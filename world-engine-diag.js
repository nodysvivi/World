// world-engine-diag.js — Gói chẩn đoán (xuất nhanh trạng thái chạy để gỡ lỗi)
// [FIX] Module thuần chỉ đọc: chỉ gọi các module đã expose getter trạng thái tổng hợp, không sửa bất kỳ logic hiện có nào, không ghi lưu trữ, không chạm vào cấu trúc dữ liệu.
//   xuất { collect, download }；UI gọi bằng một nút trong khu vực gỡ lỗi download() là được.
//   Chi phí thu hồi: xoá tệp này + xoá world-engine.js MODULES một dòng trong + xoá UI nút và sự kiện.
window.WORLD_ENGINE_DIAG = (function() {

  // Thực thi an toàn: bất kỳ block nào ném lỗi/thiếu module đều không ảnh hưởng tổng thể, ghi là { error }
  function safe(fn) {
    try {
      const v = fn();
      return v === undefined ? null : v;
    } catch (e) {
      return { error: String(e && e.message || e) };
    }
  }

  // Cài đặt che giấu:apiKey tuyệt đối không rò rỉ;apiUrl chỉ báo đã điền hay chưa (host không rò rỉ); phần còn lại giữ nguyên
  function sanitizeSettings(s) {
    if (!s || typeof s !== 'object') return s;
    const out = {};
    for (const k in s) {
      if (k === 'apiKey') {
        const v = s[k];
        out[k] = (v && String(v).length) ? ('***đã cài đặt(len=' + String(v).length + ')') : '(trống)';
      } else if (k === 'apiUrl') {
        out[k] = (s[k] && String(s[k]).length) ? '(đã điền)' : '(trống)';
      } else {
        out[k] = s[k];
      }
    }
    return out;
  }

  // thống kê trong chat user / ai số lượng
  function countChat(chat) {
    let user = 0, ai = 0;
    for (let i = 0; i < chat.length; i++) {
      const m = chat[i];
      if (!m) continue;
      if (m.is_user) user++; else ai++;
    }
    return { total: chat.length, user, ai };
  }

  function collect() {
    const core = window.WORLD_ENGINE_CORE;
    const api = window.WORLD_ENGINE_API;
    const store = window.WORLD_ENGINE_STORE;
    const evo = window.WORLD_ENGINE_EVOLUTION;
    const chatcache = window.WORLD_ENGINE_CHATCACHE;
    const worldbook = window.WORLD_ENGINE_WORLDBOOK;
    const rules = window.WORLD_ENGINE_RULES;
    const preset = window.WORLD_ENGINE_PRESET;
    const inspector = window.WORLD_ENGINE_INJECT_INSPECTOR;

    const diag = {};

    // —— thông tin meta ——
    diag.meta = safe(function () {
      return {
        extVersion: window.WORLD_ENGINE_VERSION || 'không rõ (chưa đọc được manifest phiên bản)',
        collectedAt: new Date().toISOString(),
        userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || 'không rõ'
      };
    });

    // —— môi trường chạy ——
    diag.env = safe(function () {
      const ctx = SillyTavern.getContext();
      const chat = (ctx && ctx.chat) || [];
      return {
        chatId: (ctx && ctx.chatId) || null,
        chat: countChat(chat),
        name1: (ctx && ctx.name1) || null,
        name2: (ctx && ctx.name2) || null,
        characterId: (ctx && ctx.characterId != null) ? ctx.characterId : null,
        hasChatMetadata: !!(ctx && ctx.chatMetadata),
        tavernApi: {
          updateChatMetadata: !!(ctx && typeof ctx.updateChatMetadata === 'function'),
          saveMetadataDebounced: !!(ctx && typeof ctx.saveMetadataDebounced === 'function'),
          saveMetadata: !!(ctx && typeof ctx.saveMetadata === 'function'),
          saveChat: !!(ctx && typeof ctx.saveChat === 'function')
        }
      };
    });

    // —— cài đặt (che giấu)——
    diag.settings = safe(function () {
      if (!api || !api.getSettings) return { error: 'api module không khả dụng' };
      return sanitizeSettings(api.getSettings(true));
    });

    // —— Tóm tắt trạng thái thế giới ——
    diag.worldState = safe(function () {
      if (!core || !core.loadState) return { error: 'core module không khả dụng' };
      const st = core.loadState() || {};
      const len = function (a) { return Array.isArray(a) ? a.length : 0; };
      return {
        round: st.round,
        chatLayer: st.chatLayer,
        worldDigestLen: (st.worldDigest || '').length,
        counts: {
          events: len(st.events),
          factions: len(st.factions),
          winds: len(st.winds),
          worldTrends: len(st.worldTrends),
          memories: len(st.memories),
          enemies: len(st.enemies),
          influenceChain: len(st.influenceChain),
          economySignals: len(st.economy && st.economy.signals),
          secretActions: len(st.blackbox && st.blackbox.secretActions),
          secretAssets: len(st.blackbox && st.blackbox.secretAssets)
        },
        regionalIncidentActive: !!(st.regionalIncident && st.regionalIncident.active),
        hasLastInjection: !!st.lastInjection,
        hasLastEvolveResult: !!st.lastEvolveResult,
        hasState: core.hasState ? core.hasState() : null
      };
    });

    // —— điểm lưu ——
    diag.checkpoint = safe(function () {
      if (!core || !core.restoreCheckpoint) return { error: 'core module không khả dụng' };
      const cp = core.restoreCheckpoint();
      if (!cp) return { exists: false };
      return { exists: true, round: cp.round, chatLayer: cp.chatLayer };
    });

    // —— vân tay / số tầng ——
    diag.fingerprint = safe(function () {
      if (!core) return { error: 'core module không khả dụng' };
      return {
        fingerprint: core.loadFingerprint ? core.loadFingerprint() : null,
        chatLayer: core.getChatLayer ? core.getChatLayer() : null,
        isNewRound: core.isNewRound ? core.isNewRound() : null,
        lastStoryDay: core.getLastStoryDay ? core.getLastStoryDay() : null,
        anchorLayer: core.getAnchorLayer ? core.getAnchorLayer() : null
      };
    });

    // —— Trạng thái suy diễn (gồm hoàn chỉnh prompt / trả về gốc, người dùng đã đồng ý bao gồm văn bản hội thoại gốc)——
    diag.evolution = safe(function () {
      if (!evo) return { error: 'evolution module không khả dụng' };
      const dbg = evo.getLastDebug ? evo.getLastDebug() : {};
      // [FIX] thu thập bổ sung PR#12 của prompt Cấu trúc phân đoạn: chỉ lưu key/label/độ dài, không lưu lặp lại văn bản hoàn chỉnh
      //   （nội dung hoàn chỉnh đã có trong lastPrompt；phân đoạn dùng để đối chiếu đoạn nào bị preset ghi đè, tỷ lệ các đoạn).
      const segs = (dbg && Array.isArray(dbg.segments)) ? dbg.segments : [];
      return {
        isRunning: evo.isRunning ? evo.isRunning() : null,
        lastError: evo.getLastError ? evo.getLastError() : null,
        lastPrompt: (dbg && dbg.prompt) || '',
        lastRawResult: (dbg && dbg.rawResult) || '',
        lastPromptLen: ((dbg && dbg.prompt) || '').length,
        lastRawResultLen: ((dbg && dbg.rawResult) || '').length,
        segmentCount: segs.length,
        segments: segs.map(function (s) {
          return { key: (s && s.key) || null, label: (s && s.label) || null, contentLen: ((s && s.content) || '').length };
        })
      };
    });

    // —— cache Tavern ——
    diag.chatcache = safe(function () {
      if (!chatcache || !chatcache.getStatus) return { error: 'chatcache module không khả dụng' };
      const status = chatcache.getStatus();
      const snaps = chatcache.listSnapshots ? chatcache.listSnapshots() : [];
      return {
        status: status,
        snapshots: snaps.map(function (s) {
          return { id: s.id, name: s.name, auto: !!s.auto, round: s.round, createdAt: s.createdAt, v: s.v };
        })
      };
    });

    // —— Worldbook ——
    diag.worldbook = safe(function () {
      if (!worldbook) return { error: 'worldbook module không khả dụng' };
      const ids = worldbook.getSelectedIds ? worldbook.getSelectedIds() : [];
      return {
        selectedCount: Array.isArray(ids) ? ids.length : 0,
        hasSelection: worldbook.hasSelection ? worldbook.hasSelection() : null,
        triggerEnabled: worldbook.triggerEnabled ? worldbook.triggerEnabled() : null
      };
    });

    // —— Key lưu trữ (chỉ key tên, không xuất value：tránh rò rỉ và phình to kích thước)——
    diag.store = safe(function () {
      if (!store || !store.keys) return { error: 'store module không khả dụng' };
      const keys = store.keys();
      return { count: keys.length, keys: keys };
    });

    // —— quy tắc ——
    diag.rules = safe(function () {
      if (!rules || !rules.getRuleCount) return { error: 'rules module không khả dụng' };
      return { ruleCount: rules.getRuleCount() };
    });

    // —— preset engine (PR#13 đưa vào; gói chẩn đoán trước đó chưa thu thập——khi gỡ lỗi không thấy được preset hiện tại và đoạn ghi đè)——
    diag.preset = safe(function () {
      if (!preset) return { error: 'preset module không khả dụng' };
      const active = preset.getActivePreset ? preset.getActivePreset() : null;
      const overridden = preset.getOverriddenSegKeys ? preset.getOverriddenSegKeys() : [];
      const custom = preset.getCustomPresets ? preset.getCustomPresets() : [];
      const all = preset.getAllPresets ? preset.getAllPresets() : [];
      return {
        activeId: preset.getActivePresetId ? preset.getActivePresetId() : null,
        activeName: (active && (active.name || active.id)) || null,
        activeIsBuiltin: !!(active && active.builtin),
        overriddenSegKeys: Array.isArray(overridden) ? overridden.slice() : [],
        overriddenCount: Array.isArray(overridden) ? overridden.length : 0,
        presetCount: Array.isArray(all) ? all.length : 0,
        customPresetCount: Array.isArray(custom) ? custom.length : 0,
        // chỉ liệt kê id+name+builtin，Không xuất toàn bộ đoạn văn bản (tránh phình dung lượng và rò rỉ tiềm ẩn)
        customPresetList: Array.isArray(custom) ? custom.map(function (p) {
          return { id: (p && p.id) || null, name: (p && p.name) || null, builtin: !!(p && p.builtin) };
        }) : []
      };
    });

    // —— Tiêm snapshot tự kiểm tra (tách rời module chỉ đọc; khi gỡ lỗi có thể xem trực tiếp trạng thái thế giới vòng trước có thực sự vào cuối cùng không prompt）——
    //   Khi khách hàng báo "tiêm thất bại", ở đây có thể phân biệt SUCCESS / MISSING（thất bại thật)/ SKIPPED_*（bỏ qua theo thiết kế/tự tắt).
    diag.injectInspector = safe(function () {
      if (!inspector || !inspector.getLastSnapshot) return { error: 'inspector module không khả dụng' };
      const snap = inspector.getLastSnapshot();
      if (!snap) return { hasSnapshot: false, status: 'NOT_YET' };
      const out = {
        hasSnapshot: true,
        status: snap.status,
        statusText: inspector.statusText ? inspector.statusText(snap.status) : null,
        apiType: snap.apiType,
        round: snap.round,
        ts: snap.ts,
        injectEnabled: snap.injectEnabled,
        registeredAtSend: snap.registeredAtSend,
        sameLayerReroll: snap.sameLayerReroll,
        landed: snap.landed
      };
      if (snap.apiType === 'chat') {
        out.messageCount = snap.messageCount;
        out.ourIndex = snap.ourIndex;
        out.ourContentLen = (snap.ourContent || '').length;
        // role chuỗi chỉ báo role+độ dài+isOurs，Không xuất nội dung chính (tránh phình dung lượng và rò rỉ ngữ cảnh chat)
        out.roleChain = Array.isArray(snap.messages)
          ? snap.messages.map(function (m) { return { role: m.role, length: m.length, isOurs: !!m.isOurs }; })
          : [];
      } else {
        out.promptLength = snap.promptLength;
        out.ourExcerptLen = (snap.ourExcerpt || '').length;
      }
      return out;
    });

    // —— Chẩn đoán regex lọc (tái sử dụng core.validateFilterRegex：hỗ trợ /pat/flags và thuần pattern hai cách viết)——
    //   Khi gỡ lỗi không cần đoán regex người dùng điền có hiệu lực hay không——Ở đây báo từng dòng hợp lệ/mục không hợp lệ và lý do.
    diag.filterRegex = safe(function () {
      if (!core || !core.validateFilterRegex) return { error: 'core.validateFilterRegex không khả dụng' };
      const s = (api && api.getSettings) ? api.getSettings(true) : {};
      let raw = '';
      try { raw = s && s.evolveFilterRegex ? String(s.evolveFilterRegex) : ''; } catch (e) { raw = ''; }
      const v = core.validateFilterRegex(raw);
      return {
        rawTextLength: raw.length,
        rawLineCount: raw ? raw.split('\n').length : 0,
        nonEmptyCount: v.ok + v.bad.length,
        validCount: v.ok,
        invalidCount: v.bad.length,
        // Mục không hợp lệ báo nguyên trạng lý do;raw đã ở validateFilterRegex cắt bớt trong 60 chữ
        invalidList: v.bad,
        // Mục hợp lệ chỉ báo line + flags（không lặp lại pattern，tránh phình dung lượng)
        validList: v.entries.map(function (e) { return { line: e.line, flags: e.flags }; }),
        // raw cắt bớt xem trước 200，tiện nhìn thoáng qua biết người dùng đã điền gì
        rawPreview: raw.slice(0, 200)
      };
    });

    return diag;
  }

  // Tải gói chẩn đoán dưới dạng JSON tệp
  function download() {
    const diag = collect();
    const content = JSON.stringify(diag, null, 2);
    let chatId = 'unknown';
    try {
      const ctx = SillyTavern.getContext();
      if (ctx && ctx.chatId) chatId = String(ctx.chatId).replace(/[^\w.-]+/g, '_').slice(0, 40);
    } catch (e) {}
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world-engine-diag-' + chatId + '-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return content;
  }

  return { collect, download };
})();
