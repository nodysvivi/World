// world-engine.js — Điểm vào chính: tải module, bind sự kiện, tiêm suy diễn
(function() {
  if (window.__WORLD_ENGINE_LOADED__) return;
  window.__WORLD_ENGINE_LOADED__ = true;

  const MODULES = [
    'world-engine-store.js',
    'world-engine-preset.js',       // ← Thêm mới: hệ thống preset engine (ngay sau store，ở evolution trước; tham chiếu lúc runtime evolution đoạn mặc định)
    'world-engine-core.js',
    'world-engine-api.js',
    'world-engine-rules-loader.js',
    'world-engine-worldbook.js',
    'world-engine-chatcache.js',
    'world-engine-ledger.js',
    'world-engine-evolution.js',
    'world-engine-inject.js',
    'world-engine-inject-inspector.js', // ← Thêm mới: trình xem tự kiểm tra tiêm (tách rời/chỉ đọc, đăng ký prompt-ready sự kiện đối chiếu xem tiêm có thực sự vào văn bản chính không)
    'world-engine-diag.js',
    'world-engine-ui.js'
  ];

  function getBaseUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('world-engine.js')) {
        return src.substring(0, src.lastIndexOf('/'));
      }
    }
    return './plugins/world-engine';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Tải thất bại: ' + src));
      document.head.appendChild(s);
    });
  }

  async function init() {
    const baseUrl = getBaseUrl();
    console.log('[World Engine] Đang tải...');

    try {
      for (const mod of MODULES) {
        await loadScript(baseUrl + '/' + mod);
        console.log('[World Engine] Đã tải:', mod);
      }

      // Đọc số phiên bản extension (từ manifest.json，nguồn sự thật duy nhất) cho UI hiển thị; thất bại không chặn khởi động
      try {
        const resp = await fetch(baseUrl + '/manifest.json', { cache: 'no-cache' });
        if (resp && resp.ok) {
          const mf = await resp.json();
          if (mf && mf.version) window.WORLD_ENGINE_VERSION = String(mf.version);
        }
      } catch (e) { /* Không đọc được số phiên bản không ảnh hưởng chức năng,UI phía client tự động hạ cấp ẩn đi */ }

      // Trước tiên nạp lưu trữ vào bản sao bộ nhớ (và di chuyển cũ localStorage bản lưu), sau đó mọi đọc ghi đồng bộ mới có dữ liệu
      if (window.WORLD_ENGINE_STORE) {
        await window.WORLD_ENGINE_STORE.hydrate();
      }

      // Cache Tavern: cài đặt xong khe đồng bộ và thực hiện khôi phục một lần cho chat hiện tại/Hội tụ (phải trước lần tiêm văn bản chính đầu tiên, tiêm mới dùng được trạng thái đã đồng bộ)
      if (window.WORLD_ENGINE_CHATCACHE) {
        window.WORLD_ENGINE_CHATCACHE.init();
      }

      // Trình xem tự kiểm tra tiêm: đăng ký chỉ đọc ST prompt-ready sự kiện, đối chiếu xem trạng thái thế giới có thực sự vào cuối cùng không prompt（tách rời, đăng ký thất bại không chặn khởi động)
      if (window.WORLD_ENGINE_INJECT_INSPECTOR) {
        try { window.WORLD_ENGINE_INJECT_INSPECTOR.init(); } catch (e) { console.warn('[World Engine] Khởi tạo tự kiểm tra tiêm thất bại (không nghiêm trọng)', e); }
      }

      const core = window.WORLD_ENGINE_CORE;
      const api = window.WORLD_ENGINE_API;
      const ledger = window.WORLD_ENGINE_LEDGER;
      const evolution = window.WORLD_ENGINE_EVOLUTION;
      const inject = window.WORLD_ENGINE_INJECT;
      const ui = window.WORLD_ENGINE_UI;
      const rulesLoader = window.WORLD_ENGINE_RULES;

      // Tải toàn bộ quy tắc engine sống (quy tắc đã tích hợp sẵn trong JS , không cần request mạng)
      let rulesCount = 0;
      try {
        const result = await rulesLoader.loadRules();
        rulesCount = result.count || 0;
        console.log('[World Engine] 📜 Quy tắc engine sống đã sẵn sàng, tổng cộng', rulesCount, 'điều');
      } catch(e) {
        console.warn('[World Engine] Tải quy tắc bất thường (không nghiêm trọng):', e.message);
      }

      let isEvolving = false;
      let autoEvolveTimer = null;
      let lastProcessedMessageKey = '';
      const AUTO_EVOLVE_DELAY = 1500;

      // ========== Quản lý tiêm ==========
      const INJECTION_NAME = 'world-engine-world';

      // injection_position=1 là In-Chat（chèn vào luồng chat),depth=1 là vị trí ngay trước tin nhắn người dùng
      // với preset JSON trong injection_position:1 / injection_depth:1 tương ứng
      const INJ_POSITION = 1;
      const INJ_DEPTH = 1;

      function registerInjection(content) {
        try {
          const ctx = SillyTavern.getContext();
          if (typeof ctx.setExtensionPrompt === 'function') {
            ctx.setExtensionPrompt(INJECTION_NAME, content, INJ_POSITION, INJ_DEPTH);
            return true;
          }
          if (typeof ctx.registerInjection === 'function') {
            if (typeof ctx.unregisterInjection === 'function') {
              ctx.unregisterInjection(INJECTION_NAME);
            }
            ctx.registerInjection(INJECTION_NAME, content, { position: INJ_POSITION, depth: INJ_DEPTH, role: 'system' });
            return true;
          }
          if (Array.isArray(ctx.extensionPrompts)) {
            ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
            ctx.extensionPrompts.push({
              name: INJECTION_NAME, content,
              role: 'system', position: INJ_POSITION, depth: INJ_DEPTH
            });
            return true;
          }
          console.warn('[World Engine] Tất cả phương thức tiêm đều không khả dụng');
          return false;
        } catch(e) {
          console.error('[World Engine] Tiêm thất bại', e);
          return false;
        }
      }

      function unregisterInjection() {
        try {
          const ctx = SillyTavern.getContext();
          if (typeof ctx.setExtensionPrompt === 'function') {
            ctx.setExtensionPrompt(INJECTION_NAME, '', INJ_POSITION, INJ_DEPTH); // Xoá nội dung tức là huỷ tiêm
          } else if (typeof ctx.unregisterInjection === 'function') {
            ctx.unregisterInjection(INJECTION_NAME);
          } else if (Array.isArray(ctx.extensionPrompts)) {
            ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
          }
        } catch(e) {}
      }

      // ========== Tiêm trạng thái thế giới vào văn bản chính prompt ==========
      // stateOverride: Nếu truyền vào thì dùng trạng thái đó (khi reroll roll dùng điểm lưu), nếu không thì dùng trạng thái hiện tại
      function applyInjection(stateOverride) {
        try {
          if (api.getSettings(true).injectIntoPrompt === false) {
            unregisterInjection();
            console.log('[World Engine] Tiêm văn bản chính đã bị tắt trong cài đặt');
            return;
          }
          const ctx = SillyTavern.getContext();
          if (!ctx) return;
          const state = stateOverride || core.loadState();
          const currentRound = state.round;

          const chatHistory = ctx.chat || [];
          const recentChat = chatHistory.slice(-5);
          const recent = recentChat.map(m => (m.mes || '')).join(' ');

          const tags = [];
          const namePattern = /([\p{L}]{2,4}(?:\s[\p{L}]{2,4}){0,2})\s(?:nói|đạo|giảng|hỏi|đáp)\b/gu;
          let m;
          while ((m = namePattern.exec(recent)) !== null) {
            if (!['cái gì','thế nào','cái này','cái kia','không có','có thể','biết','nhưng','bởi vì','cho nên'].includes(m[1])) {
              tags.push(m[1]);
            }
          }
          for (const ev of state.events || []) tags.push(ev.name);
          for (const f of state.factions || []) tags.push(f.name);

          const context = inject.buildContext(state, tags);

          // chỉ ghi lại khi sử dụng trạng thái hiện tại (trạng thái điểm lưu không nên bị ghi đè)
          if (!stateOverride && core.hasState()) {
            state.lastInjection = { timestamp: Date.now(), round: currentRound, context, tagsUsed: tags };
            core.saveState(state);
          }

          registerInjection(context);
          console.log(`[World Engine] tiêm hoàn tất (round ${currentRound}, ${context.length} chars)${stateOverride ? ' [điểm lưu]' : ''}`);
        } catch(e) {
          console.error('[World Engine] xử lý tiêm thất bại', e);
        }
      }

      // trước khi lắp ráp văn bản chính, "chọn tiêm trạng thái thế giới nào":
      //   reroll roll（Tavern type=swipe/regenerate，do bên gọi truyền vào opts.isReroll）→ tiêm điểm lưu (trạng thái trước khi tạo ra văn bản chính của tầng này);
      //   xoá ngược về tầng cũ (chatLayer < state.chatLayer）→ tiêm điểm lưu;
      //   nếu không thì (tạo mới/vòng mới/viết tiếp)→ tiêm trạng thái hiện tại.
      function applyInjectionForCurrentRound(opts) {
        const state = core.loadState();
        const chatLayer = core.getChatLayer();
        const isReroll = !!(opts && opts.isReroll);

        // [FIX v2.3.19] reroll roll tiêu chí chuyển sang dùng nguyên bản của Tavern type（swipe/regenerate），không dùng nữa chatLayer===state.chatLayer giá trị.
        //   v2.3.18 tiêu chí giá trị thuần tuý của có hồi quy:GENERATION_STARTED ở tầng người dùng push vào chat **trước khi** emit，khi gửi tin nhắn vòng mới
        //   chatLayer vẫn == vòng trước state.chatLayer，bị đánh giá nhầm thành reroll roll、đã tiêm điểm lưu (người dùng 「không reroll roll nhưng lại tiêm trạng thái cũ」).
        //   reroll thực sự đáng tin cậy roll tín hiệu là Tavern GENERATION_STARTED của type tham số (swipe/regenerate），xem onGenerationStarted。
        if (isReroll) {
          const checkpoint = core.restoreCheckpoint();
          if (checkpoint) {
            console.log('[World Engine] đánh giá tiêm văn bản chính: reroll roll（type=swipe/regenerate），tiêm điểm lưu');
            applyInjection(checkpoint);
            if (ui && ui.setInjectedScope) ui.setInjectedScope('checkpoint');
          } else {
            console.log('[World Engine] đánh giá tiêm văn bản chính: reroll roll（type=swipe/regenerate），không có điểm lưu, không tiêm');
            unregisterInjection();
          }
          if (ui && ui.refresh) ui.refresh(true);
          return;
        }

        const stateLayer = Number.isFinite(Number(state.chatLayer)) ? Number(state.chatLayer) : chatLayer;
        let injectedScope = 'state';
        if (chatLayer < stateLayer) {
          const checkpoint = core.restoreCheckpoint();
          if (checkpoint) {
            injectedScope = 'checkpoint';
            console.log(`[World Engine] đánh giá tiêm văn bản chính: số tầng hội thoại ${chatLayer} < số tầng trạng thái hiện tại ${stateLayer}，tiêm điểm lưu`);
            applyInjection(checkpoint);
          } else {
            console.warn(`[World Engine] đánh giá tiêm văn bản chính: số tầng hội thoại ${chatLayer} < số tầng trạng thái hiện tại ${stateLayer}，nhưng không có điểm lưu, lùi về trạng thái hiện tại`);
            applyInjection();
          }
        } else {
          console.log(`[World Engine] đánh giá tiêm văn bản chính: số tầng hội thoại ${chatLayer} >= số tầng trạng thái hiện tại ${stateLayer}，tiêm trạng thái hiện tại`);
          applyInjection();
        }
        // Sau khi tiêm vào phần thân, làm mới bảng điều khiển để 「trạng thái hiện tại」 theo sát bản thực tế được tiêm:
        // reroll roll / xoá tầng cũ về trước → hiển thị điểm lưu; nếu không thì → hiển thị trạng thái hiện tại.
        if (ui && ui.setInjectedScope) ui.setInjectedScope(injectedScope);
        if (ui && ui.refresh) ui.refresh(true);
      }

      // ========== Sau khi nhận được phản hồi hoàn chỉnh: suy diễn thế giới + ghi lại sổ cái ==========
      function getMessageKey(ctx, chat, message) {
        const messageId = message?.mesId ?? message?.message_id ?? message?.send_date ?? (chat.length - 1);
        const swipeId = message?.swipe_id ?? message?.swipeId ?? '';
        return [core.getChatId(), chat.length - 1, messageId, swipeId].join('|');
      }

      function clearAutoEvolveTimer() {
        if (autoEvolveTimer) {
          clearTimeout(autoEvolveTimer);
          autoEvolveTimer = null;
        }
      }

      function onMessageReceived() {
        clearAutoEvolveTimer();

        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        const lastMsg = chat[chat.length - 1];
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '').trim() : '';
        if (!ctx || chat.length <= 2 || !lastMsg || lastMsg.is_user || !aiMsg) return;

        const messageKey = getMessageKey(ctx, chat, lastMsg);
        autoEvolveTimer = setTimeout(
          () => runAutoEvolution(messageKey, aiMsg),
          AUTO_EVOLVE_DELAY
        );
      }

      async function runAutoEvolution(expectedKey, expectedText) {
        autoEvolveTimer = null;
        if (isEvolving || lastProcessedMessageKey === expectedKey) return;
        // Đã có suy diễn (như kích hoạt thủ công) đang chạy: bỏ qua lần suy diễn tự động này, tránh evolve() do busy trả về false bị báo cáo nhầm là 「suy diễn thất bại」
        if (evolution.isRunning && evolution.isRunning()) return;

        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        const lastMsg = chat[chat.length - 1];
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '').trim() : '';
        if (!ctx || !lastMsg || lastMsg.is_user || !aiMsg) return;

        const currentKey = getMessageKey(ctx, chat, lastMsg);
        if (currentKey !== expectedKey) return;
        if (aiMsg !== expectedText) {
          onMessageReceived();
          return;
        }

        // ===== Chế độ suy diễn và đếm: quyết định tin nhắn này có tự động suy diễn hay không =====
        const settings = api.getSettings(true);
        if (settings.evolveMode === 'manual') {
          // Chế độ thủ công: chỉ được kích hoạt bởi nút 「suy diễn thủ công」, ở đây không thực hiện bất kỳ suy diễn tự động nào
          lastProcessedMessageKey = currentKey;
          return;
        }
        const everyX = Math.max(1, parseInt(settings.evolveEveryX) || 1);
        let timeStoryDay = null;   // không phải null = chế độ theo thời gian, suy diễn xong ghi lại state.time
        let timeReadRounds = null; // Chế độ thời gian: số vòng đọc lần này (min(số vòng đã qua, giới hạn trên X)）

        if (settings.evolveMode === 'time') {
          // Tiền đề:state.time và checkpoint['time phải có cả hai']
          const st = core.hasState() ? core.loadState() : null;
          const cp = core.restoreCheckpoint();
          if (!st || st.time == null || !cp || cp.time == null) {
            lastProcessedMessageKey = currentKey;
            setStatus('Thời gian điểm lưu và trạng thái hiện tại trống, vui lòng điền trong cài đặt', false);
            if (ui) ui.refresh(true);
            return;
          }
          const currentDay = core.parseStoryDay(aiMsg, settings);
          if (currentDay == null) {
            core.setLastStoryDay(null);
            lastProcessedMessageKey = currentKey;
            setStatus('chưa lấy được thời gian', false);
            if (ui) ui.refresh(true);
            return;
          }
          core.setLastStoryDay(currentDay);
          const isNew = core.isNewRound();
          const base = isNew ? Number(st.time) : Number(cp.time);   // reroll roll → so với điểm lưu
          const threshold = Math.max(1, parseInt(settings.evolveTimeThreshold) || 1);
          const delta = currentDay - base;
          if (delta < threshold) {
            lastProcessedMessageKey = currentKey;
            setStatus(`thứ ${Math.max(0, delta)}/${threshold} ngày, chưa đến lúc suy diễn`);
            if (ui) ui.refresh(true);
            return;
          }
          timeStoryDay = currentDay;
          // Số vòng đã qua kể từ lần suy diễn trước (điểm neo tầng: tầng điểm lưu → tầng trạng thái hiện tại → tầng hiện tại), và giới hạn trên X lấy giá trị nhỏ hơn
          const Xmax = Math.max(1, parseInt(settings.evolveTimeMaxRounds) || 10);
          const Lnow = core.getChatLayer();
          let anchorL = (cp && cp.chatLayer != null) ? Number(cp.chatLayer)
                      : (st && st.chatLayer != null ? Number(st.chatLayer) : Lnow);
          if (!Number.isFinite(anchorL)) anchorL = Lnow;
          const since = Math.floor(Math.max(0, Lnow - anchorL) / 2);
          timeReadRounds = Math.max(1, Math.min(since, Xmax));
        } else {
          const L = core.getChatLayer();
          const cp = core.restoreCheckpoint();
          const storedState = core.hasState() ? core.loadState() : null;
          let anchor = null;
          if (cp && cp.chatLayer != null) {
            anchor = Number(cp.chatLayer);
          } else if (storedState && storedState.chatLayer != null && Number.isFinite(Number(storedState.chatLayer))) {
            anchor = Number(storedState.chatLayer);
          } else if (core.loadFingerprint() !== '') {
            anchor = Number(core.loadFingerprint());
          }
          // [FIX] fallback 3 cấp đều trống = Chat này chưa từng được suy diễn (vỏ rỗng state + không có điểm lưu + không có vân tay).
          //   fallback logic cũ anchor=L dẫn đến c=0 deadlock vĩnh viễn (xem onChatLoaded đối với vỏ rỗng state không còn ghim chatLayer thay đổi đi kèm của);
          //   đổi thành nhận định chưa từng suy diễn,anchor=-1 để c>0 kích hoạt suy diễn lần đầu. Sau khi suy diễn thành công evolution ghi bình thường fingerprint，các vòng tiếp theo đi theo điểm neo bình thường.
          if (!Number.isFinite(anchor)) anchor = -1;
          const c = Math.floor(Math.max(0, L - anchor) / 2);
          const doEvolve = c > 0 && c % everyX === 0;

          if (!doEvolve) {
            lastProcessedMessageKey = currentKey;
            const pos = c % everyX || (c === 0 ? 0 : everyX);
            setStatus(`thứ ${pos}/${everyX} vòng, chưa đến lúc suy diễn`);
            if (ui) ui.refresh(true);
            return;
          }
        }

        const ok = await performEvolution(aiMsg, chat, timeStoryDay, timeReadRounds);
        if (ok) lastProcessedMessageKey = currentKey;
      }

      function setStatus(text, isErr) {
        if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus(text, !!isErr);
      }

      // thực thi một lần suy diễn (tự động theo vòng / theo thời gian / thời gian điền tay trên trang cài đặt dùng chung).
      // storyDay không phải null → Ghi lại sau khi suy diễn thành công state.time（theo chế độ thời gian).
      async function performEvolution(aiMsg, chat, storyDay, readRoundsOverride) {
        isEvolving = true;
        try {
          const state = core.loadState();
          const isNewRound = core.isNewRound();
          setStatus('Đang suy diễn...');
          // Hiển thị cơ sở theo isNewRound：vòng mới→Trạng thái hiện tại, reroll roll→điểm lưu
          if (ui && ui.setEvolvingUI) ui.setEvolvingUI(true, isNewRound ? 'state' : 'checkpoint');
          if (ui && ui.refresh) ui.refresh(true);

          // Lấy hội thoại đưa vào nền; chế độ thời gian do bên gọi truyền vào số vòng đọc, chế độ theo vòng dùng a（Giới hạn đến X）。start Bảo vệ số âm
          const settings = api.getSettings(true);
          let readRounds;
          if (readRoundsOverride != null) {
            readRounds = Math.max(1, parseInt(readRoundsOverride) || 1);
          } else {
            readRounds = Math.max(1, parseInt(settings.evolveReadRounds) || 1);
            if (settings.evolveMode === 'auto') {
              readRounds = Math.min(Math.max(1, parseInt(settings.evolveEveryX) || 1), readRounds);
            }
          }
          const start = Math.max(0, chat.length - readRounds * 2);
          const dialogueText = chat.slice(start)
            .map(m => (m.is_user ? 'Người dùng' : 'AI') + '：' + core.filterDialogue((m.mes || '').trim(), settings))
            .filter(line => line.length > 3)
            .join('\n');

          const success = await evolution.evolve(state, '', aiMsg, { dialogueText });
          if (success) {
            ledger.recordChanges(state);
            if (storyDay != null) { state.time = Number(storyDay); core.saveState(state); }
            // reroll roll khi nội dung chính đã được tiêm vào điểm lưu theo tầng, sau khi suy diễn hoàn tất không ghi đè
            if (isNewRound) applyInjection();
            console.log('[World Engine] ✅ Suy diễn hoàn tất, hiện tại thứ', state.round, 'vòng');
          } else {
            console.warn('[World Engine] ⚠️ Suy diễn thất bại hoặc đã huỷ bỏ');
          }
          const reason = !success && evolution.getLastError ? evolution.getLastError() : '';
          setStatus(success ? 'Suy diễn hoàn tất' : (reason ? 'Suy diễn thất bại:' + reason : 'Suy diễn thất bại hoặc đã huỷ bỏ'), !success);
          return success;
        } catch(e) {
          console.error('[World Engine] Xử lý thất bại', e);
          setStatus('Suy diễn bất thường: ' + e.message, true);
          return false;
        } finally {
          isEvolving = false;
          if (ui) { ui.setEvolvingUI(false); ui.refresh(true); }
        }
      }

      // Sau khi điền thủ công và lưu 'Thời gian hội thoại vòng này' ở trang cài đặt: kiểm tra xem có đủ thời gian không, đủ thì suy diễn.
      async function manualTimeEvolve(currentDay) {
        if (currentDay == null || isEvolving) return;
        if (evolution.isRunning && evolution.isRunning()) { setStatus('Đã có suy diễn đang chạy...'); return; }
        const settings = api.getSettings(true);
        const st = core.hasState() ? core.loadState() : null;
        const cp = core.restoreCheckpoint();
        if (!st || st.time == null || !cp || cp.time == null) {
          setStatus('Thời gian điểm lưu và trạng thái hiện tại trống, vui lòng điền trong cài đặt', false);
          return;
        }
        core.setLastStoryDay(currentDay);
        const isNew = core.isNewRound();
        const base = isNew ? Number(st.time) : Number(cp.time);
        const threshold = Math.max(1, parseInt(settings.evolveTimeThreshold) || 1);
        const delta = Number(currentDay) - base;
        if (delta < threshold) {
          setStatus(`thứ ${Math.max(0, delta)}/${threshold} ngày, chưa đến lúc suy diễn`);
          if (ui) ui.refresh(true);
          return;
        }
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        const lastMsg = chat[chat.length - 1];
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '').trim() : '';
        // Nhất quán với đường dẫn tự động: đọc min(số vòng đã qua, giới hạn trên X) vòng
        const Xmax = Math.max(1, parseInt(settings.evolveTimeMaxRounds) || 10);
        const Lnow = core.getChatLayer();
        let anchorL = (cp && cp.chatLayer != null) ? Number(cp.chatLayer)
                    : (st && st.chatLayer != null ? Number(st.chatLayer) : Lnow);
        if (!Number.isFinite(anchorL)) anchorL = Lnow;
        const since = Math.floor(Math.max(0, Lnow - anchorL) / 2);
        const readRounds = Math.max(1, Math.min(since, Xmax));
        await performEvolution(aiMsg, chat, Number(currentDay), readRounds);
      }

      async function onChatLoaded() {
        clearAutoEvolveTimer();
        // Khi chuyển chat, nếu vẫn có suy diễn đang chạy/Backfill hàng loạt, huỷ bỏ ngay lập tức——
        // Backfill bắt được tham chiếu mảng hội thoại của chat cũ, tiếp tục chạy sẽ ghi nội dung chat cũ vào chat mới (ô nhiễm chéo chat + Bản lưu cũ đã clearState mất).
        if (evolution && evolution.isRunning && evolution.isRunning()) {
          try { evolution.abort(); console.log('[World Engine] Chuyển chat, huỷ bỏ suy diễn đang chạy/Backfill'); } catch (e) { console.warn('[World Engine] Huỷ bỏ suy diễn thất bại', e); }
        }
        // Cache Tavern: khi chuyển chat trước tiên thực hiện khôi phục đồng bộ thời gian thực/Hội tụ (phải trước khi đọc trạng thái cục bộ, cục bộ mới lấy được bản lưu mới hơn từ đám mây)
        if (window.WORLD_ENGINE_CHATCACHE) {
          try { window.WORLD_ENGINE_CHATCACHE.onChatLoaded(); } catch (e) { console.warn('[World Engine] Khôi phục cache Tavern thất bại', e); }
        }
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        const currentLayer = core.getChatLayer();
        if (chat.length === 0) {
          core.clearState();
          core.clearCheckpoint();
          core.saveFingerprint(String(currentLayer));
        }
        let storedState = null;
        if (core.hasState()) {
          storedState = core.loadState();
          // [FIX] Chỉ đối với những cái đã thực sự suy diễn state bù chatLayer；vỏ rỗng state（round=0 và không có lastEvolveResult）Giữ lại undefined，
          //   để runAutoEvolution của anchor Dự phòng đi vào nhánh 'chưa từng suy diễn' (anchor=-1），Tránh việc anchor đóng đinh ở tầng hiện tại dẫn đến deadlock.
          if (!Number.isFinite(Number(storedState.chatLayer)) && (storedState.round > 0 || storedState.lastEvolveResult)) {
            storedState.chatLayer = currentLayer;
            core.saveState(storedState);
          }
        }
        const checkpoint = core.restoreCheckpoint();
        if (checkpoint && !Number.isFinite(Number(checkpoint.chatLayer))) {
          checkpoint.chatLayer = storedState && Number.isFinite(Number(storedState.chatLayer))
            ? Number(storedState.chatLayer)
            : currentLayer;
          core.saveCheckpoint(checkpoint);
        }
        // Di chuyển phiên bản cũ fingerprint（Ngữ nghĩa cũ là chat.length）đến số tầng thống nhất (chat.length - 1）。
        const savedFingerprint = Number(core.loadFingerprint());
        if (Number.isFinite(savedFingerprint) && savedFingerprint === currentLayer + 1 &&
            (!storedState || Number(storedState.chatLayer) === currentLayer)) {
          core.saveFingerprint(String(currentLayer));
        }
        // [FIX] fingerprint bù tầng hiện tại = Thiết lập điểm neo ở tầng này (chat đã suy diễn thiết lập ở đây, lần sau có tầng mới mới suy diễn).
        //   Nhưng vỏ rỗng state（round=0 và không có lastEvolveResult = chưa từng suy diễn) không thể bù thành tầng hiện tại——Nếu không thì
        //   runAutoEvolution Khớp cấp 3 anchor=L、c=0、Deadlock vĩnh viễn. Chỉ những cái đã thực sự suy diễn state mới bù;
        //   vỏ rỗng state giữ lại vân tay trống, để auto nhánh đi vào fallback 「chưa từng suy diễn」 anchor=-1 kích hoạt suy diễn lần đầu.
        //   với vỏ rỗng phía trên state không ghim chatLayer cùng cấu trúc (cùng lấy round>0||lastEvolveResult phân biệt đã suy diễn qua chưa).
        const reallyEvolved = storedState && (storedState.round > 0 || storedState.lastEvolveResult);
        if (chat.length > 0 && !core.restoreCheckpoint() && reallyEvolved && core.loadFingerprint() === '') {
          core.saveFingerprint(String(currentLayer));
        }
        applyInjectionForCurrentRound();
        console.log('[World Engine] chat đã tải, tiêm đã cập nhật');
      }

      function onMessageSwiped() {
        clearAutoEvolveTimer();
        // swipe（mũi tên trái phải dưới tin nhắn): rõ ràng là reroll roll，điểm lưu tiêm.
        applyInjectionForCurrentRound({ isReroll: true });
      }

      // mượn sự kiện bắt đầu tạo làm thời điểm lắp ráp phần thân. reroll roll tiêu chí dùng nguyên bản của Tavern type（swipe/regenerate），
      // không dùng nữa chatLayer giá trị——bởi vì GENERATION_STARTED ở người dùng/AI tầng push vào chat trước khi emit，
      // khi gửi tin nhắn vòng mới chatLayer vẫn == vòng trước state.chatLayer，tiêu chí thuần giá trị sẽ đánh giá nhầm lần tạo đầu của vòng mới thành reroll roll（v2.3.18 hồi quy).
      //   type==='swipe'|'regenerate' → reroll roll，điểm lưu tiêm (trạng thái thế giới trước khi phần thân tầng này được tạo ra).
      //   dryRun（khởi động trước của plugin loại cơ sở dữ liệu/tính token tạo)→ không động đến tiêm, tránh 「tạo xong lại tiêm một lần nữa」。
      function onGenerationStarted(type, _opts, dryRun) {
        if (dryRun) return; // vòng khởi động trước không đánh giá lại tiêm
        const isReroll = (type === 'swipe' || type === 'regenerate');
        applyInjectionForCurrentRound({ isReroll });
      }

      // ========== ràng buộc sự kiện ==========
      const ctx = SillyTavern.getContext();
      if (ctx && ctx.eventSource) {
        const autoEvolveEvent = ctx.event_types?.GENERATION_ENDED || ctx.event_types?.MESSAGE_RECEIVED || 'message_received';
        ctx.eventSource.on(autoEvolveEvent, onMessageReceived);
        ctx.eventSource.on(ctx.event_types?.CHAT_LOADED || 'chat_loaded', onChatLoaded);
        ctx.eventSource.on(ctx.event_types?.MESSAGE_SWIPED || 'message_swiped', onMessageSwiped);
        ctx.eventSource.on(ctx.event_types?.GENERATION_STARTED || 'generation_started', onGenerationStarted);
        console.log('[World Engine] ràng buộc sự kiện thành công, "tự động suy diễn sự kiện":', autoEvolveEvent);
      } else {
        console.warn('[World Engine] không thể ràng buộc sự kiện');
      }

      // khi khởi tạo ngay lập tức chọn trạng thái tiêm theo số tầng hội thoại
      applyInjectionForCurrentRound();
      // lộ ra điểm vào tiêm được chọn theo số tầng hội thoại để gọi thủ công
      window.WORLD_ENGINE = { applyInjection: applyInjectionForCurrentRound, manualTimeEvolve };

      // ========== thêm nút điểm vào bảng điều khiển vào thanh nhập của Tavern ==========
      // đã chuyển đến world-engine-ui['js của buildInputButton']()

      ui.buildPanel();
      ui.buildInputButton();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ui.buildInputButton());
      }

      // mỗi 30 giây tự động làm mới bảng điều khiển (nếu hiển thị)
      setInterval(() => { if (ui) ui.refresh(true); }, 30000);

      console.log('[World Engine] khởi tạo hoàn thành ✅');
    } catch(err) {
      console.error('[World Engine] khởi tạo thất bại', err);
    }
  }

  init();
})();
