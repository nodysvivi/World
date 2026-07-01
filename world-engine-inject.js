// world-engine-inject.js — Xây dựng tiêm ngữ cảnh (lọc điều kiện, chỉ tiêm ảnh hưởng RP thông tin then chốt)
window.WORLD_ENGINE_INJECT = (function() {
  const core = window.WORLD_ENGINE_CORE;
  const ledger = window.WORLD_ENGINE_LEDGER;

  // Phán từ danh tiếng: dịch cấp độ thành ngôn ngữ tự nhiên cho model văn bản chính đọc, tránh tiêm các nhãn cấp độ trần trụi
  const REP_DIM_NAME = { authority: 'Trên triều đình', common: 'Giữa thị tứ', shadow: 'Trong giang hồ', circuit: 'Giữa đồng đạo' };
  const REP_VERDICT = {
    authority: { // Trên triều đình —— Tuân thủ pháp luật/Phục tùng ↔ Khiêu khích/Nguy hiểm
      'trời giận người oán': 'Triều đình coi như cái gai trong mắt, đã bị truy nã hỏi tội, trên quan trường ai cũng đòi đánh',
      "tai tiếng khắp nơi": 'Trên quan trường danh tiếng cực xấu, bị coi là phần tử rắc rối và nguy hiểm, đi đâu cũng bị đề phòng',
      "vô danh": 'Triều đình không ai biết tên, không lọt vào mắt xanh của người nắm quyền',
      "được kính trọng": 'Trên quan trường khá có danh vọng, được coi là người có thể dùng và đáng tin cậy',
      "được vạn người ngưỡng mộ": 'Được người nắm quyền vô cùng trọng dụng, trên triều đình một lời nói nặng tựa chín đỉnh',
    },
    common: { // Giữa thị tứ —— Nhân thiện/Bảo vệ ↔ Bạo lệ/Đe doạ
      'trời giận người oán': 'Bách tính hận thấu xương, nhắc đến là chửi rủa, tránh như rắn rết',
      "tai tiếng khắp nơi": 'Thị tứ truyền miệng cực kém, bị coi là tai hoạ, hàng xóm thấy là đi đường vòng',
      "vô danh": 'Trên phố không mấy ai nghe qua hắn, chìm nghỉm giữa đám đông',
      "được kính trọng": 'Bách tính nhớ cái tốt của hắn, truyền miệng rất tốt, coi hắn là người trượng nghĩa',
      "được vạn người ngưỡng mộ": 'Vạn dân ủng hộ, đi đến đâu bách tính xếp hàng chào đón, được tôn như cha mẹ tái sinh',
    },
    shadow: { // Trong giang hồ —— Có gan/Dám gánh vác ↔ Không có gan/Bắt nạt kẻ yếu
      'trời giận người oán': 'Giang hồ ai cũng đòi đánh, chợ đen báo tên hắn là có người muốn ra tay',
      "tai tiếng khắp nơi": 'Giang hồ coi thường hắn, coi là kẻ hèn nhát bắt nạt kẻ yếu sợ kẻ mạnh, không ai muốn làm việc cùng',
      "vô danh": 'Trên giang hồ không ai nhận ra hắn, giang hồ tra không ra người này',
      "được kính trọng": 'Trên giang hồ có chút danh tiếng, người trong đạo kính hắn ba phần có gan',
      "được vạn người ngưỡng mộ": 'Giang hồ tôn làm hào kiệt, một câu nói có thể điều động nhân mã giang hồ một phương',
    },
    circuit: { // Giữa đồng đạo —— Kỹ nghệ/Giữ quy củ/Cống hiến ↔ Đập biển hiệu/Phản bội
      'trời giận người oán': 'Đồng hành coi là cặn bã trong nghề, bị đuổi khỏi giới, ai cũng đòi đánh',
      "tai tiếng khắp nơi": 'Đồng đạo khinh bỉ tay nghề và nhân phẩm, mang tiếng đập biển hiệu, bán đứng đồng hành',
      "vô danh": 'Trong nghề không ai biết nhân vật này',
      "được kính trọng": 'Đồng hành kính trọng kỹ nghệ và đức hạnh, là nhân vật có số má trong nghề',
      "được vạn người ngưỡng mộ": 'Được tôn làm một thế hệ tông sư, đồng đạo coi là tiêu chuẩn',
    },
  };
  // Tương thích bản lưu cũ: thời kỳ sáu cấp độ"có chút danh tiếng"đưa vào"được kính trọng"
  const REP_LEGACY = { "có chút danh tiếng": 'được kính trọng' };

  // Lời phán vận thế thế lực: dịch từ vận thế thành "thế lực này hiện tại đang ở hoàn cảnh nào, nội bộ có đoàn kết hay không"
  const STATUS_VERDICT = {
    "Cực thịnh": 'Tiền lương dồi dào, nhân thủ cực thịnh, nội bộ trên dưới một lòng, vững như khối sắt, hành sự mang theo sự tự tin và phô trương không thể nghi ngờ',
    "Vững chắc": 'Vận hành như thường, nền tảng vững vàng, không có nội ưu ngoại hoạn rõ ràng, tiến hành các công việc đã định theo từng bước',
    "Chèn ép lẫn nhau": 'Bề ngoài vẫn chống đỡ, nhưng bên trong phe phái chèn ép lẫn nhau, cốt lõi bất hòa, nhiều quyết sách bị đình trệ do nội đấu, tự cản trở lẫn nhau',
    "Khốn đốn": 'Tài nguyên cạn kiệt hoặc bị bên ngoài phong tỏa, đang cắn răng chống đỡ, khắp nơi thiếu hụt, không chịu nổi đả kích thêm nữa',
    "Suy tàn": 'Đã mất đi trụ cột then chốt, địa bàn hoặc nhân vật trọng yếu, lòng người dao động, liên tục thất bại, đang từng bước trượt tới bờ vực tan rã',
    "Tan rã": 'Tồn tại trên danh nghĩa, chỉ còn cái vỏ rỗng, khó ra hiệu lệnh, chúng bạn xa lánh, có thể giải tán hoàn toàn bất cứ lúc nào',
  };

  // Lời phán quan hệ thế lực: dịch từ quan hệ thành "thế lực này đối với{{user}}khuynh hướng hành vi của"
  const RELATION_VERDICT = {
    'Huyết minh': 'với{{user}}Sinh tử có nhau, tin tưởng tuyệt đối, sẽ giúp đỡ bằng mọi giá, xem an nguy của đối phương như sự tồn vong của chính mình',
    "Đồng minh": 'với{{user}}Địa vị bình đẳng, hỗ trợ lẫn nhau, chủ động chi viện và chia sẻ tình báo trên lợi ích chung, nhưng mỗi bên đều có giới hạn riêng',
    "Thân thiện": 'công nhận{{user}}，Sẵn sàng ưu tiên hợp tác, tạo điều kiện, thể hiện thiện ý, nhưng chưa đến mức kết minh giao tâm',
    "Trung lập": 'đối với{{user}}Không thân không sơ, mọi việc hành sự theo lợi hại của bản thân, không có lập trường định sẵn',
    "Lạnh nhạt": 'đã chú ý tới{{user}}nhưng thiếu hứng thú, giữ khoảng cách, không muốn giao du sâu, tạm thời không có ý định hành động chủ động',
    "Thù địch": 'với{{user}}Công khai đối lập, sẽ gây áp lực, cản trở, làm khó dễ ở ngoài sáng, thậm chí tìm cơ hội xung đột trực diện',
    "Thù truyền kiếp": 'với{{user}}Không chết không thôi, nhất quyết phải diệt trừ cho bằng được, sẽ không từ thủ đoạn, liên tục tìm sơ hở để ra tay tàn độc',
  };

  // Lời phán khí hậu kinh tế: dịch từng từ khí hậu thành mô tả thị trường cho model văn bản chính xem
  const CLIMATE_VERDICT = {
    "Phồn vinh": 'Thị trường phồn thịnh, thương lộ thông suốt, trăm nghề hưng vượng, tiền hàng lưu chuyển thuận lợi, vật giá ổn định ở mức hơi cao',
    "Ổn định": 'Thị trường như thường, vật giá lên xuống tự nhiên theo mùa, không có biến động lớn',
    "Suy thoái": 'Thị trường tiêu điều, nhu cầu thu hẹp, thương hiệu liên tiếp phá sản, một số ít nhu yếu phẩm lại khan hiếm tăng giá',
    "Biến động": 'Trật tự kinh tế sắp sụp đổ, vật giá mất kiểm soát, thương lộ bị cản trở, lòng người hoang mang, trao đổi hàng hóa',
  };

  function buildContext(worldState, tags) {
    const rulesLoader = window.WORLD_ENGINE_RULES;
    const rulesSummary = rulesLoader ? rulesLoader.getCoreRulesSummary() : '';

    // Chuỗi sự kiện:Lv3/4 Tiêm toàn bộ,Lv1/2 Chỉ đã bùng phát/Đã hoàn thành tiêm chung cuộc
    const visibleEvents = (worldState.events || []).filter(e => {
      if (e.level >= 3) return true;
      return e.stage === 'Đã bùng phát' || e.stage === 'Đã hoàn thành';
    });
    const eventsText = visibleEvents.map(e => {
      const typeName = e.type === 'progress' ? 'loại thúc đẩy' : 'loại xung đột';
      let txt = `${e.name}(${typeName}, Lv.${e.level}) ${e.stage} ${e.stageRound||1}/9`;
      if (e.evolveResult) txt += ` [${e.evolveResult}]`;
      return txt;
    }).join('；') || 'không';

    // Thế lực: tất cả 7 cấp quan hệ đều được tiêm, render thành câu tự nhiên, vận thế/quan hệ đều mang lời phán
    const formatPillars = (arr) => arr.length === 1
      ? arr[0]
      : arr.slice(0, -1).join('、') + 'với' + arr[arr.length - 1];
    const allFactions = worldState.factions || [];
    const factionsText = allFactions.length
      ? '\n' + allFactions.map(f => {
          const statusDesc = STATUS_VERDICT[f.status] || (f.status ? `đang ở trong 「${f.status}」」` : 'tình cảnh không rõ');
          const relation = f.relation || 'Trung lập';
          const relationDesc = RELATION_VERDICT[relation] || `đối với{{user}}có thái độ là 「${relation}」`;
          let s = `- ${f.name}trước mắt${statusDesc}；nó đối với{{user}}có thái độ là${relation}——${relationDesc}。`;
          if (f.scope) s += `phạm vi thế lực của nó bao phủ${f.scope}。`;
          if (f.currentGoal) s += `hiện đang dốc sức vào${f.currentGoal}。`;
          const tail = [];
          if (f.core_person) tail.push(`nhân vật trọng yếu là${f.core_person}`);
          if (f.powerPillars?.length) tail.push(`nền tảng vận hành dựa vào là${formatPillars(f.powerPillars)}`);
          if (tail.length) s += tail.join('，') + '。';
          return s;
        }).join('\n')
      : 'không';

    // có tiếng đồn: chỉ tiêm Lv3/4
    const windTypeNames = { announcement: 'thông báo', report: 'thông báo/tin nhắn', rumor: 'tin đồn', sentiment: 'dư luận' };
    const visibleWinds = (worldState.winds || []).filter(w => (w.level || 0) >= 3);
    const windsText = visibleWinds.map(w =>
      `[${windTypeNames[w.type] || 'có tiếng đồn'} Lv.${w.level || 1} ${w.scope || '?'}] ${w.content}`
    ).join('；') || 'không';

    // đại thế thiên hạ
    const trendsText = (worldState.worldTrends || []).filter(t => t.status !== 'Đã kết thúc').map(t =>
      `${t.name}（${t.scope || 'thiên hạ'}）：${t.description}`
    ).join('；') || 'không';

    // danh tiếng: tiêm lời phán tự nhiên, chứ không phải nhãn cấp độ trần trụi
    const rep = worldState.reputation || {};
    const repText = ['authority', 'common', 'shadow', 'circuit'].map(k => {
      const lv = REP_LEGACY[rep[k]] || rep[k];
      const verdict = REP_VERDICT[k] && REP_VERDICT[k][lv];
      if (!verdict) return '';
      return `tại${REP_DIM_NAME[k]}${lv}，${verdict}`;
    }).filter(Boolean).join('。') + '。';
    const repChange = rep.lastChange ? `（${rep.lastChange}）` : '';

    // tín hiệu kinh tế: tiêm toàn bộ
    const econ = worldState.economy || {};
    const signalsText = (econ.signals || []).map(s => `${s.summary}（${s.scope}）`).join('；');
    const climate = econ.climate || 'Ổn định';
    const climateText = `thị trường${climate}，${CLIMATE_VERDICT[climate] || CLIMATE_VERDICT['Ổn định']}`;
    const econText = `${climateText}${signalsText ? '。tín hiệu:' + signalsText : ''}`;

    // sổ kẻ thù
    let enemiesText = 'không';
    if (worldState.enemies && worldState.enemies.length) {
      enemiesText = worldState.enemies.map(e =>
        `${e.name}（${e.type==='blood'?'huyết cừu':'ân oán'}，${e.status}，lý do:${e.reason}）`
      ).join('；');
    }

    // sự kiện đột phát khu vực
    const ri = worldState.regionalIncident || {};
    let riText = '';
    if (ri.active) {
      riText = `⚠️ ${ri.title || 'sự kiện đột phát khu vực'}（${ri.type || '?'}，${ri.scope || '?'}）— ${ri.impact || ''}`;
    } else {
      riText = ri.title && ri.title.includes('thử lại') ? `⚠️ ${ri.title}` : 'vòng này không có sự kiện đột phát khu vực';
    }

    // hộp đen thông tin: hiển thị nội dung cụ thể
    const blackbox = worldState.blackbox || {};
    const boxParts = [];
    if (blackbox.secretActions?.length) {
      const actionsText = blackbox.secretActions.map(a =>
        `[hành vi] ${a.action || '?'}（chứng kiến:${a.witnesses || 'không'}）`
      ).join('；');
      boxParts.push(`hành vi bí mật(${blackbox.secretActions.length}): ${actionsText}`);
    }
    if (blackbox.secretAssets?.length) {
      const assetsText = blackbox.secretAssets.map(a =>
        `[tài sản] ${a.name || '?'}（bị lộ:${a.exposure || 0}%，${a.status || 'hợp lệ'}）`
      ).join('；');
      boxParts.push(`tài sản bí mật(${blackbox.secretAssets.length}): ${assetsText}`);
    }
    const blackboxText = boxParts.length ? boxParts.join(' | ') : 'không có thông tin mặt tối';

    const context = `
【trạng thái thế giới】
vòng:${worldState.round}
tóm tắt:${worldState.worldDigest}
Đại thế thiên hạ:${trendsText}
Chuỗi sự kiện:${eventsText}
Thế lực:${factionsText}
Có tiếng đồn:${windsText}
Kẻ thù:${enemiesText}
Danh tiếng:${repText}${repChange}
Kinh tế:${econText}
Sự kiện khu vực:${riText}
Hộp đen:${blackboxText}

${rulesSummary}
    `.trim();

    return context.substring(0, 5000);
  }

  return { buildContext };
})();
