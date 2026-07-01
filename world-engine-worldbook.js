// world-engine-worldbook.js — Đọc Worldbook chat hiện tại và lựa chọn suy diễn dưới nền
window.WORLD_ENGINE_WORLDBOOK = (function() {
  const STORAGE_PREFIX = 'world_engine_worldbook_selection_';
  let worldInfoModulePromise = null;

  function getChatId() {
    return window.WORLD_ENGINE_CORE?.getChatId?.() || 'default';
  }

  function getSelectionKey() {
    return STORAGE_PREFIX + getChatId();
  }

  // Tính hợp lệ của chế độ kích hoạt override giá trị ('auto' là mặc định, không ghi ra đĩa): buộc luôn thường trú / từ khoá bắt buộc / tắt
  const OVERRIDE_VALUES = ['const', 'key', 'off'];
  function sanitizeOverrides(obj) {
    const out = {};
    if (obj && typeof obj === 'object') {
      for (const k in obj) {
        if (typeof k === 'string' && OVERRIDE_VALUES.indexOf(obj[k]) !== -1) out[k] = obj[k];
      }
    }
    return out;
  }

  // Phân tích giá trị lưu trữ, tương thích định dạng cũ (mảng thuần) và định dạng mới ({ids, t, overrides}）
  function parseStored(raw) {
    try {
      const data = JSON.parse(raw || '[]');
      if (Array.isArray(data)) return { ids: data.filter(id => typeof id === 'string'), t: 0, overrides: {} };
      if (data && Array.isArray(data.ids)) {
        return {
          ids: data.ids.filter(id => typeof id === 'string'),
          t: Number(data.t) || 0,
          overrides: sanitizeOverrides(data.overrides)
        };
      }
    } catch (e) {}
    return { ids: [], t: 0, overrides: {} };
  }

  function readStored() {
    return parseStored(window.WORLD_ENGINE_STORE.getItem(getSelectionKey()));
  }

  function getSelectedIds() {
    return readStored().ids;
  }

  // ghi đè kích hoạt của mỗi mục ({entryId: 'const'|'key'|'off'}）；mặc định coi là 'auto'（theo Tavern)
  function getOverrides() {
    return readStored().overrides;
  }

  // phân biệt"chưa từng lưu"（key không tồn tại) và"đã lưu lựa chọn trống"（key tồn tại nhưng ids là []）
  function hasSelection() {
    return window.WORLD_ENGINE_STORE.getItem(getSelectionKey()) !== null;
  }

  // Tìm ra bản ghi lựa chọn cũ nhất của chat khác (theo timestamp lưu; định dạng cũ không có timestamp coi là cũ nhất)
  function removeOldestOtherSelection() {
    const currentKey = getSelectionKey();
    let oldestKey = null;
    let oldestT = Infinity;
    for (const key of window.WORLD_ENGINE_STORE.keys()) {
      if (!key || !key.startsWith(STORAGE_PREFIX) || key === currentKey) continue;
      const t = parseStored(window.WORLD_ENGINE_STORE.getItem(key)).t;
      if (t < oldestT) {
        oldestT = t;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      window.WORLD_ENGINE_STORE.removeItem(oldestKey);
      return true;
    }
    return false;
  }

  function persistSelection(ids, overrides) {
    const uniqueIds = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [])];
    // chỉ giữ lại những mục vẫn được chọn override，tránh tàn dư sau khi bỏ chọn, tích tụ vô hạn
    const idSet = new Set(uniqueIds);
    const ov = sanitizeOverrides(overrides);
    const trimmed = {};
    for (const k in ov) if (idSet.has(k)) trimmed[k] = ov[k];
    const value = JSON.stringify({ ids: uniqueIds, t: Date.now(), overrides: trimmed });
    const currentKey = getSelectionKey();
    // chuyển sang dùng IndexedDB sau đó cơ bản sẽ không đầy nữa; nếu lùi lại localStorage vẫn vượt giới hạn, thì mỗi lần xoá một mục cũ nhất rồi thử lại (FIFO dự phòng)
    while (true) {
      try {
        window.WORLD_ENGINE_STORE.setItem(currentKey, value);
        return;
      } catch (e) {
        if (!removeOldestOtherSelection()) throw e;
      }
    }
  }

  // Tương thích lệnh gọi cũ: chỉ đổi lựa chọn, giữ lại mỗi ghi đè kích hoạt đã lưu
  function saveSelectedIds(ids) {
    persistSelection(ids, readStored().overrides);
  }

  // Đồng thời lưu lựa chọn và ghi đè kích hoạt của mỗi mục
  function saveSelection(ids, overrides) {
    persistSelection(ids, overrides);
  }

  function getEntryId(entry) {
    return `${entry.world || 'Worldbook không xác định'}::${entry.uid}`;
  }

  function getEntryTitle(entry) {
    const comment = String(entry.comment || '').trim();
    if (comment) return comment;
    const keys = Array.isArray(entry.key) ? entry.key.filter(Boolean).join('、') : '';
    if (keys) return keys;
    const content = String(entry.content || '').trim();
    return content ? content.substring(0, 40) : `mục ${entry.uid}`;
  }

  async function getWorldInfoModule() {
    if (!worldInfoModulePromise) {
      worldInfoModulePromise = import('/scripts/world-info.js').catch(error => {
        worldInfoModulePromise = null;
        throw error;
      });
    }
    return worldInfoModulePromise;
  }

  async function loadCurrentEntries() {
    const module = await getWorldInfoModule();
    if (typeof module.getSortedEntries !== 'function') {
      throw new Error('hiện tại SillyTavern phiên bản không hỗ trợ đọc mục Worldbook');
    }
    const entries = await module.getSortedEntries();
    return (Array.isArray(entries) ? entries : [])
      .filter(entry => entry && entry.uid !== undefined && String(entry.content || '').trim())
      // hoàn toàn bỏ qua TavernDB-ACU mục bắt đầu bằng: không hiển thị, không tuỳ chọn, không tiêm
      .filter(entry => !getEntryTitle(entry).startsWith('TavernDB-ACU'))
      .map(entry => ({
        id: getEntryId(entry),
        uid: entry.uid,
        world: entry.world || 'Worldbook không xác định',
        title: getEntryTitle(entry),
        content: String(entry.content || '').trim(),
        disabled: entry.disable === true || entry.enabled === false,
        // —— Cấu hình kích hoạt gốc (dùng cho kích hoạt đèn xanh/lam, theo cài đặt riêng của Worldbook Tavern)——
        constant: entry.constant === true,                  // 🔵 thường trú
        vectorized: entry.vectorized === true,              // 🔗 Vector (tiện ích này không làm recall vector, xử lý theo dạng không phải từ khoá)
        selective: entry.selective === true,                // Có bật logic từ khoá phụ hay không
        selectiveLogic: Number(entry.selectiveLogic) || 0,  // 0 AND_ANY / 1 NOT_ALL / 2 NOT_ANY / 3 AND_ALL
        keys: Array.isArray(entry.key) ? entry.key.filter(k => typeof k === 'string' && k.trim()) : [],
        secondaryKeys: Array.isArray(entry.keysecondary) ? entry.keysecondary.filter(k => typeof k === 'string' && k.trim()) : [],
        caseSensitive: entry.caseSensitive === true,
        matchWholeWords: entry.matchWholeWords === true
      }));
  }

  // ========== Engine kích hoạt đèn xanh/lam ==========
  // Sao chép quy tắc khớp từ khoá của Worldbook Tavern, nhưng "kích hoạt cái gì" hoàn toàn do tiện ích này tự phán đoán:
  // Chỉ quét ngữ cảnh mà tiện ích này đưa cho suy diễn (hội thoại gần đây/trạng thái thế giới), không lắng nghe quét chat của Tavern, giữ nguyên tách rời.
  // Tavern world_info_logic：AND_ANY=0 / NOT_ALL=1 / NOT_ANY=2 / AND_ALL=3。
  const LOGIC = { AND_ANY: 0, NOT_ALL: 1, NOT_ANY: 2, AND_ALL: 3 };

  function triggerEnabled() {
    const a = window.WORLD_ENGINE_API;
    const s = a && a.getSettings ? a.getSettings() : {};
    return s.worldbookTrigger === true;
  }

  // có dạng như /pattern/flags từ khoá của được xử lý theo regex (nhất quán với Tavern)
  function parseRegexKey(str) {
    const m = /^\/(.+)\/([a-z]*)$/i.exec(str);
    if (!m) return null;
    try { return new RegExp(m[1], m[2]); } catch (e) { return null; }
  }

  // Một từ khoá có khớp văn bản quét hay không. Khớp toàn bộ từ chỉ có hiệu lực với ASCII từ đơn;
  // tiếng Trung v.v. không có ranh giới từ (\b không khả dụng), đồng loạt lùi về khớp chuỗi con——Đây cũng là mặc định hợp lý của tiện ích này (bối cảnh tiếng Trung võ hiệp).
  function matchKey(text, key, caseSensitive, matchWholeWords) {
    if (typeof key !== 'string' || !text) return false;
    const needle = key.trim();
    if (!needle) return false;
    const re = parseRegexKey(needle);
    if (re) { try { return re.test(text); } catch (e) { return false; } }
    if (matchWholeWords && /[A-Za-z0-9_]/.test(needle) && /^[\x00-\x7F]+$/.test(needle)) {
      const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { return new RegExp('(?:^|\\W)(?:' + esc + ')(?:\\W|$)', caseSensitive ? '' : 'i').test(text); } catch (e) {}
    }
    return caseSensitive ? text.indexOf(needle) !== -1 : text.toLowerCase().indexOf(needle.toLowerCase()) !== -1;
  }

  // trả về {active, reason}：reason Cung cấp cho console chẩn đoán, giải thích vì sao mục này được tiêm/bỏ qua.
  // mode：auto(theo Tavern) / const(buộc luôn thường trú) / key(từ khoá bắt buộc) / off(tắt)。
  function activationOf(entry, scanText, mode) {
    const m = mode || 'auto';
    if (m === 'off') return { active: false, reason: 'tắt(ghi đè)' };
    if (m === 'const') return { active: true, reason: 'buộc luôn thường trú(ghi đè)' };
    if (m === 'auto' && entry.constant) return { active: true, reason: '🔵thường trú' };
    // 🟢 đường dẫn từ khoá (m==='key' buộc đi theo từ khoá;m==='auto' và không phải mục thường trú)
    const primary = entry.keys || [];
    if (!primary.length) return { active: false, reason: entry.vectorized ? '🔗mục vector(không kích hoạt)' : 'không có từ khoá chính' };
    const cs = entry.caseSensitive, mw = entry.matchWholeWords;
    const hitKey = primary.find(k => matchKey(scanText, k, cs, mw));
    if (!hitKey) return { active: false, reason: '🟢không khớp' };
    const sec = entry.secondaryKeys || [];
    if (!entry.selective || !sec.length) return { active: true, reason: '🟢khớp 「' + hitKey + '」' };
    const anySec = sec.some(k => matchKey(scanText, k, cs, mw));
    const allSec = sec.every(k => matchKey(scanText, k, cs, mw));
    let ok;
    switch (entry.selectiveLogic) {
      case LOGIC.AND_ALL: ok = allSec; break;
      case LOGIC.NOT_ALL: ok = !allSec; break;
      case LOGIC.NOT_ANY: ok = !anySec; break;
      default: ok = anySec; // AND_ANY
    }
    return { active: ok, reason: ok ? ('🟢khớp 「' + hitKey + '」+từ khoá phụ') : '🟢khớp chính nhưng logic từ khoá phụ không thoả mãn' };
  }

  function isEntryActive(entry, scanText, mode) {
    return activationOf(entry, scanText, mode).active;
  }

  // scanText：Văn bản ngữ cảnh mà extension này cung cấp cho suy diễn (hội thoại gần đây, v.v.). Bỏ qua khi kích hoạt tắt, duy trì hiện trạng 「tiêm tất cả đã chọn」.
  async function buildPromptSection(scanText) {
    const stored = readStored();
    const selectedIds = new Set(stored.ids);
    if (!selectedIds.size) return '';

    const triggerOn = triggerEnabled();
    const overrides = stored.overrides || {};
    const text = String(scanText || '');

    try {
      const entries = await loadCurrentEntries();
      const pool = entries.filter(entry => selectedIds.has(entry.id) && !entry.disabled);
      if (!pool.length) return '';

      let selectedEntries;
      if (triggerOn) {
        const decided = pool.map(entry => {
          const r = activationOf(entry, text, overrides[entry.id]);
          return { entry, active: r.active, reason: r.reason };
        });
        selectedEntries = decided.filter(d => d.active).map(d => d.entry);
        // Chi tiết khớp trên console: in ra những mục nào được tiêm mỗi vòng suy diễn/bỏ qua và lý do (nhóm thu gọn, không trôi màn hình)
        try {
          console.groupCollapsed(`[World Engine] Đèn xanh/lam Worldbook:${selectedEntries.length}/${pool.length} tiêm${text ? '' : '（văn bản quét trống, chỉ thường trú)'}`);
          decided.forEach(d => console.log(`${d.active ? '✓ tiêm' : '· bỏ qua'} | ${d.reason} | ${d.entry.world} / ${d.entry.title}`));
          console.groupEnd();
        } catch (e) {}
      } else {
        selectedEntries = pool; // Kích hoạt tắt: duy trì hiện trạng, tiêm tất cả mục đã chọn
      }

      if (!selectedEntries.length) return '';

      const content = selectedEntries.map(entry =>
        `【${entry.world} / ${entry.title}】\n${entry.content}`
      ).join('\n\n');

      return `========== mục Worldbook đã chọn ==========
Nội dung dưới đây là sự thật và ràng buộc thế giới quan của chat hiện tại. Suy diễn dưới nền phải tuân thủ; không được tự ý viết lại thiết lập đã định của nó.

${content}`;
    } catch(error) {
      console.warn('[World Engine] đọc Worldbook đã chọn thất bại:', error);
      return '';
    }
  }

  return {
    getChatId,
    hasSelection,
    getSelectedIds,
    getOverrides,
    saveSelectedIds,
    saveSelection,
    loadCurrentEntries,
    buildPromptSection,
    triggerEnabled,
    isEntryActive,
    activationOf,
    matchKey
  };
})();
