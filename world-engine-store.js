// world-engine-store.js — Lớp trung gian lưu trữ
// Chuyển toàn bộ bản lưu của World Engine từ không gian chật hẹp localStorage（khoảng 5MB，dùng chung với Tavern) sang IndexedDB（dung lượng lớn hơn hàng chục lần).
// Cung cấp cho lớp trên giao diện đọc ghi đồng bộ giống với localStorage : khi khởi động sẽ IndexedDB đổ dữ liệu vào bản sao bộ nhớ,
// đọc trực tiếp từ bản sao (đồng bộ), ghi cập nhật đồng bộ bản sao và ghi bất đồng bộ vào IndexedDB。IndexedDB tự động lùi về khi không khả dụng localStorage。
window.WORLD_ENGINE_STORE = (function() {
  const DB_NAME = 'world_engine';
  const STORE_NAME = 'kv';
  const PREFIX = 'world_engine_';

  let db = null;
  let ready = false;
  const mirror = new Map(); // key -> string value（bản sao bộ nhớ, hỗ trợ đọc đồng bộ)

  // Callback ghi (khe đồng bộ): mỗi lần setItem/removeItem sau đó thông báo cho người đăng ký.
  // Module cache Tavern (world-engine-chatcache.js）nhờ đó đưa bản lưu được cách ly theo chat vào bản sao chat_metadata，
  // thực hiện đồng bộ đa thiết bị; các module khác không cần thay đổi.hydrate() ghi trực tiếp mirror，không qua đây, nên khi đổ vào bản sao sẽ không bị dội lại.
  let syncSink = null;
  function setSyncSink(sink) { syncSink = sink; }
  function notifySink(method, key, value) {
    if (!syncSink || typeof syncSink[method] !== 'function') return;
    try { syncSink[method](key, value); } catch (e) { /* Đồng bộ thất bại không được ảnh hưởng đến ghi cục bộ */ }
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGetAll() {
    return new Promise((resolve, reject) => {
      const out = [];
      const cur = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push([c.key, c.value]); c.continue(); }
        else resolve(out);
      };
      cur.onerror = () => reject(cur.error);
    });
  }

  function idbPut(key, value) {
    if (!db) return;
    try { db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key); }
    catch (e) { console.warn('[World Engine] IndexedDB ghi thất bại', e); }
  }

  function idbDel(key) {
    if (!db) return;
    try { db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key); }
    catch (e) {}
  }

  // Gọi một lần khi khởi động: mở IndexedDB、đổ vào bản sao, di chuyển và dọn dẹp localStorage bản lưu cũ trong
  async function hydrate() {
    if (ready) return;
    try {
      db = await openDB();
      for (const [k, v] of await idbGetAll()) mirror.set(k, v);
    } catch (e) {
      console.warn('[World Engine] IndexedDB không khả dụng, lùi về localStorage', e);
      db = null;
    }
    // Đưa localStorage còn sót lại trong world_engine_* chuyển vào IndexedDB，và giải phóng localStorage không gian
    try {
      const legacyKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) legacyKeys.push(k);
      }
      for (const k of legacyKeys) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        if (!mirror.has(k)) { mirror.set(k, v); idbPut(k, v); }
        if (db) localStorage.removeItem(k); // Chỉ xoá khi IDB khả dụng (đã ghi ra đĩa), tránh mất dữ liệu
      }
      if (db && legacyKeys.length) {
        console.log(`[World Engine] Đã di chuyển ${legacyKeys.length} bản lưu đến IndexedDB`);
      }
    } catch (e) { console.warn('[World Engine] Di chuyển bản lưu cũ thất bại (không nghiêm trọng)', e); }
    ready = true;
  }

  function getItem(key) {
    if (mirror.has(key)) return mirror.get(key);
    // Bản sao không khớp (chưa hydrate hoặc IDB không khả dụng) lùi về localStorage
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function setItem(key, value) {
    value = String(value);
    mirror.set(key, value);
    if (db) idbPut(key, value);
    else localStorage.setItem(key, value); // IDB lùi về khi không khả dụng localStorage（có thể ném lỗi hạn mức)
    notifySink('onWrite', key, value);
  }

  function removeItem(key) {
    mirror.delete(key);
    if (db) idbDel(key);
    else { try { localStorage.removeItem(key); } catch (e) {} }
    notifySink('onRemove', key, null);
  }

  // trả về tất cả trong bản sao key（thay thế localStorage.length / localStorage.key(i)）
  function keys() {
    if (mirror.size || db) return [...mirror.keys()];
    const out = [];
    for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
    return out;
  }

  return { hydrate, getItem, setItem, removeItem, keys, setSyncSink };
})();
