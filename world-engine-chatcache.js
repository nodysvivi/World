// world-engine-chatcache.js — cache & bản lưu Tavern (đồng bộ đa thiết bị + bản lưu chống mất mát)
//
// Bối cảnh:world-engine-store.js đặt bản lưu ở IndexedDB / localStorage，theo "thiết bị + trình duyệt" cách ly.
// Sau khi đổi thiết bị hoặc đổi trình duyệt, những bản lưu này sẽ không đi theo. Còn SillyTavern của chat_metadata sẽ được tuần tự hoá vào tệp chat,
// lưu vào máy chủ Tavern, và đồng bộ đa thiết bị theo chính chat đó (xem script.js：khi mở chat chat_metadata tải từ đầu tệp,
// saveChat thì lại ghi lại vào đầu tệp). Module này phản chiếu bản lưu của "extension này, chat hiện tại" vào chat_metadata.world_engine，
// từ đó thực hiện hai việc:
//   1) đồng bộ thời gian thực (live）：sau khi bật, trạng thái không gian làm việc liên tục phản chiếu vào chat; đổi thiết bị mở cùng một chat là có thể viết tiếp tiến độ
//      （xung đột giải quyết theo "số bản sửa đổi mới hơn thắng"——Lamport bộ đếm, tránh phụ thuộc đồng hồ đa thiết bị).
//   2) bản lưu chat (snapshots）：đặt tên bản lưu thủ công + tự động sao lưu cuốn chiếu, có thể khôi phục / đổi tên / xuất / xoá / nhập, chống mất mát.
//
// Ràng buộc then chốt:
//   - Tuyệt đối không đưa cài đặt toàn cục (world_engine_settings，chứa API Key）ghi vào tệp chat; chỉ phản chiếu những thứ "cách ly theo chat" của 5 khoá.
//   - Luôn dùng SillyTavern.getContext() lấy tham chiếu mới nhất:chat_metadata bị thay thế toàn bộ khi chuyển chat, cache tham chiếu cũ sẽ ghi sai chat.
//   - ghi chat_metadata khi đó chỉ động đến world_engine một khoá này (updateChatMetadata làm gộp nông cấp cao nhất),
//     giữ lại integrity、extension khác (như ghi chú tác giả note）dữ liệu đã ghi không bị ghi đè.
window.WORLD_ENGINE_CHATCACHE = (function() {
  const NS = 'world_engine';            // chat_metadata khoá không gian tên dưới
  const SCHEMA_VERSION = 1;
  const MAX_AUTO_BACKUPS = 3;           // số lượng tự động sao lưu cuốn chiếu giữ lại (chống mất mát, kiểm soát dung lượng)
  const MAX_MANUAL_BACKUPS = 20;        // giới hạn bản lưu thủ công có tên (bao gồm nhập)
  const TICK_DELAY = 1500;              // debounce ghi chat (mili giây), với nhiều lần trong một lần suy diễn setItem gộp
  const SIZE_WARN_BYTES = 1024 * 1024;  // ngưỡng cảnh báo mềm dung lượng không gian tên (khoảng 1MB）

  function core() { return window.WORLD_ENGINE_CORE; }
  function api() { return window.WORLD_ENGINE_API; }
  function store() { return window.WORLD_ENGINE_STORE; }

  function getCtx() {
    try { return SillyTavern.getContext(); } catch (e) { return null; }
  }

  // hiện tại có đang ở trong "chat thực" không (có chatId và không phải placeholder default）——chỉ có ghi như vậy chat_metadata mới có ý nghĩa
  function chatUsable(ctx) {
    return !!(ctx && ctx.chatId && ctx.chatId !== 'default');
  }

  function settings() {
    const a = api();
    return a && a.getSettings ? a.getSettings() : {};
  }
  function syncEnabled() { return settings().syncToChat === true; }
  function autoBackupEnabled() { return settings().autoBackup === true; }

  // —— được cách ly theo chat 5 khoá bản lưu (đặt tên nhất quán với core.js / worldbook['js giữ nguyên']; trước khi sửa ở đây hãy đối chiếu module nguồn)——
  //   state:       world_engine_<id>                      (core.js loadState/saveState)
  //   checkpoint:  world_engine_<id>_checkpoint           (core.js getCheckpointKey)
  //   fingerprint: world_engine_<id>_fingerprint          (core.js getFingerprintKey)
  //   anchorLayer: world_engine_<id>_anchorLayer          (core.js getAnchorLayerKey，tồn đọng từ bản cũ)
  //   worldbook:   world_engine_worldbook_selection_<id>  (worldbook.js getSelectionKey)
  const SLOTS = {
    state:       id => `world_engine_${id}`,
    checkpoint:  id => `world_engine_${id}_checkpoint`,
    fingerprint: id => `world_engine_${id}_fingerprint`,
    anchorLayer: id => `world_engine_${id}_anchorLayer`,
    worldbook:   id => `world_engine_worldbook_selection_${id}`
  };
  const SLOT_NAMES = Object.keys(SLOTS);

  // Khoá số bản sửa đổi cục bộ: chỉ ghi sổ cái cục bộ trên thiết bị (Lamport bộ đếm), không thuộc về slot、không vào chat, không kích hoạt đồng bộ
  function revKey(id) { return `world_engine_${id}_syncrev`; }

  // Tạm ngưng slot đồng bộ trong quá trình cài đặt bản lưu, tránh việc "ghi lại store → lại bị coi là ghi mới và đẩy về chat" gây dội ngược
  let _suspend = false;
  // Vòng cơ sở tự động sao lưu: chỉ thêm mới một bản tự động sao lưu khi vòng tiến triển hơn mức này (lấy vòng hiện tại làm cơ sở khi mở chat)
  let _lastAutoRound = null;

  // ========== slot đóng gói / cài đặt ==========

  // kiểm tra xem một store key có thuộc về dữ liệu có thể đồng bộ của "chat hiện tại" hay không slot；nếu không thì trả về null
  function slotOfKey(key, id) {
    for (const name of SLOT_NAMES) if (SLOTS[name](id) === key) return name;
    return null;
  }

  function hasAnyLocal(id) {
    for (const name of SLOT_NAMES) if (store().getItem(SLOTS[name](id)) != null) return true;
    return false;
  }

  // bóc tách state / checkpoint chỉ để debug, có thể được ensureArrays trường xây dựng lại, giúp giảm dung lượng tệp chat
  function stripHeavy(rawJson) {
    try {
      const o = JSON.parse(rawJson);
      delete o.lastInjection;
      delete o.lastEvolveResult;
      return JSON.stringify(o);
    } catch (e) { return rawJson; }
  }

  // đem dữ liệu của chat hiện tại slot đóng gói nguyên trạng thành { slotName: rawString }（bị thiếu slot không đưa vào)
  function packChat(id) {
    const data = {};
    for (const name of SLOT_NAMES) {
      const raw = store().getItem(SLOTS[name](id));
      if (raw == null) continue;
      data[name] = (name === 'state' || name === 'checkpoint') ? stripHeavy(raw) : raw;
    }
    return data;
  }

  // từng slot so sánh hai bản pack có giống nhau không['slot giá trị đều là chuỗi'], trực tiếp === so sánh, tránh JSON.stringify tuần tự hoá hai chiều.
  // dùng để live khử trùng lặp nội dung (không có thay đổi thì không đẩy vào chat) và so sánh khử trùng lặp tự động sao lưu.
  function sameData(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  // ước tính namespace số byte sau khi tuần tự hoá:data vốn đã là chuỗi, cộng dồn các slot độ dài là được,
  // tránh mỗi lần writeNamespace đều đem toàn bộ ns（tối đa ~24 bản trạng thái hoàn chỉnh)JSON.stringify chỉ để lấy .length làm cảnh báo mềm.
  function nsSize(ns) {
    let n = 0;
    if (ns.live && ns.live.data) {
      const d = ns.live.data;
      for (const k in d) n += (d[k] || '').length;
      n += 64; // live metadata (rev/updatedAt/chatId）chi phí
    }
    if (Array.isArray(ns.snapshots)) {
      for (const s of ns.snapshots) {
        const d = s && s.data;
        if (d) for (const k in d) n += (d[k] || '').length;
        n += 80; // snapshot chi phí metadata
      }
    }
    return n;
  }

  // đem một bản pack cài đặt lại vào store；exact=true thì xoá pack không tồn tại trong slot（khôi phục chính xác)
  function installPack(data, id, exact) {
    data = data || {};
    _suspend = true;
    try {
      for (const name of SLOT_NAMES) {
        const key = SLOTS[name](id);
        if (Object.prototype.hasOwnProperty.call(data, name) && data[name] != null) {
          store().setItem(key, data[name]);
        } else if (exact) {
          // [FIX] checkpoint/fingerprint là điểm neo đếm của tự động suy diễn, nếu thiếu sẽ khiến anchor lùi về trống rỗng, kích hoạt deadlock
          //   （xem world-engine['js runAutoEvolution của anchor dự phòng']). Đám mây live['data khi thiếu hai cái này'], giữ lại giá trị cục bộ đã có,
          //   không theo exact xoá; phần còn lại slot（state/worldbook/anchorLayer）vẫn xoá theo ngữ nghĩa khôi phục chính xác.
          if (name === 'checkpoint' || name === 'fingerprint') continue;
          store().removeItem(key);
        }
      }
    } finally {
      _suspend = false;
    }
  }

  function currentRound(id) {
    try { return JSON.parse(store().getItem(SLOTS.state(id)) || '{}').round || 0; }
    catch (e) { return 0; }
  }

  // ========== chat_metadata đọc ghi namespace ==========

  function readNamespace() {
    const ctx = getCtx();
    const md = ctx && ctx.chatMetadata;
    const ns = md && md[NS];
    return (ns && typeof ns === 'object') ? ns : null;
  }

  function ensureNamespace() {
    const ns = readNamespace() || {};
    ns.v = SCHEMA_VERSION;
    if (!ns.live) ns.live = null;
    if (!Array.isArray(ns.snapshots)) ns.snapshots = [];
    pruneSnapshots(ns); // sau khi nâng cấp số lượng cũ có thể vượt quá hiện tại limit，hội tụ tức thời (bịt kín"chỉ trong lần tiếp theo addSnapshot mới prune"khoảng trống di chuyển của)
    return ns;
  }

  // ghi toàn bộ namespace và lưu trữ vào tệp chat['updateChatMetadata thực hiện shallow merge ở tầng cao nhất'], chỉ thay thế world_engine khoá.
  function writeNamespace(ns) {
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return false;
    try {
      const size = nsSize(ns);
      if (size > SIZE_WARN_BYTES) {
        console.warn(`[World Engine] kích thước cache Tavern hơi lớn (khoảng ${(size / 1024).toFixed(0)}KB），có thể làm chậm việc lưu chat, khuyên dùng giảm số lượng bản lưu.`);
      }
      if (typeof ctx.updateChatMetadata === 'function') {
        ctx.updateChatMetadata({ [NS]: ns });
      } else if (ctx.chatMetadata) {
        ctx.chatMetadata[NS] = ns; // đường lùi: gắn trực tiếp vào hiện tại chat_metadata trên
      } else {
        return false;
      }
      // lưu trữ: ưu tiên dùng bản debounce (group an toàn, sẽ tự động huỷ lưu khi chuyển chat)
      if (typeof ctx.saveMetadataDebounced === 'function') ctx.saveMetadataDebounced();
      else if (typeof ctx.saveMetadata === 'function') ctx.saveMetadata();
      else if (typeof ctx.saveChat === 'function') ctx.saveChat();
      return true;
    } catch (e) {
      console.warn('[World Engine] ghi chat_metadata thất bại', e);
      return false;
    }
  }

  // ========== Lamport số bản sửa đổi ==========

  function localRev(id) {
    const v = parseInt(store().getItem(revKey(id)) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  }
  function setLocalRev(id, rev) {
    _suspend = true; // số bản sửa đổi không phải là slot，nhưng vẫn đi theo store；treo để phòng ngừa kích hoạt tick
    try { store().setItem(revKey(id), String(rev)); } finally { _suspend = false; }
  }

  // lấy không gian làm việc cục bộ làm live đẩy lên chat, số bản sửa đổi +1（dùng cho: bật gieo mầm đồng bộ, hội tụ cục bộ mới hơn, ghim lên đầu sau khi khôi phục)
  // force=true khi đẩy vô điều kiện (sau khi khôi phục bản lưu dù nội dung giống nhau cũng phải đem live trỏ đến trạng thái sau khi khôi phục);
  // nếu không thì khi nội dung đóng gói mới và ns.live['data hoàn toàn nhất quán'], trả về hiện tại rev không +1、không ghi ra đĩa——
  // tránh không có thay đổi slot ghi vào cũng kích hoạt một lần lưu toàn bộ tệp chat (một trong những nguyên nhân chính gây giật lag tần suất cao sau khi nâng cấp).
  // trả về: mang theo nsArg khi trả về mới rev（hoặc null biểu thị chưa đẩy); không mang theo nsArg khi trả về true/false。
  function pushLiveNow(nsArg, force) {
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return nsArg ? null : false;
    const id = ctx.chatId;
    const data = packChat(id);
    // hàng rào an toàn: khi cục bộ không có bất kỳ bản lưu nào, tuyệt đối không dùng nội dung trống ghi đè lên những gì đã có trong chat live。
    // nếu không thì "thiết bị mất dữ liệu cục bộ" một khi bật đồng bộ trước, sẽ xoá sạch bản lưu thực sự ở nơi khác (exact cài đặt sẽ xoá slot）。
    if (Object.keys(data).length === 0) return nsArg ? null : false;
    const ns = nsArg || ensureNamespace();
    // khử trùng lặp nội dung: khi không có thay đổi thì không đẩy, không bump rev（force ngoại trừ)
    if (!force && ns.live && ns.live.chatId === id && sameData(ns.live.data, data)) {
      const curRev = (ns.live && ns.live.rev) || localRev(id);
      return nsArg ? curRev : true;
    }
    const rev = Math.max(localRev(id), (ns.live && ns.live.rev) || 0) + 1;
    ns.live = { rev, updatedAt: Date.now(), chatId: id, data };
    if (nsArg) return rev; // bên gọi chịu trách nhiệm writeNamespace + setLocalRev
    if (writeNamespace(ns)) { setLocalRev(id, rev); return true; }
    return false;
  }

  // ========== callback khe đồng bộ + debounce tick ==========

  let _tickTimer = null;
  function scheduleTick() {
    if (!syncEnabled() && !autoBackupEnabled()) return;
    if (_tickTimer) clearTimeout(_tickTimer);
    _tickTimer = setTimeout(() => { _tickTimer = null; runTick(); }, TICK_DELAY);
  }

  // một lần tick đưa 「live đồng bộ」và「tự động sao lưu」gộp thành một lần ghi chat, giảm số lần lưu chat
  function runTick() {
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return;
    const id = ctx.chatId;
    if (!syncEnabled() && !autoBackupEnabled()) return;
    const ns = ensureNamespace();
    let changed = false;
    let revToSet = null;

    if (syncEnabled()) {
      const prevRev = (ns.live && ns.live.rev) || 0;
      const r = pushLiveNow(ns, false); // khử trùng lặp nội dung: trả về hiện tại khi không có thay đổi rev、không cập nhật ns.live
      if (r != null && r !== prevRev) { revToSet = r; changed = true; }
    }
    if (autoBackupEnabled() && addAutoBackupIfAdvanced(ns, id)) {
      changed = true;
    }
    if (changed && writeNamespace(ns) && revToSet != null) setLocalRev(id, revToSet);
  }

  function onStoreWrite(key, value) {
    if (_suspend) return;
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return;
    if (!slotOfKey(key, ctx.chatId)) return; // chỉ quan tâm đến chat hiện tại slot；khoá cài đặt, các khoá chat khác đều bỏ qua
    scheduleTick();
  }
  function onStoreRemove(key) { onStoreWrite(key, null); }

  // ========== tải chat: khôi phục đồng bộ thời gian thực / hội tụ ==========

  function onChatLoaded() {
    // vứt bỏ phần còn sót lại của chat trước pending tick，tránh nó ở B ngữ cảnh vô tình ghi ra đĩa / tạo tự động sao lưu
    if (_tickTimer) { clearTimeout(_tickTimer); _tickTimer = null; }
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return;
    const id = ctx.chatId;
    _lastAutoRound = currentRound(id); // lấy vòng lúc mở làm đường cơ sở, chỉ tự động sao lưu khi thúc đẩy sau đó
    if (!syncEnabled()) return;        // khi tắt đồng bộ thời gian thực không tự động sửa không gian làm việc cục bộ (bản lưu hoàn toàn thủ công)

    const ns = readNamespace();
    const lr = localRev(id);
    const remoteData = (ns && ns.live && ns.live.data) || {};
    const remoteRev = (ns && ns.live && ns.live.rev) || 0;
    // trong chat vẫn chưa có live（hoặc live nội dung trống / đã hỏng): nếu cục bộ có dữ liệu thì đẩy lên làm hạt giống
    if (!ns || !ns.live || Object.keys(remoteData).length === 0) {
      if (hasAnyLocal(id)) pushLiveNow();
      return;
    }
    if (remoteRev > lr) {
      installPack(remoteData, id, true); // đám mây mới hơn → sử dụng
      setLocalRev(id, remoteRev);
      console.log(`[World Engine] cache Tavern: sử dụng bản lưu mới hơn trên đám mây rev ${remoteRev}（cục bộ ${lr}）`);
    } else if (remoteRev < lr) {
      pushLiveNow(); // cục bộ mới hơn → đẩy lên hội tụ
    }
    // remoteRev === lr：đã đồng bộ, không cần xử lý
  }

  // ========== bản lưu / sao lưu ==========

  function genId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addSnapshot(ns, snap, id) {
    snap.id = snap.id || genId();
    snap.createdAt = snap.createdAt || Date.now();
    snap.chatId = id;
    snap.v = SCHEMA_VERSION;
    ns.snapshots.unshift(snap); // mới→cũ
    pruneSnapshots(ns);
    return snap;
  }

  // tự động sao lưu cuốn chiếu giữ lại MAX_AUTO_BACKUPS mục; thủ công / nhập giữ lại MAX_MANUAL_BACKUPS mục; duy trì mới ban đầu→thứ tự cũ
  function pruneSnapshots(ns) {
    const keepAuto = ns.snapshots.filter(s => s.auto).slice(0, MAX_AUTO_BACKUPS);
    const keepManual = ns.snapshots.filter(s => !s.auto).slice(0, MAX_MANUAL_BACKUPS);
    ns.snapshots = ns.snapshots.filter(s => (s.auto ? keepAuto : keepManual).includes(s));
  }

  function addAutoBackupIfAdvanced(ns, id) {
    const round = currentRound(id);
    if (round <= 0) return false;
    if (_lastAutoRound != null && round <= _lastAutoRound) return false;
    const packed = packChat(id);
    const newestAuto = ns.snapshots.find(s => s.auto);
    if (newestAuto && sameData(newestAuto.data, packed)) {
      _lastAutoRound = round; // giống với nội dung tự động sao lưu mới nhất → bỏ qua, nhưng cập nhật đường cơ sở
      return false;
    }
    addSnapshot(ns, { name: `tự động sao lưu · thứ${round}vòng`, auto: true, round, data: packed }, id);
    _lastAutoRound = round;
    return true;
  }

  // —— đối ngoại (UI）giao diện ——

  function listSnapshots() {
    const ns = readNamespace();
    return ns && Array.isArray(ns.snapshots) ? ns.snapshots.slice() : [];
  }

  // đặt tên bản lưu thủ công; trả về bản đã tạo snapshot hoặc null
  function createSnapshot(name) {
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return null;
    const id = ctx.chatId;
    if (!hasAnyLocal(id)) return null;
    const ns = ensureNamespace();
    const round = currentRound(id);
    const snap = addSnapshot(ns, {
      name: String(name || `bản lưu · thứ${round}vòng`).trim().slice(0, 60) || `bản lưu · thứ${round}vòng`,
      auto: false, round, data: packChat(id)
    }, id);
    return writeNamespace(ns) ? snap : null;
  }

  // khôi phục bản lưu nào đó vào chat hiện tại (ghi đè không gian làm việc). tự động sao lưu trạng thái hiện tại trước khi khôi phục để có thể hoàn tác.
  function restoreSnapshot(snapId) {
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return false;
    const id = ctx.chatId;
    const ns = ensureNamespace();
    const snap = ns.snapshots.find(s => s.id === snapId);
    if (!snap) return false;
    if (hasAnyLocal(id)) {
      addSnapshot(ns, {
        name: `tự động sao lưu trước khi khôi phục · thứ${currentRound(id)}vòng`, auto: true, round: currentRound(id), data: packChat(id)
      }, id);
    }
    installPack(snap.data, id, true);
    normalizeAfterRestore(id); // tầng/chuẩn hoá vân tay theo số tầng hiện tại, tránh bị nhận diện nhầm là trùng roll（nhất quán với 「nhập dữ liệu」)
    // trên cùng một ns cập nhật trên live（trỏ đến trạng thái sau khi khôi phục), cuối cùng chỉ ghi ra đĩa một lần, tránh hai lần writeNamespace ghi đè lẫn nhau
    let revToSet = null;
    if (syncEnabled()) revToSet = pushLiveNow(ns, true); // force：sau khi khôi phục dù nội dung giống nhau cũng phải đem live trỏ đến trạng thái sau khi khôi phục, tránh lần sau onChatLoaded bị giá trị cũ trên đám mây ghi đè
    if (writeNamespace(ns) && revToSet != null) setLocalRev(id, revToSet);
    return true;
  }

  // sau khi khôi phục bản lưu lịch sử: đem state/checkpoint của chatLayer、fingerprint căn chỉnh theo "số tầng hội thoại hiện tại".
  // với ui.js logic "nhập dữ liệu" nhất quán, nếu không thì số tầng cũ sẽ khiến việc tiêm nội dung chính/suy diễn đánh giá nhầm vòng này là reroll roll。
  function normalizeAfterRestore(id) {
    const layer = core().getChatLayer();
    _suspend = true;
    try {
      const stateRaw = store().getItem(SLOTS.state(id));
      if (stateRaw != null) {
        const st = JSON.parse(stateRaw); st.chatLayer = layer;
        store().setItem(SLOTS.state(id), JSON.stringify(st));
      }
      const cpRaw = store().getItem(SLOTS.checkpoint(id));
      if (cpRaw != null) {
        const cp = JSON.parse(cpRaw); cp.chatLayer = layer;
        store().setItem(SLOTS.checkpoint(id), JSON.stringify(cp));
      }
      store().setItem(SLOTS.fingerprint(id), String(layer));
    } catch (e) {
      console.warn('[World Engine] chuẩn hoá sau khi khôi phục thất bại', e);
    } finally {
      _suspend = false;
    }
  }

  function renameSnapshot(snapId, name) {
    const ns = ensureNamespace();
    const snap = ns.snapshots.find(s => s.id === snapId);
    if (!snap) return false;
    snap.name = String(name || snap.name).trim().slice(0, 60) || snap.name;
    return writeNamespace(ns);
  }

  function deleteSnapshot(snapId) {
    const ns = ensureNamespace();
    const before = ns.snapshots.length;
    ns.snapshots = ns.snapshots.filter(s => s.id !== snapId);
    if (ns.snapshots.length === before) return false;
    return writeNamespace(ns);
  }

  // xuất một bản lưu thành đối tượng có thể tải xuống (UI chịu trách nhiệm ghi thành tệp)
  function exportSnapshot(snapId) {
    const ns = readNamespace();
    const snap = ns && ns.snapshots.find(s => s.id === snapId);
    if (!snap) return null;
    return {
      type: 'world-engine-chat-snapshot', v: SCHEMA_VERSION,
      name: snap.name, round: snap.round, createdAt: snap.createdAt,
      exportedAt: Date.now(), data: snap.data
    };
  }

  // nhập từ đối tượng xuất thành một bản lưu mới; trả về bản lưu đã tạo snapshot hoặc null
  function importSnapshot(obj) {
    const ctx = getCtx();
    if (!ctx || !chatUsable(ctx)) return null;
    if (!obj || obj.type !== 'world-engine-chat-snapshot' || !obj.data || typeof obj.data !== 'object') return null;
    const ns = ensureNamespace();
    const snap = addSnapshot(ns, {
      name: (String(obj.name || 'nhập bản lưu').trim().slice(0, 52) || 'nhập bản lưu') + '（nhập)',
      auto: false, round: obj.round || 0, data: obj.data
    }, ctx.chatId);
    return writeNamespace(ns) ? snap : null;
  }

  // dùng để hiển thị trạng thái bảng điều khiển
  function getStatus() {
    const ctx = getCtx();
    const usable = chatUsable(ctx);
    const ns = readNamespace();
    return {
      usable,
      chatId: usable ? ctx.chatId : null,
      apiAvailable: !!(ctx && typeof ctx.updateChatMetadata === 'function' && typeof ctx.saveMetadataDebounced === 'function'),
      syncEnabled: syncEnabled(),
      autoBackupEnabled: autoBackupEnabled(),
      liveRev: ns && ns.live ? ns.live.rev : 0,
      localRev: usable ? localRev(ctx.chatId) : 0,
      liveUpdatedAt: ns && ns.live ? ns.live.updatedAt : null,
      snapshotCount: ns && ns.snapshots ? ns.snapshots.length : 0
    };
  }

  // ========== khởi tạo ==========

  let _inited = false;
  function init() {
    if (_inited) return;
    _inited = true;
    store().setSyncSink({ onWrite: onStoreWrite, onRemove: onStoreRemove });
    // khi tải extension, chat thường đã sẵn sàng (làm mới trang, bật extension giữa chừng): thực hiện khôi phục một lần cho chat hiện tại / hội tụ
    try { onChatLoaded(); } catch (e) { console.warn('[World Engine] khôi phục khởi tạo cache Tavern thất bại', e); }
  }

  return {
    init, onChatLoaded, pushLiveNow, getStatus,
    listSnapshots, createSnapshot, restoreSnapshot, renameSnapshot, deleteSnapshot,
    exportSnapshot, importSnapshot
  };
})();
