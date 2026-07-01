// world-engine-api.js — độc lập API gọi (hỗ trợ tuỳ chỉnh OpenAI tương thích API）
window.WORLD_ENGINE_API = (function() {
  let cachedSettings = null;

  function getSettings(forceRefresh) {
    if (forceRefresh) cachedSettings = null;
    if (cachedSettings) return cachedSettings;
    const defaults = {
      apiUrl: '',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      // [FIX] Cách kết nối:'direct'=Trình duyệt kết nối trực tiếp (mặc định, hành vi cũ);'proxy'=Chuyển tiếp qua server Tavern, vượt qua bên thứ ba API của CORS hạn chế
      connectionMode: 'direct',
      injectIntoPrompt: true,
      evolveMode: 'auto',
      // Cache Tavern: phản chiếu bản lưu cách ly theo chat vào chat_metadata，Thực hiện đồng bộ đa thiết bị và bản lưu chống mất mát (mặc định tắt)
      syncToChat: false,   // Đồng bộ thời gian thực: trạng thái không gian làm việc liên tục phản chiếu vào chat, đổi thiết bị mở cùng chat là có thể viết tiếp
      autoBackup: false,   // Tự động sao lưu cuốn chiếu: mỗi khi vòng thúc đẩy, tự động lưu một bản vào chat (giữ lại vài bản gần nhất)
      worldbookTrigger: false, // Kích hoạt đèn xanh/lam Worldbook:🔵Thường trú luôn tiêm / 🟢Từ khoá khớp mới tiêm (mặc định tắt=Tiêm tất cả đã chọn)
      // Backfill hàng loạt suy diễn thế giới: từ 1 cái AI tầng chia lô suy diễn đến tầng chỉ định (xoá hết làm lại)
      backfillBatchSize: 5,    // Mỗi lô AI số tầng (mỗi bao nhiêu tầng gọi suy diễn một lần)
      backfillRetries: 2,      // Số lần thử lại độc lập mỗi lô (giới hạn thử lại khi suy diễn thất bại)
      backfillEndLayer: 0,     // Kết thúc AI tầng (0 = suy diễn đến AI tầng cuối cùng)
      evolveEveryX: 1,
      evolveReadRounds: 1,
      evolveFilterRegex: '',
      tonePrompt: '',
      // Chế độ suy diễn theo thời gian
      evolveTimeFront: 0,
      evolveTimeBack: 80,
      evolveTimeRe1: '', evolveTimeRe2: '', evolveTimeRe3: '',
      evolveTimeRe4: '', evolveTimeRe5: '', evolveTimeRe6: '',
      evolveTimeMul1: 360, evolveTimeMul2: 30, evolveTimeMul3: 1,
      evolveTimeThreshold: 1,
      evolveTimeMaxRounds: 10,
      // [FIX] API Yêu cầu quá giờ (mili giây).0 = Không quá giờ (hành vi cũ). Mặc định 120s：
      //   Yêu cầu suy diễn nếu rơi vào hố đen mạng (proxy không phản hồi/upstream không trả về cũng không báo lỗi),fetch sẽ treo vĩnh viễn,
      //   evolve của _isRunning không bao giờ reset, từ đó mọi suy diễn tự động bị isRunning() thủ vệ âm thầm bỏ qua,
      //   cho đến khi người dùng chuyển chat một lần mới mở khoá. Quá giờ cho phép xử lý yêu cầu treo như thất bại,finally reset bình thường.
      apiTimeoutMs: 120000
    };
    const raw = window.WORLD_ENGINE_STORE.getItem('world_engine_settings');
    if (raw) {
      try { cachedSettings = { ...defaults, ...JSON.parse(raw) }; return cachedSettings; } catch(e) {}
    }
    cachedSettings = defaults;
    return cachedSettings;
  }

  // [FIX] Chuẩn hoá chat/completions URL：Chỉ bù /chat/completions，Không còn nhét thay người dùng /v1 các tiền tố phiên bản.
  //   Volcengine Ark v.v. OpenAI Endpoint tương thích dùng tiền tố phiên bản tuỳ chỉnh (/api/v3、/api/coding/v3），logic cũ sẽ nhét cứng
  //   /v1 đem URL ghép thành .../v3/v1/chat/completions mà toàn bộ 404。tiền tố phiên bản do người dùng điền hoàn chỉnh trong cài đặt,
  //   bên cạnh có gợi ý định dạng. Ba điểm gọi (getProxyBase / callApi / fetchModelList）hưởng lợi từ ngữ nghĩa nhất quán.
  function normalizeUrl(url) {
    let u = url.trim().replace(/\/+$/, '');
    if (!u) return '';
    if (u.endsWith('/chat/completions')) return u;
    return u + '/chat/completions';
  }

  // [FIX] Dùng qua proxy Tavern: từ chat/completions URL khôi phục lại base（có dạng như https://host/v1），
  // giao cho backend Tavern, để nó tự ghép /chat/completions và /models。
  function getProxyBase(settings) {
    return normalizeUrl(settings.apiUrl).replace(/\/chat\/completions$/, '');
  }

  // [FIX] gọi endpoint backend riêng của Tavern cần mang theo CSRF/header xác thực; chỉ khả dụng trong môi trường Tavern.
  function tavernHeaders() {
    try {
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (ctx && typeof ctx.getRequestHeaders === 'function') {
        const h = ctx.getRequestHeaders();
        if (h && !h['Content-Type'] && !h['content-type']) h['Content-Type'] = 'application/json';
        return h;
      }
    } catch (e) {}
    throw new Error('qua proxy của Tavern cần chạy trong môi trường Tavern (không lấy được header yêu cầu của Tavern)');
  }

  // [FIX] lệnh gọi suy diễn được chuyển tiếp qua server Tavern: trình duyệt → backend Tavern cùng nguồn (không có CORS）→ server gửi thay đến bên thứ ba API。
  // đi qua OpenAI source + reverse_proxy tuyến đường, như vậy có thể đem ... của chính chúng ta URL/KEY truyền xuyên suốt lên thượng nguồn.
  // [FIX] kèm timeout fetch：đem ... do bên gọi truyền vào signal（người dùng chủ động huỷ bỏ / chuyển chat) và bộ đếm thời gian timeout nội bộ
  //   gộp vào cùng một yêu cầu. Kích hoạt timeout → controller.abort()，nhưng ném ra là ... thông thường Error（kèm __timeout đánh dấu),
  //   chứ không phải AbortError——như vậy evolve của catch sẽ xử lý theo "suy diễn thất bại" và đặt lại _isRunning，
  //   và thanh trạng thái hiển thị rõ lý do timeout; người dùng chủ động huỷ bỏ vẫn đi qua bên ngoài signal của AbortError，hiển thị "đã huỷ bỏ".
  //   timeoutMs <= 0 khi ... không đặt timeout (giữ lại hành vi cũ).
  async function fetchWithTimeout(url, options, signal, timeoutMs) {
    if (!(timeoutMs > 0)) {
      return fetch(url, { ...options, signal: signal || null });
    }
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    // bên ngoài signal khi huỷ bỏ thì đồng thời huỷ bỏ yêu cầu lần này
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onExternalAbort, { once: true });
    }
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (e) {
      if (timedOut) {
        throw new Error('API yêu cầu timeout (' + Math.round(timeoutMs / 1000) + 's không phản hồi), đã huỷ bỏ suy diễn lần này');
      }
      throw e;   // huỷ bỏ bên ngoài → ném ra nguyên trạng AbortError
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
    }
  }

  async function callApiViaProxy(settings, body, signal) {
    const base = getProxyBase(settings);
    if (!base) throw new Error('chưa cấu hình API URL，vui lòng điền trong cài đặt');
    const payload = {
      chat_completion_source: 'openai',
      reverse_proxy: base,
      proxy_password: settings.apiKey || '',
      model: body.model,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      stream: false
    };
    console.log('[World Engine] gọi API（qua proxy của Tavern):', base, payload.model);
    const resp = await fetchWithTimeout('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: tavernHeaders(),
      body: JSON.stringify(payload)
    }, signal, settings.apiTimeoutMs);
    if (!resp.ok) {
      let detail = '';
      try { const err = await resp.json(); detail = err.error?.message || JSON.stringify(err); } catch(e) {}
      throw new Error(`HTTP ${resp.status}: ${detail}`);
    }
    const data = await resp.json();
    if (data && data.error) {
      throw new Error('proxy của Tavern trả về lỗi:' + (data.error.message || JSON.stringify(data.error)));
    }
    const choice = data.choices?.[0];
    if (!choice) throw new Error('API trả về thiếu choices[0]');
    if (choice.finish_reason === 'length') {
      console.warn('[World Engine] API đầu ra đạt giới hạn độ dài, sẽ đọc các trường đã trả về hoàn chỉnh trước khi bị cắt cụt');
    }
    return choice.message?.content || '';
  }

  /**
   * gọi độc lập API（không phải Tavern tích hợp sẵn),OpenAI định dạng tương thích
   */
  async function callApi(prompt, maxTokens, temperature, signal) {
    const settings = getSettings();

    const body = {
      model: settings.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature ?? settings.temperature ?? 0.7,
      max_tokens: maxTokens ?? settings.maxTokens ?? 2000
    };

    // [FIX] qua proxy của Tavern: vượt qua bên thứ ba API của CORS giới hạn, do Tavern Node server chuyển tiếp
    if (settings.connectionMode === 'proxy') {
      return callApiViaProxy(settings, body, signal);
    }

    const url = normalizeUrl(settings.apiUrl);
    if (!url) throw new Error('chưa cấu hình API URL，vui lòng điền trong cài đặt');

    const headers = {
      'Content-Type': 'application/json'
    };
    if (settings.apiKey) {
      headers['Authorization'] = 'Bearer ' + settings.apiKey;
    }

    console.log('[World Engine] gọi API:', url, body.model);

    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    }, signal, settings.apiTimeoutMs);

    if (!resp.ok) {
      let detail = '';
      try { const err = await resp.json(); detail = err.error?.message || JSON.stringify(err); } catch(e) {}
      throw new Error(`HTTP ${resp.status}: ${detail}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('API trả về thiếu choices[0]');
    if (choice.finish_reason === 'length') {
      console.warn('[World Engine] API đầu ra đạt giới hạn độ dài, sẽ đọc các trường đã trả về hoàn chỉnh trước khi bị cắt cụt');
    }
    return choice.message?.content || '';
  }

  function repairTruncatedJSON(content) {
    const rootStart = content.indexOf('{');
    if (rootStart === -1) return null;

    const stack = [];
    const candidates = [];
    let inString = false;
    let escaped = false;

    for (let i = rootStart; i < content.length; i++) {
      const char = content[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        stack.pop();
      } else if (char === ',' && stack.length > 0) {
        candidates.push({
          end: i,
          suffix: stack.slice().reverse().map(open => open === '{' ? '}' : ']').join('')
        });
      }
    }

    for (let i = candidates.length - 1; i >= 0; i--) {
      const candidate = content.slice(rootStart, candidates[i].end) + candidates[i].suffix;
      try {
        return JSON.parse(candidate);
      } catch(e) {}
    }
    return null;
  }

  /**
   * phân tích API trả về JSON（xử lý chịu lỗi)
   */
  function parseJSON(text) {
    let content = String(text || '').trim();
    content = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
      return JSON.parse(content);
    } catch(e) {}

    // Trích xuất cấp cao nhất từ kết quả trả về có lẫn giải thích, văn bản suy nghĩ hoặc nhiều khối mã JSON；
    // Câu trả lời cuối cùng của mô hình thường nằm ở cuối, do đó sử dụng đối tượng hợp lệ cuối cùng.
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    let result = null;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}' && depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            result = JSON.parse(content.slice(start, i + 1));
          } catch(e2) {}
          start = -1;
        }
      }
    }
    return result || repairTruncatedJSON(content);
  }

  /**
   * Lấy danh sách mô hình (OpenAI định dạng tương thích)
   */
  async function fetchModelList() {
    const settings = getSettings();
    const baseUrl = normalizeUrl(settings.apiUrl).replace(/\/chat\/completions$/, '');

    // [FIX] Qua proxy của Tavern: dùng Tavern /status endpoint để kéo danh sách mô hình, bỏ qua CORS
    if (settings.connectionMode === 'proxy') {
      if (!baseUrl) throw new Error('chưa cấu hình API URL，vui lòng điền trong cài đặt');
      const resp = await fetch('/api/backends/chat-completions/status', {
        method: 'POST',
        headers: tavernHeaders(),
        body: JSON.stringify({
          chat_completion_source: 'openai',
          reverse_proxy: baseUrl,
          proxy_password: settings.apiKey || ''
        })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.error) throw new Error('Proxy của Tavern kéo mô hình thất bại (vui lòng kiểm tra URL/khoá bí mật có đúng không)');
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(m => m.id);
      }
      throw new Error('Không thể phân tích danh sách mô hình');
    }

    const url = baseUrl + '/models';
    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers['Authorization'] = 'Bearer ' + settings.apiKey;

    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(m => m.id);
    }
    throw new Error('Không thể phân tích danh sách mô hình');
  }

  return { callApi, parseJSON, getSettings, fetchModelList };
})();
