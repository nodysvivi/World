// world-engine-core.js — Cấu trúc dữ liệu cốt lõi và lưu trữ (theo chat ID cách ly)
window.WORLD_ENGINE_CORE = (function() {
  const STORAGE_PREFIX = 'world_engine_';
  const EVENT_TYPES = ['conflict', 'progress'];
  const EVENT_STAGE_ORDER = {
    conflict: ['Manh nha', 'Ủ biến', 'Cận kề'],
    progress: ['Chuẩn bị', 'Thực thi', 'then chốt']
  };
  const EVENT_STAGE_MAP = {
    conflict: ['Manh nha', 'Ủ biến', 'Cận kề', 'Đã bùng phát', 'Đã tan biến'],
    progress: ['Chuẩn bị', 'Thực thi', 'then chốt', 'Đã hoàn thành', 'Đã thất bại']
  };
  const EVENT_SUCCESS_STAGE = {
    conflict: 'Đã bùng phát',
    progress: 'Đã hoàn thành'
  };
  const EVENT_TERMINAL_STAGES = {
    conflict: ['Đã bùng phát', 'Đã tan biến'],
    progress: ['Đã hoàn thành', 'Đã thất bại']
  };

  function getDefaultState() {
    return {
      round: 0,
      worldDigest: 'Thế giới đang thức tỉnh, mọi thứ vẫn chưa thể biết trước.',
      events: [],
      factions: [],
      winds: [],
      worldTrends: [],
      reputation: {
        authority: 'vô danh',
        common: 'vô danh',
        shadow: 'vô danh',
        circuit: 'vô danh',
        lastChange: ''
      },
      economy: {
        climate: 'Ổn định',
        signals: []
      },
      memories: [],
      enemies: [],
      influenceChain: [],
      regionalIncident: {
        active: false,
        title: '',
        type: '',
        scope: '',
        impact: '',
        cooldown: 0,
        _retry: false,
        _retryType: ''
      },
      blackbox: {
        secretActions: [],
        secretAssets: []
      },
      lastEvolveResult: null,
      lastInjection: null,
      lastUpdated: {}
    };
  }

  /** Lấy tên nhân vật đang đóng vai hiện tại */
  function getUserName() {
    try {
      const ctx = SillyTavern.getContext();
      if (ctx?.name1) return ctx.name1;
      if (ctx?.name2) return ctx.name2;
      const character = ctx?.characters?.[ctx?.characterId];
      if (character?.name) return character.name;
    } catch(e) {}
    return 'người dùng';
  }

  /** UI Render: Thay thế trong văn bản {{user}} thành tên nhân vật hiện tại */
  function renderUserName(text) {
    if (!text || typeof text !== 'string') return text;
    const name = getUserName();
    return text.replace(/\{\{user\}\}/g, name);
  }

  function getChatId() {
    try {
      const ctx = SillyTavern.getContext();
      if (ctx && ctx.chatId) return ctx.chatId;
    } catch(e) {}
    return 'default';
  }

  function ensureArrays(state) {
    state.memories = state.memories || [];
    state.events = state.events || [];
    if (state.events) {
      for (const ev of state.events) {
        if (ev.stageRound === undefined) ev.stageRound = 1;
        if (!ev.type || !EVENT_TYPES.includes(ev.type)) ev.type = 'conflict';
        if (ev.consecutiveFails === undefined) ev.consecutiveFails = 0;
        if (ev.stall === undefined) ev.stall = false;
        // sửa lỗi stageRound>=9 vấn đề chưa thăng cấp
        const successStage = EVENT_SUCCESS_STAGE[ev.type] || EVENT_SUCCESS_STAGE.conflict;
        const terminalStages = EVENT_TERMINAL_STAGES[ev.type] || EVENT_TERMINAL_STAGES.conflict;
        if (ev.stageRound >= 9 && !terminalStages.includes(ev.stage)) {
          const STAGES = EVENT_STAGE_ORDER[ev.type] || EVENT_STAGE_ORDER.conflict;
          const idx = STAGES.indexOf(ev.stage);
          if (idx !== -1 && idx < STAGES.length - 1) {
            ev.stage = STAGES[idx + 1];
            ev.stageRound = ev.stageRound - 9 || 1;
          } else {
            ev.stage = successStage;
            ev.stageRound = 9;
          }
        }
        if (terminalStages.includes(ev.stage)) {
          ev.stageRound = 9;
          ev.stall = false;
        }
      }
    }
    state.factions = state.factions || [];
    const FACTION_RELATIONS = ['Huyết minh', 'Đồng minh', 'Thân thiện', 'Trung lập', 'Lạnh nhạt', 'Thù địch', 'Thù truyền kiếp'];
    const FACTION_STATUSES = ['Cực thịnh', 'Vững chắc', 'Chèn ép lẫn nhau', 'Khốn đốn', 'Suy tàn', 'Tan rã'];
    for (const f of state.factions) {
      f.status = FACTION_STATUSES.includes(f.status) ? f.status : 'Vững chắc';
      // cấp 8→Di chuyển cấp 7: Của bản lưu cũ"căng thẳng"gộp vào"Lạnh nhạt"
      if (f.relation === 'căng thẳng') f.relation = 'Lạnh nhạt';
      f.relation = FACTION_RELATIONS.includes(f.relation) ? f.relation : 'Trung lập';
      f.scope = f.scope || '';
      if (!Array.isArray(f.powerPillars)) f.powerPillars = [];
      else f.powerPillars = f.powerPillars.map(p => {
        const name = typeof p === 'string' ? p : (p.name || '');
        return name.length > 4 ? name.slice(0, 4) : name;
      }).filter(Boolean);
      if (f.powerPillars.length > 3) f.powerPillars.length = 3;
    }
    state.worldTrends = state.worldTrends || [];
    if (state.worldTrends.length > 4) state.worldTrends.length = 4;
    state.winds = state.winds || [];
    state.winds = state.winds.map((wind, index) => {
      wind.topic = wind.topic || wind.content || `có tiếng đồn${index + 1}`;
      if (!['announcement', 'report', 'rumor', 'sentiment'].includes(wind.type)) wind.type = 'rumor';
      wind.level = Math.min(4, Math.max(1, parseInt(wind.level) || 1));
      wind.content = wind.content || '';
      wind.scope = wind.scope || 'nơi xuất phát';
      wind.source = wind.source || 'nguồn gốc không rõ';
      wind.quietRounds = Math.max(0, parseInt(wind.quietRounds) || 0);
      return wind;
    });
    state.reputation = state.reputation || { authority: 'vô danh', common: 'vô danh', shadow: 'vô danh', circuit: 'vô danh' };
    // cấp 6→Di chuyển cấp 5: Của bản lưu cũ"có chút danh tiếng"gộp vào"được kính trọng"
    for (const _dim of ['authority', 'common', 'shadow', 'circuit']) {
      if (state.reputation[_dim] === 'có chút danh tiếng') state.reputation[_dim] = 'được kính trọng';
    }
    if (!state.reputation.lastChange) state.reputation.lastChange = '';
    state.economy = state.economy || { climate: 'Ổn định', signals: [] };
    if (!state.economy.signals) state.economy.signals = [];
    state.enemies = state.enemies || [];
    state.influenceChain = Array.isArray(state.influenceChain) ? state.influenceChain : [];
    for (const influence of state.influenceChain) {
      if (influence && typeof influence === 'object' && influence._createdRound === undefined) {
        influence._createdRound = Number(state.round) || 0;
      }
    }
    if (!state.regionalIncident) {
      state.regionalIncident = { active: false, title: '', type: '', scope: '', impact: '', cooldown: 0, _retry: false, _retryType: '' };
    }
    state.regionalIncident.active = state.regionalIncident.active === true || state.regionalIncident.active === 'true';
    if (state.regionalIncident.cooldown === undefined) state.regionalIncident.cooldown = 0;
    if (state.regionalIncident.duration === undefined) state.regionalIncident.duration = 0;
    if (state.regionalIncident._retry === undefined) state.regionalIncident._retry = false;
    if (state.regionalIncident._retryType === undefined) state.regionalIncident._retryType = '';
    if (!state.blackbox) {
      state.blackbox = { secretActions: [], secretAssets: [] };
    } else {
      state.blackbox.secretActions = state.blackbox.secretActions || [];
      state.blackbox.secretAssets = state.blackbox.secretAssets || [];
    }
    state.lastInjection = state.lastInjection || null;
    return state;
  }

  function loadState() {
    const chatId = getChatId();
    const key = STORAGE_PREFIX + chatId;
    const raw = window.WORLD_ENGINE_STORE.getItem(key);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        const def = getDefaultState();
        const merged = { ...def, ...saved };
        merged.memories = saved.memories || [];
        merged.lastInjection = saved.lastInjection || null;
        return ensureArrays(merged);
      } catch(e) { console.warn('[World Engine] tải trạng thái thất bại', e); }
    }
    return ensureArrays(getDefaultState());
  }

  /** có tồn tại trạng thái hiện tại đã ghi ra đĩa thực sự hay không;loadState() khi không tồn tại chỉ trả về trạng thái mặc định tạm thời. */
  function hasState() {
    return window.WORLD_ENGINE_STORE.getItem(STORAGE_PREFIX + getChatId()) !== null;
  }

  function saveState(state) {
    const chatId = getChatId();
    const key = STORAGE_PREFIX + chatId;
    ensureArrays(state);
    state.lastUpdated = { chatId, timestamp: Date.now() };
    window.WORLD_ENGINE_STORE.setItem(key, JSON.stringify(state));
  }

  function clearState() {
    window.WORLD_ENGINE_STORE.removeItem(STORAGE_PREFIX + getChatId());
  }

  /** Lưu trạng thái và ghi lại số tầng hội thoại hiện tại (evolve gọi sau khi hoàn thành) */
  function saveStateWithLayer(state) {
    state.chatLayer = getChatLayer();
    saveState(state);
  }

  // ========== hệ thống điểm lưu (a/b trạng thái kép) ==========
  // a = điểm lưu, sao chép mỗi khi có vòng hội thoại mới b
  // b = không gian làm việc,UI hiển thị cái này

  function getCheckpointKey() {
    return STORAGE_PREFIX + getChatId() + '_checkpoint';
  }

  function getAnchorLayerKey() {
    return STORAGE_PREFIX + getChatId() + '_anchorLayer';
  }

  function getFingerprintKey() {
    return STORAGE_PREFIX + getChatId() + '_fingerprint';
  }

  /** lưu điểm lưu a（sao chép hoàn chỉnh hiện tại state） */
  function saveCheckpoint(state) {
    const key = getCheckpointKey();
    const cp = JSON.parse(JSON.stringify(state));
    ensureArrays(cp);
    window.WORLD_ENGINE_STORE.setItem(key, JSON.stringify(cp));
  }

  /** từ điểm lưu a khôi phục trạng thái */
  function restoreCheckpoint() {
    const key = getCheckpointKey();
    const raw = window.WORLD_ENGINE_STORE.getItem(key);
    if (raw) {
      try {
        const cp = JSON.parse(raw);
        return ensureArrays(cp);
      } catch(e) { console.warn('[World Engine] đọc điểm lưu thất bại', e); }
    }
    return null;
  }

  /** xoá điểm lưu */
  function clearCheckpoint() {
    window.WORLD_ENGINE_STORE.removeItem(getCheckpointKey());
  }

  /** giao diện neo độc lập phiên bản cũ (ngữ nghĩa số tầng thống nhất thành chat.length - 1；bộ đếm hiện tại không sử dụng nó). */
  function getAnchorLayer() {
    const saved = window.WORLD_ENGINE_STORE.getItem(getAnchorLayerKey());
    return saved !== null ? Number(saved) : null;
  }

  /** cài đặt neo đếm */
  function setAnchorLayer(l) {
    window.WORLD_ENGINE_STORE.setItem(getAnchorLayerKey(), String(l));
  }

  /** lấy số tầng hội thoại hiện tại (đếm từ 0 bắt đầu đếm) */
  function getChatLayer() {
    try {
      const ctx = SillyTavern.getContext();
      const chat = ctx?.chat || [];
      return Math.max(0, chat.length - 1);
    } catch(e) { return 0; }
  }

  /** lấy vân tay của hội thoại hiện tại (số tầng hội thoại, dùng để phán đoán xem có reroll roll） */
  function getChatFingerprint() {
    return String(getChatLayer());
  }

  /** lưu vân tay vào localStorage */
  function saveFingerprint(fp) {
    window.WORLD_ENGINE_STORE.setItem(getFingerprintKey(), fp);
  }

  /** đọc vân tay đã lưu lần trước */
  function loadFingerprint() {
    return window.WORLD_ENGINE_STORE.getItem(getFingerprintKey()) || '';
  }

  /** phán đoán xem có phải vòng hội thoại mới không (vân tay thay đổi → vòng mới; không đổi → rerollroll） */
  function isNewRound() {
    const oldFp = loadFingerprint();
    const newFp = getChatFingerprint();
    if (!oldFp) return true;
    return oldFp !== newFp;
  }

  function addMemory(state, memory) {
    if (!state) return;
    state.memories.unshift(memory);
    if (state.memories.length > 200) state.memories.pop();
    saveState(state);
  }

  // bộ lọc đầu vào đầu ra: theo settings.evolveFilterRegex（mỗi dòng một regex) xoá nội dung khớp.
  // dùng để làm sạch văn bản hội thoại trước khi đưa vào suy diễn dưới nền (chuỗi suy nghĩ, thanh trạng thái,HTML v.v.).
  //
  // mỗi dòng một regex, "hỗ trợ hai cách viết":
  //   1. thuần pattern（như `ゐ<details>[\s\S]*?</details>`）—— tự động theo g thay thế toàn cục (tương thích ngược với cách viết cũ);
  //   2. JS literal `/pattern/flags`（như `/<details>[\s\S]*?<\/details>/g`）—— tự động bóc dấu phân cách lấy flags，
  //      flags không chứa g thì bù g（người dùng viết `/pat/` hoặc `/pat/i` đều thực thi theo ngữ nghĩa xoá toàn cục).
  // bỏ qua dòng trống; một dòng không hợp lệ không ném lỗi (im lặng trên đường dẫn sản xuất), chỉ khi bên gọi truyền onError thì báo cáo qua callback.

  // bóc một dòng văn bản thành {pattern, flags}。thuần pattern → flags mặc định 'g'；/pat/flags literal → lấy flags và đảm bảo g。
  function stripRegexLine(pat) {
    const m = /^\/(.+)\/([a-z]*)$/i.exec(pat);
    if (m) {
      let flags = m[2] || '';
      if (flags.indexOf('g') < 0) flags += 'g';
      return { pattern: m[1], flags: flags };
    }
    return { pattern: pat, flags: 'g' };
  }

  // xác thực thuần: phân tích từng dòng raw，trả về { ok, bad, entries }。không gọi replace、không có tác dụng phụ.
  //   ok      —— số lượng hợp lệ
  //   bad     —— [{ line: 1-based Số dòng, raw: Văn bản dòng gốc(Cắt cụt 60), reason: Thông báo lỗi }]
  //   entries —— [{ line, pattern, flags }] Mục hợp lệ (dành cho nút kiểm thử/tái sử dụng chẩn đoán)
  function validateFilterRegex(raw) {
    const out = { ok: 0, bad: [], entries: [] };
    if (!raw) return out;
    const lines = String(raw).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const pat = lines[i].trim();
      if (!pat) continue;
      const lineNo = i + 1;
      const stripped = stripRegexLine(pat);
      try {
        new RegExp(stripped.pattern, stripped.flags);   // Chỉ thử biên dịch, không replace
        out.ok++;
        out.entries.push({ line: lineNo, pattern: stripped.pattern, flags: stripped.flags });
      } catch (e) {
        out.bad.push({ line: lineNo, raw: pat.slice(0, 60), reason: String(e && e.message || e) });
      }
    }
    return out;
  }

  // lọc văn bản hội thoại. Tham số thứ ba onError(lineNo, rawLine, reason) tuỳ chọn——nếu truyền vào thì gọi lại khi có một mục không hợp lệ (lưu/dùng cho kiểm thử),
  // không truyền thì im lặng (đường dẫn suy diễn sản xuất, tuyệt đối không ngắt quãng). Ba điểm gọi sản xuất đều không truyền tham số thứ ba, hành vi nhất quán với phiên bản cũ.
  function filterDialogue(text, settings, onError) {
    if (!text) return text || '';
    const raw = (settings && settings.evolveFilterRegex) || '';
    if (!raw.trim()) return text;
    const v = validateFilterRegex(raw);
    let out = text;
    for (let i = 0; i < v.entries.length; i++) {
      const e = v.entries[i];
      // validateFilterRegex Đã thử biên dịch qua, ở đây tất nhiên thành công; giữ lại try chỉ làm dự phòng phòng thủ
      try { out = out.replace(new RegExp(e.pattern, e.flags), ''); } catch (err) { /* sẽ không đi vào */ }
    }
    if (typeof onError === 'function' && v.bad.length) {
      const lines = String(raw).split('\n');
      for (let i = 0; i < v.bad.length; i++) {
        const b = v.bad[i];
        onError(b.line, lines[b.line - 1] || '', b.reason);
      }
    }
    return out;
  }

  // ========== Phân tích thời gian câu chuyện (dùng cho chế độ suy diễn theo thời gian) ==========
  // Số tiếng Trung → Số Ả Rập (số Ả Rập trả về nguyên dạng, rỗng → 0）
  function cnToNum(s) {
    if (s == null) return 0;
    s = String(s).trim();
    if (s === '') return 0;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    const D = { "Không":0, 〇:0, "Một":1, Hai:2, Hai:2, Ba:3, "Bốn":4, "Năm":5, "Sáu":6, "Bảy":7, "Tám":8, "Chín":9 };
    s = s.replace(/^Sơ/, '');               // Mùng chín → Chín
    // Chứa「Vạn」: tách hai đoạn cao thấp đệ quy (trước vạn rỗng tính theo 1 tính, tức là「Vạn」=10000）
    if (s.includes('Vạn')) {
      const idx = s.indexOf('Vạn');
      return cnToNum(s.slice(0, idx) || 'Một') * 10000 + cnToNum(s.slice(idx + 1));
    }
    // Trấp/Táp Viết tắt: Trấp=20、Hai mươi ba=23、Hai mươi mười=20（tiếp theo không phải hàng đơn vị thì bỏ qua)
    if (s.includes('Trấp')) return 20 + (D[s.replace('Trấp', '')] || 0);
    if (s.includes('Táp')) return 30 + (D[s.replace('Táp', '')] || 0);
    // Ngàn/Trăm/Mười Giá trị hàng + Hàng đơn vị (không làm chỗ trống bỏ qua): một ngàn hai trăm=1200、hai mươi bảy=27、mười một=11
    let total = 0, num = 0;
    const UNIT = { "Mười":10, "Trăm":100, "Ngàn":1000 };
    for (const ch of s) {
      if (ch === 'Không' || ch === '〇') continue;
      if (D[ch] != null) num = D[ch];
      else if (UNIT[ch] != null) { total += (num === 0 ? 1 : num) * UNIT[ch]; num = 0; }
    }
    total += num;
    // Cả đoạn không phân tích ra bất kỳ số tiếng Trung nào → Dự phòng Ả Rập
    if (total === 0 && !/[Không 〇 một hai hai ba bốn năm sáu bảy tám chín mười trăm ngàn]/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    }
    return total;
  }

  // Cấp module: Số ngày cốt truyện phân tích được từ phần chính gần đây nhất (dùng cho UI「thời gian hội thoại vòng này」 hiển thị lại)
  let _lastStoryDay = null;
  function getLastStoryDay() { return _lastStoryDay; }
  function setLastStoryDay(v) { _lastStoryDay = (v == null ? null : Number(v)); }

  /**
   * Phân tích「tổng số ngày」cốt truyện từ phần chính theo cài đặt. Nếu không phân tích được thì trả về null。
   * Quy tắc: Lấy cửa sổ (trước front chữ + sau back chữ, đều 0 thì toàn văn)→ dùng 6 ô ghép regex
   * （ô số lẻ không rỗng thành nhóm bắt, ô số chẵn là literal)→ lấy kết quả khớp cuối cùng → các nhóm bắt cnToNum × nhân hệ số rồi tính tổng.
   */
  function parseStoryDay(text, settings) {
    if (!text || !settings) return null;
    const front = Math.max(0, parseInt(settings.evolveTimeFront) || 0);
    const back = Math.max(0, parseInt(settings.evolveTimeBack) || 0);
    let win;
    if (front === 0 && back === 0) win = text;
    else win = (front > 0 ? text.slice(0, front) : '') + '\n' + (back > 0 ? text.slice(-back) : '');

    const boxes = [1, 2, 3, 4, 5, 6].map(i => settings['evolveTimeRe' + i] || '');
    const muls = [
      parseFloat(settings.evolveTimeMul1),
      parseFloat(settings.evolveTimeMul2),
      parseFloat(settings.evolveTimeMul3)
    ];
    let pattern = '';
    const activeMuls = [];
    for (let i = 0; i < 6; i++) {
      const b = boxes[i];
      if (i % 2 === 0) {                      // ô số 1/3/5
        if (b) { pattern += '(' + b + ')'; activeMuls.push(muls[i / 2]); }
      } else {                               // ô đơn vị 2/4/6（literal, có thể rỗng)
        pattern += b;
      }
    }
    if (!pattern || activeMuls.length === 0) return null;

    let re;
    try { re = new RegExp(pattern, 'g'); } catch (e) { return null; }
    let m, last = null;
    while ((m = re.exec(win)) !== null) {
      last = m;
      if (m.index === re.lastIndex) re.lastIndex++;   // chống vòng lặp vô hạn zero-width
    }
    if (!last) return null;

    let total = 0;
    for (let k = 0; k < activeMuls.length; k++) {
      const mul = Number.isFinite(activeMuls[k]) ? activeMuls[k] : 0;
      total += cnToNum(last[k + 1]) * mul;
    }
    return total;
  }

  function ensureEventFields(ev) {
    if (!ev.type || !EVENT_TYPES.includes(ev.type)) ev.type = 'conflict';
    if (ev.stageRound === undefined) ev.stageRound = 1;
    if (ev.level === undefined) ev.level = 1;
    if (ev.consecutiveFails === undefined) ev.consecutiveFails = 0;
    if (ev.stall === undefined) ev.stall = false;
    // hằng số giai đoạn
    const STAGES = EVENT_STAGE_MAP[ev.type] || EVENT_STAGE_MAP.conflict;
    const stageOrder = EVENT_STAGE_ORDER[ev.type] || EVENT_STAGE_ORDER.conflict;
    const successStage = EVENT_SUCCESS_STAGE[ev.type] || EVENT_SUCCESS_STAGE.conflict;
    const terminalStages = EVENT_TERMINAL_STAGES[ev.type] || EVENT_TERMINAL_STAGES.conflict;
    if (!ev.stage || !STAGES.includes(ev.stage)) ev.stage = STAGES[0];
    // stageRound >= 9 tự động thăng cấp
    if (ev.stageRound >= 9 && !terminalStages.includes(ev.stage)) {
      const idx = stageOrder.indexOf(ev.stage);
      if (idx !== -1 && idx < stageOrder.length - 1) {
        ev.stage = stageOrder[idx + 1];
        ev.stageRound = ev.stageRound - 9 || 1;
      } else {
        ev.stage = successStage;
        ev.stageRound = 9;
      }
    }
    // khoá giai đoạn cuối 9/9
    if (terminalStages.includes(ev.stage)) {
      ev.stageRound = 9;
      ev.stall = false;
    }
    return ev;
  }

  function addEvent(state, event) {
    if (!state.events) state.events = [];
    ensureEventFields(event);
    const idx = state.events.findIndex(e => e.name === event.name);
    if (idx !== -1) {
      state.events[idx] = { ...state.events[idx], ...event };
      ensureEventFields(state.events[idx]);
    } else {
      state.events.unshift(event);
    }
    if (state.events.length > 16) state.events.pop();
    saveState(state);
  }

  function addFaction(state, faction) {
    if (!state.factions) state.factions = [];
    const FACTION_RELATIONS = ['Huyết minh', 'Đồng minh', 'Thân thiện', 'Trung lập', 'Lạnh nhạt', 'Thù địch', 'Thù truyền kiếp'];
    const FACTION_STATUSES = ['Cực thịnh', 'Vững chắc', 'Chèn ép lẫn nhau', 'Khốn đốn', 'Suy tàn', 'Tan rã'];
    if (!FACTION_STATUSES.includes(faction.status)) faction.status = 'Vững chắc';
    if (faction.relation === 'căng thẳng') faction.relation = 'Lạnh nhạt';
    if (!FACTION_RELATIONS.includes(faction.relation)) faction.relation = 'Trung lập';
    faction.scope = faction.scope || '';
    if (!Array.isArray(faction.powerPillars)) faction.powerPillars = [];
    else faction.powerPillars = faction.powerPillars.map(p => {
      const name = typeof p === 'string' ? p : (p.name || '');
      return name.length > 4 ? name.slice(0, 4) : name;
    }).filter(Boolean);
    if (faction.powerPillars.length > 3) faction.powerPillars.length = 3;
    const idx = state.factions.findIndex(f => f.name === faction.name);
    if (idx !== -1) {
      state.factions[idx] = { ...state.factions[idx], ...faction };
    } else {
      state.factions.unshift(faction);
    }
    if (state.factions.length > 15) state.factions.pop();
    saveState(state);
  }

  function addWorldTrend(state, trend) {
    if (!state.worldTrends) state.worldTrends = [];
    if (!trend || !trend.name) return;
    trend.status = trend.status === 'Đã kết thúc' ? 'Đã kết thúc' : 'Đang tiếp diễn';
    trend.scope = trend.scope || 'thiên hạ';
    trend.description = trend.description || '';
    trend.source = trend.source || '';
    const idx = state.worldTrends.findIndex(existing => existing.name === trend.name);
    if (idx !== -1) {
      if (state.worldTrends[idx].status === 'Đã kết thúc') trend.status = 'Đã kết thúc';
      state.worldTrends[idx] = { ...state.worldTrends[idx], ...trend };
    } else {
      state.worldTrends.unshift(trend);
      if (state.worldTrends.length > 4) state.worldTrends.length = 4;
    }
    saveState(state);
  }

  function addWind(state, wind) {
    if (!state.winds) state.winds = [];
    delete wind.quietRounds;
    wind.topic = wind.topic || wind.content || `có tiếng đồn${Date.now()}`;
    if (!['announcement', 'report', 'rumor', 'sentiment'].includes(wind.type)) wind.type = 'rumor';
    wind.level = Math.min(4, Math.max(1, parseInt(wind.level) || 1));
    wind.scope = wind.scope || 'nơi xuất phát';
    wind.source = wind.source || 'nguồn gốc không rõ';
    wind.quietRounds = 0;
    const idx = state.winds.findIndex(existing => existing.topic === wind.topic);
    if (idx !== -1) state.winds[idx] = { ...state.winds[idx], ...wind };
    else state.winds.unshift(wind);
    if (state.winds.length > 12) state.winds.pop();
    saveState(state);
  }

  // ========== xuất/dọn dẹp khi nhập ==========

  /** dữ liệu xuất sau khi dọn dẹp (bỏ gỡ lỗi/trường nội bộ) */
  function getCleanExport(state) {
    const s = JSON.parse(JSON.stringify(state));

    // bỏ gỡ lỗi/trường nội bộ
    delete s.lastEvolveResult;
    delete s.lastInjection;
    delete s.lastUpdated;
    delete s._terminalEventsThisRound;

    // sửa lỗi sự kiện stageRound>=9
    if (s.events) {
      for (const ev of s.events) {
        ensureEventFields(ev);
      }
    }

    return ensureArrays(s);
  }

  /** gộp vào trạng thái hiện tại khi nhập */
  function importState(importedState) {
    const clean = JSON.parse(JSON.stringify(importedState));
    // bỏ các trường nội bộ trong dữ liệu nhập
    delete clean.lastEvolveResult;
    delete clean.lastInjection;
    delete clean.lastUpdated;
    delete clean._terminalEventsThisRound;
    // sửa lỗi sự kiện
    if (clean.events) {
      for (const ev of clean.events) ensureEventFields(ev);
    }
    // đảm bảo các trường cần thiết
    clean.memories = clean.memories || [];
    clean.lastEvolveResult = null;
    clean.lastInjection = null;
    clean.chatLayer = getChatLayer();
    const chatId = getChatId();
    clean.lastUpdated = { chatId, timestamp: Date.now() };
    ensureArrays(clean);
    saveState(clean);
    return clean;
  }

  return {
    getDefaultState, getChatId, loadState, hasState, saveState, clearState, saveStateWithLayer,
    addMemory, addEvent, addFaction, addWorldTrend, addWind,
    ensureEventFields, getUserName, renderUserName,
    saveCheckpoint, restoreCheckpoint, clearCheckpoint, getAnchorLayer, setAnchorLayer,
    getChatLayer, getChatFingerprint, saveFingerprint, loadFingerprint, isNewRound,
    getCleanExport, importState,
    cnToNum, parseStoryDay, getLastStoryDay, setLastStoryDay, filterDialogue,
    validateFilterRegex
  };
})();
