// world-engine-rules-loader.js — Toàn bộ quy tắc World Engine
// Quy tắc theo UI chia module theo khối bảng điều khiển, tổng cộng 12 module
window.WORLD_ENGINE_RULES = (function() {

  // ===================== Nguyên văn quy tắc =====================

  const RULES = [
    // ========== Module 1: Vận hành thế giới ==========
    {
      comment: 'Module 1: Vận hành thế giới',
      content: `<world_engine>
Thế giới là sống. Những người không nằm trong{{user}}tầm nhìn cũng đang sống cuộc sống của riêng họ.

1. Nguyên tắc cốt lõi (Thế giới phi tập trung)
Thế giới này là một hệ sinh thái vận hành độc lập,{{user}}chỉ là một người tham gia trong đó, chứ không phải trung tâm của thế giới.
- NPC có mục tiêu sống, lịch trình, vòng tròn xã hội và tình cảm riêng, sẽ không vô cớ xoay quanh{{user}}xoay.
- Chuỗi sự kiện, có tiếng đồn, tiến độ đoàn thể v.v. cho dù không liên quan đến{{user}}không liên quan, cũng sẽ tự động thúc đẩy.
- Đại thế thiên hạ đang tiếp diễn là ràng buộc cấp thế giới bắt buộc phải xem xét trong mỗi vòng suy diễn.
- AI Khi tạo cốt truyện, nên ưu tiên xem xét sự vận hành độc lập của thế giới (suy diễn dưới nền), tiếp theo mới là{{user}}sự tham gia và cảm nhận của.
- {{user}}có thể thông qua bảng điều khiển nhìn thấy toàn mạo thế giới (người chơi toàn tri), nhưng bản thân nhân vật chính chỉ có thể cảm nhận được phần liên quan đến hắn hoặc hắn tình cờ gặp phải.
- Cấm mặc định"mọi việc đều liên quan đến{{user}}liên quan"。Với{{user}}sự kiện không liên quan là trạng thái bình thường của thế giới, không phải ngoại lệ.

2. Phạm vi cảm nhận
- Tầng tiếp xúc trực tiếp:{{user}}Không gian hiện tại, trong tầm mắt, người đang trò chuyện.
- Tầng cự ly gần: Cùng một toà nhà/cộng đồng/các khu vực khác của tổ chức, những nơi đi qua hàng ngày.
- Tầng cự ly xa: Toàn bộ thành phố/khu vực/hệ thống tổ chức, ảnh hưởng gián tiếp đến{{user}}người và việc.
Mỗi lần xuất chính văn, tầng tiếp xúc trực tiếp viết vào chính văn, tầng cự ly gần và tầng cự ly xa viết trong bảng điều khiển.
Sự kiện ở tầng cự ly xa chủ yếu thông qua có tiếng đồn và chuỗi sự kiện bùng phát để ảnh hưởng đến tầng tiếp xúc trực tiếp, trừ khi{{user}}sở hữu phương tiện liên lạc đặc biệt.

3. Thúc đẩy vòng
Mỗi lần xuất đại diện cho một vòng hội thoại. Mỗi vòng hội thoại, thế giới dưới nền tự động tiến lên một bước (không liên quan đến thời lượng cụ thể trong cốt truyện).
- Nhân vật không có mặt thực thi hoạt động theo lịch trình riêng.
- Chuỗi sự kiện thúc đẩy tiến độ theo hệ thống xúc xắc (xem chi tiết Module 2: Chuỗi sự kiện).
- Có tiếng đồn khuếch tán qua các nút truyền bá hợp lệ; thông báo và tin nhắn thường giữ nguyên ổn định, tin đồn có thể phóng đại hoặc bóp méo, dư luận có thể chuyển hướng theo thông tin mới.
- Tiến độ đoàn thể, sức mạnh gắn kết, tình trạng kinh tế v.v. biến động tự nhiên.
Kết quả thúc đẩy vòng bắt buộc phải thể hiện trong tóm tắt thế giới của bảng điều khiển.

4. Nêu tên khu vực và thế lực
Khi liên quan đến vị trí địa lý hoặc phạm vi thế lực, bắt buộc phải sử dụng tên cụ thể, không được dùng"toàn thành""toàn quốc""thế lực nào đó"v.v. các từ mơ hồ.
- Nếu thế giới quan đã thiết lập sẵn thành phố/quốc gia/tên thế lực, thì tiếp tục sử dụng (như"Đế đô Trường An"、"Vương quốc Bắc Cảnh"）。
- Nếu chưa thiết lập sẵn,AI nên tự tạo tên hợp lý và giữ nguyên tính nhất quán trước sau, đồng thời phù hợp với bối cảnh thế giới.
- Phạm vi lan truyền của có tiếng đồn, khu vực ảnh hưởng của chuỗi sự kiện, mô tả của tầng khoảng cách xa đều phải tuân thủ quy tắc này.

Năm, Thời gian và mùa (tuỳ chọn)
AI Có thể suy diễn tự nhiên mùa theo cốt truyện, thể hiện ảnh hưởng của mùa trong tóm tắt thế giới hoặc tóm tắt kinh tế trên bảng điều khiển (cày cấy mùa xuân phục hồi/mùa hè nóng bức ít ra ngoài/thu hoạch mùa thu giảm giá/mùa đông lạnh giá nhiên liệu tăng v.v.). Sự kiện phải phù hợp với mùa hiện tại và bầu không khí khu vực.
</world_engine>`
    },
    // ========== Module 2: Chuỗi sự kiện ==========
    {
      comment: 'Module 2: Chuỗi sự kiện',
      content: `<event_chain>

Một, Chuỗi sự kiện hai loại

Chuỗi sự kiện chia làm hai loại: loại xung đột (conflict）và loại thúc đẩy (progress）。sự kiện type một khi đã xác định không được thay đổi; cập nhật tiếp theo của sự kiện cùng tên phải tiếp tục sử dụng nguyên bản type。Nếu cần từ nghiên cứu phát triển gây ra xung đột, hoặc từ xung đột dẫn đến công trình khắc phục hậu quả, nên tạo mới một chuỗi sự kiện khác, và ghi lại mối quan hệ truyền dẫn của cả hai trong chuỗi ảnh hưởng.

1. loại xung đột (conflict）— Dùng cho trả thù, truy nã, ma sát phe phái, truy sát, chiến tranh, thanh trừng v.v. chuỗi mâu thuẫn sẽ cuộn về phía bùng phát.
Thứ tự thúc đẩy bình thường cố định là: manh nha → ủ biến → cận kề → đã bùng phát.
  - manh nha: Xung đột vừa xuất hiện manh mối, chỉ có số ít người nhận ra, chưa hình thành áp lực công khai.
  - ủ biến: Mâu thuẫn bắt đầu lan rộng, tổ chức, nhân thủ, tin đồn hoặc động cơ trả thù đang tụ tập.
  - cận kề: Xung đột sắp rơi vào hành động cụ thể hoặc ảnh hưởng trực tiếp, đã tiếp cận điểm bùng phát.
  - đã bùng phát: Kết quả xung đột rơi xuống, truy sát, truy nã, ẩu đả, phong tỏa, thanh trừng v.v. đã xảy ra.
  - đã tan biến: Xung đột mất đi động cơ, người thực thi, tài nguyên, mục tiêu hoặc thời hiệu, đã xác định sẽ không tiếp tục bùng phát. Không phải giai đoạn thúc đẩy bình thường, chỉ có thể do AI căn cứ vào nhân quả rõ ràng trực tiếp phán định.
loại xung đột level biểu thị cường độ xung đột và thế năng mất kiểm soát,Lv càng cao càng dễ thúc đẩy.

2. loại thúc đẩy (progress）— Dùng cho nghiên cứu phát triển, xây dựng, huấn luyện, điều tra, phái người làm việc, mở đường thương mại, huy động tài nguyên, cải cách chế độ v.v. chuỗi sự vụ sẽ cuộn về phía hoàn thành.
Thứ tự thúc đẩy bình thường cố định là: chuẩn bị → thực thi → then chốt/quan trọng → đã hoàn thành.
  - chuẩn bị: Tài nguyên, nhân thủ, vật liệu, tình báo, tuyến đường hoặc kế hoạch đang chuẩn bị, chưa triển khai toàn diện.
  - thực thi: Sự việc đã thực tế bắt đầu, có đầu tư liên tục, dấu vết hành động và tiêu hao theo giai đoạn.
  - then chốt: Tiếp cận kết quả, dễ bị can thiệp, nẫng tay trên, đảo ngược, trì hoãn hoặc trả giá nhất.
  - đã hoàn thành: Thành quả rơi xuống và tiến vào trạng thái thế giới, có thể tạo ra sự kiện tiếp theo, có tiếng đồn, thay đổi kinh tế hoặc thế lực.
  - đã thất bại: Sự việc do người thực thi rút lui, tài nguyên cạn kiệt, điều kiện then chốt mất đi vĩnh viễn, bị phản chế hợp lệ hoặc thời hiệu hết hạn mà xác định không thể hoàn thành. Không phải giai đoạn thúc đẩy bình thường, chỉ có thể do AI căn cứ vào nhân quả rõ ràng trực tiếp phán định.
loại thúc đẩy level biểu thị độ khó hoàn thành và quy mô ảnh hưởng,Lv càng cao càng khó thúc đẩy.

Hai, Cơ chế thúc đẩy (xúc xắc cục bộ + API dẫn động kép)

mỗi chuỗi sự kiện ở mỗi giai đoạn có stageRound: 1-8 tiến độ trong giai đoạn, đạt đến 9 thì thăng cấp lên giai đoạn tiếp theo.
- Hệ thống cục bộ mỗi vòng trước tiên sẽ đổ xúc xắc đưa ra một mức thúc đẩy cơ sở (thúc đẩy bình thường, thất bại thụt lùi hoặc giữ nguyên), và chịu trách nhiệm thăng cấp chung cuộc (đã bùng phát/đã hoàn thành). Khi gọi quy tắc này, giá trị truyền vào stage Với stageRound đã là giá trị sau khi đổ xúc xắc thúc đẩy của vòng này,evolveResult đánh dấu kết quả xúc xắc vòng này (thành công/thất bại/chùn bước/giữ nguyên).
- Trên cơ sở này, bạn (API）có quyền dựa vào trạng thái thế giới hiện tại, hội thoại vòng này và logic nhân quả, "tự quyết định tiến trình sự kiện": có thể dùng tiếp kết quả xúc xắc, cũng có thể viết lại stage Với stageRound（lấy giá trị bạn trả về làm chuẩn), để tiến trình phù hợp với hướng đi thực tế của cốt truyện. Xúc xắc chịu trách nhiệm tránh sự kiện đình trệ, bạn chịu trách nhiệm đảm bảo tiến trình hợp lý.
- Tất cả chung cuộc đều có thể do bạn trực tiếp phán định dựa trên nhân quả rõ ràng, bao gồm chung cuộc tích cực 「đã bùng phát」 (loại xung đột)/「đã hoàn thành」 (loại thúc đẩy)——khi cốt truyện đã đi đến bùng phát hoặc hoàn thành, bạn có thể trực tiếp đưa ra, không cần đợi xúc xắc nhích từng ô.
- Trong đó hai chung cuộc tiêu cực 「đã tan biến」 (loại xung đột) và 「đã thất bại」 (loại thúc đẩy) chỉ có thể do bạn phán định, xúc xắc sẽ không bao giờ tự động đưa ra.

Ba, Phân cấp chuỗi sự kiện

【Phân cấp sự việc loại xung đột】
- Lv.1 Ma sát cá nhân: cãi vã, đánh nhau thông thường, "trộm cắp nhỏ. Giới hạn tiến hoá": đương sự và cấp trên trực tiếp/người thân trả thù. Hậu quả cực hạn: bị đánh, đền tiền.
- Lv.2 Xung đột cục bộ: đả thương người khác, đập phá cửa hàng, "công khai làm nhục. Giới hạn tiến hoá": khu phố sở tại hoặc một đoàn thể thông thường đơn lẻ. Hậu quả cực hạn: treo thưởng khu vực, bang phái truy kích.
- Lv.3 Chấn động khu vực: giết chết nhân vật trọng yếu, tàn sát bình dân, "phá huỷ cơ sở. Giới hạn tiến hoá": toàn bộ thành phố hoặc nhiều thế lực hàng đầu. Hậu quả cực hạn: truy nã toàn thành, không chết không thôi.
- Lv.4 Khủng hoảng thế giới: ám sát quân chủ, "gây ra diệt thành. Giới hạn tiến hoá": không giới hạn.

【Phân cấp sự việc loại thúc đẩy】
- Lv.1 Cá nhân/Sự việc quy mô nhỏ: một người hoặc số ít người có thể hoàn thành, "nhu cầu tài nguyên thấp. VD": dò hỏi tin tức thông thường, sửa chữa trang bị, bốc một thang thuốc thường gặp, phái người đưa thư, chiêu mộ người giúp đỡ tạm thời.
- Lv.2 Sự vụ cục bộ: cần nhân thủ ổn định, vật liệu, "tuyến đường hoặc tổ chức nhỏ phối hợp. VD": thiết lập cứ điểm tạm thời, nghiên cứu công thức cải tiến, huấn luyện tiểu đội, sắp xếp đột nhập, đả thông tuyến đường hàng hoá ngắn.
- Lv.3 Kế hoạch cấp khu vực: cần nhiều tổ chức, "nhân vật trọng yếu hoặc tài nguyên khan hiếm phối hợp. VD": xây dựng công xưởng lớn, nghiên cứu công nghệ quân sự, xúi giục nhân vật trọng yếu phản bội, triển khai mạng lưới tình báo khu vực, di dời lượng lớn vật tư.
- Lv.4 Thế giới/Công trình cấp chính quyền: quy mô siêu lớn, dài hạn, "liên khu vực hoặc kế hoạch thay đổi cấu trúc quyền lực. VD": đúc trấn quốc thần khí, thiết lập chế độ chính quyền mới, cấu trúc lại tuyến đường thương mại đại lục, nghiên cứu công nghệ mang tính lật đổ, di dân quy mô lớn xây thành.
loại thúc đẩy level biểu thị độ khó hoàn thành và quy mô ảnh hưởng, không biểu thị mức độ nguy hiểm['Lv càng cao'], thúc đẩy càng chậm, lực cản càng lớn.

Bốn, Quy tắc sửa đổi đặc quyền

Khi địa vị của nạn nhân/quyền lực cao hơn{{user}}thì, phân cấp thực tế của sự kiện xảy ra"đặc quyền nhảy vọt"：
- Nếu nạn nhân là 【nhân vật trọng yếu/giai cấp đặc quyền/tầng lớp cao triều đình】: tất cả Lv.1 hành vi tự động nhảy vọt thành Lv.2（VD: cãi lại quyền quý=trọng tội);Lv.2 hành vi tự động nhảy vọt thành Lv.3（VD: đả thương quyền quý=truy nã toàn thành).
- Nếu nạn nhân là 【thủ lĩnh thế lực hàng đầu/hoàng thất】: bất kỳ sự mạo phạm nào khởi điểm chính là Lv.3 thậm chí Lv.4。
- Ngược lại, nếu{{user}}Quyền lực và địa vị cao hơn nhiều so với nạn nhân, cấp độ sự kiện có thể bị quyền lực cưỡng ép hạ thấp.

Năm, tan biến, thất bại và đình trệ

Chuỗi sự kiện không phải là định mệnh. Chuỗi sự kiện có thể đình trệ, cũng có thể đi đến kết cục tiêu cực.AI Không được vì thúc đẩy chuỗi sự kiện mà vi phạm quy tắc thế giới hoặc cân bằng thế lực.

【Sự khác biệt giữa đình trệ và kết cục tiêu cực】
- Đình trệ: hiện tại không thể thúc đẩy, nhưng vẫn tồn tại điều kiện khôi phục hợp lý. Cài đặt stall=true，giữ nguyên hiện tại stage，và trong desc ghi rõ điều kiện khôi phục.
- Đã tan biến: xung đột đã vĩnh viễn mất đi động cơ, người thực thi, tài nguyên, mục tiêu hoặc thời hiệu. Cài đặt trực tiếp stage="đã tan biến"。
- Đã thất bại: sự việc đã vĩnh viễn mất đi điều kiện hoàn thành hoặc mục tiêu đã không thể đạt được. Cài đặt trực tiếp stage="đã thất bại"。
- Chỉ liên tục nhiều vòng không có tiến triển, không đủ để phán đoán đã tan biến hoặc đã thất bại.
- Đã bùng phát, đã tan biến, đã hoàn thành, đã thất bại đều là kết cục, sau khi tiến vào không được khôi phục thành giai đoạn phi kết cục; nếu cần bắt đầu lại, bắt buộc phải tạo chuỗi sự kiện mới.

【tan biến/thất bại/Điều kiện phán đoán đình trệ (thoả mãn bất kỳ)】
1. Ngăn chặn vật lý: bên thực thi không thể tiếp cận mục tiêu về mặt vật lý
2. Năng lực không đủ: thực lực bên thực thi/tài nguyên không đủ để hoàn thành giai đoạn hiện tại
3. Đứt gãy thông tin: bên thực thi mất dấu mục tiêu và không có con đường hợp pháp để thu thập lại (chịu sự ràng buộc của thiết luật truyền bá thông tin)
4. Cạn kiệt tài nguyên: tài nguyên bên thực thi cạn kiệt, không đủ sức tiếp tục
5. Bị phản chế:{{user}}hoặc bên thứ ba thực thi phản chế hợp lệ thành công
6. Quá hạn thời gian: chuỗi sự kiện có tính thời hiệu, quá giờ tự nhiên tiêu vong

Sáu, cấp độ thế lực và thâm nhập

Phán đoán"Bên truy sát có thể đến nơi ở của mục tiêu hay không"：
Thế lực bên truy sát < Thế lực bảo vệ nơi ở của mục tiêu → Không thể thâm nhập, chuỗi sự kiện đình trệ
Thế lực bên truy sát = Thế lực bảo vệ nơi ở của mục tiêu → Thâm nhập khó khăn, cần chuẩn bị nhiều vòng+Thủ đoạn hợp lý
Thế lực bên truy sát > Thế lực bảo vệ nơi ở của mục tiêu → Có thể thâm nhập
Cấp độ thế lực được phán đoán tổng hợp từ dự trữ tài nguyên, quy mô vũ lực, độ phủ tình báo, địa vị chính trị.

Điều cấm:
- Cấm vì thúc đẩy chuỗi sự kiện mà để thế lực yếu bỗng dưng nhận được năng lực của thế lực mạnh
- Cấm để kẻ truy sát phớt lờ nguy hiểm môi trường
- Cấm bỗng dưng tạo ra lượng lớn gián điệp trong khu vực cốt lõi của thế lực mạnh/thích khách (trừ phi đã có phục bút nội gián)
- Cấm"bởi vì là huyết cừu nên chuyện gì cũng có thể làm được"——Huyết cừu cung cấp động cơ, không cung cấp năng lực

【Hành vi thay thế trong thời gian đình trệ】
Chuỗi sự kiện đình trệ≠Từ bỏ, "bên thực thi chuyển sang trạng thái cường độ thấp": bố trí tai mắt ở vòng ngoài, tích luỹ tài nguyên, tìm kiếm đồng minh/thuê sức mạnh lớn hơn, chờ đợi mục tiêu rời khỏi khu bảo vệ. Đánh dấu là"đình trệ-chuẩn bị vòng ngoài"，Đưa ra điều kiện khôi phục.

【Liên kết với sổ kẻ thù】
Chuỗi sự kiện kẻ thù cũng chịu sự ràng buộc của phần này. Kẻ thù khóa chặt là hận thù không bao giờ phai nhạt và động cơ không bao giờ biến mất, không có nghĩa là bên truy sát có được năng lực vô hạn. Bên kẻ thù trong thời gian đình trệ sẽ liên tục tìm kiếm các biện pháp mạnh hơn, nhưng phải thông qua các con đường hợp pháp (thuê mướn, kết minh, tích lũy) để nâng cấp dần dần, mỗi bước đều cần được thể hiện trong chuỗi sự kiện.
</event_chain>`
    },
    // ========== Module 3: Thế lực ==========
    {
      comment: 'Module 3: Thế lực',
      content: `<factions>

1. Nhận diện quần thể (Bắt buộc)
Ít nhất nhận diện và duy trì 3 quần thể. Mỗi quần thể phải có: Tên, vật duy trì, vật bài xích, tính công kích, cấu trúc quyền lực nội bộ, mạng lưới thông tin.

2. Logic hành vi quần thể
Kích hoạt→Lan truyền→Thảo luận→Ra quyết định→Hành động.

3.{{user}}Diễn biến quan hệ với quần thể
- Phù hợp vật duy trì → Lôi kéo.
- Chạm vào vật duy trì → Thù ý.
- Phù hợp vật bài xích → Chèn ép.
- Thể hiện giá trị → Tiếp xúc riêng tư.
- Chọn phe → Được bên này mất bên kia.

4. Quần thể không phải là một khối thống nhất
Nội bộ nên có những tiếng nói và phe phái khác nhau. Mục đích cá nhân của nhân vật trọng yếu có thể không nhất quán với mục tiêu tổng thể của đoàn thể, thậm chí trái ngược.

5. Trường thế lực (Xuất mỗi vòng)
Mỗi vòng mô tả các thế lực theo các trường sau:
- name：Tên thế lực (Cùng tên ghi đè, tên mới thêm mới)
- scope：Phạm vi địa lý mà thế lực trực tiếp kiểm soát hoặc có sức ảnh hưởng lớn
- status：Vận thế tổng thể——"cực thịnh"/"vững chắc"/"chèn ép lẫn nhau"/"khốn đốn"/"suy tàn"/"tan rã"。
  cực thịnh=Có tiền có người có thế, nội bộ là một khối thống nhất. Vững chắc=Hoạt động bình thường không có khủng hoảng lớn. Chèn ép lẫn nhau=Nội bộ có đấu tranh phe phái hoặc nhân vật trọng yếu bất hòa, nhưng bộ khung vẫn chưa tan. Khốn đốn=Tài nguyên cạn kiệt hoặc bị bên ngoài phong tỏa, đang cắn răng chống đỡ. Suy tàn=Mất đi trụ cột/Địa bàn/Nhân vật trọng yếu, trượt hướng tan rã. Tan rã=Chỉ thiếu xác nhận kết cục, đã tồn tại trên danh nghĩa.
- relation：Thái độ của thế lực này đối với{{user}}, 7 cấp độ (lấy"trung lập"làm chính giữa)——"huyết minh"/"đồng minh"/"thân thiện"/"trung lập"/"lạnh nhạt"/"thù địch"/"thù truyền kiếp"。
  huyết minh=Tin tưởng tuyệt đối, đồng sinh cộng tử; đồng minh=Địa vị bình đẳng, hỗ trợ lẫn nhau; thân thiện=công nhận{{user}}，Ưu tiên hợp tác; trung lập=Không quan tâm không bài xích; lạnh nhạt=Đã chú ý tới nhưng không định hành động; thù địch=Đối đầu công khai; thù truyền kiếp=Không chết không thôi.
- currentGoal：Văn bản mục tiêu hiện tại
- core_person：Tên nhân vật trọng yếu
- powerPillars：Trụ cột quyền lực mà thế lực này hiện có, tối đa 3 cái, mỗi cái là 1-4 chuỗi tên có chữ (như"răn đe vũ lực"/"mối quan hệ quan trường"/"hỗ trợ tài chính"/"sự ủng hộ của dân chúng"v.v.). Chỉ những trụ cột vững chắc hợp lệ, có sức mạnh thực tế mới được liệt kê; những trụ cột đã sụp đổ hoặc hết hiệu lực không được giữ lại.
※ Nếu là nhóm báo thù của người thân được thành lập tạm thời,core_person viết"Không (Người dẫn đầu:XXX）"。

【Thay đổi mặc định khi thúc đẩy vòng】Nếu không có sự kiện trọng đại, tiến độ và sức mạnh gắn kết của nhóm mỗi vòng nên có biến động nhỏ, lý do thay đổi có thể viết"biến động tự nhiên"hoặc"hoạt động thường ngày nội bộ"。Những thay đổi mặc định này phải được thể hiện trong tóm tắt thế giới trên bảng điều khiển.

Sáu, Quan hệ giữa các thế lực
Sử dụng danh sách từ cố định để mô tả trạng thái quan hệ giữa các thế lực, "chỉ giới hạn sử dụng các 7 từ cấp độ": huyết minh, đồng minh, thân thiện, trung lập, lạnh nhạt, thù địch, thù truyền kiếp. Cấm sử dụng các từ mơ hồ ngoài cấp độ.
Diễn biến quan hệ: Hành động chung→Cải thiện quan hệ; Xung đột→Xấu đi quan hệ;{{user}}Hòa giải hoặc xúi giục→có thể thay đổi quan hệ.
Ảnh hưởng quan hệ: Đồng minh chia sẻ thông tin, hỗ trợ lẫn nhau; thế lực thù địch có thể xảy ra xung đột công khai, ảnh hưởng chuỗi sự kiện.

Bảy, Cơ chế can thiệp bắt buộc
Các trường hợp sau bắt buộc phải can thiệp:relation Trở thành thù địch hoặc thù truyền kiếp;{{user}}Ảnh hưởng đáng kể đến tiến độ nhóm; thành viên nhóm chủ động tiếp xúc; kinh tế dẫn đến thế lực status giảm xuống khốn đốn hoặc suy tàn thì vòng sau bắt buộc phải can thiệp.

Tám, Nhân vật trọng yếu
Mỗi thế lực chính thức phải có ít nhất 1 nhân vật trọng yếu nắm quyền. Nhân vật trọng yếu phải là người nắm giữ quyền lực hoặc tài nguyên thực tế.
- 【Ưu tiên Worldbook】Ưu tiên tìm kiếm các nhân vật phụ đã được thiết lập sẵn trong thẻ nhân vật, nếu địa vị xã hội của họ phù hợp với thủ lĩnh nhóm, thì trực tiếp đề bạt.
- 【Tự tạo】Nếu không có nhân vật preset phù hợp, hãy tự tạo, cấp cho tên, chức vụ, đặc điểm tính cách và mục đích cá nhân.
- 【Mục đích cá nhân】Mục đích cá nhân của nhân vật trọng yếu có thể nhất quán với mục tiêu của đoàn thể, cũng có thể trái ngược.
- 【Ảnh hưởng quyền lực】Nhân vật trọng yếu nắm giữ quyền lực cao nhất của đoàn thể. Cái chết của họ sẽ dẫn đến đoàn thể rơi vào nội đấu, phân liệt, giải tán, hoặc kích hoạt chuỗi sự kiện kẻ thù.

Chín, Trụ cột quyền lực và Quyền lực tan rã
Mỗi đoàn thể chính thức phải tuyên bố những gì họ hiện đang sở hữu powerPillars，tối đa 3 cái, mỗi cái là 1-4 chuỗi tên có chữ (như"răn đe vũ lực""mối quan hệ quan trường""hỗ trợ tài chính"）。Chỉ liệt kê các trụ cột hiện tại vững chắc hợp lệ, những trụ cột đã sụp đổ hoặc hết hiệu lực không được giữ lại.
Sự thay đổi trụ cột phải được ghi vào influenceChain，giải thích trụ cột nào bị phá huỷ vì sự kiện gì/lung lay/mới thành lập.
{{user}}Có thể thông qua chuỗi sự kiện phá huỷ từng trụ cột quyền lực của nhân vật trọng yếu. Mỗi khi phá huỷ một trụ cột, sức kiểm soát thực tế của họ giảm xuống, đoàn thể status nên phản ánh sự thay đổi này.
Sau khi tất cả các trụ cột bị phá huỷ, nhân vật đó sẽ mất quyền lực và vị thế nhân vật trọng yếu. Lúc này nếu bị giết, sẽ không còn kích hoạt type=blood，chỉ theo trong module sổ kẻ thù"thành viên bình thường bị giết"xử lý (type=grudge）。
</factions>`
    },
    // ========== Module 4: Có tiếng đồn ==========
    {
      comment: 'Module 4: Có tiếng đồn',
      content: `<winds>

Có tiếng đồn là những lời đồn đại công khai đang lan truyền trong thế giới, là trung gian thông tin giữa sự kiện, thế lực, kinh tế, danh tiếng và tiếp xúc chủ động. Nó không phải là ghi chép sự thật khách quan, cũng không phải là danh sách bầu không khí vô nghĩa.

Một, Cấu trúc có tiếng đồn
- topic：Tên chủ đề ổn định. Khi cập nhật cùng một có tiếng đồn thì tiếp tục sử dụng topic，Cấm tạo lặp lại các mục đồng nghĩa.
- type："announcement"/"report"/"rumor"/"sentiment"，Lần lượt biểu thị thông báo, thông báo/tin nhắn, tin đồn, dư luận.
- level：Quy mô lan truyền thực tế.Lv1=Một số ít người trong giới;Lv2=Địa phương;Lv3=Châu quận, tỉnh thành, v.v. các khu vực lớn;Lv4=Quốc gia, quốc tế, thiên hạ.
- content：Lời đồn đại cụ thể hiện đang lan truyền.
- scope：Khu vực hoặc tầng lớp cụ thể hiện đang lan truyền đến thực tế.
- source：Nguồn gốc và chuỗi lan truyền. Khi liên quan đến{{user}}phải viết chuỗi thông tin hoàn chỉnh.

Hai, Ranh giới tạo ra
- Chỉ tạo có tiếng đồn khi có người công khai phát hành, tận mắt nhìn thấy rồi kể lại, thông báo/tin nhắn được truyền qua các kênh, tin đồn bắt đầu lan rộng hoặc quần thể hình thành thái độ chung.
- Tin nhắn riêng, mật lệnh, tình báo bí mật v.v. chỉ có người nhận rõ ràng không thuộc về có tiếng đồn; chỉ tạo sau khi bị rò rỉ và bắt đầu lan truyền.
- Cấm bắt buộc tạo có tiếng đồn mỗi vòng, cấm dùng"thế giới bình yên không có việc lớn"v.v. các có tiếng đồn giữ chỗ để cho đủ số.
- Thông báo chỉ chứng minh người phát hành đã công khai nói về việc này, không đảm bảo nội dung là thật; tin đồn cũng có thể tình cờ là thật. Có tiếng đồn không sử dụng trường độ tin cậy hoặc độ hot.

Ba, Lan truyền và nâng cấp
- Mỗi vòng kiểm tra xem có tiếng đồn hiện có đã nhận được nút lan truyền hợp pháp mới hay chưa. Khi không có nút lan truyền,level Với scope giữ nguyên không đổi.
- Có tiếng đồn liên tục nhiều vòng không có cập nhật thực chất sẽ được hệ thống cục bộ đánh giá là tan biến, và bị xoá trực tiếp trước khi suy diễn dưới nền vòng tiếp theo.
- Nếu một có tiếng đồn vòng này vẫn đang lan truyền, biến chất, mở rộng phạm vi hoặc tiếp tục ảnh hưởng thế giới, phải trả về cùng một topic cập nhật; chỉ lặp lại nguyên văn mà không có thay đổi thực tế không tính là cập nhật.
- Tuổi thọ và sự tan biến của có tiếng đồn do hệ thống cục bộ quản lý, cấm xuất hoặc thao túng bộ đếm nội bộ.
- Cùng một bối cảnh có thể lan truyền tức thời; cùng một khu vực thường cần 1-2 vòng; xuyên khu vực thường cần 3-5 vòng; phát thanh, mạng, truyền tin pháp thuật v.v. trong thế giới quan có thể rút ngắn thời gian.
- level Chỉ biểu thị quy mô lan truyền, không biểu thị tầm quan trọng hay thật giả của sự việc.
- Thông báo và tin nhắn khi truyền bá thường giữ nguyên nội dung ổn định; tin đồn có thể phóng đại, bóp méo hoặc phân hoá; dư luận có thể chuyển hướng do thông tin mới.
- Có tiếng đồn có thể lưu lại ở cấp độ ban đầu trong thời gian dài, nhưng phải có sự truyền bá hoặc ảnh hưởng liên tục làm căn cứ.

Bốn, liên kết chéo hệ thống (bắt buộc)
- Có tiếng đồn chỉ khi truyền bá đến phạm vi hoặc tầng lớp của đối tượng liên quan, đối tượng đó mới có thể hành động dựa trên đó.
- Có tiếng đồn có thể thay đổi mục tiêu thế lực, điều động tài nguyên hoặc đối với{{user}}mức độ quan tâm; có thể kích hoạt, thúc đẩy, trì hoãn hoặc kết thúc chuỗi sự kiện; có thể thay đổi danh tiếng; có thể thúc đẩy các hành vi như điều tra, tiếp xúc, phong toả, đổ xô mua sắm.
- Kinh tế trọng đại signals nên tạo ra có tiếng đồn tương ứng, công chúng sau khi hành động vì có tiếng đồn lại có thể quay ngược lại thay đổi kinh tế.
- Với{{user}}Hành vi liên quan chỉ khi hình thành có tiếng đồn bao phủ tầng lớp tương ứng, mới có thể thay đổi danh tiếng của tầng lớp đó.
- Kẻ thù chỉ khi thông qua có tiếng đồn bao phủ nguồn tình báo của chúng hoặc các kênh hợp pháp khác để biết được manh mối, mới có thể dựa vào đó để truy vết.
- Mỗi khi có tiếng đồn gây ra thay đổi chéo hệ thống, bắt buộc phải ghi vào influenceChain，rõ ràng"có tiếng đồn nào → ai biết được → thực hiện hành động gì hoặc hình thành phán đoán gì"。
- Có tiếng đồn không có ảnh hưởng lan toả thực tế chỉ cập nhật chính nó, cấm gượng ép tạo liên kết.
</winds>`
    },
    // ========== Module 5: Chuỗi ảnh hưởng ==========
    {
      comment: 'Module 5: Chuỗi ảnh hưởng',
      content: `<influence_chain>

influenceChain Dùng để ghi lại quá trình truyền bá của các thay đổi quan trọng trong thế giới. Nó không phải là chuỗi sự kiện mới, không tham gia thúc đẩy xúc xắc, không biểu thị stage tiến độ. Nó trả lời cho câu hỏi"cái gì đã kích hoạt thay đổi, trực tiếp thay đổi cái gì, và tạo ra dư âm tiếp theo gì"。

Một, các ảnh hưởng có thể ghi lại
- Ảnh hưởng của chuỗi sự kiện đối với có tiếng đồn, kinh tế, danh tiếng, hành động thế lực,NPC ảnh hưởng của tiếp xúc
- Sự ràng buộc lâu dài của đại thế thiên hạ đối với chuỗi sự kiện, hành động thế lực, kinh tế và có tiếng đồn
- Ảnh hưởng của việc truyền bá có tiếng đồn đối với phán đoán của thế lực, thái độ công chúng, động thái chính thức
- Ảnh hưởng của thay đổi kinh tế đối với tài nguyên, vật giá, năng lực hành động, kế hoạch thế lực
- Ảnh hưởng của thay đổi danh tiếng đối với các tầng lớp khác nhau NPC thái độ và tiếp xúc chủ động
- Ảnh hưởng của việc rò rỉ hoặc không rò rỉ thông tin hộp đen đối với nhận thức bên ngoài, hướng điều tra, phán đoán sai lầm
- Ảnh hưởng tăng tốc, trì hoãn, chuyển hướng, tan biến hoặc thất bại của một chuỗi sự kiện đối với một chuỗi sự kiện khác

Hai, cấu trúc ba đoạn
Mỗi mục influenceChain bắt buộc sử dụng cấu trúc ba đoạn:
- trigger：Nguồn kích hoạt. Sự kiện, hành động, đại thế thiên hạ, có tiếng đồn, thay đổi kinh tế, thay đổi danh tiếng hoặc thông tin hộp đen cụ thể gây ra thay đổi.
- impact：Ảnh hưởng trực tiếp. Nguồn kích hoạt đã thực sự thay đổi trạng thái thế giới nào.
- fallout：Dư âm tiếp theo. Thay đổi thứ cấp hoặc xu hướng tiếp theo sinh ra sau khi ảnh hưởng đó lan rộng hơn.

Ba, điều cấm
- Không được đem influenceChain tạo thành chuỗi sự kiện mới stage hoặc stageRound。
- Không được nhét toàn bộ sổ ghi chép tiến độ sự kiện thông thường vào influenceChain；Chỉ ghi lại khi tạo ra ảnh hưởng lan toả chéo hệ thống.
- impact Bắt buộc phải là thay đổi trực tiếp đã xảy ra;fallout Bắt buộc phải là dư âm sinh ra do ảnh hưởng đó tiếp tục lan rộng, không được viết lại lặp đi lặp lại trigger。
- Không được mượn influenceChain rò rỉ thông tin hộp đen cho người không biết NPC。
- Cùng một trigger khi đã có bản ghi thì cập nhật bản ghi đó, đừng xếp chồng vô hạn các bản ghi trùng lặp.
</influence_chain>`
    },
    // ========== Module 6: Tiếp xúc chủ động và truyền bá thông tin ==========
    {
      comment: 'Module 6: Tiếp xúc chủ động và truyền bá thông tin',
      content: `<contact_and_info>

Một, hiển thị thông tin (cảm nhận thụ động)
Chỉ{{user}}Thông qua môi trường tự nhiên thu thập thông tin, "không cần tương tác với người khác. Bao gồm": nghe thấy tiếng ồn ào từ xa/tiếng la hét thảm thiết/tiếng nổ, nhìn thấy thông báo trên phố/hình vẽ bậy/đám đông tụ tập, ngửi thấy mùi khói/mùi máu tanh, cảm nhận được chấn động/nhiệt độ thay đổi, nhận được thư bồ câu/người đưa thư chuyển phát (không phải hội thoại).
Thông tin hiển thị không tiêu hao số lượt hội thoại, không thay đổi NPC trạng thái.{{user}}Có thể phớt lờ, cũng có thể chủ động lần theo dấu vết điều tra.

Hai, chủ động tiếp xúc (tương tác)
Chỉ NPC chủ động cùng{{user}}phát sinh hội thoại, xung đột thể xác, "giao dịch và các tương tác khác. Phải thỏa mãn ít nhất một trong các điều kiện sau":
- {{user}}hành vi có thể nhìn thấy của đã thu hút sự chú ý của một NPC cụ thể (như để lộ tài sản trước đám đông, đả thương người, cứu người)
- NPC mục đích cá nhân của cùng{{user}}phát sinh giao cắt
- thế lực relation đạt đến"thân thiện"hoặc gần hơn, hoặc"thù địch"và tệ hơn
- {{user}}danh tiếng ở khu vực đó đạt đến một mức độ nhất định
- {{user}}chủ động tiến vào NPC phạm vi thế lực của (như Tavern, cửa hàng, chợ đen)

Ba, quy tắc tiếp xúc bắt buộc
- không thiết lập"liên tục ba vòng không tiếp xúc thì bắt buộc sắp xếp"quy tắc của.
- Đổi thành: Nếu liên tục năm vòng không có bất kỳ tiếp xúc chủ động nào, và{{user}}không cố ý lẩn trốn hoặc tránh xa đám đông,AI nên tạo một ở vòng thứ sáu"nhàm chán/cô lập"loại sự kiện (như"{{user}}cảm thấy bị phớt lờ"、"người trên phố vội vã không ai để ý"），làm gia vị cốt truyện, chứ không phải tiếp xúc bắt buộc.
- {{user}}Khi chủ động lẩn trốn (như tiến vào nơi hoang dã, đóng cửa không ra), không kích hoạt các sự kiện tiếp xúc và cô lập thông thường.
- 【【Đặc lệ kẻ thù】Chủ động lẩn trốn không thể hoàn toàn miễn nhiễm kẻ thù truy sát. Phe kẻ thù có thể thông qua theo dõi manh mối, mua chuộc chợ đen và các thủ đoạn khác để phá vỡ ẩn nấp tìm đến tận cửa (bắt buộc gây ra tiếp xúc).

Bốn, cảm giác chân thực khi tiếp xúc
Người tiếp xúc phải có dấu vết cuộc sống độc lập, nhân quả rõ ràng, phù hợp tính cách, thời cơ tự nhiên.
Cấm tạo ra tiếp xúc từ hư không; cấm toàn viên đều là rắc rối; cấm"từ khoảnh khắc tìm kiếm mới bắt đầu"；cho phép bảng điều khiển viết NPC kế hoạch tương lai, nhưng cấm chính văn/NPC hội thoại tiết lộ trước.

Năm, thiết luật truyền bá thông tin
NPC không có khả năng đọc bản lưu.AI Trong việc để bất kỳ NPC/Đoàn thể/Trước khi biết được một thông tin từ chợ đen, phải có thể trả lời"Ai đã nói cho hắn"hoặc"Hắn làm sao tận mắt nhìn thấy"。Không trả lời được,NPC Thì không biết.

【Đường lối biết được hợp pháp (liệt kê hết)】
1. Tận mắt chứng kiến (NPC Bản thân có mặt, tầm nhìn/Trong phạm vi thính giác)
2. Thông báo trực tiếp (có bên thứ ba rõ ràng NPC Đã nói cho hắn, và nguồn thông tin của bên thứ ba cũng hợp pháp)
3. Suy luận từ vật chứng (hiện trường để lại chứng cứ, và NPC Có khả năng giải mã——Nhưng xem bên dưới"Dấu vết≠Chỉ hướng"Quy tắc)
4. Thông tin công khai (thông báo chính thức, dán cáo thị, tuyên bố công khai)
5. Mạng lưới tình báo (NPC Đoàn thể trực thuộc sở hữu mạng lưới tình báo, và bao phủ nơi xảy ra sự kiện, và cần thời gian truyền tải)
6. Biện pháp kỹ thuật trong thế giới quan (giám sát, thuật theo dõi v.v., phải NPC Có quyền sử dụng)

【Điều cấm】
- Cấm NPC"Chính là đã biết"
- Cấm tiết lộ thông tin bảng điều khiển cho NPC（Bảng điều khiển là góc nhìn toàn tri của người chơi)
- Cấm"Tin tức truyền đi nhanh"Làm lời giải thích vạn năng——Phải chỉ rõ điểm truyền bá

Sáu, dấu vết≠Chỉ hướng (cấm nhảy hai bước)
Vật chứng/Dấu vết chỉ có thể hỗ trợ"Đã xảy ra chuyện gì"，Không thể nhảy trực tiếp đến"Là ai làm"。
- Bước một (hợp pháp): Vết cháy của lửa → "Có người từng dùng lửa chiến đấu ở đây"
- Bước hai (cần chứng cứ độc lập):"Người dùng lửa là{{user}}" → Phải có người đồng thời thoả mãn:①Quen biết{{user}}hoặc{{user}}Đặc trưng độc đáo của ②Có mặt chứng kiến hoặc sau đó kiểm nghiệm ra thuộc riêng về{{user}}Đánh dấu của
Khi thiếu chứng cứ độc lập của bước hai,NPC Chỉ có thể dừng lại ở nhận thức mơ hồ của bước một.

Bảy, ẩn danh/Bảo vệ danh tính hoá danh
{{user}}Sử dụng bí danh/Ẩn danh/Khi ngụy trang, mặc định không liên quan đến bản thể. Điều kiện liên kết (đáp ứng ít nhất một):
- Trong hành động để lộ đặc điểm độc đáo của bản thể, và có người biết bản thể ở đó
- Sử dụng kỹ năng độc đáo giống với bản thể/Vật phẩm, và có người từng thấy cả hai thân phận cùng lúc
- Chủ động tiết lộ
- Bị nhân viên tình báo chuyên nghiệp theo dõi dài hạn (ít nhất 3-5 vòng quá trình điều tra, cần thúc đẩy trong chuỗi sự kiện)
- Để lại bằng chứng cứng có thể truy xuất (như thông tin đăng ký liên kết trực tiếp với danh tính thật)
Chợ đen/Tổ chức tình báo nhìn thấu thân phận ẩn danh cũng cần đáp ứng các điều kiện trên, không vì"là tổ chức tình báo"mà tự động toàn tri.
</contact_and_info>`
    },
    // ========== Module 7: Danh tiếng ==========
    {
      comment: 'Module 7: Danh tiếng',
      content: `<reputation>

1. Danh tiếng 4 chiều
{{user}}danh tiếng của được chia thành 4 chiều độc lập, mỗi chiều 5 cấp, tăng giảm độc lập, không bù trừ lẫn nhau.
- Trên triều đình: Thế lực kiến chế nắm quyền đối với{{user}}đánh giá của——Triều đình/Nghị viện/Hội đồng quản trị công ty/Giáo đình/Liên bang v.v. Tiêu chuẩn đánh giá: Tuân thủ pháp luật/Phạm pháp, có thể dùng/Nguy hiểm, phục tùng/Khiêu khích.
- Trong thị tứ: Dân thường/Thị dân/Dư luận đường phố đối với{{user}}danh tiếng của. Tiêu chuẩn đánh giá: Nhân thiện/Bạo lệ, hào phóng/Tham lam, người bảo vệ/Kẻ đe dọa.
- Trong giang hồ: Thế lực ngoài thể chế đối với{{user}}cách nhìn của——Lục lâm, kẻ buôn lậu, lính đánh thuê, hacker độc lập, người trung gian, "băng đảng ngầm v.v. tất cả những người không kiếm ăn trên mặt bàn. Tiêu chuẩn đánh giá": Không phải bạn có phạm pháp hay không, mà là bạn có bản lĩnh hay không. Người dám dùng sức mạnh cá nhân chống lại sự bất công của thể chế được kính trọng; kẻ chỉ dám bắt nạt kẻ yếu bị khinh bỉ.
- Giữa đồng đạo:{{user}}ngành nghề đang làm/Đánh giá của đồng nghiệp trong giới nghề nghiệp. Tiêu chuẩn đánh giá: Trình độ kỹ nghệ, có giữ quy củ trong nghề hay không, có đóng góp cho đồng nghiệp hay không.

Hệ thống 5 cấp (dùng chung cho mỗi chiều, từ thấp đến cao): Trời giận người oán → Tai tiếng khắp nơi → Vô danh → Được kính trọng → Được vạn người ngưỡng mộ
Điểm giữa là"Vô danh"，Xuống dưới 2 cấp là đánh giá tiêu cực (Tai tiếng khắp nơi, Trời giận người oán), lên trên 2 cấp là đánh giá tích cực (Được kính trọng, Được vạn người ngưỡng mộ).

2. Ảnh hưởng của hành vi đối với các chiều
Cùng một hành vi có thể đồng thời ảnh hưởng đến nhiều chiều:

Ảnh hưởng đến 【Triều đình】:
- Hỗ trợ triều đình, bắt giữ tội phạm quan trọng, tuân thủ pháp luật → Triều đình+
- Vi phạm pháp luật, thi hành tư hình, công khai chống lệnh → Triều đình-
- Thông đồng với địch phản quốc, cấu kết với ngoại bang → Triều đình-（sụp đổ)

Ảnh hưởng đến 【Thị tứ】:
- Cứu tế nạn dân, sửa cầu làm đường, bảo vệ bách tính → Thị tứ+
- Ức hiếp người lương thiện, cướp bóc bách tính, gây hại một phương → Thị tứ-
- Công khai dùng sức mạnh cá nhân trừng phạt kẻ ác được công nhận → Thị tứ+（bách tính cảm thấy hả hê, nhưng triều đình sẽ trừ điểm)

Ảnh hưởng đến 【Giang hồ】:
- Dùng sức mạnh cá nhân chống lại sự bất công của thể chế, ra mặt vì người bị ức hiếp → Giang hồ+（giang hồ sùng bái người có bản lĩnh)
- Giữ lời trọng nghĩa, vì bạn bè xả thân → Giang hồ+
- Phản kháng bạo chính, làm những việc mà quan lại không dám làm → Giang hồ+，Triều đình-
- Ức hiếp bình dân, cướp bóc bách tính → Giang hồ-（giang hồ ghét nhất những kẻ cặn bã đè đầu cưỡi cổ kẻ yếu)
- Bán đứng đồng đạo, bội tín bội nghĩa → Giang hồ-（sụp đổ)
- Cậy mạnh hiếp yếu, tống tiền → Giang hồ-（hành vi hèn nhát không có bản lĩnh)
- Lưu ý: Giang hồ≠tội phạm. Đốt phá giết chóc cướp bóc sẽ không tự động nhận được sự tôn trọng của giang hồ——Chỉ khi chống lại thể chế bất công hoặc hành động với thân thủ hơn người mới được cộng điểm.

Ảnh hưởng đến 【Đồng đạo】:
- Tay nghề xuất chúng, kỹ nghệ tinh tiến → Đồng đạo+
- Đóng góp cho ngành, nâng đỡ hậu bối → Đồng đạo+
- Phản bội đồng nghiệp, bán đứng đồng đạo → Đồng đạo-（sụp đổ)
- Làm ẩu làm tả, đập nát bảng hiệu của ngành → Đồng đạo-

Cơ chế đặc biệt:
- 【Tiền đề có tiếng đồn】Hành vi chỉ khi hình thành tiếng đồn bao phủ tầng lớp tương ứng mới có thể thay đổi danh tiếng của tầng lớp đó. Hành vi chỉ bị một người chứng kiến, chưa lan truyền sẽ không thay đổi danh tiếng của nhóm. Hành vi bí mật tuyệt đối không ai biết (đưa vào hộp đen thông tin) không ảnh hưởng đến danh tiếng bốn chiều, chỉ âm thầm ảnh hưởng đến ân oán cá nhân của nạn nhân.
- Một hành vi đơn lẻ tối đa ảnh hưởng đồng thời 3 chiều.
- 【Cá nhân vs Phân biệt vòng tròn】Sự thay đổi danh tiếng dựa trên việc vòng tròn đó có biết đến rộng rãi hay không; việc thù hằn nội bộ của một nhóm đơn lẻ chỉ được tính vào sự chú ý của nhóm đó đối với{{user}}sự chú ý của/nhân vật trọng yếu đối với{{user}}sự thù hận cá nhân của, không ảnh hưởng đến đánh giá tổng thể của chiều tương ứng.
- 【Giang hồ≠Làm rõ tội phạm】Các tội phạm hình sự đơn thuần như trộm cắp, cướp bóc, giết người sẽ không nâng cao địa vị giang hồ. Giang hồ chỉ tôn trọng những kẻ"có lý do"phản nghịch——chống lại thể chế bất nghĩa, ra mặt vì kẻ yếu, hoặc hành động với thân thủ siêu phàm. Một tên trộm chuyên cướp của bình dân trong mắt giang hồ cũng bị coi thường như người bình thường, thậm chí còn bị khinh bỉ hơn.

Ba, những người quan sát khác nhau nhìn vào các chiều khác nhau
mới tạo NPC/Thái độ ban đầu của nhóm, "đọc chiều tương ứng theo vòng tròn mà nó thuộc về":
- Triều đình/Quyền quý/Giai cấp thống trị → Nhìn vào 【Triều đình】
- Bình dân/Bách tính/Thị dân → Xem 【Giữa chốn thị tứ】
- Giang hồ/Thế giới ngầm/Người ngoài thể chế → Xem 【Giữa chốn giang hồ】
- Đồng nghiệp/Cùng nghề/Người trong đồng đạo → Xem 【Giữa chốn đồng đạo】
- Người vượt vòng tròn (như nội gián triều đình vào giang hồ)→ Lấy đánh giá tổng hợp của hai chiều

Bốn, Hiệu ứng danh tiếng phức hợp
- Triều đình+Thị tứ song cao → "Lòng dân hướng về"Chuỗi sự kiện (Quan phương phong tước/Cơ hội được dân ý ủng hộ)
- Thị tứ+Giang hồ song cao → "Thay trời hành đạo"Chuỗi sự kiện (Bách tính và giang hồ đều công nhận{{user}}Là anh hùng, triều đình ngược lại căng thẳng)
- Giang hồ+Đồng đạo song cao → "Một phương hào kiệt"Chuỗi sự kiện (Nhân mạch hai tuyến, giang hồ và đồng nghiệp đều kính nể ba phần)
- Triều đình cao+Giang hồ cao → "Thân phận hai mặt"Chuỗi sự kiện (Rủi ro bại lộ tích luỹ theo thời gian)
- Bất kỳ chiều nào giảm xuống trời giận người oán → Trong vòng tròn đó"Truy nã/Truy sát/Trục xuất/Phong sát"Chuỗi sự kiện

Năm, Chi tiết quy tắc
- 【Cơ chế hồi phục phản sát】Danh tiếng tăng lên thông qua việc phản sát đoàn thể phục thù, mặc định tác dụng giữa chốn đồng đạo (chạm đỉnh"Được kính trọng"）；Nếu đối tượng phản sát là đoàn thể tội ác tày trời, thì đồng thời nâng cao danh tiếng thị tứ và địa vị giang hồ.
- 【Danh tiếng sụp đổ bắt buộc đánh giá lại】"Phản bội lòng tin""Bị vạch trần lời nói dối"Hoặc các sự kiện tội ác tồi tệ, có thể khiến chiều tương ứng lập tức rớt cấp. Lúc này bắt buộc yêu cầu AI Đánh giá lại sự chú ý của tất cả các đoàn thể đã xuất hiện đối với{{user}}độ quan tâm.
- 【Độ khó tẩy trắng】"Tai tiếng khắp nơi"Hồi phục đến"Vô danh"Cần nhiều vòng hành vi tương ứng liên tục hoặc một sự kiện chính diện trọng đại.
</reputation>`
    },
    // ========== Module 8: Kinh tế ==========
    {
      comment: 'Module 8: Kinh tế',
      content: `<world_economy>

Mạch đập kinh tế là tuần hoàn máu của thế giới, không phải{{user}}sổ cái cá nhân của. Nó theo dõi khí hậu kinh tế tổng thể và những thay đổi đáng chú ý trong thị trường.

Một, Khí hậu kinh tế

climate Biểu thị nhiệt độ kinh tế của khu vực hiện tại, "dùng bốn từ để mô tả":
- Phồn vinh: Thương mại hưng vượng, tuyến đường thương mại an toàn, vật giá ổn định ở mức cao
- Ổn định: Hoạt động thường ngày, vật giá dao động tự nhiên theo mùa
- Suy thoái: Nhu cầu thu hẹp, thương hiệu phá sản, một số ít nhu yếu phẩm thiết yếu lại tăng vọt
- Biến động: Chiến loạn/Thiên tai nạn đói/Phong toả dẫn đến trật tự kinh tế sụp đổ, trao đổi hàng hoá quay trở lại

climate của scope là{{user}}Khu vực hiện tại và vòng tròn kinh tế liên kết trực tiếp với nó. Sự nóng lạnh của kinh tế ở xa thông qua signals bổ sung.

Hai, Tín hiệu thị trường

signals Ghi lại những thay đổi kinh tế đáng chú ý trên thị trường hiện tại. Tiêu chuẩn theo dõi:
- Thay đổi này đủ để ảnh hưởng đến hành động của thế lực,NPC quyết sách hoặc hướng đi của chuỗi sự kiện
- không phải dao động thường ngày——dao động thường ngày không đáng để đưa vào signals
- thường không vượt quá 3 mục

Mỗi mục bao gồm:
- summary：Một câu mô tả thay đổi và ảnh hưởng (ví dụ"Chiến sự Bắc cảnh cắt đứt đường mỏ, giá sắt tăng gấp ba, các tiệm rèn lần lượt đóng cửa"）
- scope：Phạm vi địa lý bị ảnh hưởng (tên khu vực cụ thể, không được viết"toàn lãnh thổ"）

AI bắt buộc để mỗi mục signal Có nhân quả: Đằng sau sự thay đổi phải có chuỗi sự kiện hoặc nguyên nhân bên ngoài có thể truy xuất (thời tiết, chiến sự, gián đoạn thương mại, công nghệ mới, hành vi đầu cơ tích trữ, đầu cơ). Không thể dao động vô cớ.

Ba, Liên kết có tiếng đồn và chuỗi sự kiện

- Những thay đổi lớn như vật giá tăng vọt, cạn kiệt vật tư → tạo ra ít nhất 1 mục thông báo kinh tế hoặc dư luận (xem module bốn).
- Sau khi mọi người biết được có tiếng đồn kinh tế và thực hiện các hành động như đổ xô đi mua, đầu cơ tích trữ, rút vốn, có thể đảo ngược lại làm thay đổi kinh tế và chuỗi sự kiện.
- Cấm bỏ qua khoảng cách khiến thông tin kinh tế lan truyền khắp thành phố trong chớp mắt——signals của scope và của có tiếng đồn scope phải nhất quán.

Bốn, Liên kết kinh tế và chuỗi sự kiện

- Xuất hiện nghiêm trọng cùng một hướng trong nhiều vòng liên tiếp signal → API Nên tạo một chuỗi sự kiện loại thúc đẩy, biểu thị địa phương đang cố gắng giải quyết (mở tuyến đường thương mại mới, tìm kiếm sản phẩm thay thế, v.v.).
- Thay đổi kinh tế lớn → Ảnh hưởng đến quan hệ giữa các thế lực (độ căng thẳng giữa bên chịu thiệt và bên hưởng lợi tăng lên).

Năm, Điều cấm

- Cấm theo dõi{{user}}ví tiền hoặc ba lô cá nhân của. Đây là World Engine, không phải phòng kế toán.
- Cấm dao động vụn vặt thường ngày đưa vào signals。
- Cấm giá cả vật tư dao động không có lý do.
- Cấm xu hướng kinh tế của tất cả các khu vực hoàn toàn nhất quán.
</world_economy>`
    },
    // ========== Module chín: Sổ kẻ thù ==========
    {
      comment: 'Module chín: Sổ kẻ thù',
      content: `<enemies>

Kẻ thù là do{{user}}hành vi tổn thương cụ thể của tạo ra, ân oán cá nhân không thể đảo ngược. Đặc trưng cốt lõi của kẻ thù là không bao giờ phai nhạt và theo dõi xuyên khu vực. Nó đối lập với thái độ ở cấp độ thế lực (factions.relation）là hai thứ hoàn toàn khác nhau——Thế lực đối立 bắt nguồn từ lập trường và lợi ích, có thể đàm phán; kẻ thù bắt nguồn từ tổn thương, không thể đàm phán.

1. Loại kẻ thù
1. Huyết cừu (type: "blood"）— Điều kiện kích hoạt (thoả mãn một trong các điều kiện):{{user}}Giết chết nhân vật trọng yếu của một đoàn thể nào đó (ngoại trừ cựu nhân vật trọng yếu đã mất quyền lực, xem phần quyền lực tan rã của module thế lực);{{user}}Khiến người thân ruột thịt của ai đó tử vong hoặc tàn phế vĩnh viễn.
   Đặc tính: Không bao giờ phai nhạt, không thể đàm phán, động cơ trả thù không bao giờ biến mất. Ngay cả khi bên trả thù cạn kiệt tài nguyên, hận thù cũng không tan biến, chỉ tạm thời đình trệ do thiếu khả năng.

2. Ân oán không gây tử vong (type: "grudge"）— Điều kiện kích hoạt (phải đồng thời thoả mãn):
   - Tổn thương không thể đảo ngược:{{user}}Hành vi của ... đã gây ra tổn thất nặng nề không thể phục hồi (phế bỏ võ công, cướp đi cơ nghiệp cả đời, gài bẫy dẫn đến phá sản/lưu đày/bị tước đoạt thân phận, v.v.).
   - Ý nguyện trả thù rõ ràng: Nạn nhân có động cơ trả thù mãnh liệt, rõ ràng, không phải kiểu chung chung"không thích"hoặc"ôm hận trong lòng"。
   - có theo dõi/Khả năng báo thù: Nạn nhân có khả năng (tài nguyên, võ nghệ, nhân mạch, mạng lưới tình báo) đối với{{user}}thực hiện theo dõi hoặc báo thù thực tế.
   Không thoả mãn 3 điều trên thì không tính grudge。bị{{user}}nhục mạ, một lần thất bại trong cạnh tranh thương mại, bị thương do ẩu đả trên phố——những điều này đều không đủ tư cách đưa vào sổ kẻ thù, nên để trong tự sự do AI thể hiện tự nhiên, không ghi ra đĩa.
   Đặc tính: Tương tự không bao giờ phai nhạt, nhưng mức độ khủng bố thường thấp hơn huyết cừu.

2. Hành vi và theo dõi của kẻ thù
- Huyết cừu cung cấp động cơ, "không cung cấp khả năng. Truy sát bị ràng buộc bởi cấp bậc thế lực": thế lực yếu không thể thâm nhập địa bàn của thế lực mạnh.
- Theo dõi liên khu vực cần thời gian. Kẻ thù phải định vị trước thông qua các biện pháp hợp pháp{{user}}（mạng lưới tình báo, người cung cấp thông tin, có tiếng đồn, v.v.), sau đó mới có thể tổ chức hành động.
- Kẻ thù status = "đang thực thi"khi, mỗi cách 5-10 vòng mới có tỷ lệ thực sự phát động một lần truy sát/hành động báo thù.
- Nếu thế lực kẻ thù < {{user}}thế lực bảo vệ nơi ở, truy sát buộc phải đình trệ, chuyển sang"đang theo dõi"và tích luỹ lực lượng.

3. Kích hoạt kẻ thù (góc nhìn đoàn thể)
Khi{{user}}hành vi của ... kích hoạt type=blood thì,"AI phải căn cứ vào thân phận của người bị giết để phán đoán hướng đi của đoàn thể":
1. Người bị giết là nhân vật trọng yếu của đoàn thể (ngoại trừ cựu nhân vật trọng yếu đã mất quyền lực):
   - Hướng đi A（Cùng chung kẻ thù): Nếu độ gắn kết cao và có người thừa kế rõ ràng, người thừa kế trở thành cốt lõi mới, tạo chuỗi sự kiện loại xung đột.
   - Hướng đi B（Đấu đá nội bộ): Nếu bè phái san sát, đoàn thể rơi vào tranh quyền đoạt lợi, việc trả thù bị gác lại, tiến độ ban đầu đình trệ.
   - Hướng đi C（Giải tán): Nếu độ gắn kết thấp hoặc tài nguyên cạn kiệt, đoàn thể trực tiếp giải tán, xoá khỏi bảng điều khiển hoạt động.
2. Người bị giết là thành viên bình thường (hoặc cựu nhân vật trọng yếu đã mất quyền lực): tạo đoàn thể trả thù tạm thời, "định dạng tên":"[Tên người bị giết]đội phục thù người thân của"。Tạo chuỗi sự kiện loại xung đột.
Bất kể đường dẫn nào, đều phải trong enemies thêm một mục sổ kẻ thù vào, và trong influenceChain ghi lại quan hệ truyền dẫn.

Bốn, kẻ thù kết thúc
Chỉ khi kẻ thù bị{{user}}tiêu diệt hoàn toàn (giết kẻ phục thù cốt lõi, phá huỷ tổ chức phục thù), mới có thể đánh dấu status="đã kết thúc"。
- Các mục đã kết thúc sẽ được giữ lại 20 vòng ghi nhớ sau đó tự động xoá.
- Sau khi phản sát{{user}}danh tiếng có thể hồi phục, nhưng cao nhất chỉ có thể đạt tới"Được kính trọng"（nếu module danh tiếng được bật).
- Chuỗi sự kiện loại xung đột tương ứng đồng bộ đánh dấu là đã kết thúc.

Năm, Điều cấm
- Cấm chỉ vì"bị{{user}}nhục mạ""cạnh tranh thương mại thất bại""đánh nhau trên phố bị thương nhẹ"và các tổn thương có thể đảo ngược khác để tạo mục sổ kẻ thù.
- Cấm việc đối lập thái độ ở cấp độ thế lực (factions.relation = "thù địch"）tự động đánh đồng với kẻ thù.
- Cấm ban cho kẻ thù năng lực vượt quá thế lực của chúng. Thế lực yếu không thể tự dưng triệu hồi viện trợ mạnh, thâm nhập lãnh địa mạnh hoặc định vị toàn tri.
</enemies>`
    },
    // ========== Module 10: Sự kiện đột phát khu vực ==========
    {
      comment: 'Module 10: Sự kiện đột phát khu vực',
      content: `<regional_incident>

Một, định vị hệ thống
Hệ thống này chỉ chịu trách nhiệm tạo sự kiện đột phát cấp khu vực——sự kiện trọng đại đủ để ảnh hưởng đến một khu vực, con đường, thị trấn, cửa ải, bến tàu, đền chùa, chợ, thôn làng, tuyến đường thương mại hoặc đường thuỷ.
Không xử lý các sự kiện giá trị thấp sau (chúng chỉ phù hợp làm miêu tả môi trường trong chính văn): xe ngựa hoảng sợ, ngoại tình bị bắt, người qua đường cãi nhau, kẻ say rượu làm loạn, kẻ trộm ăn cắp, tranh chấp hàng xóm thông thường, có người đánh nhau ở xa, tai nạn ngẫu nhiên cá nhân.
Ví dụ về sự kiện đột phát khu vực: sơn tặc cướp đường, thuỷ phỉ cướp thuyền, thương đội bị đồ sát, giết người hàng loạt, hoả hoạn trong thành, kho lương bốc cháy, lũ lụt, dịch bệnh, cầu sập, quan đạo đứt đoạn, nạn đói thiếu lương, bạo loạn bến tàu, dân biến địa phương, quân thủ thành làm phản, động đất lở núi, bão tuyết.

Hai, phân chia trách nhiệm
Sự kiện đột phát khu vực có kích hoạt hay không, và kích hoạt loại nào, hoàn toàn do hệ thống cục bộ phán đoán. Khi cục bộ không kích hoạt, quy tắc này sẽ không yêu cầu bạn tạo sự kiện đột phát khu vực, bạn cũng không được tự phát tạo.
Chỉ khi cục bộ phán đoán kích hoạt và tiêm "Lệnh bắt buộc đột phát khu vực" cho bạn, bạn mới theo loại được chỉ định trong lệnh, tạo tiêu đề sự kiện cụ thể, địa điểm xảy ra, phạm vi ảnh hưởng, truyền bá có tiếng đồn và ảnh hưởng lan tràn.

Ba, loại sự kiện
- banditry Cướp bóc: sơn tặc, thuỷ phỉ, lưu khấu, băng cướp, cướp tiêu, cướp thuyền, cướp lương, cướp muối, đồ sát cướp bóc thôn bản hoặc thương đội.
- fire Hoả hoạn: phường thị, kho lương, bến tàu, đền chùa, quan thự, công xưởng, đội thuyền, kho hàng xảy ra hoả hoạn khu vực.
- massacre Án mạng nghiêm trọng: giết người hàng loạt, án diệt môn, huyết án khách sạn, thương đội bị đồ sát, án xác chết bến tàu và các vụ án đủ để gây hoảng loạn.
- flood Lũ lụt: nước sông dâng cao, vỡ đê, bến tàu bị ngập, ruộng làng bị huỷ, cầu bị cuốn trôi.
- infrastructure Đường sá thuỷ lợi sụp đổ: quan đạo sạt lở, cầu sập, bến phà ngừng hoạt động, đê nứt, cống nước hư hỏng, dịch lộ đứt đoạn.
- plague Dịch bệnh: dịch người, dịch gia súc, nguồn nước nhiễm bệnh, thôn làng phong toả, bến tàu từ chối chở, bệnh nhân sốt cao trong thành tăng vọt.
- famine Nạn đói thiếu lương: kho lương cạn đáy, lương cứu tế đứt đoạn, giá lương thực tăng vọt, nạn dân cướp lương, đại hộ đóng kho, thôn quê đứt bữa.
- riot Bạo loạn: ẩu đả bến tàu, dân đói cướp lương, khách hành hương giẫm đạp, tiệm muối bị đập, xung đột trạm gác, xung đột thị tứ mở rộng.
- rebellion Dân biến nổi loạn: lưu dân lập trại, hương binh chống quan, bạo động thuế dịch, tà giáo tụ tập, nổi loạn địa phương.
- military Quân vụ đột biến: quân thủ thành làm phản, quân lương bị cướp, biên quân bỏ chạy, quân địch vượt biên, cửa ải giới nghiêm, doanh trại kinh sợ trong đêm.
- earthquake Động đất lở núi: động đất, lở núi, sập hầm mỏ, nứt đất, sơn thôn bị vùi lấp.
- storm Bão tuyết: bão, bão tuyết, bão cát, đợt rét đậm, gió biển huỷ thuyền, gió lớn phá huỷ lều lán.

Bốn,API Yêu cầu tạo
Khi xúc xắc cục bộ kích hoạt và tiêm lệnh bắt buộc,"API phải":
1. Dựa theo loại được chỉ định tạo sự kiện đột phát cấp khu vực, sự kiện ảnh hưởng đến một khu vực, con đường, thị trấn, cửa ải, bến tàu hoặc phạm vi địa lý rõ ràng khác.
2. Sự kiện phải tạo ra tiếng đồn có thể lan truyền.
3. Sự kiện phải gây ra ít nhất một ảnh hưởng lan tỏa: thay đổi kinh tế, hành động thế lực, thay đổi trị an, thay đổi chuỗi sự kiện, thay đổi danh tiếng, thay đổi hộp đen hoặc chuỗi ảnh hưởng mới.
4. Sự kiện và{{user}}hành vi hiện tại không có quan hệ nhân quả trực tiếp, không được viết thành kết quả âm mưu của kẻ thù đã có, thế lực đã có, chuỗi sự kiện đã có.
5. Không được vô cớ hủy diệt sân khấu cốt lõi, không được vô cớ phá hủy{{user}}tài sản cốt lõi.
6. Nếu sự kiện không xảy ra ở{{user}}khu vực hiện tại, không được cưỡng ép ngắt quãng{{user}}hành động hiện tại, chỉ đóng vai trò thay đổi thế giới dưới nền, tin tức phương xa hoặc lan truyền tiếng đồn.
7. Cấm biến"sự kiện đột phát khu vực"thành âm mưu đã được lên kế hoạch từ lâu của một thế lực đã có.

Năm, cấu trúc dữ liệu
{
  "regionalIncident": {
    "active": true,
    "title": "Tiêu đề sự kiện",
    "type": "Loại sự kiện",
    "scope": "Phạm vi ảnh hưởng",
    "impact": "Tóm tắt hậu quả khu vực trong một câu"
  }
}
cooldown Được bảo trì cục bộ,API không được xuất hoặc sửa đổi trường này.

Sáu,API Yêu cầu trả về tối thiểu
Sau khi kích hoạt ít nhất trả về regionalIncident、winds、influenceChain。Tùy tình huống có thể trả về thêm events、economy、factions、reputation、blackbox。
</regional_incident>`
    },
    // ========== Module 11: Hộp đen thông tin ==========
    {
      comment: 'Module 11: Hộp đen thông tin',
      content: `<secret_asset>

Một, Định nghĩa hộp đen thông tin (Thiết luật chống góc nhìn Thượng đế)
Trong quá trình chạy cốt truyện, có hai loại nội dung cần được đưa vào 【Hộp đen thông tin】 để cách ly nghiêm ngặt:
1. Hành vi bí mật (secretActions）：{{user}}Hành động hoàn thành trong tình huống không có người chứng kiến, không để lại dấu vết (như giết bò trên núi sâu, ám sát trong mật thất, đột nhập không tiếng động). Thuộc tính then chốt là dấu vết——có nhân chứng hay không, có vật chứng hay không.
2. Tài sản bí mật (secretAssets）：{{user}}Mọi tài nguyên nắm giữ trong tối, chưa hiển thị công khai (như mật thư, thuốc độc, điểm yếu, vật tư cất giấu, nội gián, thân phận bí mật). Thuộc tính then chốt là mức độ lộ diện và tính khả dụng.
- secretActions Trường: mỗi mục { action, witnesses: "Không/Chỉ XX" }
- secretAssets Trường: mỗi mục { name, exposure: 0-100, status: "hợp lệ/hết hạn/lộ diện/hết hiệu lực" }

Hai, Kiểm tra quyền được biết và quy tắc cách ly vật lý (Ưu tiên cao nhất)
1. Nguyên tắc rào cản vật lý: Đối với nội dung trong hộp đen, tất cả những người không ở hiện trường vụ án, không trực tiếp tham gia NPC，mặc định ở trạng thái"hoàn toàn, triệt để không hay biết"cách ly vật lý.
2. Cấm tuyệt đối góc nhìn Thượng đế:AI Tuyệt đối cấm biến{{user}}hành vi bí mật tự động chuyển thành sự kiện toàn tri. Ví dụ:{{user}}giết một con bò trên núi sâu, chỉ cần không có nhân chứng, cho dù đến thành phố, cũng tuyệt đối không có bất kỳ ai biết con bò đã chết, càng không thể biết là do{{user}}giết.
3. Bắt buộc kiểm tra:AI Khi miêu tả bất kỳ NPC（bao gồm đối thoại, hành động, thần thái, hoạt động tâm lý) trước, bắt buộc phải đối chiếu xem NPC có nằm trong"danh sách người biết chuyện"của hộp đen hay không.
4. Biểu hiện hoàn toàn không biết: Nếu NPC không biết chuyện,AI tuyệt đối không được để họ thể hiện ra bất kỳ sự ám chỉ, nghi ngờ,"lời nói ẩn ý"hoặc"giác quan thứ sáu"。không biết chuyện tức là giống như một tờ giấy trắng,NPC phản ứng của họ bắt buộc phải hoàn toàn dựa trên nhận thức công khai hiện tại của họ.
5. Ràng buộc suy luận dấu vết: Nếu{{user}}để lại vật chứng rõ ràng,NPC bắt buộc phải thông qua các"hành động điều tra"cụ thể phù hợp với trí lực và thân phận của họ thì mới có thể dần dần thu thập thông tin, tuyệt đối không được trực tiếp"đốn ngộ"hoặc"đoán được"。

Ba, cơ chế vận hành tài sản bí mật
- exposure：0-100，nguy cơ bại lộ.0=tuyệt đối bí mật,100=đã hoàn toàn công khai.{{user}}Hoạt động thường xuyên, cảnh giới địa phương nâng cấp, trưng ra hoặc ám chỉ cho người khác, đều sẽ dẫn đến mức độ bại lộ tăng lên. Đạt đến 50 có tao ngộ chiến/nguy cơ rò rỉ, đạt đến 90 có thể bị tịch thu/công khai.
- status：hợp lệ/hết hạn/lộ diện/hết hiệu lực. Hợp lệ=vẫn có thể gọi; hết hạn=tình báo lỗi thời; bại lộ=đã bị phát hiện; hết hiệu lực=đã không khả dụng (như vật tư bị tịch thu, người đưa tin mất liên lạc, thân phận bị nhìn thấu).
- Tiến hoá tài sản: Tình báo có tính thời hiệu, sau khi sự kiện liên quan xảy ra có thể tự động hết hạn. Mức độ bại lộ của điểm cất giấu vật tư tăng tự nhiên theo thời gian, hoạt động gần đó làm tăng tốc độ. Người đưa tin/cơ sở ngầm sau khi bại lộ có thể bị lợi dụng ngược lại, thân phận sau khi bại lộ sẽ mất đi tính linh hoạt trong hành động. Mức độ bại lộ thấp+tính hợp lệ cao=tài sản an toàn; mức độ bại lộ thấp+đã hết hạn=không ai biết nhưng đã vô dụng; mức độ bại lộ cao+đã hết hiệu lực=đã bị phát hiện và huỷ bỏ.
</secret_asset>`
    },
    // ========== Module 12: Đại thế thiên hạ ==========
    {
      comment: 'Module 12: Đại thế thiên hạ',
      content: `<world_trends>

Đại thế thiên hạ là cục diện dài hạn đã thay đổi phương thức vận hành của quốc gia, quốc tế hoặc toàn bộ thế giới. Nó không phải là có tiếng đồn bình thường, cũng không phải là chuỗi sự kiện đang chờ thúc đẩy, mà là ràng buộc cấp thế giới bắt buộc phải cân nhắc khi các hệ thống khác hành động.

Một, cấu trúc dữ liệu
Mỗi mục bao gồm:
- name：Tên đại thế ổn định, trùng tên sẽ ghi đè cập nhật.
- scope：Phạm vi ảnh hưởng thực tế.
- status："đang tiếp diễn"/"đã kết thúc"。
- description：Cục diện hiện tại và nó đang ràng buộc hành động của thế giới như thế nào.
- source：Nguồn gốc rõ ràng hình thành nên đại thế này.

Hai, điều kiện hình thành
Mỗi vòng kiểm tra các nguồn ứng viên sau:
- Lv4 Sự kiện loại xung đột bước vào"đã bùng phát"。
- Lv4 Sự kiện loại thúc đẩy bước vào"đã hoàn thành"，và thành quả thay đổi cục diện quốc gia hoặc quốc tế.
- Lv4 Sự thật đằng sau có tiếng đồn được xác nhận rộng rãi, và liên tục ảnh hưởng đến nhiều thế lực.
- Các cục diện dài hạn như chiến tranh, đoạt đích, đại án toàn quốc, thay đổi chính quyền, thảm họa toàn cầu đã hình thành.

Nguồn ứng viên không đồng nghĩa với tự động tạo. Chỉ khi đồng thời thỏa mãn"kéo dài liên tục, ảnh hưởng diện rộng, tác dụng xuyên hệ thống, buộc nhiều thế lực liên tục điều chỉnh hành vi"thì mới tạo đại thế thiên hạ. Lễ hội toàn quốc, thông báo đơn lẻ, chấn động ngắn hạn, tin tức trọng đại thông thường không tính là đại thế thiên hạ.

Ba, tiếp diễn và kết thúc
- Đại thế thiên hạ không tham gia xúc xắc, không tự động tan biến, cũng không vì vòng nào đó không trả về mà bị xoá.
- Tất cả status="đang tiếp diễn" đại thế thiên hạ, mỗi vòng đều phải làm bối cảnh ràng buộc cho chuỗi sự kiện, thế lực, kinh tế, có tiếng đồn và NPC hành vi.
- Bản thân đại thế không có effects trường. Ảnh hưởng cụ thể nên được áp dụng vào hệ thống tương ứng, và ghi lại khi tạo ra thay đổi xuyên hệ thống influenceChain。
- Chỉ cập nhật khi xuất hiện sự thật thay đổi cục diện rõ ràng description；Chỉ đánh dấu là khi cục diện xác định đã kết thúc"đã kết thúc"。
- Đại thế đã kết thúc là kết quả lịch sử, không được chuyển lại thành đang tiếp diễn; nếu cục diện tương tự xảy ra lần nữa, nên tạo đại thế với tên mới.
</world_trends>`
    }
  ];

  // ===================== Giao diện đối ngoại =====================

  function loadRules(baseUrl) {
    return new Promise((resolve) => {
      console.log('[World Engine] Quy tắc đã được tích hợp sẵn trong JS , tổng cộng', RULES.length, 'mục');
      resolve({ count: RULES.length, comments: RULES.map(r => r.comment) });
    });
  }

  function getAllRulesText() {
    console.log('[getAllRulesText] RULES:', RULES.length);
    if (RULES.length === 0) return '【Tải quy tắc thế giới thất bại, tất cả quy tắc không khả dụng】';
    const orderedRules = RULES.map(r => `========== ${r.comment} ==========\n${r.content}`);
    return `## Quy tắc suy diễn thế giới (bản gốc, tổng cộng${RULES.length}điều)\n\n${orderedRules.join('\n\n')}`;
  }

  function getCoreRulesSummary() {
    if (RULES.length === 0) return '';

    const summary = `
【World Engine·Quy tắc hành vi thế giới】

Thế giới vận hành:
- Thế giới là sống, không xoay quanh{{user}}xoay: mỗi vòng đều để người trước đài sau rèm sống cuộc sống của riêng họ——người đi đường cứ đi đường, người buôn bán cứ buôn bán, người đấu đá cứ tiếp tục đấu đá, cho dù chẳng liên quan gì đến nhân vật chính. Những việc không liên quan đến{{user}}là chuyện bình thường, đừng đổ mọi thứ lên đầu họ.
- Người không có mặt cũng đang hành động: mỗi vòng chính văn đều nên để lộ"thế giới tự vận hành"dấu vết——động tĩnh mới truyền đến từ nơi khác, ai đó đã đổi chỗ hoặc không còn nữa, một sự kiện nào đó lại tiến thêm một bước, chứ không phải nhân vật chính không xuất hiện thì thế giới đóng băng.
- Nhân vật chính không toàn tri: họ chỉ cảm nhận được những việc trước mắt và tình cờ gặp phải; thay đổi ở phương xa dựa vào có tiếng đồn, tin đồn, thương nhân, thông báo truyền đến tai họ, nếu không truyền đến thì coi như họ không biết, đừng để họ tự dưng biết được tình hình phương xa.
- Mỗi vòng thế giới tiến lên một bước: thời gian đang trôi, không liên quan đến việc trong cốt truyện đã qua bao lâu, đừng để thế giới dừng lại tại chỗ chờ nhân vật chính.

Chuỗi sự kiện (định dạng tiêm: tên(loại, Lv['cấp độ']) giai đoạn hiện tại tiến độ giai đoạn/9 [động hướng vòng này]，Ví dụ: Tuyết Diêu Doanh Nam Điều(loại thúc đẩy, Lv.4) then chốt/quan trọng 4/9 [giữ nguyên]）：
- Trước tiên sẽ đọc dòng này: ví dụ trên = một đại sự loại thúc đẩy tên là 「Tuyết Diêu Doanh Nam Điều」, đang ở"then chốt/quan trọng"Giai đoạn, giai đoạn này thúc đẩy đến 4/9，Vòng này án binh bất động. Dưới đây phân tích từng mục.
- Hai loại: loại xung đột = mâu thuẫn sẽ lăn đến bùng phát (trả thù, truy sát, phe phái thanh trừng, chiến tranh thanh toán); loại thúc đẩy = sự vụ sẽ lăn đến đã hoàn thành (nghiên cứu, xây dựng, điều tra, làm việc, mở đường buôn bán).
- cấp độ Lv1-4 ＝Sức nặng và phạm vi ảnh hưởng của việc này, "khi diễn quy mô phải tương xứng":
  · Lv1 Cấp cá nhân (va chạm trên phố / dò hỏi tin tức nhỏ), động tĩnh dừng ở đương sự;
  · Lv2 Cấp cục bộ (đả thương đập quán / lập cứ điểm, huấn luyện tiểu đội), lan ra một con phố hoặc một đoàn thể nhỏ;
  · Lv3 Cấp khu vực (giết nhân vật trọng yếu / xây đại công phường, rải lưới tình báo), có thể khuấy động cả tòa thành hoặc nhiều đại thế lực;
  · Lv4 Cấp thế giới (thích sát vua / đúc quốc khí, đổi đường buôn bán), đủ để viết lại cục diện một nước.
  loại xung đột Lv Càng cao càng hung hiểm, càng dễ mất kiểm soát; loại thúc đẩy Lv Càng cao càng gian nan, thúc đẩy càng chậm. Đừng đem Lv4 đại sự viết thành xô xát nhỏ trên phố.
- Giai đoạn ＝Việc này đi đến bước nào, "độ căng thẳng của chính văn theo giai đoạn tăng dần":
  · Loại xung đột: manh nha (vừa nhú mầm, số ít người nhận ra)→ủ biến (lan rộng, tụ người tụ thế tụ động cơ)→cận kề (chạm là nổ)→đã bùng phát (truy sát / ẩu đả / truy nã v.v. đã diễn ra);
  · Loại thúc đẩy: chuẩn bị (chuẩn bị người, vật liệu, tình báo)→thực thi (thực tế bắt tay vào làm, liên tục đầu tư)→then chốt (bước ngoặt cuối cùng, dễ bị phá hỏng hoặc lật ngược nhất)→đã hoàn thành (thành quả đạt được).
- Tiến độ/9 ＝Thanh tiến độ trong giai đoạn hiện tại, càng gần 9 càng cận kề giai đoạn tiếp theo.4/9 là quá nửa chưa đến đỉnh, đừng diễn như sắp vượt giai đoạn, cũng đừng coi như nó chưa khởi bước.

- [động hướng vòng này] ＝Đà của vòng này:[thành công]＝tiến lên một bước,[thất bại/chùn bước]＝bị đẩy lùi một chút,[giữ nguyên]＝giằng co tại chỗ không động. Vòng này nên tiến, nên lùi hay nên bế tắc, cứ theo nó mà làm, đừng làm trái lại. (Sự kiện chung cuộc không mang đánh dấu này)
- Còn lại: sự kiện đi theo logic của chính nó, không xoay quanh nhân vật chính; đình trệ≠từ bỏ, bên bị cản trở sẽ chuyển sang vòng ngoài chuẩn bị kín đáo (bố trí tai mắt, tích lũy tài nguyên, tìm người giúp) chứ không biến mất vô cớ; địa vị nạn nhân càng cao, cấp độ xung đột nhảy vọt càng mạnh (mạo phạm quyền quý≈trọng tội).
Thế lực:
- Quan hệ là thái độ của thế lực này đối với{{user}}thái độ,"NPC lời nói và hành động phải dựa trên thái độ này": đồng minh sẽ không vô cớ trở mặt, thù địch/thù truyền kiếp sẽ không đột nhiên tỏ ý tốt.
- Thế lực sống theo mục tiêu của mình, không xoay quanh{{user}}chuyển động; chỉ khi biết được thông báo hợp pháp và địa bàn với tới được, mới chủ động tìm đến{{user}}hoặc ra tay.
- Thế lực chỉ có tiếng nói trong phạm vi của mình, vượt biên giới làm{{user}}phải có bước đệm, không thể vô cớ hô mưa gọi gió trên địa bàn người khác.
- Thù địch chỉ là lập trường đối đầu, có thể đàm phán; với kẻ cắn chết{{user}}không buông là hai chuyện khác nhau.

Đại thế thiên hạ:
- Đại thế thiên hạ là gì: nó không phải một sự kiện cụ thể, cũng không phải chuỗi sự kiện nào đang chờ bùng phát, mà là bối cảnh lớn đã bao trùm toàn bộ thời đại——chiến tranh, đoạt đích, đại tai, thay đổi chính quyền, tái cấu trúc đường buôn bán, những cục diện dài hạn, diện rộng, viết lại quy tắc này. Nó là"thời tiết"，của thế giới, tất cả mọi người trong phạm vi đều sống dưới nó, không ai tránh khỏi.
- Nó là bối cảnh nền luôn tồn tại, không cần màn nào cũng làm nhân vật chính, "nhưng phải liên tục thấm vào các chi tiết": vật giá vật tư (trưng thu lương thực thì lương thực đắt, phong tỏa đường sá thì thiếu hàng hóa), hoàn cảnh và chủ đề của con người (trai tráng bị bắt lính, nạn dân chạy xuống phía nam, ai nấy đều lo sợ), những hạn chế trong hành sự (trạm gác kiểm tra nghiêm ngặt, một số giao thương bị đứt đoạn, một số con đường không thể đi). Cho dù nhân vật chính đang làm việc hoàn toàn không liên quan, đại thế thiên hạ cũng nên âm thầm đè nặng trong bối cảnh.
- Phạm vi ảnh hưởng = đại thế thiên hạ bao trùm đến đâu: thế lực, giao thương, đi lại, lòng người trong phạm vi đều bị nó dẫn dắt; ngoài phạm vi chỉ là tiếng sấm ầm ầm từ xa, dựa vào có tiếng đồn mang đến.
- Nó là cục diện dài hạn, sẽ không vì một hai vòng không nhắc đến mà biến mất; trừ khi trong cốt truyện nó đã kết thúc rõ ràng, nếu không thì nó luôn ở đó ràng buộc thế giới——Đừng diễn cho nó mất đi, cũng đừng tự ý kết thúc nó.

Có tiếng đồn (định dạng tiêm:[loại Lv.Quy mô Nơi truyền đến] Cách nói, "ví dụ":[Tin đồn Lv.3 Thanh Thạch Quan và khu vực lân cận] Quân thủ vệ Thanh Thạch Quan sắp bị điều xuống phía nam):
- Có tiếng đồn là lời thì thầm của thế giới, "phải để nó được người ta nói ra trong chính văn": bàn tán ở quán trà, tán gẫu ở bến tàu, cáo thị trên tường, lời nhắn của khách thương, hàng xóm khua môi múa mép——Đừng để nó chỉ nằm đó mà không lên tiếng.{{user}}Khi người ở nơi hoặc tầng lớp mà có tiếng đồn truyền đến, thì nên có người nhắc tới, có người tin sâu sắc, có người bán tín bán nghi.
- Bốn loại, "độ tin cậy và giọng điệu khác nhau": thông báo = quan phủ hoặc thế lực đã công khai nói qua,"đã nói qua"là thật, nội dung chưa chắc đã thật; tin nhắn = sự truyền đạt có nguồn gốc, khá đáng tin; tin đồn = càng truyền càng sai lệch, thường phóng đại, bóp méo, râu ông nọ cắm cằm bà kia; dư luận = cảm xúc và hướng gió của một nhóm người, chưa chắc đã có tin chính xác. Diễn xuất độ tin cậy khác nhau theo loại, đừng coi tin đồn là bằng chứng thép, cũng đừng coi thông báo là sự thật.
- Lv Quy mô = truyền rộng bao nhiêu:Lv1 Vài người trong vòng tròn/Lv2 Một nơi/Lv3 Một châu một quận/Lv4 Một nước cho đến thiên hạ. Quy mô càng lớn, càng nhiều người không liên quan cũng đang bàn luận, cũng bị vạ lây.
- Nơi truyền đến = ranh giới của có tiếng đồn: người trong phạm vi hoặc tầng lớp này mới nghe được, mới phản ứng dựa theo đó; người ngoài phạm vi hoàn toàn không biết gì về điều này, đừng để nơi chưa truyền đến có người vô cớ hùa theo.

Truyền bá thông tin:
- NPC Biết được thông tin phải có con đường hợp pháp: tận mắt chứng kiến, người khác báo cho, suy diễn từ vật chứng, thông tin công khai, mạng lưới tình báo.
- Cấm"Chính là đã biết"。Cấm rò rỉ thông tin bảng điều khiển cho NPC。
- Dấu vết≠chỉ hướng. Vật chứng chỉ có thể suy diễn"đã xảy ra chuyện gì"，không thể nhảy trực tiếp đến"Là ai làm"。
- Ẩn danh/Hóa danh mặc định không liên quan đến bản thể, việc bại lộ cần có điều kiện (bại lộ đặc điểm, bại lộ kỹ năng, chủ động tiết lộ v.v.).

Tiếp xúc và sự kiện:
- Tiếp xúc phải tự nhiên——Người tiếp xúc có dấu vết cuộc sống độc lập, nhân quả rõ ràng, phù hợp với tính cách. Cấm vô cớ tạo ra tiếp xúc.
- Nếu liên tục nhiều vòng không có tiếp xúc chủ động và{{user}}không cố ý lẩn trốn, có thể tạo"bị phớt lờ"loại sự kiện làm gia vị cho cốt truyện.
- {{user}}Khi chủ động lẩn trốn, phe kẻ thù vẫn có thể thông qua theo dõi mà tìm đến tận cửa.

Sổ kẻ thù:
- Kẻ thù chia thành huyết cừu (type=blood，nhân vật trọng yếu bị giết/người thân ruột thịt tử vong hoặc tàn phế) và ân oán không gây tử vong (type=grudge，tổn thương không thể đảo ngược+ý muốn trả thù rõ ràng+có năng lực theo dõi).
- Kẻ thù không bao giờ phai nhạt, đuổi theo{{user}}chạy. Huyết cừu cung cấp động cơ không cung cấp năng lực, truy sát chịu sự ràng buộc của cấp bậc thế lực.
- Theo dõi xuyên khu vực cần thời gian, phải định vị hợp pháp trước{{user}}mới có thể tổ chức hành động.

Sự kiện đột phát khu vực:
- Nếu vòng này xảy ra sự kiện đột phát cấp khu vực (sơn tặc cướp đường, hoả hoạn, lũ lụt, dịch bệnh, nạn đói, v.v.), bắt buộc phải diễn nó ra, đừng để nó có tiếng mà không có miếng, không có hồi kết.
- Cách diễn tuỳ theo khoảng cách: nếu xảy ra ở{{user}}nơi ở, hoá thành áp lực của bối cảnh hiện tại——khói lửa, hoảng loạn, phong toả đường, chạy nạn, tra xét, vật giá leo thang cùng các chi tiết có thể cảm nhận được, ép hắn phải đối mặt hoặc đi đường vòng; nếu ở xa, thì mượn có tiếng đồn, thương nhân, cáo thị, người chạy nạn truyền đến tai hắn, không ngắt quãng cứng nhắc hành động hiện tại của hắn.
- Nó là thiên tai nhân hoạ của bản thân thế giới, không liên quan đến{{user}}chuỗi hành vi của, cũng không phải âm mưu do thế lực đã có bày ra; đừng đổ lên đầu nhân vật chính, cũng đừng bắt hắn gánh tội thay.

Kinh tế:
- Sự nóng lạnh của thị trường phải được diễn ra: "thị trường phồn vinh" được tiêm vào/ổn định/suy thoái/biến động" là nền tảng kinh tế của khu vực hiện tại——Phồn vinh thì tiểu thương tụ tập, hàng hoá lưu thông người đông đúc, vật giá ổn định có phần tăng nhẹ; suy thoái biến động thì cửa hàng đóng cửa, vật giá mất kiểm soát, đường phố tiêu điều, lòng người hoang mang. Hãy biến nó thành{{user}}vật giá, nhân khí và bầu không khí trị an có thể chạm tới được khi mua sắm, trọ lại, đi đường, đừng để nó chỉ làm lời dẫn chuyện bối cảnh.
- 「Tín hiệu" là biến động cục bộ đáng chú ý nhất trước mắt, "phải hiện hình cụ thể ở khu vực mà nó đánh dấu": một vật nào đó tăng giá, đứt hàng tranh mua, thương hiệu phá sản chuyển nghề, phu khuân vác đình công, trạm gác bóc lột v.v., và dựa vào đó ảnh hưởng đến{{user}}có thể mua được gì, tiêu bao nhiêu tiền, đường có dễ đi không, đụng phải người nào.
- Kinh tế đi theo khu vực: tín hiệu chỉ có hiệu lực trong phạm vi của mình, tình hình ở xa phải dựa vào có tiếng đồn, thương nhân, để báo mới truyền đến được, đừng để toàn cảnh đều giống nhau.

Danh tiếng:
- Danh tiếng phải được diễn ra:NPC đối với{{user}}ánh mắt, từ ngữ, lễ nghĩa, ra giá, có chịu giúp đỡ hay không của, đều nên chủ động thể hiện sự cao thấp ở chiều không gian của vòng tròn mà nó thuộc về——Người được kính trọng nhận được sự kính ý, tiện lợi và giảm giá, kẻ tai tiếng khắp nơi bị lạnh nhạt, nâng giá, đề phòng thậm chí xua đuổi, danh tiếng càng cực đoan phản ứng càng rõ nét. Danh tiếng là tiền tệ xã hội sống, không phải đồ trang trí trên bảng điều khiển.
- Mỗi người nhìn theo chiều của mình: bách tính nhìn thị tứ, quan sai nhìn triều đình, người trên giang hồ nhìn thảo mãng, người cùng nghề nhìn đồng đạo, vượt vòng tròn thì lấy tổng hợp; bốn chiều độc lập, không nhuốm màu lẫn nhau, một chiều cao không có nghĩa là chiều khác sẽ nể mặt (thảo mãng cao ngược lại có thể khiến triều đình càng kiêng dè hơn).
- Vô danh là trạng thái mặc định=vòng tròn đó chưa từng nghe qua{{user}}，cứ coi như người lạ bình thường là được, đừng cố gượng ép phản ứng mạnh mẽ; có phản ứng cũng phân cấp——trời giận người oán mới hô đánh hô giết, tai tiếng khắp nơi chỉ là đề phòng đi đường vòng, được kính trọng≠được vạn người ngưỡng mộ, đừng đem"có chút danh tiếng"diễn thành"xếp hàng chào đón"。
- Danh tiếng chỉ có hiệu lực khi đã truyền đến vòng tròn đó, "khu vực đó": nơi khác, mới đến chân ướt chân ráo, nơi thông báo chưa bao phủ tới, cho dù nơi khác danh tiếng lẫy lừng, người bản địa cũng coi như không có người này.

Hộp đen thông tin (tiêm hai loại, "ví dụ":[hành vi] đêm khuya diệt khẩu Trương Tam (nhân chứng:không);[tài sản] trạm gác ngầm phía nam thành (bại lộ:30%，hợp lệ)):
- Hộp đen là thứ chỉ có{{user}}（và nhân chứng được ghi rõ trong tiêm) mới biết được mặt tối. Thiết luật tối cao: những người không có trong danh sách biết chuyện NPC bắt buộc phải hoàn toàn không biết chuyện——không được ám chỉ, không được nghi ngờ, không được"giác quan thứ sáu"、không được nói bóng nói gió; người không biết chuyện thì cứ coi như chuyện đó căn bản chưa từng xảy ra.
- [hành vi]＝{{user}}Chuyện đã làm nhưng không phô trương, xem"nhân chứng"để định ai biết: đánh dấu"Không"thì trên đời không ai hay biết, không ai có thể dựa vào đó mà phản ứng; đánh dấu"Chỉ XX"thì chỉ có XX biết chuyện, những người còn lại vẫn bị giữ trong bóng tối như cũ.
- [tài sản]＝{{user}}Những lá bài nắm giữ trong tối (trạm gác ngầm, mật thư, thuốc độc, điểm yếu, vật tư cất giấu v.v.), nên dùng thì dùng, có thể gọi, có thể giở trò, có thể lật kèo——Đây là con bài tẩy của hắn, đừng để nó bám bụi.
- lộ diện% Là thanh gươm treo trên đầu: càng cao càng dễ bại lộ, khi cận kề mức cao hoặc trạng thái chuyển sang「Bại lộ」, có thể sắp xếp tra hỏi, có người sinh nghi, manh mối nổi lên để tạo sự căng thẳng; tài sản có trạng thái「Hết hạn／Hết hiệu lực」đã không còn tác dụng, đừng để nó phát huy tác dụng nữa.
    `.trim();

    return summary;
  }

  function getRuleCount() {
    return RULES.length;
  }

  return { loadRules, getAllRulesText, getCoreRulesSummary, getRuleCount };
})();
