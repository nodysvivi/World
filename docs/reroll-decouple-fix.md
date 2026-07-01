# Tách rời tiêm/suy diễn reroll (v2.3.18)

Tài liệu này ghi lại nguyên nhân gốc rễ và cách sửa lỗi của hai bug dây chuyền được người dùng kiểm thử xác nhận và sửa chữa vào ngày 2026-06-29.

## Hiện tượng (người dùng kiểm thử)

Sandbox Naruto (syncToChat / auto / everyX=1), vòng 5 → mở tầng 6 mới → tự động suy diễn vòng 6 → swipe reroll tầng 6:

1. **Triệu chứng A**: Log tiêm `số tầng hội thoại 18 >= 18 tiêm trạng thái hiện tại (round 6)` —— đã tiêm trạng thái hiện tại của vòng 6, chứ không phải điểm lưu vòng 5.
2. **Triệu chứng B**: Log suy diễn `✅ suy diễn hoàn tất (reroll/redo), vòng không đổi: vòng 5` —— vòng dừng ở 5 chứ không phải 6.

## Nguyên nhân gốc rễ

| Triệu chứng | Nguyên nhân gốc rễ | Vị trí code |
|---|---|---|
| **B** | Khi điểm vào evolve `isNew=false` thì không phân biệt `Object.assign(state,cp)` khôi phục state thành điểm lưu (vòng 5) → suy diễn → round=5. `reroll (suy diễn lại cùng tầng = vòng hiện tại không đổi)` và `redo (thủ công về điểm lưu)` bị gộp chung vào cùng một đường dẫn. | evolution.js:749-774 |
| **A** | Cổng `_pendingReroll` phụ thuộc vào trình tự sự kiện swipe của Tavern, dễ bị GENERATION_ENDED xoá sớm / plugin tạo kép đụng cửa sổ → khi tiêm reroll cổng đã mở → đi vào nhánh dự phòng `>=` tiêm trạng thái hiện tại. | world-engine.js:207-222 |

## Cách sửa (hai tệp, ba chỗ)

### 1. evolution.js: evolve chọn cơ sở chia ba (line 744-774)

```diff
- if (isNew) { forward }
- else { 
-   // isNew=false → khôi phục không phân biệt từ điểm lưu (gộp chung reroll/redo)
-   Object.assign(state, cp)
- }

+ const isForward = isNew          // mode='forward' hoặc tự động vòng mới
+ if (isForward) { vòng mới }
+ else if (mode === 'redo') {
+   // redo: khôi phục từ điểm lưu (giữ lại khôi phục Object.assign gốc + thủ vệ không cp)
+ } else {
+   // tự động reroll: không khôi phục từ điểm lưu, suy diễn trực tiếp trên state hiện tại
+ }
```

### 2. evolution.js: khối vòng chia ba (line 968-978)

Trong `if(isForward)` thì `round++ / saveCheckpoint(backup) / saveFingerprint` không đổi; nhánh else log phân biệt redo/tự động reroll, vòng không đổi.

### 3. world-engine.js: tiêu chí tiêm đổi sang type gốc của Tavern + xoá _pendingReroll

> ⚠️ **Tiêu chí giá trị `state.chatLayer===chatLayer` của v2.3.18 đã bị bác bỏ qua probe trên máy thật, v2.3.19 chuyển sang dùng type gốc của Tavern.**

**v2.3.18 (phương án trung gian đã loại bỏ)**: Tiêu chí `Number.isFinite(state.chatLayer) && state.chatLayer === chatLayer`.
Về lý thuyết "khi tạo lần đầu vòng mới evolve chưa chạy, state.chatLayer vẫn là vòng trước → chatLayer > state.chatLayer không khớp".

**Bác bỏ qua probe trên máy thật (2026-06-29, kết hợp plugin "Thực Tâm Nhập Ma · Cơ sở dữ liệu")**: Tavern `GENERATION_STARTED` emit **trước khi** tầng người dùng push vào chat (probe kiểm thử: khi GEN_STARTED thì chatLen=23, sự kiện tiếp theo MSG_SENT mới chatLen=24). Vì vậy khi **gửi tin nhắn vòng mới** thì chatLayer vẫn == state.chatLayer vòng trước → tiêu chí giá trị phán đoán nhầm thành reroll → đã tiêm điểm lưu vòng trước. Người dùng "không reroll nhưng lại tiêm trạng thái cũ" chính là đây.

**v2.3.19 (phương án cuối cùng)**: Tiêu chí reroll chuyển sang dùng **type gốc của Tavern** (không dựa vào suy luận giá trị số tầng):

```js
// onGenerationStarted(type, _opts, dryRun)
if (dryRun) return;                                  // bỏ qua vòng khởi động/tính token, chấm dứt "tạo xong lại tiêm"
const isReroll = (type === 'swipe' || type === 'regenerate');
applyInjectionForCurrentRound({ isReroll });
// onMessageSwiped → applyInjectionForCurrentRound({ isReroll: true })
```

`applyInjectionForCurrentRound(opts)`: `opts.isReroll` → tiêm điểm lưu (không có cp thì không tiêm); nếu không thì đi theo dự phòng `chatLayer < stateLayer` gốc (xoá tầng cũ về trước tiêm điểm lưu) / `>=` (tiêm trạng thái hiện tại).

**Vì sao type đáng tin cậy**: `swipe` (mũi tên xuống của tin nhắn, script.js:9986) / `regenerate` (tạo lại ở dưới cùng, script.js:11304) là đánh dấu gốc của Tavern cho "viết lại nội dung cùng một tầng", không liên quan đến số tầng/trình tự sự kiện, dùng chung cho bất kỳ plugin nào. `normal`/`continue`/`impersonate`/`quiet` đều không phải là reroll.

### Bảng trường hợp biên (tiêu chí type v2.3.19)

| # | Bối cảnh | type | dryRun | isReroll | Tiêm | Đúng? |
|---|---|---|---|---|---|---|
| 1 | Gửi tin nhắn vòng mới (chatLayer tạm==state.chatLayer) | normal | false | false | Trạng thái hiện tại | ✓ (trị hồi quy v2.3.18) |
| 2 | Mũi tên swipe reroll | swipe | false | true | Điểm lưu | ✓ |
| 3 | Tạo lại ở dưới cùng (đường dẫn người dùng kiểm thử) | regenerate | false | true | Điểm lưu | ✓ |
| 4 | Plugin cơ sở dữ liệu khởi động/tính token | * | true | — | Không đổi tiêm | ✓ (không lặp lại tiêm nữa) |
| 5 | Viết tiếp | continue | false | false | Trạng thái hiện tại | ✓ |
| 6 | Xoá về trước đến tầng cũ (chatLayer<state.chatLayer) | normal | false | false | Đi nhánh `<` tiêm điểm lưu | ✓ |
| 7 | Reroll thật không cp | swipe/regenerate | false | true | unregister | ✓ |

## Phần không thay đổi

- Logic lưu trữ inject/core/store không thay đổi (quy luật bình hoa)
- Ngữ nghĩa forward/redo thủ công không đổi
- Thời điểm lưu checkpoint không đổi
- Bối cảnh tầng đầu không cp không đổi
- Chế độ thời gian không bị ảnh hưởng