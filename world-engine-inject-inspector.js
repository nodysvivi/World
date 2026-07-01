// world-engine-inject-inspector.js — Trình xem tự kiểm tra tiêm (tách rời / chỉ đọc thuần)
//
// Tại sao có module này:registerInjection() của return true chỉ đại diện cho 「gọi ST setExtensionPrompt không ném ngoại lệ」,
//   chưa bao giờ chứng minh đoạn trạng thái thế giới đó thực sự đã vào prompt cuối cùng gửi cho LLM prompt。Khách hàng 「tiêm không thành công」 không có cách nào phán đoán, chúng ta cũng không phán đoán được.
//   Module này đăng ký ST hai 「sự kiện vàng」, đọc**sau khi chúng ta tiêm ST thực sự đã ghép xong prompt chuỗi**，theo role chia xong,
//   dùng lời nói dễ hiểu để phán đoán lần tiêm vòng này:✅thành công / ❌đã đăng ký nhưng không vào phần chính / ⏸bỏ qua theo thiết kế(đã tắt or cùng tầng reroll) / —vẫn chưa tạo.
//
// Quy tắc sắt (tuyệt đối không làm bug）：
//   - Chỉ đọc thuần: chỉ đọc sự kiện eventData、ctx.extensionPrompts、core/api của getter；không ghi bất kỳ lưu trữ nào, không sửa logic tiêm, không động vào cấu trúc dữ liệu.
//   - tuyệt đối không mutate eventData（không ghi .prompt / .chat）。
//   - không giữ live tham chiếu: lập tức sao chép thành đối tượng mô tả nhẹ + sao chép chuỗi.
//   - toàn bộ handler try/catch bọc chết: cho dù ST đổi phiên bản eventData hình dạng thay đổi,throw cũng bị nuốt, tuyệt đối không ảnh hưởng đến việc tạo.
//   - chỉ giữ lại một bản snapshot cuối cùng, bộ nhớ có giới hạn.
//
// Chi phí thu hồi: xoá tệp này + xoá world-engine.js MODULES một dòng + xoá init một dòng (+ xoá UI renderDebug thẻ trên cùng + diag một đoạn).
window.WORLD_ENGINE_INJECT_INSPECTOR = (function() {
  'use strict';

  // và world-engine['js của INJECTION_NAME tương ứng'] (chúng ta đăng ký vào ST extension_prompts dùng key）。
  const INJECTION_NAME = 'world-engine-world';

  // lính gác hạ cánh:buildContext() đầu ra luôn bắt đầu bằng 「【Trạng thái thế giới】」 (world-engine-inject.js），
  //   chuỗi con này không có bất kỳ {{...}} macro, không bị ST substituteParams viết lại → Dùng nó để phán đoán 「tiêm có vào cuối cùng prompt」ổn định nhất.
  //   （Lưu ý: Dùng chuỗi tiêm hoàn chỉnh làm indexOf sẽ do {{user}} các macro bị khai triển mà dẫn đến âm tính giả, nên chỉ nhận lính canh không macro này.）
  const SENTINEL = '【Trạng thái thế giới】';

  // Tên sự kiện (literal; khi chạy ưu tiên dùng ctx['event_types hằng số của'], không lấy được thì lùi về literal).
  const EV_TEXT = 'generate_after_combine_prompts';   // Hoàn thành văn bản/Kinh điển API：eventData={prompt,dryRun}
  const EV_CHAT = 'chat_completion_prompt_ready';      // Hoàn thành hội thoại/OpenAI Loại:eventData={chat:[{role,content}],dryRun}

  let _subscribed = false;
  let _last = null;  // Chỉ giữ lại một bản snapshot cuối cùng

  function getCtx() {
    try { return (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null; }
    catch (e) { return null; }
  }

  // —— Thu thập các trường môi trường chỉ đọc tại thời điểm sự kiện (lúc này extension_prompts vẫn giữ đăng ký vòng này) ——
  function snapEnv(ctx) {
    const api = window.WORLD_ENGINE_API;
    const core = window.WORLD_ENGINE_CORE;
    let injectEnabled = true, registeredAtSend = false, sameLayerReroll = false, round = null;

    try { injectEnabled = !(api && api.getSettings && api.getSettings(true).injectIntoPrompt === false); } catch (e) {}

    // Xác nhận độc lập 「vòng này chúng ta rốt cuộc có đăng ký hay không」——Phân biệt 「đã đăng ký nhưng chưa hạ cánh=Thật bug」và 「chính chúng ta không đăng ký=bỏ qua theo thiết kế」。
    try {
      const ep = ctx && ctx.extensionPrompts;
      const entry = ep && ep[INJECTION_NAME];
      registeredAtSend = !!(entry && entry.value && String(entry.value).length);
    } catch (e) {}

    // thử lại cùng tầng roll Tiêu chí (với world-engine['js applyInjectionForCurrentRound cùng một fingerprint tiêu chuẩn']).
    try {
      const fp = core && core.loadFingerprint ? core.loadFingerprint() : '';
      const fpLayer = (fp !== '' && Number.isFinite(Number(fp))) ? Number(fp) : null;
      const chatLayer = core && core.getChatLayer ? core.getChatLayer() : null;
      sameLayerReroll = (fpLayer != null && chatLayer != null && fpLayer === chatLayer);
    } catch (e) {}

    try { round = core && core.loadState ? core.loadState().round : null; } catch (e) {}

    return { injectEnabled, registeredAtSend, sameLayerReroll, round };
  }

  // —— Hoàn thành hội thoại: Từ thật·cuối cùng chat mảng lấy role chuỗi đã chia (clone, không giữ live tham chiếu) ——
  //   Mỗi mục đều clone hoàn chỉnh content để UI khai triển chỉ đọc (người dùng cần đối chiếu toàn bộ role nội dung thực tế của, không chỉ là mục chúng ta tiêm).
  //   Chỉ giữ lại một bản snapshot cuối cùng, bộ nhớ có giới hạn;diag Phía xuất không mang theo content（Quyền riêng tư: Gồm thẻ nhân vật/Worldbook/văn bản gốc lịch sử chat).
  function snapChat(chat, env) {
    const messages = [];
    let landed = false, ourContent = '', ourIndex = -1;
    for (let i = 0; i < chat.length; i++) {
      const m = chat[i] || {};
      const content = (m.content != null) ? String(m.content) : '';
      const isOurs = content.indexOf(SENTINEL) >= 0;
      messages.push({ role: m.role || '?', length: content.length, isOurs: isOurs, content: content });
      if (isOurs && !landed) {
        landed = true;
        ourIndex = i;
        ourContent = content; // Dữ liệu trạng thái thế giới của chính chúng ta, giữ lại hoàn chỉnh
      }
    }
    return {
      apiType: 'chat',
      ts: nowTs(),
      round: env.round,
      injectEnabled: env.injectEnabled,
      registeredAtSend: env.registeredAtSend,
      sameLayerReroll: env.sameLayerReroll,
      landed: landed,
      messageCount: messages.length,
      messages: messages,
      ourIndex: ourIndex,
      ourContent: ourContent,
      status: deriveStatus(env, landed),
    };
  }

  // —— Hoàn thành văn bản:prompt Đã flatten thành chuỗi đơn, chuỗi không thể chia role；Lưu độ dài + Lính canh khớp + Trích xuất gần lính canh ——
  function snapText(prompt, env) {
    const text = String(prompt || '');
    const idx = text.indexOf(SENTINEL);
    const landed = idx >= 0;
    let excerpt = '';
    if (landed) {
      const a = Math.max(0, idx - 40);
      const b = Math.min(text.length, idx + 300);
      excerpt = (a > 0 ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : '');
    }
    return {
      apiType: 'text',
      ts: nowTs(),
      round: env.round,
      injectEnabled: env.injectEnabled,
      registeredAtSend: env.registeredAtSend,
      sameLayerReroll: env.sameLayerReroll,
      landed: landed,
      promptLength: text.length,
      ourExcerpt: excerpt,
      status: deriveStatus(env, landed),
    };
  }

  // —— Máy trạng thái: Suy diễn hoàn toàn từ trường chỉ đọc, trung thực nhất claim ——
  function deriveStatus(env, landed) {
    if (!env.injectEnabled) return 'SKIPPED_DISABLED';
    if (!env.registeredAtSend) return env.sameLayerReroll ? 'SKIPPED_REROLL' : 'SKIPPED_OTHER';
    return landed ? 'SUCCESS' : 'MISSING';
  }

  function nowTs() { try { return Date.now(); } catch (e) { return 0; } }

  // —— Xử lý sự kiện: Dùng chung bộ khung, toàn trình try/catch，dryRun Đồng loạt bỏ qua, tuyệt đối không sửa eventData ——
  function onChatPromptReady(eventData) {
    try {
      if (!eventData || eventData.dryRun) return;            // Bỏ qua tính là token vòng khởi động của
      if (!Array.isArray(eventData.chat)) return;            // Phòng thủ hình dạng
      const ctx = getCtx();
      _last = snapChat(eventData.chat, snapEnv(ctx));        // không giữ eventData['chat bản thể']
    } catch (e) { /* tự kiểm tra chỉ đọc tuyệt đối không ảnh hưởng đến việc tạo */ }
  }

  function onTextPromptReady(eventData) {
    try {
      if (!eventData || eventData.dryRun) return;
      if (typeof eventData.prompt !== 'string') return;
      const ctx = getCtx();
      _last = snapText(eventData.prompt, snapEnv(ctx));
    } catch (e) {}
  }

  // —— khởi tạo: đăng ký sự kiện vàng (thủ vệ đăng ký đơn, được gọi rõ ràng bởi điểm vào chính, tránh tình trạng chạy đua thời gian tải) ——
  function init() {
    if (_subscribed) return;
    try {
      const ctx = getCtx();
      if (!ctx || !ctx.eventSource || typeof ctx.eventSource.on !== 'function') {
        console.warn('[World Engine] tự kiểm tra tiêm:eventSource không khả dụng, bỏ qua đăng ký');
        return;
      }
      const et = ctx.event_types || {};
      ctx.eventSource.on(et.CHAT_COMPLETION_PROMPT_READY || EV_CHAT, onChatPromptReady);
      ctx.eventSource.on(et.GENERATE_AFTER_COMBINE_PROMPTS || EV_TEXT, onTextPromptReady);
      _subscribed = true;
      console.log('[World Engine] trình xem tự kiểm tra tiêm đã sẵn sàng (đăng ký chỉ đọc prompt-ready sự kiện)');
    } catch (e) {
      console.warn('[World Engine] đăng ký tự kiểm tra tiêm thất bại (không nghiêm trọng):', e && e.message);
    }
  }

  // trả về bản chụp cuối cùng (tham chiếu bản sao chỉ đọc;UI/diag chỉ đọc không ghi). Nếu không có thì null。
  function getLastSnapshot() { return _last; }

  // mã trạng thái → Nói dễ hiểu (UI và diag dùng chung, nguồn sự thật duy nhất).
  const STATUS_TEXT = {
    NOT_YET: 'chưa tạo, tạm không có bản ghi tiêm',
    SKIPPED_DISABLED: 'Vòng này không tiêm: tiêm văn bản chính đã tắt (phích cắm/cài đặt)',
    SKIPPED_REROLL: 'Vòng này không tiêm theo thiết kế: cùng tầng reroll roll（swipe/tạo lại)',
    SKIPPED_OTHER: 'Vòng này không tiêm: chưa kích hoạt suy diễn hoặc không có trạng thái thế giới',
    SUCCESS: '✅ Trạng thái thế giới vòng này đã vào văn bản chính',
    MISSING: '❌ đã đăng ký nhưng không vào cuối cùng prompt——Đây mới là tiêm thất bại thực sự (nghi ngờ bị extension khác xoá/vượt quá độ sâu)',
  };
  function statusText(status) { return STATUS_TEXT[status] || STATUS_TEXT.NOT_YET; }

  return { init, getLastSnapshot, statusText, SENTINEL };
})();
