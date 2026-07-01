# World Engine World Engine

Tiện ích mở rộng bên thứ ba của SillyTavern — engine suy diễn thế giới độc lập được điều khiển bằng API.

Tự động suy diễn trạng thái thế giới sau hội thoại, tiêm ngữ cảnh vào prompt, giúp thế giới trong roleplay AI thực sự "sống" lại: NPC có cuộc sống riêng, chuỗi sự kiện tự thúc đẩy, thế lực hưng suy thay thế, có tiếng đồn nổi lên khắp nơi, kinh tế biến động——tất cả không lấy người chơi làm trung tâm.

## Tổng quan tính năng

**Suy diễn thế giới**
- Tự động (hoặc thủ công) gọi API tương thích OpenAI bên ngoài sau mỗi vòng hội thoại để suy diễn thay đổi thế giới
- Hỗ trợ hai chế độ nhịp độ: "suy diễn mỗi N vòng" và "suy diễn theo thời gian trong cốt truyện"
- Kết quả suy diễn tự động tiêm vào prompt, AI có thể cảm nhận động thái thế giới khi viết nội dung chính

**Quy tắc engine sống** (tích hợp 12 module)
- Vận hành thế giới, chuỗi sự kiện, lan truyền có tiếng đồn, hệ thống thế lực, hệ thống danh tiếng, hệ thống kinh tế, thao tác hộp đen, sự kiện đột phát khu vực, v.v.
- Thúc đẩy giai đoạn sự kiện bằng xúc xắc (manh nha→ủ biến→cận kề→bùng phát/tan biến)
- Biến động tự nhiên của trụ cột quyền lực thế lực, sức mạnh đoàn kết, vận thế

**Bảng điều khiển trạng thái thế giới**
- Tóm tắt thế giới / đại thế thiên hạ / đột phát khu vực / chuỗi sự kiện / có tiếng đồn / chuỗi ảnh hưởng / danh tiếng / thế lực / kẻ thù truyền kiếp / kinh tế / hộp đen
- Mỗi module có thể thu gọn, hỗ trợ chỉnh sửa nội tuyến, thêm mới, xoá
- Hiển thị trạng thái kép a/b giữa điểm lưu (ảnh chụp trước suy diễn) và trạng thái hiện tại

**Cache & bản lưu Tavern** (v2.2.0)
- Đồng bộ thời gian thực đa thiết bị: phản chiếu trạng thái thế giới vào `chat_metadata`, lưu cùng tệp chat lên máy chủ Tavern
- Bản lưu có tên + tự động sao lưu cuốn chiếu: chống mất mát, hỗ trợ khôi phục/đổi tên/xuất/nhập/xoá
- Giải quyết xung đột bằng bộ đếm Lamport, rào chắn nội dung trống ngăn thiết bị trống ghi đè dữ liệu thật
- Mặc định tắt, nếu không bật sẽ hoàn toàn không ghi tệp chat

**Suy diễn Worldbook dưới nền**
- Chọn mục Worldbook theo chat để tham gia suy diễn, giúp kết quả suy diễn bám sát thiết lập thế giới quan cụ thể
- Kích hoạt đèn xanh/lam (v2.3.0): 🔵 mục thường trú luôn tiêm, 🟢 mục từ khoá khớp hội thoại gần đây mới tiêm, theo cài đặt Worldbook của Tavern, mỗi mục có thể ghi đè riêng (mặc định tắt)

**Backfill hàng loạt suy diễn thế giới** (v2.3.1)
- Bắt đầu từ tầng AI thứ 1, chia lô suy diễn lại trạng thái thế giới đến tầng chỉ định (VD: 30 tầng AI, mỗi lô 5 tầng → gọi 6 lần suy diễn)
- Mỗi lô chỉ nạp hội thoại của tầng lô đó, token cố định có thể kiểm soát; trạng thái thế giới tích luỹ theo từng lô, giữ nguyên tính liền mạch
- Có thể cấu hình số tầng mỗi lô, tầng kết thúc, số lần thử lại độc lập mỗi lô; tự động lưu một ảnh chụp sao lưu trước khi xoá hết làm lại

**Nhập/xuất dữ liệu**
- Xuất trạng thái thế giới hoàn chỉnh định dạng JSON, có thể nhập xuyên chat
- Tự động chuẩn hoá số tầng khi nhập, tránh phán đoán sai lệch

## Cài đặt

### Cách 1: Thông qua trình quản lý tiện ích mở rộng SillyTavern

1. Mở SillyTavern, vào trang **Tiện ích mở rộng**
2. Nhấp vào **Cài đặt tiện ích mở rộng**
3. Nhập địa chỉ kho lưu trữ: `https://github.com/DlSNlGHT/World`
4. Sau khi cài đặt hoàn tất, làm mới trang

### Cách 2: Cài đặt thủ công

```bash
cd <Thư mục cài đặt SillyTavern>/data/default-user/extensions
git clone https://github.com/DlSNlGHT/World world-engine
```

Chỉ cần làm mới trang SillyTavern.

## Cấu hình

Sau khi cài đặt, tìm bảng điều khiển tiện ích mở rộng **World Engine** ở thanh bên SillyTavern, vào trang **Cài đặt**:

1. **Cấu hình API** (bắt buộc)
   - API URL: Bất kỳ endpoint tương thích OpenAI nào (ví dụ `https://api.openai.com/v1`)
   - API Key: Khoá tương ứng
   - Tên model: Ví dụ `gpt-4o`, `claude-3-5-sonnet`, v.v.

2. **Chế độ suy diễn**
   - Tự động: Tự động suy diễn sau mỗi N vòng hội thoại (mặc định mỗi vòng)
   - Theo thời gian: Quyết định số vòng suy diễn dựa trên thời gian trôi qua trong cốt truyện
   - Thủ công: Chỉ kích hoạt khi nhấp vào nút "Suy diễn thủ công"

3. **Backfill hàng loạt suy diễn thế giới** (tuỳ chọn)
   - Chia lô suy diễn thế giới từ tầng AI thứ 1 đến tầng chỉ định, dùng cho: đã có lượng lớn hội thoại trước khi cài tiện ích, hoặc muốn xoá hết làm lại
   - Số tầng AI mỗi lô: Mỗi bao nhiêu tầng gọi suy diễn một lần; Tầng kết thúc: điền 0 = suy diễn đến cuối; Số lần thử lại mỗi lô: giới hạn thử lại khi thất bại
   - Nhấp "▶ Bắt đầu backfill suy diễn thế giới" → Xác nhận (sẽ xoá trạng thái thế giới hiện tại, tự động lưu ảnh chụp sao lưu) → Thúc đẩy từng lô, có thể "■ Dừng" bất cứ lúc nào

4. **Cache & bản lưu Tavern** (tuỳ chọn)
   - Đồng bộ thời gian thực đa thiết bị: Sau khi bật, trạng thái thế giới sẽ đồng bộ đa thiết bị cùng với chat
   - Tự động sao lưu cuốn chiếu: Tự động lưu một bản mỗi khi vòng thúc đẩy, giữ lại gần nhất 3 bản

## Sử dụng

1. Sau khi cấu hình xong API, trò chuyện bình thường với nhân vật
2. Sau khi AI trả lời, World Engine tự động suy diễn và cập nhật bảng điều khiển
3. Nhấp vào thanh tiêu đề bảng điều khiển để mở rộng/thu gọn các module xem toàn cảnh thế giới
4. Kết quả suy diễn tự động tiêm vào prompt, AI sẽ cảm nhận thay đổi thế giới trong lần trả lời vòng tiếp theo

**Phân trang bảng điều khiển**: Tóm tắt thế giới / đại thế thiên hạ / chuỗi sự kiện / có tiếng đồn / thế lực / danh tiếng / kinh tế / hộp đen / điểm lưu / cài đặt

**Bản lưu và khôi phục**:
- Khu vực "Cache & bản lưu Tavern" ở trang cài đặt có thể tạo mới bản lưu có tên, nhập bản lưu bên ngoài
- Mỗi bản lưu hỗ trợ khôi phục (quay lại trạng thái thời điểm đó), đổi tên, xuất JSON, xoá
- Tự động tạo một bản sao lưu trước khi khôi phục, có thể khôi phục lại bất cứ lúc nào

## Cấu trúc dự án

```
world-engine.js           Điểm vào chính: tải module, liên kết sự kiện, logic tiêm
world-engine-core.js      Cấu trúc dữ liệu cốt lõi và lưu trữ (cách ly theo ID chat)
world-engine-store.js     Lớp trung gian lưu trữ (IndexedDB + fallback localStorage)
world-engine-api.js       Gọi API độc lập (định dạng tương thích OpenAI)
world-engine-evolution.js Suy diễn thế giới (quy tắc engine sống + hệ thống xúc xắc)
world-engine-inject.js    Xây dựng ngữ cảnh tiêm (lọc điều kiện thông tin quan trọng)
world-engine-rules-loader.js  Tích hợp toàn bộ quy tắc suy diễn (12 module)
world-engine-ledger.js    Sổ cái sự kiện lớn (ghi lại thay đổi Lv3/4)
world-engine-worldbook.js Chọn Worldbook suy diễn dưới nền
world-engine-chatcache.js Cache & bản lưu Tavern (đồng bộ đa thiết bị)
world-engine-ui.js        Bảng điều khiển UI hoàn chỉnh
style.css                 Style
manifest.json             Manifest tiện ích mở rộng SillyTavern
worldmap.svg              Tài nguyên bản đồ thế giới
```

## Điểm kỹ thuật chính

- **Tiện ích mở rộng thuần frontend**: 10 module JS, IIFE gắn vào biến toàn cục `window.*`, không có hệ thống build
- **Dẫn động kép xúc xắc cục bộ + API bên ngoài**: Thúc đẩy giai đoạn sự kiện dùng RNG cục bộ, tạo tự sự dùng LLM bên ngoài
- **Cách ly theo chat**: Mỗi chat có bản lưu độc lập, không can thiệp lẫn nhau
- **Trạng thái kép a/b**: Điểm lưu trước suy diễn (checkpoint) + trạng thái hiện tại sau suy diễn, hỗ trợ tiêm đúng phiên bản khi reroll
- **Ranh giới an toàn**: Các cài đặt nhạy cảm như API Key tuyệt đối không ghi vào `chat_metadata`, ngăn chặn rò rỉ do chia sẻ tệp chat

## Giấy phép

[MIT](https://opensource.org/licenses/MIT)

## Tác giả

[Disnight](https://github.com/DlSNlGHT)