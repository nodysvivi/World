// sandbox khẳng định ngoại tuyến v2.3.19：reroll roll tiêu chí tiêm chuyển sang dùng mặc định của Tavern type（swipe/regenerate）+ dryRun bỏ qua.
// phát lại tương đương world-engine['js của onGenerationStarted'](type,opts,dryRun) → applyInjectionForCurrentRound(opts)
// và evolution.js evolve() cơ sở/chia ba vòng (cái sau v2.3.18 đã xác minh, ở đây chạy lại bảo vệ hồi quy).

const assert = require('assert');

// ───────── onGenerationStarted：đưa Tavern type/dryRun dịch thành isReroll / có bỏ qua không ─────────
// sao chép từ world-engine.js onGenerationStarted
function onGenStarted(type, dryRun) {
  if (dryRun) return { skipped: true };            // vòng khởi động không đánh giá lại tiêm
  const isReroll = (type === 'swipe' || type === 'regenerate');
  return { skipped: false, isReroll };
}

// ───────── applyInjectionForCurrentRound(opts)：reroll roll dựa vào opts.isReroll，nếu không thì đi chatLayer dự phòng ─────────
// sao chép từ world-engine.js applyInjectionForCurrentRound
function decideInjection(state, chatLayer, checkpoint, opts) {
  const isReroll = !!(opts && opts.isReroll);
  if (isReroll) {
    if (checkpoint) return { branch: 'reroll-cp', inject: 'checkpoint', cpRound: checkpoint.round };
    return { branch: 'reroll-none', inject: 'none' };
  }
  const stateLayer = Number.isFinite(Number(state.chatLayer)) ? Number(state.chatLayer) : chatLayer;
  if (chatLayer < stateLayer) {
    if (checkpoint) return { branch: 'less-cp', inject: 'checkpoint', cpRound: checkpoint.round };
    return { branch: 'less-fallback', inject: 'state' };
  }
  return { branch: 'ge-current', inject: 'state' };
}

// thứ 6 vòng forward hoàn thành:state.round=6, state.chatLayer=20, cp=thứ 5 vòng
function makeState6() { return { round: 6, chatLayer: 20 }; }
function cp5() { return { round: 5, chatLayer: 18 }; }

// ═══════ G1-G5：onGenerationStarted type dịch ═══════
{
  // G1 normal tạo mới → không phải reroll roll，không bỏ qua
  const r = onGenStarted('normal', false);
  assert.deepStrictEqual(r, { skipped: false, isReroll: false }, 'G1');
  console.log('✓ G1 type=normal → không phải reroll roll');
}
{
  // G2 swipe（mũi tên)→ reroll roll
  const r = onGenStarted('swipe', false);
  assert.deepStrictEqual(r, { skipped: false, isReroll: true }, 'G2');
  console.log('✓ G2 type=swipe → reroll roll');
}
{
  // G3 regenerate（tạo lại ở dưới cùng)→ reroll roll ★người dùng thực tế dùng cái này★
  const r = onGenStarted('regenerate', false);
  assert.deepStrictEqual(r, { skipped: false, isReroll: true }, 'G3');
  console.log('✓ G3 type=regenerate → reroll roll（★đường dẫn thực tế người dùng kiểm tra★）');
}
{
  // G4 dryRun（khởi động plugin cơ sở dữ liệu/tính token）→ bỏ qua, không đánh giá lại tiêm
  const r = onGenStarted('normal', true);
  assert.deepStrictEqual(r, { skipped: true }, 'G4');
  console.log('✓ G4 dryRun → bỏ qua (không còn 「tạo xong lại tiêm」)');
}
{
  // G5 continue（viết tiếp)→ không phải reroll roll（tiếp tục hiện tại AI tầng viết, tiêm trạng thái hiện tại)
  const r = onGenStarted('continue', false);
  assert.deepStrictEqual(r, { skipped: false, isReroll: false }, 'G5');
  console.log('✓ G5 type=continue → không phải reroll roll（tiêm trạng thái hiện tại)');
}

// ═══════ I1-I6：đánh giá tiêm (sửa lỗi v2.3.18 hiện trường hồi quy)═══════
{
  // I1 ★hồi quy cốt lõi★：gửi tin nhắn vòng mới,GEN_STARTED khi tầng người dùng chưa ghi ra đĩa chatLayer vẫn==20==state.chatLayer，
  //   nhưng type=normal → isReroll=false → tiêm trạng thái hiện tại (không còn bị đánh giá nhầm thành reroll roll điểm lưu tiêm)
  const r = decideInjection(makeState6(), 20, cp5(), { isReroll: false });
  assert.strictEqual(r.branch, 'ge-current', 'I1 branch');
  assert.strictEqual(r.inject, 'state', 'I1 inject');
  console.log('✓ I1 ★gửi tin nhắn vòng mới chatLayer==state['chatLayer nhưng type']=normal → tiêm trạng thái hiện tại (trị v2.3.18 hồi quy)★');
}
{
  // I2 reroll thật roll（regenerate）cùng tầng có cp → điểm lưu tiêm
  const r = decideInjection(makeState6(), 20, cp5(), { isReroll: true });
  assert.strictEqual(r.branch, 'reroll-cp', 'I2 branch');
  assert.strictEqual(r.cpRound, 5, 'I2 cpRound=5');
  console.log('✓ I2 reroll thật roll(regenerate) → tiêm thứ 5 điểm lưu vòng');
}
{
  // I3 reroll thật roll không có cp → không tiêm
  const r = decideInjection(makeState6(), 20, null, { isReroll: true });
  assert.strictEqual(r.branch, 'reroll-none', 'I3 branch');
  console.log('✓ I3 reroll thật roll không có cp → không tiêm');
}
{
  // I4 vòng mới AI tầng đã ghi ra đĩa (chatLayer 22 > 20）type=normal → tiêm trạng thái hiện tại
  const r = decideInjection(makeState6(), 22, cp5(), { isReroll: false });
  assert.strictEqual(r.branch, 'ge-current', 'I4 branch');
  console.log('✓ I4 vòng mới AI tầng ghi ra đĩa(22>20) type=normal → tiêm trạng thái hiện tại');
}
{
  // I5 xoá ngược về tầng cũ (chatLayer 15 < 20）không phải reroll roll → vẫn chạy < điểm lưu tiêm nhánh
  const r = decideInjection(makeState6(), 15, cp5(), { isReroll: false });
  assert.strictEqual(r.branch, 'less-cp', 'I5 branch');
  console.log('✓ I5 xoá ngược tầng cũ(15<20) → điểm lưu tiêm (dự phòng không đổi)');
}
{
  // I6 trống trước suy diễn đầu state（chatLayer bất kỳ) không reroll roll → tiêm trạng thái hiện tại (mặc định)
  const r = decideInjection({ round: 0, chatLayer: undefined }, 4, null, { isReroll: false });
  assert.strictEqual(r.branch, 'ge-current', 'I6 branch');
  console.log('✓ I6 trống trước suy diễn đầu state → tiêm trạng thái hiện tại (mặc định)');
}

// ═══════ E1-E5：evolution cơ sở/bảo vệ hồi quy ba phần vòng (v2.3.18 logic không đổi)═══════
function isNewRoundSim(fp, chatLayerNow) {
  if (fp === '' || fp == null) return true;
  return fp !== String(chatLayerNow);
}
function evolveSim({ mode, state, cp, hadStoredState, chatLayerNow, fp }) {
  const isNew = mode === 'forward' ? true : mode === 'redo' ? false : isNewRoundSim(fp, chatLayerNow);
  const isForward = isNew;
  let restored = false, rejectedRedo = false, baseSource;
  if (isForward) baseSource = 'state';
  else if (mode === 'redo') {
    if (cp) { Object.assign(state, cp); restored = true; baseSource = 'checkpoint'; }
    else return { rejectedRedo: true, roundAfter: state.round };
  } else baseSource = 'state(autoroll)';
  const roundBefore = state.round;
  let savedCheckpoint = false, label;
  if (isForward) { state.round++; if (hadStoredState) savedCheckpoint = true; label = 'forward'; }
  else label = (mode === 'redo') ? 'redo' : 'autoroll';
  state.chatLayer = chatLayerNow;
  return { baseSource, restored, rejectedRedo, label, roundAfter: state.round, roundChanged: state.round !== roundBefore, savedCheckpoint };
}
{
  // E1 tự động thử lại roll（regenerate）：fp==chatLayer → isNewRound=false → autoroll → round không đổi
  const s = { round: 6, chatLayer: 20 };
  const r = evolveSim({ mode: undefined, state: s, cp: cp5(), hadStoredState: true, chatLayerNow: 20, fp: '20' });
  assert.strictEqual(r.label, 'autoroll', 'E1 label');
  assert.strictEqual(r.roundAfter, 6, 'E1 round không đổi=6');
  assert.strictEqual(r.savedCheckpoint, false, 'E1 không điểm lưu');
  console.log('✓ E1 tự động thử lại roll → round giữ nguyên 6 + điểm lưu không đổi');
}
{
  // E2 tự động vòng mới:fp(20)!=chatLayer(22) → isNewRound=true → forward → round++
  const s = { round: 6, chatLayer: 20 };
  const r = evolveSim({ mode: undefined, state: s, cp: cp5(), hadStoredState: true, chatLayerNow: 22, fp: '20' });
  assert.strictEqual(r.label, 'forward', 'E2 label');
  assert.strictEqual(r.roundAfter, 7, 'E2 round 7');
  console.log('✓ E2 tự động vòng mới → round 6→7 + điểm lưu tiến lên');
}
{
  // E3 thủ công redo có cp → về điểm lưu round=5
  const s = { round: 6, chatLayer: 20 };
  const r = evolveSim({ mode: 'redo', state: s, cp: { round: 5, chatLayer: 18, memories:[], events:[], factions:[], worldTrends:[], winds:[], enemies:[], influenceChain:[] }, hadStoredState: true, chatLayerNow: 20 });
  assert.strictEqual(r.label, 'redo', 'E3 label'); assert.strictEqual(r.restored, true, 'E3 restored'); assert.strictEqual(r.roundAfter, 5, 'E3 round 5');
  console.log('✓ E3 thủ công redo → về điểm lưu round=5');
}
{
  // E4 thủ công redo không có cp → từ chối
  const s = { round: 6, chatLayer: 20 };
  const r = evolveSim({ mode: 'redo', state: s, cp: null, hadStoredState: true, chatLayerNow: 20 });
  assert.strictEqual(r.rejectedRedo, true, 'E4 reject');
  console.log('✓ E4 thủ công redo không có cp → từ chối');
}
{
  // E5 thủ công forward → round++
  const s = { round: 5, chatLayer: 18 };
  const r = evolveSim({ mode: 'forward', state: s, cp: cp5(), hadStoredState: true, chatLayerNow: 20 });
  assert.strictEqual(r.label, 'forward', 'E5 label'); assert.strictEqual(r.roundAfter, 6, 'E5 round 6'); assert.strictEqual(r.savedCheckpoint, true, 'E5 cp');
  console.log('✓ E5 thủ công forward → round 5→6 + điểm lưu tiến lên');
}

console.log('\n tất cả 16 xác nhận thông qua ✅（G5 type dịch + I6 tiêm + E5 suy diễn hồi quy)');
