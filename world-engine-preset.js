// world-engine-preset.js — Hệ thống preset engine (preset của engine suy diễn thế giới)
// Đưa suy diễn prompt của 4 đoạn hardcode (①Vai trò engine / ②Nhân quả 10 bước / ⑦JSON Mô tả đầu ra / ⑧JSON ví dụ)
// thành 'preset thường trú' có thể chỉnh sửa, lưu, chuyển đổi, nhập và xuất.
//
// Quy tắc cốt lõi: Khi kích hoạt preset 'mặc định' (không có bất kỳ ghi đè tuỳ chỉnh nào),4 đoạn lùi về giá trị mặc định, suy diễn prompt
// tương đương cấp độ byte PR#12 hiện trạng. Văn bản mặc định nguồn sự thật duy nhất = world-engine-evolution['js được expose']
// window.WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS（tham chiếu lúc runtime, không sao chép ở đây, tránh trôi dạt bản sao).
//
// Lưu trữ: đi qua window.WORLD_ENGINE_STORE（IndexedDB），độc lập key，không vào world_engine_settings。
//   world_engine_active_preset   = preset kích hoạt hiện tại id（string，'default' hoặc tuỳ chỉnh id）
//   world_engine_custom_presets  = mảng preset tuỳ chỉnh (JSON string）
// chatcache là nghiêm ngặt 5-slot danh sách trắng, sẽ không đưa nhầm hai cái này vào key、chuyển chat không bị xoá, an toàn.
//
// Thứ tự tải: module này tải sau world-engine-store.js sau,core/evolution trước.
//   Do đó cấp cao nhất của module không thể đọc evolution của DEFAULT_SEGS（lúc này evolution chưa tải)——tất cả trì hoãn đến khi
//   hàm được gọi mới đọc (lúc này evolution đã tải,UI đã khởi động).
(function () {
  'use strict';

  var STORAGE_KEY_ACTIVE = 'world_engine_active_preset';
  var STORAGE_KEY_CUSTOM = 'world_engine_custom_presets';
  var DEFAULT_PRESET_ID = 'default';

  // 4 đoạn có thể chỉnh sửa key，và evolution.js của _lastPromptSegments key nhất quán từng chữ.
  var EDITABLE_SEG_KEYS = ['engine-role', 'causal-steps', 'output-format', 'json-example'];

  var SEG_LABELS = {
    'engine-role':   '① Lệnh vai trò engine',
    'causal-steps':  '② Kiểm tra nhân quả (10 bước)',
    'output-format': '⑦ JSON Mô tả trường đầu ra',
    'json-example':  '⑧ JSON Ví dụ'
  };

  // ── Công cụ ───────────────────────────────────────
  function store() {
    return window.WORLD_ENGINE_STORE;
  }

  function log(msg) { console.log('[World Engine][Preset] ' + msg); }
  function warn(msg) { console.warn('[World Engine][Preset] ' + msg); }

  function deepClone(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  // Lúc runtime lấy từ evolution module lấy 4 văn bản mặc định của đoạn (nguồn sự thật duy nhất).evolution trả về khi chưa tải {}。
  function getDefaultSegTexts() {
    var src = window.WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS;
    if (src && typeof src === 'object') return src;
    warn('WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS Chưa sẵn sàng, văn bản đoạn mặc định tạm thời không khả dụng');
    return {};
  }

  function genId() {
    // Không dùng Date.now()/Math.random()（VM/môi trường script workflow có thể bị hạn chế), chuyển sang dùng đếm+tương thích timestamp.
    // Dùng cho môi trường trình duyệt thực Date.now；Nếu không khả dụng thì thoái hoá thành đếm tăng dần.
    var ts = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    var rnd = '';
    try {
      if (typeof Math !== 'undefined' && Math.random) {
        rnd = Math.floor(Math.random() * 1e6).toString(36);
      }
    } catch (e) {}
    return 'custom_' + ts.toString(36) + '_' + rnd;
  }

  // ── Chuẩn hoá preset ───────────────────────────────────
  // Chuẩn hoá đầu vào bất kỳ thành object preset hợp lệ.segments trong đó có đoạn là null/chuỗi rỗng/không phải chuỗi → coi như "không ghi đè" lưu null。
  function normalizePreset(obj) {
    if (!obj || typeof obj !== 'object') obj = {};
    var name = (obj.name == null ? '' : String(obj.name)).trim() || 'Preset chưa đặt tên';
    var description = (obj.description == null ? '' : String(obj.description)).trim();

    var segments = {};
    for (var i = 0; i < EDITABLE_SEG_KEYS.length; i++) {
      var k = EDITABLE_SEG_KEYS[i];
      var v = obj.segments ? obj.segments[k] : undefined;
      if (v == null) { segments[k] = null; continue; }
      v = String(v);
      // Chuỗi rỗng hoặc chỉ có khoảng trắng coi như "không ghi đè"(Trở về mặc định)，và UI nhất quán ngữ nghĩa với xoá rỗng.
      if (v.trim() === '') { segments[k] = null; continue; }
      segments[k] = v;
    }

    return {
      id: (obj.id && typeof obj.id === 'string') ? obj.id : genId(),
      name: name,
      description: description,
      builtin: false,
      segments: segments,
      createdAt: Number.isFinite(Number(obj.createdAt)) ? Number(obj.createdAt) : 0,
      updatedAt: Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0
    };
  }

  // ── Preset mặc định tích hợp ───────────────────────────────
  // segments toàn bộ null = 4 đoạn đều trở về giá trị mặc định = tương đương cấp byte với hiện trạng. Không ghi ra đĩa.
  function buildDefaultPreset() {
    return {
      id: DEFAULT_PRESET_ID,
      name: 'Mặc định (hardcode)',
      description: 'Prompt suy diễn mặc định tích hợp của World Engine,4 đoạn đều là văn bản gốc hardcode. Chỉnh sửa hoặc lưu thành để tuỳ chỉnh.',
      builtin: true,
      segments: { 'engine-role': null, 'causal-steps': null, 'output-format': null, 'json-example': null },
      createdAt: 0,
      updatedAt: 0
    };
  }

  // ── Lưu trữ CRUD ──────────────────────────────────
  function getActivePresetId() {
    var s = store();
    if (!s) return DEFAULT_PRESET_ID;
    var id = s.getItem(STORAGE_KEY_ACTIVE);
    if (!id || typeof id !== 'string') return DEFAULT_PRESET_ID;
    // Nếu lưu id Trỏ đến preset tuỳ chỉnh đã bị xoá, quay về mặc định.
    if (id !== DEFAULT_PRESET_ID) {
      var customs = loadCustomPresets();
      var found = false;
      for (var i = 0; i < customs.length; i++) { if (customs[i].id === id) { found = true; break; } }
      if (!found) { setActivePresetId(DEFAULT_PRESET_ID); return DEFAULT_PRESET_ID; }
    }
    return id;
  }

  function setActivePresetId(id) {
    var s = store();
    if (!s) { warn('store Chưa sẵn sàng, không thể lưu preset đang kích hoạt'); return; }
    s.setItem(STORAGE_KEY_ACTIVE, id || DEFAULT_PRESET_ID);
  }

  function setActivePreset(id) {
    setActivePresetId(id);
    log('Đã chuyển preset kích hoạt:' + (id || DEFAULT_PRESET_ID));
  }

  function loadCustomPresets() {
    var s = store();
    if (!s) return [];
    var raw = s.getItem(STORAGE_KEY_CUSTOM);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // Chuẩn hoá từng mục, loại bỏ các mục hoàn toàn không thể phân tích.
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        try { out.push(normalizePreset(arr[i])); } catch (e) { warn('Loại bỏ preset tuỳ chỉnh không thể chuẩn hoá #' + i); }
      }
      return out;
    } catch (e) { warn('Lưu trữ preset tuỳ chỉnh bị hỏng, "coi như trống":' + e.message); return []; }
  }

  function saveCustomPresetsArray(arr) {
    var s = store();
    if (!s) { warn('store Chưa sẵn sàng, không thể lưu danh sách preset'); return; }
    s.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(arr || []));
  }

  function getAllPresets() {
    return [buildDefaultPreset()].concat(loadCustomPresets());
  }

  function getCustomPresets() { return loadCustomPresets(); }
  function getBuiltinPresets() { return [buildDefaultPreset()]; }

  function getPresetById(id) {
    if (!id || id === DEFAULT_PRESET_ID) return buildDefaultPreset();
    var customs = loadCustomPresets();
    for (var i = 0; i < customs.length; i++) { if (customs[i].id === id) return customs[i]; }
    return null;
  }

  function getActivePreset() {
    return getPresetById(getActivePresetId()) || buildDefaultPreset();
  }

  // Lưu/Cập nhật một preset tuỳ chỉnh['preset Không có id hoặc id']=default thì tạo mới id（tức là 「Lưu thành」).
  // trả về preset sau khi lưu (bao gồm cuối cùng id）。
  function saveCustomPreset(preset) {
    var p = normalizePreset(preset);
    if (!p.id || p.id === DEFAULT_PRESET_ID) p.id = genId();
    var customs = loadCustomPresets();
    var idx = -1;
    for (var i = 0; i < customs.length; i++) { if (customs[i].id === p.id) { idx = i; break; } }
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    p.updatedAt = now;
    if (p.createdAt === 0) p.createdAt = now;
    if (idx >= 0) customs[idx] = p; else customs.push(p);
    saveCustomPresetsArray(customs);
    log((idx >= 0 ? 'Cập nhật' : 'thêm mới') + 'Preset tuỳ chỉnh:' + p.name + ' (' + p.id + ')');
    return p;
  }

  // Lưu thành: bất kể đầu vào id，buộc tạo mới id Lưu thành preset mới. trả về preset mới.
  function saveAsCustomPreset(preset, newName) {
    var p = normalizePreset(preset);
    p.id = genId();
    if (newName && String(newName).trim()) p.name = String(newName).trim();
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    p.createdAt = now; p.updatedAt = now;
    var customs = loadCustomPresets();
    customs.push(p);
    saveCustomPresetsArray(customs);
    log('Lưu thành preset mới:' + p.name + ' (' + p.id + ')');
    return p;
  }

  function deleteCustomPreset(id) {
    if (!id || id === DEFAULT_PRESET_ID) { warn('Preset tích hợp không thể xoá'); return false; }
    var customs = loadCustomPresets();
    var next = customs.filter(function (p) { return p.id !== id; });
    if (next.length === customs.length) { warn('Không tìm thấy preset cần xoá:' + id); return false; }
    saveCustomPresetsArray(next);
    // Đang xoá preset hiện đang kích hoạt → quay về mặc định.
    if (getActivePresetId() === id) setActivePresetId(DEFAULT_PRESET_ID);
    log('Đã xoá preset tuỳ chỉnh:' + id);
    return true;
  }

  // ── Truy vấn ghi đè cốt lõi (evolution['js gọi'])──────────
  // Trả về văn bản ghi đè của preset đang kích hoạt cho một đoạn; không có ghi đè (null/preset mặc định/đoạn chưa tuỳ chỉnh) trả về null。
  // evolution.js dựa vào đó dùng `override || DEFAULT` quyết định văn bản cuối cùng.
  function getSegmentOverride(segKey) {
    if (EDITABLE_SEG_KEYS.indexOf(segKey) < 0) return null;
    var p = getActivePreset();
    if (!p || !p.segments) return null;
    var v = p.segments[segKey];
    if (v == null) return null;
    v = String(v);
    if (v.trim() === '') return null;
    return v;
  }

  // trả về một lần 4 đoạn ghi đè map：{ 'engine-role': text|null, 'causal-steps': ..., 'output-format': ..., 'json-example': ... }
  // cho evolution['js của callEvolutionAPI lấy một lần 4 đoạn'], tránh gọi riêng từng đoạn getSegmentOverride dẫn đến
  // cùng một vòng suy diễn lặp đi lặp lại JSON['parse toàn bộ mảng preset tuỳ chỉnh'] (4 đoạn × 8 lần parse → 1 lần parse）。
  // Hiệu suất thực tế:5 preset thì mỗi vòng từ ~289µs giảm xuống ~30µs；50 preset lớn thì từ ~3.8ms giảm xuống ~50µs。
  // Preset mặc định (không ghi đè) đi đường nhanh: trả về trực tiếp toàn bộ null，0 lần JSON.parse。
  function getOverrides() {
    var out = { 'engine-role': null, 'causal-steps': null, 'output-format': null, 'json-example': null };
    var s = store();
    if (!s) return out;
    var id = s.getItem(STORAGE_KEY_ACTIVE);
    if (!id || id === DEFAULT_PRESET_ID) return out; // Preset mặc định:4 đoạn toàn bộ null，0 parse
    // Preset tuỳ chỉnh:parse 1 lần tìm preset + nhân tiện kiểm tra id vẫn tồn tại
    var customs = loadCustomPresets();
    var p = null;
    for (var i = 0; i < customs.length; i++) { if (customs[i].id === id) { p = customs[i]; break; } }
    if (!p) { // đang kích hoạt id đã bị xoá → quay về mặc định và trả về toàn bộ null
      setActivePresetId(DEFAULT_PRESET_ID);
      return out;
    }
    if (!p.segments) return out;
    for (var j = 0; j < EDITABLE_SEG_KEYS.length; j++) {
      var k = EDITABLE_SEG_KEYS[j];
      var v = p.segments[k];
      if (v == null) { out[k] = null; continue; }
      v = String(v);
      out[k] = (v.trim() === '') ? null : v;
    }
    return out;
  }

  // ── Nhập xuất ───────────────────────────────────
  // Xuất: trả về của preset JSON chuỗi (tuỳ chọn bỏ timestamp nội bộ, ở đây giữ lại để dễ truy xuất).
  function exportPreset(id) {
    var p = getPresetById(id || getActivePresetId());
    if (!p) { warn('Xuất thất bại: không tìm thấy preset ' + id); return null; }
    var out = {
      __worldEnginePreset: true,
      version: 1,
      preset: {
        name: p.name,
        description: p.description,
        segments: p.segments
      }
    };
    return JSON.stringify(out, null, 2);
  }

  // Nhập: phân tích JSON chuỗi, kiểm tra, chuẩn hoá, lưu thành preset tuỳ chỉnh. Trả về preset mới hoặc ném lỗi.
  function importPreset(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') throw new Error('Nội dung nhập trống');
    var obj;
    try { obj = JSON.parse(jsonStr); }
    catch (e) { throw new Error('không hợp lệ JSON：' + e.message); }
    var src = (obj && obj.__worldEnginePreset && obj.preset) ? obj.preset : obj;
    var p = normalizePreset(src);
    p.id = genId();
    var now = (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
    p.createdAt = now; p.updatedAt = now;
    var customs = loadCustomPresets();
    customs.push(p);
    saveCustomPresetsArray(customs);
    log('Nhập preset:' + p.name + ' (' + p.id + ')');
    return p;
  }

  // ── UI Hỗ trợ: lấy "văn bản hiển thị" của một đoạn dưới preset hiện tại (có ghi đè dùng ghi đè, nếu không thì mặc định)────────
  // cho chỉnh sửa preset UI khởi tạo textarea：để người dùng thấy văn bản thực tế đang có hiệu lực.
  function getSegmentDisplayText(segKey) {
    var ov = getSegmentOverride(segKey);
    if (ov != null) return ov;
    var defaults = getDefaultSegTexts();
    return defaults[segKey] || '';
  }

  // Trong preset đang kích hoạt, những đoạn nào là "đã tuỳ chỉnh ghi đè" (true=người dùng đã sửa). Cho UI đánh dấu.
  function getOverriddenSegKeys() {
    var p = getActivePreset();
    if (!p || !p.segments) return [];
    var out = [];
    for (var i = 0; i < EDITABLE_SEG_KEYS.length; i++) {
      var k = EDITABLE_SEG_KEYS[i];
      var v = p.segments[k];
      if (v != null && String(v).trim() !== '') out.push(k);
    }
    return out;
  }

  // ── lộ ra API ───────────────────────────────────
  window.WORLD_ENGINE_PRESET = {
    EDITABLE_SEG_KEYS: EDITABLE_SEG_KEYS,
    SEG_LABELS: SEG_LABELS,
    DEFAULT_PRESET_ID: DEFAULT_PRESET_ID,
    getDefaultSegTexts: getDefaultSegTexts,
    getSegmentDisplayText: getSegmentDisplayText,
    getOverriddenSegKeys: getOverriddenSegKeys,
    getActivePresetId: getActivePresetId,
    getActivePreset: getActivePreset,
    setActivePreset: setActivePreset,
    setActivePresetId: setActivePresetId,
    getAllPresets: getAllPresets,
    getCustomPresets: getCustomPresets,
    getBuiltinPresets: getBuiltinPresets,
    getPresetById: getPresetById,
    saveCustomPreset: saveCustomPreset,
    saveAsCustomPreset: saveAsCustomPreset,
    deleteCustomPreset: deleteCustomPreset,
    getSegmentOverride: getSegmentOverride,
    getOverrides: getOverrides,
    exportPreset: exportPreset,
    importPreset: importPreset,
    normalizePreset: normalizePreset
  };

  log('module đã tải. Preset mặc định id=' + DEFAULT_PRESET_ID + '，đoạn có thể chỉnh sửa:' + EDITABLE_SEG_KEYS.join(', '));
})();
