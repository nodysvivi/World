// world-engine-evolution.js — suy diễn thế giới API gọi (sử dụng quy tắc engine sống hoàn chỉnh)
window.WORLD_ENGINE_EVOLUTION = (function() {
  const core = window.WORLD_ENGINE_CORE;
  const api = window.WORLD_ENGINE_API;

  const EVENT_TYPES = ['conflict', 'progress'];
  const EVENT_STAGE_ORDER = {
    conflict: ['manh nha', 'ủ biến', 'cận kề'],
    progress: ['chuẩn bị', 'thực thi', 'then chốt/quan trọng']
  };
  const EVENT_FINAL_STAGE = {
    conflict: 'đã bùng phát',
    progress: 'đã hoàn thành'
  };
  const EVENT_TERMINAL_STAGES = {
    conflict: ['đã bùng phát', 'đã tan biến'],
    progress: ['đã hoàn thành', 'đã thất bại']
  };
  const EVENT_STAGE_BASE = {
    conflict: { 'manh nha': 95, 'ủ biến': 85, 'cận kề': 75 },
    progress: { 'chuẩn bị': 75, 'thực thi': 85, 'then chốt/quan trọng': 95 }
  };
  const WIND_DECAY = {
    announcement: { base: 10, grace: 4, linear: 3, quadratic: 1 },
    report: { base: 20, grace: 2, linear: 4, quadratic: 2 },
    rumor: { base: 25, grace: 1, linear: 5, quadratic: 3 },
    sentiment: { base: 8, grace: 5, linear: 2, quadratic: 1 }
  };

  let _lastPrompt = '';
  let _lastRawResult = '';
  // [MAP] suy diễn prompt Phân đoạn (dùng để hiển thị hoàn toàn minh bạch, chỉ đọc). Với thực tế phát ra prompt nhất quán cấp độ byte:
  // Các đoạn trước tiên được trích xuất thành biến có tên, template literal và segments mảng tham chiếu cùng một biến, tránh việc tính toán lại/sao chép trôi dạt.
  let _lastPromptSegments = [];

  function getLastDebug() {
    return { prompt: _lastPrompt, rawResult: _lastRawResult, segments: _lastPromptSegments };
  }

  // ========== Hệ thống xúc xắc sự kiện đột phát khu vực ==========

  const REGIONAL_INCIDENT_CONFIG = {
    chance: 0.03,
    durationRounds: 5,
    cooldownRounds: 5,
    typeWeights: [
      { type: 'banditry', label: 'cướp bóc', weight: 18 },
      { type: 'fire', label: 'hoả hoạn', weight: 14 },
      { type: 'massacre', label: 'án mạng nghiêm trọng', weight: 10 },
      { type: 'flood', label: 'lũ lụt', weight: 10 },
      { type: 'infrastructure', label: 'đường sá thuỷ lợi sụp đổ', weight: 10 },
      { type: 'plague', label: 'dịch bệnh', weight: 9 },
      { type: 'famine', label: 'nạn đói thiếu lương', weight: 8 },
      { type: 'riot', label: 'bạo loạn', weight: 8 },
      { type: 'rebellion', label: 'dân biến nổi loạn', weight: 5 },
      { type: 'military', label: 'Quân vụ đột biến', weight: 4 },
      { type: 'earthquake', label: 'Động đất lở núi', weight: 2 },
      { type: 'storm', label: 'Bão tuyết', weight: 2 }
    ]
  };

  const INCIDENT_TYPE_GUIDE = {
    banditry: 'cướp bóc: Sơn tặc, thuỷ phỉ, lưu khấu, băng cướp, cướp tiêu, chặn tàu, cướp lương, cướp muối, tàn sát cướp bóc thôn bản hoặc thương đội.',
    fire: 'hoả hoạn: Phường thị, kho lương, bến tàu, tự viện, quan thự, công xưởng, đội tàu, kho hàng xảy ra hoả hoạn khu vực.',
    massacre: 'án mạng nghiêm trọng: Giết người hàng loạt, diệt môn, huyết án khách sạn, thương đội bị đồ sát, án mạng bến tàu v.v. đủ để gây hoảng loạn.',
    flood: 'lũ lụt: Nước sông dâng cao, vỡ đê, bến tàu bị ngập, ruộng làng bị huỷ, cầu cống bị cuốn trôi.',
    infrastructure: 'đường sá thuỷ lợi sụp đổ: Quan đạo sạt lở, cầu cống sụp đổ, bến đò đình trệ, đê nứt, cống nước hư hỏng, đường trạm đứt đoạn.',
    plague: 'dịch bệnh: Dịch người, dịch súc vật, nguồn nước nhiễm bệnh, thôn lạc phong toả, bến tàu từ chối chở, bệnh nhân sốt cao trong thành tăng vọt.',
    famine: 'nạn đói thiếu lương: Kho lương cạn kiệt, lương cứu tế đứt đoạn, giá lương thực tăng vọt, nạn dân cướp lương, đại hộ đóng kho, thôn quê đứt bữa.',
    riot: 'bạo loạn: Bến tàu ẩu đả, dân đói cướp lương, khách hành hương giẫm đạp, tiệm muối bị đập, xung đột trạm gác, xung đột thị tứ mở rộng.',
    rebellion: 'dân biến nổi loạn: Lưu dân lập trại, hương binh chống quan, bạo động thuế dịch, tà giáo tụ tập, phản loạn địa phương.',
    military: 'Quân vụ đột biến: Thủ quân binh biến, quân lương bị cướp, biên quân bỏ chạy, địch quân vượt biên, quan ải giới nghiêm, quân doanh kinh hãi trong đêm.',
    earthquake: 'Động đất lở núi: Động đất, lở núi, sập hầm mỏ, nứt đất, sơn thôn bị vùi lấp.',
    storm: 'Bão tuyết: Bão, bão tuyết, bão cát, không khí lạnh, gió biển huỷ thuyền, gió lớn phá huỷ lều lán.'
  };

  function ensureRegionalIncident(state) {
    if (!state.regionalIncident) {
      state.regionalIncident = {
        active: false,
        title: '',
        type: '',
        scope: '',
        impact: '',
        duration: 0,
        cooldown: 0,
        _retry: false,
        _retryType: ''
      };
    }
  }

  function getIncidentTypeLabel(type) {
    const found = REGIONAL_INCIDENT_CONFIG.typeWeights.find(t => t.type === type);
    return found ? found.label : type;
  }

  function buildRegionalIncidentOngoingPrompt(incident) {
    return `
【Sự kiện đột phát khu vực đang tiếp diễn (còn lại ${incident.duration} vòng)】
Tiêu đề:${incident.title}
Loại:${getIncidentTypeLabel(incident.type)}
Phạm vi:${incident.scope}
Ảnh hưởng hiện tại:${incident.impact}
Sự kiện này vẫn đang trong thời kỳ hoạt động. Vui lòng tiếp tục dư âm của nó (kinh tế, có tiếng đồn, hành động thế lực v.v.) trong suy diễn vòng này, không được viết thành đã bình yên, cũng không được ở regionalIncident Trường tạo sự kiện mới.
`;
  }

  function weightedPick(items, randomFn = Math.random) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = randomFn() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  function buildRegionalIncidentPrompt(picked) {
    const guide = INCIDENT_TYPE_GUIDE[picked.type] || '';
    return `
【Lệnh bắt buộc của xúc xắc cục bộ: Vòng này bắt buộc phải tạo sự kiện đột phát khu vực】
Xúc xắc cục bộ đã phán định: Vòng này kích hoạt sự kiện đột phát khu vực.
Xúc xắc cục bộ đã chỉ định loại sự kiện:
Loại:${picked.label}
type：${picked.type}
Mô tả loại:${guide}
Bạn phải dựa theo trạng thái thế giới hiện tại, tạo một sự kiện đột phát cấp khu vực phù hợp với loại này.
Sự kiện bắt buộc phải đáp ứng:
1. Sự kiện ảnh hưởng đến một khu vực, đường sá, thị trấn, quan ải, bến tàu, chùa chiền, chợ, thôn xóm, thương lộ hoặc thuỷ lộ rõ ràng.
2. Sự kiện không phải là chuyện vặt, không phải tiếng ồn của người qua đường, không phải sự cố ngẫu nhiên của một cá nhân.
3. Sự kiện bắt buộc phải tạo ra tiếng đồn có thể lan truyền.
4. Sự kiện bắt buộc phải gây ra ít nhất một loại ảnh hưởng lan toả: thay đổi kinh tế, hành động của thế lực, thay đổi trị an, thay đổi chuỗi sự kiện, thay đổi danh tiếng, thay đổi hộp đen hoặc chuỗi ảnh hưởng mới.
5. Sự kiện và{{user}}hành vi hiện tại không có nhân quả trực tiếp, không được viết thành kết quả âm mưu của kẻ thù đã có, thế lực đã có, chuỗi sự kiện đã có.
6. Địa điểm xảy ra sự kiện do bạn chọn dựa theo trạng thái thế giới hiện tại, nhưng bắt buộc phải hợp lý, không được vô cớ huỷ diệt bối cảnh cốt lõi, không được vô cớ phá huỷ{{user}}tài sản cốt lõi.
7. Nếu sự kiện không xảy ra ở{{user}}khu vực hiện tại, không được cưỡng ép cắt ngang{{user}}hành động hiện tại, chỉ làm thay đổi thế giới dưới nền, tin tức phương xa hoặc lan truyền tiếng đồn.
8. Nếu sự kiện xảy ra ở{{user}}khu vực hiện tại, có thể hình thành áp lực bối cảnh hiện tại, nhưng vẫn không được thay{{user}}đưa ra lựa chọn.
9. Cấm tạo các sự kiện giá trị thấp như xe ngựa hoảng sợ, ngoại tình bị bắt, người qua đường cãi nhau, kẻ trộm ăn cắp, kẻ say làm loạn, tranh chấp hàng xóm thông thường v.v.
10. Cấm đem"sự kiện đột phát khu vực"viết thành âm mưu đã được lên kế hoạch từ lâu của một thế lực đã có; trừ khi trong trạng thái đã có tồn tại bằng chứng nhân quả rõ ràng.
bạn phải trả về dưới đây JSON trường:
{
  "regionalIncident": {
    "active": true,
    "title": "tiêu đề sự kiện",
    "type": "${picked.type}",
    "scope": "phạm vi ảnh hưởng",
    "impact": "tóm tắt hậu quả khu vực trong một câu"
  },
  "winds": [
    {
      "topic": "tên chủ đề ổn định",
      "type": "report",
      "level": 1-4,
      "content": "lời đồn đang lan truyền",
      "scope": "phạm vi lan truyền",
      "source": "chuỗi nguồn tin"
    }
  ],
  "influenceChain": [
    {
      "trigger": "tiêu đề sự kiện đột phát khu vực",
      "impact": "ảnh hưởng trực tiếp đã gây ra",
      "fallout": "dư âm tiếp theo"
    }
  ]
}
nếu sự kiện đã đủ để hình thành xung đột kéo dài hoặc nhiệm vụ cai trị, có thể trả về thêm events。
nếu sự kiện ảnh hưởng đến thị trường, đường bộ, đường thuỷ, giá lương thực, giá muối, vận chuyển hàng hoá, có thể trả về thêm economy。
nếu sự kiện ảnh hưởng đến phán đoán hoặc tài nguyên của một thế lực nào đó, có thể trả về thêm factions。
nếu sự kiện ảnh hưởng{{user}}danh tiếng, có thể trả về thêm reputation。
nếu sự kiện có nhân chứng bí mật, bằng chứng ẩn, nhân vật mất tích, sự thật chưa công bố, có thể trả về thêm blackbox。
`;
  }

  function rollRegionalIncident(state, randomFn = Math.random) {
    ensureRegionalIncident(state);
    const incident = state.regionalIncident;

    // sự kiện đang tiếp diễn: đếm ngược mỗi vòng, sau khi về không sẽ tan biến và bước vào thời gian hồi
    if (incident.active) {
      const remaining = Math.max(0, (incident.duration || 0) - 1);
      incident.duration = remaining;
      if (remaining <= 0) {
        const title = incident.title;
        incident.active = false;
        incident.title = '';
        incident.type = '';
        incident.scope = '';
        incident.impact = '';
        incident.duration = 0;
        incident.cooldown = REGIONAL_INCIDENT_CONFIG.cooldownRounds;
        incident._retry = false;
        incident._retryType = '';
        console.log('[World Engine] sự kiện đột phát khu vực đã tan biến (hết thời gian tiếp diễn):', title);
        return { triggered: false, injectPrompt: '', reason: 'expired' };
      }
      // vẫn đang tiếp diễn, tiêm"đang tiếp diễn"nhắc nhở
      return {
        triggered: true,
        ongoing: true,
        injectPrompt: buildRegionalIncidentOngoingPrompt(incident),
        reason: 'ongoing'
      };
    }

    // đang hồi
    if ((incident.cooldown || 0) > 0) {
      incident.cooldown = Math.max(0, incident.cooldown - 1);
      return { triggered: false, injectPrompt: '', reason: 'cooldown' };
    }

    const dice = randomFn();
    const chance = REGIONAL_INCIDENT_CONFIG.chance;

    // Xác định xem có cần kích hoạt không
    let triggerNow = false;
    let triggerType = incident._retryType || '';
    let triggerLabel = '';

    if (incident._retry && triggerType) {
      // Xúc xắc vòng trước thành công nhưng API chưa trả về → thử lại, loại không đổi
      triggerNow = true;
      incident._retry = false;
      incident._retryType = '';
      const found = REGIONAL_INCIDENT_CONFIG.typeWeights.find(t => t.type === triggerType);
      if (found) triggerLabel = found.label;
    }

    if (!triggerNow && dice >= chance) {
      // chưa kích hoạt
      incident.active = false;
      incident.title = '';
      incident.type = '';
      incident.scope = '';
      incident.impact = '';
      return { triggered: false, injectPrompt: '', chance, dice, reason: 'miss' };
    }

    // kích hoạt (vòng đầu)
    let picked;
    if (!triggerNow) {
      picked = weightedPick(REGIONAL_INCIDENT_CONFIG.typeWeights, randomFn);
      triggerType = picked.type;
      triggerLabel = picked.label;
    }

    incident.active = true;
    incident.type = triggerType;
    incident.duration = REGIONAL_INCIDENT_CONFIG.durationRounds; // số vòng kéo dài, thời gian hồi chiêu chỉ bắt đầu sau khi tan biến
    incident.cooldown = 0;

    return {
      triggered: true,
      ongoing: false,
      incidentType: triggerType,
      incidentLabel: triggerLabel,
      injectPrompt: buildRegionalIncidentPrompt({ type: triggerType, label: triggerLabel || triggerType }),
      chance,
      dice,
      reason: triggerNow ? 'retry' : 'hit'
    };
  }

  function mergeRegionalIncident(state, update) {
    ensureRegionalIncident(state);
    const incident = state.regionalIncident;

    // vòng này không có xúc xắc cục bộ kích hoạt, không chấp nhận API tự phát sinh
    if (!incident.active) {
      incident.title = '';
      incident.type = '';
      incident.scope = '';
      incident.impact = '';
      incident._retry = false;
      incident._retryType = '';
      return;
    }

    // sự kiện đang tiếp diễn (đã có tiêu đề): nội dung cố định, không chấp nhận API ghi đè
    if (incident.title) {
      if (update.regionalIncident) delete update.regionalIncident;
      return;
    }

    // kích hoạt mới vòng đầu (chưa có tiêu đề): gộp API nội dung sự kiện trả về
    const duration = incident.duration || REGIONAL_INCIDENT_CONFIG.durationRounds;
    if (update.regionalIncident && update.regionalIncident.active) {
      state.regionalIncident = {
        active: true,
        title: update.regionalIncident.title || 'sự kiện đột phát khu vực chưa đặt tên',
        type: update.regionalIncident.type || incident.type || 'other',
        scope: update.regionalIncident.scope || 'khu vực chưa biết',
        impact: update.regionalIncident.impact || 'trật tự khu vực bị tác động.',
        duration,
        cooldown: 0,
        _retry: false,
        _retryType: ''
      };
    } else {
      // API không trả về → đặt cờ thử lại, vòng sau tiếp tục
      state.regionalIncident = {
        active: false,
        title: 'tạo sự kiện đột phát khu vực thất bại (sẽ thử lại ở vòng sau)',
        type: incident.type || 'other',
        scope: 'khu vực chưa biết',
        impact: 'xúc xắc cục bộ kích hoạt sự kiện đột phát khu vực, nhưng API chưa trả về regionalIncident。vòng sau sẽ thử lại cùng loại.',
        duration: 0,
        cooldown: 0,
        _retry: true,
        _retryType: incident.type || ''
      };
    }
  }

  // ========== xúc xắc chuỗi sự kiện thúc đẩy (hệ thống hai loại bốn giai đoạn)==========
  // mỗi giai đoạn 9 ô, đầy 9 thăng cấp lên giai đoạn tiếp theo.
  // conflict: manh nha→ủ biến→cận kề→đã bùng phát;API có thể phán định đã tan biến;level càng cao càng dễ thúc đẩy.
  // progress: chuẩn bị→thực thi→then chốt/quan trọng→đã hoàn thành;API có thể phán định đã thất bại;level càng cao càng khó thúc đẩy.
  // đình trệ hoàn toàn giao cho API kiểm soát, xúc xắc cục bộ không còn bỏ qua vòng
  function forceTriggerEvents(state) {
    const events = state.events || [];
    let anyTriggered = false;

    for (const ev of events) {
      // xoá kết quả vòng trước
      delete ev.evolveResult;

      // khởi tạo trường
      if (!ev.type || !EVENT_TYPES.includes(ev.type)) ev.type = 'conflict';
      if (ev.stageRound === undefined) ev.stageRound = 1;
      if (ev.consecutiveFails === undefined) ev.consecutiveFails = 0;
      const stageOrder = EVENT_STAGE_ORDER[ev.type] || EVENT_STAGE_ORDER.conflict;
      const terminalStages = EVENT_TERMINAL_STAGES[ev.type] || EVENT_TERMINAL_STAGES.conflict;

      // bỏ qua sự kiện kết cục
      if (terminalStages.includes(ev.stage)) continue;
      if (!ev.stage || !stageOrder.includes(ev.stage)) ev.stage = stageOrder[0];

      // bảo hiểm: liên tục không thành công đạt giới hạn thì bắt buộc thành công
      const maxFails = getMaxFails(ev);
      if (ev.consecutiveFails >= maxFails) {
        advanceStageRound(ev);
        ev.consecutiveFails = 0;
        ev.evolveResult = 'thành công';
        anyTriggered = true;
        if (ev.stage === EVENT_FINAL_STAGE.conflict) logEruption(state, ev);
        continue;
      }

      // đổ xúc xắc bình thường
      const r = Math.min(1, (ev.stageRound || 1) / 9);
      const stageBase = (EVENT_STAGE_BASE[ev.type] || EVENT_STAGE_BASE.conflict)[ev.stage] || 85;
      const level = ev.level || 1;
      const levelAdjust = ev.type === 'progress' ? (level - 1) * 10 : -((level - 1) * 10);
      const threshold = Math.round(stageBase - 200 * r * (1 - r) + levelAdjust);
      const dice = Math.floor(Math.random() * 100) + 1;

      if (dice > threshold) {
        // thành công: thúc đẩy
        advanceStageRound(ev);
        ev.consecutiveFails = 0;
        ev.evolveResult = 'thành công';
        anyTriggered = true;
        if (ev.stage === EVENT_FINAL_STAGE.conflict) logEruption(state, ev);
      } else if (dice < threshold * 0.4) {
        // chùn bước: thụt lùi
        ev.stageRound = Math.max(1, ev.stageRound - 1);
        ev.consecutiveFails++;
        ev.evolveResult = 'chùn bước';
      } else {
        // giữ nguyên: không đổi
        ev.consecutiveFails++;
        ev.evolveResult = 'giữ nguyên';
      }
    }

    if (anyTriggered) return anyTriggered;
  }

  function getMaxFails(ev) {
    const level = ev.level || 1;
    return ev.type === 'progress' ? 2 + level : 6 - level;
  }

  function advanceStageRound(ev) {
    const stageOrder = EVENT_STAGE_ORDER[ev.type] || EVENT_STAGE_ORDER.conflict;
    const finalStage = EVENT_FINAL_STAGE[ev.type] || EVENT_FINAL_STAGE.conflict;
    ev.stageRound++;
    if (ev.stageRound >= 9) {
      // thăng cấp lên giai đoạn tiếp theo
      const idx = stageOrder.indexOf(ev.stage);
      if (idx !== -1 && idx < stageOrder.length - 1) {
        ev.stage = stageOrder[idx + 1];
        ev.stageRound = 1;
      } else {
        ev.stage = finalStage;
        ev.stageRound = 9;
      }
    }
  }

  function logEruption(state, ev) {
    console.log(`[World Engine] sự kiện bùng phát: ${ev.name}`);
  }

  // ========== xúc xắc tiếng đồn tan biến ==========
  // API vòng này trả về cùng topic khi có tiếng đồn,core.addWind sẽ quietRounds đặt lại thành 0。
  // có tiếng đồn chưa được cập nhật ở vòng sau API tích luỹ sự im lặng trước khi gọi, và có thể trực tiếp tan biến.
  function decayWinds(state, randomFn = Math.random) {
    const survivors = [];
    const decayed = [];

    for (const wind of state.winds || []) {
      const params = WIND_DECAY[wind.type] || WIND_DECAY.rumor;
      const level = Math.min(4, Math.max(1, parseInt(wind.level) || 1));
      wind.quietRounds = Math.max(0, parseInt(wind.quietRounds) || 0) + 1;

      if (wind.quietRounds <= params.grace) {
        survivors.push(wind);
        continue;
      }

      const n = wind.quietRounds - params.grace - 1;
      const chance = Math.min(95, Math.max(5,
        params.base + params.linear * n + params.quadratic * n * n - (level - 1) * 10
      ));
      const dice = Math.floor(randomFn() * 100) + 1;

      if (dice <= chance) decayed.push(wind);
      else survivors.push(wind);
    }

    state.winds = survivors;
    if (decayed.length) {
      console.log(`[World Engine] 🌫️ có tiếng đồn tan biến: ${decayed.map(w => w.topic).join('、')}`);
    }
    return decayed;
  }

  const OUTPUT_INSTRUCTIONS = `
## JSON giải thích trường xuất

bạn phải xuất một JSON đối tượng. Chỉ xuất các trường có thay đổi thực chất trong vòng này; cấm tạo nội dung vô nghĩa để cho đủ số lượng.

### events（mảng chuỗi sự kiện)
mỗi mục bao gồm:
- name: tên sự kiện (nếu trùng tên sự kiện đã có thì ghi đè cập nhật, tên mới thì thêm mới)
- type: "conflict"/"progress"。conflict=chuỗi sự kiện loại xung đột,progress=chuỗi sự kiện loại thúc đẩy. Sự kiện mới bắt buộc phải điền; của sự kiện đã có type một khi đã xác định thì cấm thay đổi, khi cập nhật sự kiện cùng tên phải tiếp tục sử dụng hiện tại type。
- level: 1-4。conflict biểu thị mức độ xung đột/thế năng mất kiểm soát,Lv càng cao càng dễ thăng cấp;progress biểu thị quy mô sự việc/độ khó hoàn thành,Lv càng cao càng khó hoàn thành.
- stage: theo type sử dụng các giai đoạn khác nhau:
  - conflict chỉ có thể sử dụng "manh nha"/"ủ biến"/"cận kề"/"đã bùng phát"/"đã tan biến"。
    - manh nha: xung đột vừa xuất hiện dấu hiệu, chỉ có số ít người nhận ra, chưa hình thành áp lực công khai.
    - ủ biến: mâu thuẫn bắt đầu lan rộng, tổ chức, nhân lực, tin đồn hoặc động cơ trả thù đang tụ tập.
    - cận kề: xung đột sắp dẫn đến hành động cụ thể hoặc ảnh hưởng trực tiếp, đã đến gần điểm bùng phát.
    - đã bùng phát: kết quả xung đột đã định, truy sát, truy nã, ẩu đả, phong toả, thanh trừng v.v. đã xảy ra.
    - đã tan biến: xung đột mất đi động cơ, người thực thi, tài nguyên, mục tiêu hoặc thời hiệu, đã xác định sẽ không tiếp tục bùng phát.
    - thứ tự thúc đẩy bình thường cố định là: manh nha → ủ biến → cận kề → đã bùng phát; đã tan biến không phải là giai đoạn thúc đẩy bình thường, chỉ có thể do API phán đoán trực tiếp dựa trên nhân quả rõ ràng.
  - progress chỉ có thể sử dụng "chuẩn bị"/"thực thi"/"then chốt/quan trọng"/"đã hoàn thành"/"đã thất bại"。
    - chuẩn bị: tài nguyên, nhân lực, vật liệu, tình báo, tuyến đường hoặc kế hoạch đang được chuẩn bị, chưa triển khai toàn diện.
    - thực thi: sự việc đã thực sự bắt đầu, có sự đầu tư liên tục, dấu vết hành động và tiêu hao theo giai đoạn.
    - then chốt: gần đến kết quả, dễ bị can thiệp, nẫng tay trên, đảo ngược, trì hoãn hoặc phải trả giá nhất.
    - đã hoàn thành: thành quả đã định và tiến vào trạng thái thế giới, có thể tạo ra sự kiện tiếp theo, có tiếng đồn, thay đổi kinh tế hoặc thế lực.
    - đã thất bại: sự việc do người thực thi rút lui, cạn kiệt tài nguyên, mất vĩnh viễn điều kiện then chốt, bị phản chế hợp lệ hoặc hết thời hiệu mà xác định không thể hoàn thành.
    - thứ tự thúc đẩy bình thường cố định là: chuẩn bị → thực thi → then chốt/quan trọng → đã hoàn thành; đã thất bại không phải là giai đoạn thúc đẩy bình thường, chỉ có thể do API phán đoán trực tiếp dựa trên nhân quả rõ ràng.
- stageRound: tiến độ trong giai đoạn hiện tại 1-8。giai đoạn không phải kết cục viết 9 sẽ được cục bộ tự động thăng cấp; tất cả các giai đoạn kết cục sẽ được cục bộ khoá thành 9/9。
- desc: mô tả sự kiện
- stall: true/false（true biểu thị sự kiện tạm thời đình trệ/bị cản trở, nhưng tương lai vẫn có thể khôi phục; chỉ dùng làm đánh dấu, không thay đổi type hoặc stage；lý do đình trệ và điều kiện khôi phục ghi vào desc）

### đình trệ chuỗi sự kiện và phán đoán kết cục
- đình trệ không phải là kết cục. Chỉ cần vẫn tồn tại điều kiện khôi phục hợp lý, thì cài đặt stall=true，và giữ nguyên hiện tại stage。
- conflict chỉ khi xung đột đã xác định mất đi khả năng tiếp tục bùng phát, mới có thể trực tiếp đem stage đánh dấu thành "đã tan biến"。
- progress Chỉ khi sự việc đã được xác định là không thể tiếp tục hoặc không thể đạt được mục tiêu, mới có thể trực tiếp đem stage đánh dấu thành "đã thất bại"。
- đánh dấu "đã tan biến"/"đã thất bại" khi,desc phải ghi rõ lý do cụ thể dẫn đến kết cục; không được phán định kết cục chỉ vì liên tục nhiều vòng không có tiến triển.
- "đã bùng phát"/"đã tan biến"/"đã hoàn thành"/"đã thất bại" đều là kết cục, sau khi tiến vào không được khôi phục thành giai đoạn phi kết cục. Nếu cần khởi động lại, nên tạo chuỗi sự kiện mới.

### factions（mảng thế lực)
mỗi mục bao gồm:
- name: Tên thế lực (cùng tên thì ghi đè, tên mới thì thêm mới)
- scope: Phạm vi địa lý mà thế lực trực tiếp kiểm soát hoặc có sức ảnh hưởng lớn
- status: Vận thế tổng thể——"cực thịnh"/"vững chắc"/"chèn ép lẫn nhau"/"khốn đốn"/"suy tàn"/"tan rã"。
  cực thịnh=Có tiền có người có thế, vững như bàn thạch; vững chắc=Hoạt động bình thường không có nguy cơ lớn; chèn ép lẫn nhau=Đấu tranh phe phái nội bộ, bộ khung vẫn chưa tan; khốn đốn=Tài nguyên cạn kiệt hoặc bị phong tỏa, cắn răng chống đỡ; suy tàn=Mất đi trụ cột/Địa bàn/nhân vật trọng yếu, trượt hướng tan rã; tan rã=Chỉ còn trên danh nghĩa, chỉ chờ xác nhận kết cục.
- relation: Thế lực này đối với{{user}}thái độ, bảy cấp (lấy"trung lập"làm chính giữa, chỉ có thể lấy bảy giá trị này)——"huyết minh"/"đồng minh"/"thân thiện"/"trung lập"/"lạnh nhạt"/"thù địch"/"thù truyền kiếp"。
  huyết minh=Tuyệt đối tin tưởng, sinh tử có nhau; đồng minh=Địa vị bình đẳng, hỗ trợ lẫn nhau; thân thiện=Đồng tình{{user}}，Ưu tiên hợp tác; trung lập=Không quan tâm không bài xích; lạnh nhạt=Đã chú ý tới nhưng không định hành động; thù địch=Công khai đối kháng; thù truyền kiếp=Không chết không thôi.
- currentGoal: Văn bản mục tiêu hiện tại
- core_person: Tên nhân vật trọng yếu
- powerPillars: Trụ cột quyền lực mà thế lực này hiện có, tối đa 3 cái, mỗi cái là 1-4 chuỗi tên chữ (ví dụ"Răn đe vũ lực"/"Mối quan hệ quan trường"/"Hỗ trợ tài chính"）。Chỉ những trụ cột vững chắc và có sức mạnh thực tế mới được liệt kê; những trụ cột đã sụp đổ hoặc mất hiệu lực không được giữ lại. Trường này chỉ biểu thị trụ cột hiện tại, không bao gồm lịch sử.API bắt buộc trong desc hoặc influenceChain giải thích sự thay đổi trụ cột.

### worldTrends（mảng đại thế thiên hạ)
Đại thế thiên hạ là cục diện dài hạn đã thay đổi cách vận hành của quốc gia, quốc tế hoặc toàn thế giới, không phải là có tiếng đồn thông thường, cũng không phải là chuỗi sự kiện chờ bùng phát.
mỗi mục bao gồm:
- name: Tên đại thế (trùng tên ghi đè cập nhật, tên mới thêm mới)
- scope: Phạm vi ảnh hưởng thực tế
- status: "đang tiếp diễn"/"đã kết thúc"
- description: Cục diện hiện tại và cách nó đang ràng buộc hành động của thế giới
- source: Nguồn gốc rõ ràng hình thành đại thế này

Quy tắc phán định:
- Kiểm tra mỗi vòng Lv4 Sự kiện loại xung đột bước vào đã bùng phát,Lv4 Sự kiện loại thúc đẩy bước vào đã hoàn thành,Lv4 sự thật đằng sau có tiếng đồn được xác nhận rộng rãi và các nguồn ứng viên khác.
- Chỉ khi cục diện mang tính dài hạn, diện rộng, liên hệ thống và buộc nhiều thế lực liên tục điều chỉnh hành động, mới tạo ra đại thế thiên hạ. Lễ hội toàn quốc, thông báo đơn lẻ, chấn động ngắn hạn không được tính.
- Đại thế thiên hạ không tham gia xúc xắc, không tự động tan biến. Đại thế đang tiếp diễn mỗi vòng đều bắt buộc làm ràng buộc bối cảnh cho suy diễn chuỗi sự kiện, thế lực, kinh tế và có tiếng đồn.
- Chỉ khi xuất hiện sự thật thay đổi cục diện rõ ràng mới có thể cập nhật; chỉ khi cục diện xác định kết thúc mới đánh dấu là đã kết thúc.
- Hành động mới, có tiếng đồn hoặc thay đổi kinh tế do đại thế tạo ra nên được ghi vào trường tương ứng; truyền dẫn liên hệ thống ghi vào influenceChain。

### winds（mảng có tiếng đồn)
mỗi mục bao gồm:
- topic: Tên chủ đề ổn định. Khi cập nhật cùng một có tiếng đồn bắt buộc tiếp tục sử dụng cái đã có topic；cùng topic ghi đè cập nhật, mới topic thêm mới.
- type: "announcement"/"report"/"rumor"/"sentiment"，Lần lượt biểu thị thông báo, tin nhắn, tin đồn, dư luận.
- level: 1-4，Biểu thị quy mô lan truyền thực tế:1=Một số ít người trong giới,2=địa phương,3=khu vực lớn,4=quốc gia/quốc tế/thiên hạ.
- content: Cách nói cụ thể đang lan truyền hiện tại; khi lan truyền biến chất thì cập nhật trường này.
- scope: Khu vực hoặc tầng lớp cụ thể thực tế lan truyền đến hiện tại.
- source: Nguồn gốc và chuỗi lan truyền. Khi liên quan đến{{user}}bắt buộc viết ra chuỗi thông tin hoàn chỉnh.

### Yêu cầu liên kết có tiếng đồn
- Mỗi vòng kiểm tra đã có winds，nhưng chỉ khi xuất hiện node lan truyền hợp lệ mới có thể mở rộng level hoặc scope；không được tự động nâng cấp.
- Có tiếng đồn chỉ sau khi lan truyền đến phạm vi hoặc tầng lớp của đối tượng liên quan, mới cho phép thay đổi factions、reputation、economy、enemies hoặc events。
- Khi có tiếng đồn dẫn đến thay đổi liên hệ thống, bắt buộc ghi đồng bộ vào influenceChain，rõ ràng“có tiếng đồn nào → ai biết được → thực hiện hành động gì/hình thành phán đoán gì”。
- Thông báo chỉ chứng minh người phát hành đã công khai nói về việc này, không đảm bảo nội dung là thật; tin đồn cũng có thể tình cờ là thật. Không sử dụng trường độ tin cậy.
- Tin nhắn riêng, mật lệnh v.v. chỉ có thông tin người nhận rõ ràng không thuộc về có tiếng đồn; sau khi rò rỉ và bắt đầu lan truyền mới tạo ra có tiếng đồn.
- Có tiếng đồn không tạo ra ảnh hưởng lan tỏa thực tế có thể chỉ cập nhật winds，Không được gượng ép tạo ra thay đổi hệ thống khác.
- Nếu tiếng đồn liên tục nhiều vòng không có cập nhật thực chất nào, hệ thống cục bộ sẽ phán đoán là đã tan biến và xoá trước khi suy diễn vòng tiếp theo. Nếu một tiếng đồn vòng này vẫn đang lan truyền, biến chất, mở rộng phạm vi hoặc tiếp tục ảnh hưởng thế giới, bắt buộc trả về cùng topic cập nhật; chỉ lặp lại nguyên văn mà không có thay đổi thực tế thì không tính là cập nhật.
- quietRounds là trường nội bộ cục bộ, cấm xuất hoặc sửa đổi.

### economy（đối tượng kinh tế)
- climate: khí hậu kinh tế — Nhiệt độ kinh tế khu vực hiện tại:"phồn vinh"/"ổn định"/"suy thoái"/"biến động"
- signals: Mảng tín hiệu thị trường. Mỗi mục { summary: "Một câu mô tả thay đổi và ảnh hưởng", scope: "Phạm vi địa lý ảnh hưởng (tên khu vực cụ thể)" }。Ghi lại những thay đổi kinh tế đáng chú ý trên thị trường hiện tại——Thay đổi này phải đủ để ảnh hưởng đến hành động của thế lực,NPC quyết sách hoặc hướng đi của chuỗi sự kiện. Những biến động vụn vặt hàng ngày không đáng được đưa vào. Thường không vượt quá 3 mục.

### reputation（đối tượng danh tiếng)
Danh tiếng 4 chiều, mỗi chiều 5 cấp (từ thấp đến cao, chỉ có thể lấy 5 giá trị này): trời giận người oán→tai tiếng khắp nơi→vô danh→được kính trọng→được vạn người ngưỡng mộ
- authority: Trên triều đình — Lực lượng kiến chế nắm quyền đối với{{user}}đánh giá. Tuân thủ pháp luật/chống đối pháp luật, phục tùng/khiêu khích.
- common: Trong thị tứ — Dân thường/Dư luận đường phố đối với{{user}}đánh giá. Nhân thiện/tàn bạo, người bảo vệ/kẻ đe doạ.
- shadow: Trong giang hồ — Lực lượng ngoài thể chế (lục lâm/buôn lậu/lính đánh thuê/hacker/bang phái ngầm v.v.) đối với{{user}}cách nhìn. Tiêu chuẩn cốt lõi: có bản lĩnh hay không. Dùng sức mạnh cá nhân chống lại sự bất công của thể chế, đứng ra vì kẻ yếu→cộng điểm; ức hiếp dân thường, bán đứng đồng đạo, ỷ mạnh hiếp yếu→trừ điểm. Tội phạm hình sự đơn thuần không tự động nhận được sự tôn trọng của giang hồ.
- circuit: Giữa đồng đạo — {{user}}Ngành nghề đang làm/Đánh giá của đồng nghiệp trong giới nghề nghiệp. Trình độ kỹ năng, có giữ quy tắc nghề nghiệp hay không, có đóng góp cho ngành hay không.
- lastChange: Mô tả ngắn gọn thay đổi vòng này (ví dụ"không thay đổi"hoặc"đánh giá của triều đình tăng lên do hỗ trợ bắt giữ"）

### world_digest（chuỗi)
Tự sự suy diễn thế giới dưới nền vòng này,150-200 chữ. Mô tả những gì đã xảy ra dưới nền thế giới vòng này (ràng buộc đại thế thiên hạ,NPC hành động độc lập, thay đổi nội bộ đoàn thể, lan truyền có tiếng đồn v.v.), cấm nhắc đến{{user}}。

### enemies（mảng sổ kẻ thù)
Kẻ thù là do hành vi tổn thương cụ thể mà cùng{{user}}nhân vật hoặc quần thể sinh ra ân oán cá nhân không thể đảo ngược. Khác với đối lập thái độ ở cấp độ thế lực (đó là factions['relation trách nhiệm của']), "đặc trưng cốt lõi của kẻ thù là": không bao giờ phai nhạt, đuổi theo{{user}}chạy.

mỗi mục bao gồm:
- name: Tên kẻ thù (tên cá nhân hoặc tên đoàn thể phục thù)
- reason: Lý do kết thù (tóm tắt{{user}}đã làm gì dẫn đến kết thù)
- type: "blood"/"grudge"。blood=Huyết cừu (nhân vật trọng yếu bị giết, người thân thiết nhất qua đời/tàn phế);grudge=Ân oán không gây tử vong (bị phế, phá sản, bị cướp đi vật quan trọng v.v. gây ra tổn thương không thể đảo ngược)
- status: "đang theo dõi"/"đang lên kế hoạch"/"đang thực thi"/"đã kết thúc"
  - Đang theo dõi: đang thu thập tình báo, xác định{{user}}vị trí
  - Đang lên kế hoạch: đã định vị{{user}}，đang tổ chức nhân thủ/tài nguyên chuẩn bị hành động
  - Đang thực thi: đã phái đi truy sát/lực lượng báo thù, tấn công thực tế đã xảy ra hoặc sắp xảy ra
  - đã kết thúc: kẻ thù bị{{user}}tiêu diệt hoặc phục thù đã hoàn thành. Sau khi đánh dấu, cục bộ giữ lại 20 vòng rồi mới xoá.

Quy tắc phán định:
- type=blood điều kiện kích hoạt: nhân vật trọng yếu bị giết (loại trừ cựu nhân vật trọng yếu đã mất quyền lực, xem sự tan rã quyền lực của module thế lực); người thân ruột thịt qua đời/tàn phế. Loại hận thù này không thể đàm phán, không bao giờ phai nhạt, không từ bỏ theo thời gian.
- type=grudge điều kiện kích hoạt:{{user}}hành vi gây ra tổn thương nghiêm trọng không thể vãn hồi cho nhân vật cụ thể (bị phế võ công, bị cướp đi cơ nghiệp cả đời, bị gài bẫy dẫn đến phá sản/lưu đày), và nạn nhân có động cơ và khả năng phục thù rõ ràng. Không phải mỗi người bị{{user}}đắc tội đều tính là grudge——phải thoả mãn"tổn thương không thể vãn hồi+ý nguyện phục thù rõ ràng+có theo dõi/khả năng báo thù"ba điều kiện.
- bất kể blood hay là grudge，một khi đánh dấu là"đã kết thúc"，cục bộ sẽ giữ lại thêm 20 vòng ghi nhớ, sau đó tự động xoá.

liên kết với chuỗi sự kiện:
- khi tạo mục kẻ thù, thông thường nên đồng bộ tạo một chuỗi sự kiện loại xung đột (type=conflict），name với kẻ thù name tương ứng, và trong influenceChain ghi lại mối liên hệ giữa hai bên.
- mục sổ kẻ thù status khi thay đổi, của chuỗi sự kiện tương ứng stage nên được cập nhật đồng bộ.

xung khắc với tan rã quyền lực:
- Nếu tất cả trụ cột quyền lực của một nhân vật trọng yếu đã bị phá huỷ (xem phần tan rã quyền lực của module thế lực), người đó sẽ mất quyền lực và vị thế nhân vật trọng yếu. Lúc này nếu bị{{user}}giết chết, không kích hoạt type=blood，chỉ theo type=grudge xử lý.

Điều cấm:
- Huyết cừu cung cấp động cơ, không cung cấp năng lực. Truy sát bị ràng buộc bởi cấp bậc thế lực, thế lực yếu không thể thâm nhập địa bàn của thế lực mạnh.
- Không được chỉ vì"bị{{user}}nhục mạ"hoặc"cạnh tranh thương mại thất bại"và các tổn thương có thể đảo ngược khác mà tạo mục sổ kẻ thù.
- Không được lấy sự đối lập thái độ ở cấp độ thế lực (factions.relation）nhập lặp lại vào sổ kẻ thù.

### influenceChain（mảng chuỗi ảnh hưởng)
Dùng để ghi lại quá trình lan truyền của các thay đổi quan trọng trong thế giới, giải thích điều gì đã kích hoạt thay đổi, trực tiếp thay đổi điều gì, và tạo ra dư âm tiếp theo nào. Nó không phải là chuỗi sự kiện mới, không tham gia thúc đẩy xúc xắc, cũng không biểu thị stage tiến độ.
mỗi mục bao gồm:
- trigger: Nguồn kích hoạt. Sự kiện cụ thể, hành động, đại thế thiên hạ, có tiếng đồn, thay đổi kinh tế, thay đổi danh tiếng hoặc thông tin hộp đen gây ra thay đổi
- impact: Ảnh hưởng trực tiếp. Nguồn kích hoạt đã thực sự thay đổi trạng thái thế giới nào
- fallout: Dư âm tiếp theo. Thay đổi thứ cấp hoặc xu hướng tiếp theo do ảnh hưởng tiếp tục lan rộng tạo ra

Yêu cầu:
- Chỉ ghi lại những thay đổi thực sự tạo ra ảnh hưởng lan tỏa, đừng nhét tiến độ thông thường của mỗi chuỗi sự kiện vào influenceChain。
- impact Phải là thay đổi trực tiếp đã xảy ra;fallout Phải là dư âm lan rộng hơn nữa, không được viết lại lặp lại trigger。
- Nếu chuỗi sự kiện A dẫn đến chuỗi sự kiện B tăng tốc, chậm lại, chuyển hướng, tan biến hoặc thất bại, phải giải thích quá trình truyền dẫn trong influenceChain để giải thích quá trình truyền dẫn.
- Nếu ảnh hưởng phụ thuộc vào việc truyền bá thông tin, phải tuân thủ quy tắc truyền bá thông tin;NPC Không thể vì influenceChain tồn tại mà có được góc nhìn của Chúa.
- Cùng một trigger cập nhật bản ghi đó khi đã có bản ghi, đừng xếp chồng vô hạn các bản ghi lặp lại.

### blackbox（đối tượng hộp đen thông tin)
- secretActions: mảng hành vi bí mật, mỗi mục { action: "mô tả hành vi", witnesses: "không có/chỉ XX" }
- secretAssets: mảng tài sản bí mật, mỗi mục { name: "tên tài sản", exposure: 0-100, status: "hợp lệ/hết hạn/bị lộ/hết hiệu lực" }
  exposure Biểu thị mức độ rủi ro tài sản này bị thế giới bên ngoài phát hiện:0=tuyệt mật,100=đã hoàn toàn công khai.
  status Cho biết tài sản này hiện tại có còn khả dụng hay không: hợp lệ=Vẫn có thể gọi, hết hạn=Tình báo lỗi thời, bại lộ=Đã bị phát hiện, hết hiệu lực=Đã không khả dụng.
`;

  const JSON_EXAMPLE = `{
  "events": [
    { "name": "Huyết Đao Môn phục thù", "type": "conflict", "level": 2, "stage": "ủ biến", "stageRound": 5, "desc": "Huyết Đao Môn đã phái người truy tung, người truy tung đã lập trạm gác ngầm tại Tam Lý Đình ngoài Thanh Thạch Quan" },
    { "name": "Thanh Lô Tư cải tiến hoả dược", "type": "progress", "level": 3, "stage": "thực thi", "stageRound": 4, "desc": "Thanh Lô Tư đã thu thập đủ tiêu thạch và mật thán, đang thử nghiệm lò nhỏ, vẫn chưa bước vào giai đoạn định hình" }
  ],
  "factions": [
    { "name": "Huyết Đao Môn", "scope": "Huyết Đao Lĩnh và ba trấn xung quanh", "status": "vững chắc", "relation": "thù địch", "currentGoal": "Phục thù", "core_person": "Huyết Đao Lão Tổ", "powerPillars": ["Răn đe vũ lực","Mạng lưới tình báo"] }
  ],
  "worldTrends": [
    { "name": "Chiến tranh Bắc Cảnh", "scope": "Ba châu Bắc Cảnh và các nước xung quanh", "status": "đang tiếp diễn", "description": "Biên quân và các bộ tộc Bắc Cảnh bước vào chiến tranh dài hạn, việc trưng thu lương thực, bắt lính và phong toả tuyến đường thương mại liên tục thay đổi hành động của các bên", "source": "Lv4 Sự kiện loại xung đột "Chiến tranh Bắc Cảnh" bước vào trạng thái đã bùng phát" }
  ],
  "winds": [
    { "topic": "Thanh Thạch Quan lập trạm kiểm soát", "type": "report", "level": 2, "content": "Cửa bắc Thanh Thạch Quan đã có quan binh lập trạm kiểm tra", "scope": "Thanh Thạch Quan và các thôn trấn xung quanh", "source": "Thương lái chứng kiến→Thương đội qua lại" }
  ],
  "economy": { "climate": "ổn định", "signals": [] },
  "reputation": { "authority": "vô danh", "common": "vô danh", "shadow": "vô danh", "circuit": "vô danh", "lastChange": "không thay đổi" },
  "world_digest": "Người truy tung của Huyết Đao Môn đã lập trạm gác ngầm tại Tam Lý Đình ngoài Thanh Thạch Quan; các chủ Thiên Cơ Các Thượng Quan Vân gửi mật thư triệu hồi ba mật thám vòng ngoài; nhà bếp Tuý Tiên Lâu đổi kênh cung cấp do thương nhân bán lương thực tăng giá.",
  "enemies": [
    { "name": "Huyết Đao Môn", "reason": "{{user}}Đã giết thiếu chủ Huyết Đao Môn", "type": "blood", "status": "đang thực thi" }
  ],
  "influenceChain": [
    { "trigger": "Huyết Đao Môn phát lệnh truy nã", "impact": "Người trong giang hồ bắt đầu chủ động lưu ý{{user}}hành tung của", "fallout": "Khách điếm và bến đò xuất hiện kẻ dò xét và bí mật báo tin" }
  ],
  "blackbox": { "secretActions": [], "secretAssets": [] }
}`;

  // [MAP] preset engine: Đưa lệnh nhân vật engine, kiểm tra nhân quả 10 bước nâng lên cấp module const（nội dung hoàn toàn nhất quán từng chữ với hằng số trong hàm gốc),
  // làm nguồn sự thật duy nhất của "preset mặc định", để cung cấp cho world-engine-preset.js tham chiếu (tránh trôi dạt do sao chép hai bản).
  // callEvolutionAPI bên trong không định nghĩa lại nữa, trực tiếp tham chiếu tại đây; tầng ghi đè dùng Final biến để phân biệt giá trị mặc định và người dùng ghi đè.
  const DEFAULT_SEG_ENGINE_ROLE = `Bạn là một World Engine. Sau mỗi vòng hội thoại, thế giới dưới nền phải tự động thúc đẩy tiến lên một bước.\n Vui lòng dựa vào quy tắc thế giới và hội thoại vòng này, cập nhật trạng thái thế giới. Chỉ xuất JSON，không có văn bản nào khác.`;

  const DEFAULT_SEG_CAUSAL_STEPS = `Khi suy diễn kiểm tra theo thứ tự nhân quả sau:\n1. 【Phán định bí mật·Thực thi đầu tiên】Trước tiên phán định vòng này {{user}} và hành vi của các nhân vật liên quan có người chứng kiến hay không, có để lại dấu vết có thể truy xuất hay không. Phàm là hành vi bí mật xảy ra trong tình huống không có người chứng kiến, không để lại dấu vết (ở một mình, tình ái bí mật, chuyện khuê phòng, mật đàm trong mật thất, lẻn vào bí mật, giết chóc khi không có người v.v.), đều được tính vào blackbox.secretActions（witnesses đánh dấu"không có"hoặc"chỉ XX"），Đồng thời: không được dựa vào đó để tạo ra có tiếng đồn, không được thay đổi danh tiếng ở bất kỳ khía cạnh nào, không được hình thành hoặc thúc đẩy chuỗi sự kiện, không được để bất kỳ ai không có mặt NPC hành động dựa vào đó. Chỉ khi hành vi này bị chứng kiến, để lại dấu vết có thể truy xuất, hoặc sau đó thực sự bị lan truyền, mới có thể chuyển thành ảnh hưởng công khai.\n2. Lấy tất cả đại thế thiên hạ đang tiếp diễn làm ràng buộc cấp thế giới của vòng này, và kiểm tra xem có hình thành đại thế mới hay đại thế hiện có đã kết thúc rõ ràng hay chưa.\n3. Phán đoán sự thật, hành động và thông tin công khai của vòng này có hình thành có tiếng đồn mới hay không (ngoại trừ hành vi bí mật, xem bước 1).\n4. Kiểm tra xem có tiếng đồn hiện có đã nhận được nút lan truyền hợp lệ mới hay chưa, và cập nhật dựa trên đó level/scope/content/source。\n5. Đánh giá xem có tiếng đồn thực tế đã bao phủ những thế lực, tầng lớp hoặc tác nhân nào; chỉ những người bị bao phủ mới có thể thay đổi phán đoán và hành động dựa trên đó.\n6. Khi đại thế thiên hạ hoặc có tiếng đồn gây ra thay đổi xuyên hệ thống, hãy thực thi kết quả trong trường trạng thái tương ứng, và dùng influenceChain ghi lại quá trình truyền dẫn.\n7. Đánh giá danh tiếng: chỉ khi {{user}} hành vi của đã hình thành có tiếng đồn bao phủ tầng lớp tương ứng, mới thay đổi danh tiếng ở khía cạnh tương ứng; hành vi bí mật, chưa lan truyền hoặc chỉ có một người chứng kiến không làm thay đổi danh tiếng nhóm.\n8. Đánh giá kẻ thù: đánh giá xem vòng này có tạo ra kích hoạt huyết cừu hay không/tổn thương ân oán không thể đảo ngược; kẻ thù hiện có chỉ có thể thúc đẩy theo dõi sau khi biết được manh mối thông qua có tiếng đồn bao phủ nguồn tình báo của họ hoặc các kênh hợp pháp khác, và bị ràng buộc bởi cấp độ thế lực, không được định vị vô căn cứ {{user}}。\n9. Đánh giá kinh tế: chỉ cập nhật khi được thúc đẩy bởi chuỗi sự kiện hoặc lý do bên ngoài có thể truy xuất climate và signals；Thay đổi kinh tế lớn phải tạo ra có tiếng đồn tương ứng, cấm biến động vô căn cứ.\n10. Không được nhảy trực tiếp từ thông tin toàn tri trên bảng điều khiển đến NPC hành động, không được hư cấu các nút lan truyền để tạo ra sự liên kết.`;

  async function callEvolutionAPI(state, userMsg, aiMsg, extraInstruction = '', dialogueText = '') {
    const rulesLoader = window.WORLD_ENGINE_RULES;
    const fullRules = rulesLoader ? rulesLoader.getAllRulesText() : '【Tải quy tắc thất bại】';
    // Kích hoạt đèn xanh/lam: quét hội thoại gần đây mà extension này tự đưa vào suy diễn (tách rời, không đọc quét chat của Tavern)
    const worldbookScanText = dialogueText || `${userMsg || ''}\n${aiMsg || ''}`;
    const worldbookSection = await window.WORLD_ENGINE_WORLDBOOK?.buildPromptSection?.(worldbookScanText) || '';
    const tonePrompt = ((api.getSettings ? api.getSettings() : {}).tonePrompt || '').trim();
    const toneSection = tonePrompt
      ? `\n\n========== Từ khoá nhắc nhở bổ sung (người dùng tự định nghĩa · ưu tiên tuân thủ · nhưng không được vi phạm đầu ra nêu trên JSON định dạng)==========\n${tonePrompt}`
      : '';

    // [MAP] Lớp ghi đè preset engine: giá trị mặc định dùng cấp module DEFAULT_SEG_*（nguồn sự thật duy nhất, từng chữ bằng với template gốc),
    // Nếu preset đang kích hoạt có ghi đè tuỳ chỉnh cho đoạn nào đó thì dùng giá trị ghi đè, nếu không thì dùng giá trị mặc định.
    // Khi kích hoạt preset 「mặc định」 (không có bất kỳ ghi đè nào),4 cái Final biến từng chữ bằng với hằng số gốc → kết quả lắp ráp tương đương cấp byte PR#12 hiện trạng.
    // [PERF] lấy một lần 4 đoạn ghi đè (getOverrides đi trong preset mặc định 0-parse đường dẫn nhanh, preset tuỳ chỉnh 1 lần parse），
    // tránh tra cứu riêng từng đoạn dẫn đến lặp lại trong cùng một vòng suy diễn JSON.parse toàn bộ mảng preset tuỳ chỉnh.
    const _P = window.WORLD_ENGINE_PRESET;
    const _ov = (_P && typeof _P.getOverrides === 'function') ? _P.getOverrides() : null;
    const segEngineRole = (_ov && _ov['engine-role']) || DEFAULT_SEG_ENGINE_ROLE;
    const segCausalSteps = (_ov && _ov['causal-steps']) || DEFAULT_SEG_CAUSAL_STEPS;
    const segOutputInstructions = (_ov && _ov['output-format']) || OUTPUT_INSTRUCTIONS;
    const segJsonExample = (_ov && _ov['json-example']) || JSON_EXAMPLE;

    const segStateBlock = `## Trạng thái thế giới hiện tại (vòng thứ${state.round}vòng)\n${JSON.stringify({
  round: state.round,
  events: (state.events || []).map(e => ({ name: e.name, type: e.type || 'conflict', stage: e.stage, stageRound: e.stageRound, level: e.level, desc: e.desc, evolveResult: e.evolveResult, stall: e.stall })),
  factions: (state.factions || []).map(f => ({ name: f.name, scope: f.scope, status: f.status, relation: f.relation, currentGoal: f.currentGoal, core_person: f.core_person, powerPillars: f.powerPillars })),
  worldTrends: state.worldTrends || [],
  winds: (state.winds || []).map(({ quietRounds, ...wind }) => wind),
  reputation: state.reputation,
  economy: state.economy,
  enemies: state.enemies || [],
  influenceChain: state.influenceChain || [],
  blackbox: state.blackbox || { secretActions: [], secretAssets: [] }
}, null, 2)}`;

    const segDialogue = `## Hội thoại gần đây\n${dialogueText ? dialogueText : `Người dùng:${userMsg || ''}\nAI：${aiMsg || ''}`}`;

    const segExtraInstruction = extraInstruction ? extraInstruction : '';
    // toneSection đã bao gồm tiền đạo \n\n；segments lưu bản gốc toneSection，nhất quán với thực tế phát ra
    const segToneSection = toneSection;

    // [MAP] hoàn chỉnh thực tế phát ra prompt：thứ tự ghép nối và phân tách giống từng chữ với template gốc, không trôi dạt ngữ nghĩa.
    // 4 đoạn dùng phía trên seg*（lớp ghi đè Final biến): khi không có ghi đè thì từng chữ bằng với hằng số gốc.
    const prompt = segEngineRole + '\n\n' + segCausalSteps
      + '\n\n========== Quy tắc suy diễn thế giới ==========\n' + fullRules
      + '\n\n' + worldbookSection
      + '\n\n' + segStateBlock
      + '\n\n' + segDialogue
      + '\n\n' + segOutputInstructions
      + '\n' + segJsonExample
      + '\n' + (extraInstruction ? '\n' + extraInstruction : '') + toneSection;

    // [MAP] Phân đoạn phản chiếu (dùng để hiển thị hoàn toàn minh bạch, chỉ đọc). Các đoạn content với phía trên prompt tham chiếu cùng một biến.
    // worldbookSection / toneSection / extraInstruction khi trống content là chuỗi rỗng, bên hiển thị đánh dấu 「vòng này chưa bật」。
    _lastPromptSegments = [
      { key: 'engine-role',    label: '① Lệnh nhân vật engine',            content: segEngineRole },
      { key: 'causal-steps',   label: '② Kiểm tra nhân quả (10 bước)',        content: segCausalSteps },
      { key: 'rules',          label: '③ Quy tắc suy diễn thế giới',            content: fullRules },
      { key: 'worldbook',      label: '④ Tiêm Worldbook',              content: worldbookSection },
      { key: 'state',          label: '⑤ Trạng thái thế giới hiện tại (JSON）',     content: segStateBlock },
      { key: 'dialogue',       label: '⑥ Hội thoại gần đây',                content: segDialogue },
      { key: 'output-format',  label: '⑦ JSON giải thích trường xuất',       content: segOutputInstructions },
      { key: 'json-example',   label: '⑧ JSON Ví dụ',               content: segJsonExample },
      { key: 'extra-instr',    label: '⑨ Lệnh bổ sung',                content: segExtraInstruction },
      { key: 'tone',           label: '⑩ Từ gợi ý bổ sung (người dùng tuỳ chỉnh)', content: segToneSection }
    ];

    const rawResult = await api.callApi(prompt, 8000, 0.7, _abortController.signal);
    _lastPrompt = prompt;
    _lastRawResult = rawResult;
    const update = api.parseJSON(rawResult);
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      throw new Error('API trả về không thể phân tích thành hợp lệ JSON，đã giữ lại thử lại roll trạng thái hiện tại trước đó');
    }
    const knownFields = [
      'events', 'factions', 'worldTrends', 'winds', 'economy', 'reputation',
      'world_digest', 'enemies', 'influenceChain', 'regionalIncident', 'blackbox'
    ];
    if (!knownFields.some(field => Object.prototype.hasOwnProperty.call(update, field))) {
      throw new Error('API trả về không chứa bất kỳ trường trạng thái thế giới nào, đã giữ lại thử lại roll trạng thái hiện tại trước đó');
    }
    console.log('[World Engine] API JSON phân tích thành công, "tóm tắt thế giới":', update.world_digest || '[chưa trả về]');

    update.events = update.events || [];
    update.factions = update.factions || [];
    update.worldTrends = update.worldTrends || [];
    update.winds = update.winds || [];
    update.economy = update.economy || {};
    if (!update.economy.signals) update.economy.signals = [];
    update.reputation = update.reputation || {};
    update.world_digest = update.world_digest || state.worldDigest;
    update.enemies = update.enemies || [];
    update.influenceChain = Array.isArray(update.influenceChain) ? update.influenceChain : [];
    // regionalIncident do xúc xắc cục bộ kiểm soát, không ở trong callEvolutionAPI tự động hoàn thành trong
    // API trả về regionalIncident ở mergeRegionalIncident xác thực trong
    if (!update.blackbox) update.blackbox = { secretActions: [], secretAssets: [] };

    return update;
  }

  let _abortController = null;
  let _isRunning = false;
  let _backfillRunning = false;
  let _backfillAborted = false;
  let _lastError = '';

  async function evolve(state, userMsg, aiMsg, opts) {
    if (_isRunning) {
      console.warn('[World Engine] ⚠️ đã có suy diễn đang chạy, bỏ qua yêu cầu trùng lặp');
      _lastError = 'đã có suy diễn đang chạy';
      return false;
    }
    _lastError = '';

    delete state._terminalEventsThisRound;
    const hadStoredState = core.hasState();
    const backup = JSON.parse(JSON.stringify(state));
    // cơ sở do bên gọi chỉ định rõ (hai nút thủ công):
    //   'forward' = suy diễn về phía trước, suy diễn từ trạng thái hiện tại, suy diễn xong điểm lưu tiến lên (tương đương vòng mới);
    //   'redo'    = suy diễn lại, khôi phục từ điểm lưu rồi suy diễn tiếp, vòng không đổi;
    //   không truyền      = suy diễn tự động, tiếp tục sử dụng isNewRound() phán đoán.
    const mode = opts && opts.mode;
    const isNew = mode === 'forward' ? true
                : mode === 'redo'    ? false
                : core.isNewRound();
    // [FIX] lựa chọn cơ sở chia ba, tách rời 「thử lại roll」và 「redo」：
    //   isForward  = mode==='forward' hoặc vòng mới tự động (isNew=true） —— tiếp tục suy diễn về phía trước từ hiện tại,round++、điểm lưu tiến lên, làm mới vân tay.
    //   isRedo     = mode==='redo'（vệ tinh thủ công 「thúc đẩy lại」)        —— khôi phục cơ sở từ điểm lưu rồi suy diễn lại, vòng=vòng điểm lưu, không đổi điểm lưu/vân tay.
    //   tự động thử lại roll = nếu không thì (mode=undefined và !isNew）              —— suy diễn lại do tạo lại nội dung chính của cùng một tầng,**không khôi phục từ điểm lưu**，
    //                 trực tiếp ở hiện tại state suy diễn lên, vòng giữ nguyên vòng hiện tại, không đổi điểm lưu/vân tay.
    //   mã cũ đưa 「tự động thử lại roll」cũng chạy else của Object.assign(state,cp)，đưa state khôi phục toàn bộ thành điểm lưu (vòng trước) rồi suy diễn tiếp→vòng lùi về thành
    //   vòng điểm lưu (triệu chứng B：Thứ 6 vòng suy diễn lại roll sau khi suy diễn dừng ở 5）。nay sửa lại: chỉ có isRedo mới về điểm lưu; tự động thử lại roll ở hiện tại state suy diễn
    //   （PR#27 cách sửa 2 chú thích line768 nói rõ 'chính đạo suy diễn dựa trên trạng thái hiện tại', cách triển khai cũ không khớp với chú thích, ở đây đã căn chỉnh).
    const isForward = isNew;

    if (isForward) {
      console.log('[World Engine] 📌 vòng mới forward');
    } else if (mode === 'redo') {
      // redo（thủ công 'thúc đẩy lại'): từ điểm lưu a khôi phục cơ sở suy diễn lại, vòng=vòng điểm lưu
      const cp = core.restoreCheckpoint();
      if (cp) {
        Object.assign(state, cp);
        state.memories = cp.memories || [];
        state.events = cp.events || [];
        state.factions = cp.factions || [];
        state.worldTrends = cp.worldTrends || [];
        state.winds = cp.winds || [];
        state.enemies = cp.enemies || [];
        state.influenceChain = cp.influenceChain || [];
        console.log('[World Engine] 🔄 redo khôi phục suy diễn lại từ điểm lưu');
      } else {
        // [FIX thủ vệ] redo phải có điểm lưu làm cơ sở. Khi không có điểm lưu (sau lần suy diễn đầu tiên, hoặc chỉ mới làm redo chưa từng forward qua) từ chối thực thi,
        //   tránh âm thầm thoái hoá thành 'ở hiện tại state suy diễn lên'+ round++ giả của redo。tự động thử lại roll không nằm trong phạm vi thủ vệ này (xem nhánh dưới).
        _lastError = 'không có điểm lưu, không thể thúc đẩy lại (redo）；vui lòng 'thúc đẩy tới trước' ít nhất một vòng rồi mới sử dụng 'thúc đẩy lại'';
        console.warn('[World Engine] ⚠️ redo không có điểm lưu, đã từ chối (không thoái hoá thành giả forward）');
        return false;
      }
    } else {
      // tự động thử lại roll（mode=undefined và không phải vòng mới): suy diễn lại được kích hoạt do tạo lại nội dung chính của cùng một tầng.
      //   không khôi phục cơ sở từ điểm lưu (điểm lưu là trạng thái 'trước khi tạo nội dung chính của tầng này', giữ lại để tiêm, cơ sở suy diễn dùng hiện tại state）；
      //   vòng giữ nguyên vòng hiện tại (forward đã round++ đến vòng hiện tại, ở đây không đổi); không đổi điểm lưu/vân tay.
      //   khi không có điểm lưu (bối cảnh tầng đầu) cũng không báo lỗi——trực tiếp ở hiện tại state suy diễn lên, tầng đầu vốn dĩ không có cp。
      console.log('[World Engine] 🔄 suy diễn lại vòng hiện tại (tự động thử lại roll，vòng không đổi)');
    }

    _isRunning = true;
    _abortController = new AbortController();

    try {
      // Thứ 1 bước: xúc xắc cục bộ thúc đẩy chuỗi sự kiện (tất cả ở b thao tác trên)
      forceTriggerEvents(state);

      // Thứ 2 bước: tích luỹ tiếng đồn chìm xuống và phán định tan biến
      decayWinds(state);

      // Thứ 3 bước: xúc xắc sự kiện đột phát khu vực
      const regionalIncidentRoll = rollRegionalIncident(state);

      // Thứ 4 bước: mớm cho API làm cập nhật tự sự
      const update = await callEvolutionAPI(state, userMsg, aiMsg, regionalIncidentRoll.injectPrompt, (opts && opts.dialogueText) || '');

      // Thứ 5 bước: gộp API trả về
      for (const ev of update.events) {
        const existing = state.events.find(e => e.name === ev.name);
        if (existing) {
          // loại sự kiện một khi đã xác định không thể do API thay đổi
          ev.type = existing.type || 'conflict';

          const stageOrder = EVENT_STAGE_ORDER[existing.type] || EVENT_STAGE_ORDER.conflict;
          const finalStage = EVENT_FINAL_STAGE[existing.type] || EVENT_FINAL_STAGE.conflict;
          const terminalStages = EVENT_TERMINAL_STAGES[existing.type] || EVENT_TERMINAL_STAGES.conflict;

          // bảo vệ sự kiện chung cuộc: chỉ cho phép API sửa desc
          if (terminalStages.includes(existing.stage)) {
            if (ev.desc !== undefined) existing.desc = ev.desc;
            core.ensureEventFields(existing);
            continue;
          }

          // API đã sửa stageRound？lấy API làm chuẩn, nhưng >=9 khi tự động thăng cấp
          if (ev.stageRound !== undefined && ev.stageRound !== existing.stageRound) {
            existing.stageRound = ev.stageRound;
            existing.consecutiveFails = 0;
            // stageRound >= 9 kích hoạt thăng cấp
            if (existing.stageRound >= 9) {
              const idx = stageOrder.indexOf(existing.stage);
              if (idx !== -1 && idx < stageOrder.length - 1) {
                existing.stage = stageOrder[idx + 1];
                existing.stageRound = existing.stageRound - 9;
              } else {
                existing.stage = finalStage;
                existing.stageRound = 9;
              }
            }
          }
          // gộp các trường khác
          if (ev.stage !== undefined) existing.stage = ev.stage;
          if (ev.desc !== undefined) existing.desc = ev.desc;
          if (ev.level !== undefined) existing.level = ev.level;
          if (ev.name !== undefined) existing.name = ev.name;
          if (ev.stall !== undefined) existing.stall = ev.stall;
          existing.type = ev.type;
          core.ensureEventFields(existing);
        } else {
          if (!ev.type || !EVENT_TYPES.includes(ev.type)) ev.type = 'conflict';
          core.addEvent(state, ev);
        }
      }
      for (const fac of update.factions) core.addFaction(state, fac);
      for (const trend of update.worldTrends) core.addWorldTrend(state, trend);
      for (const wind of update.winds) core.addWind(state, wind);
      if (Object.keys(update.economy).length) Object.assign(state.economy, update.economy);
      if (Object.keys(update.reputation).length) Object.assign(state.reputation, update.reputation);
      if (update.world_digest) state.worldDigest = update.world_digest;

      // sổ kẻ thù
      if (update.enemies.length) {
        for (const en of update.enemies) {
          if (!en.name || !en.reason) continue;
          if (!en.type || !['blood', 'grudge'].includes(en.type)) en.type = 'blood';
          if (!en.status|| !['đang theo dõi','đang lên kế hoạch','đang thực thi','đã kết thúc'].includes(en.status)) en.status = 'đang theo dõi';
          const idx = (state.enemies || []).findIndex(ex => ex.name === en.name);
          if (idx !== -1) state.enemies[idx] = { ...state.enemies[idx], ...en };
          else state.enemies.unshift(en);
        }
        // giữ lại kẻ thù đã kết thúc 20 dọn dẹp sau vòng
        state.enemies = (state.enemies || []).filter(en => {
          if (en.status === 'đã kết thúc') {
            en._terminalSince = en._terminalSince || state.round;
            return (state.round - en._terminalSince) < 20;
          }
          return true;
        });
        if (state.enemies.length > 8) state.enemies.length = 8;
      }

      // chuỗi ảnh hưởng
      if (update.influenceChain.length) {
        const completedRound = state.round + 1;
        for (const influence of update.influenceChain) {
          if (!influence.trigger || !influence.impact) continue;
          influence.fallout = influence.fallout || '';
          const idx = (state.influenceChain || []).findIndex(existing => existing.trigger === influence.trigger);
          if (idx !== -1) {
            influence._createdRound = state.influenceChain[idx]._createdRound ?? completedRound;
            state.influenceChain[idx] = influence;
          } else {
            influence._createdRound = completedRound;
            state.influenceChain.unshift(influence);
          }
        }
        if (state.influenceChain.length > 12) state.influenceChain.length = 12;
      }

      // Influence entries expire after 8 rounds; updates to the same trigger do not renew them.
      const completedRound = state.round + 1;
      const cleanedInfluence = (state.influenceChain || []).filter(influence => {
        if (!influence || typeof influence !== 'object') return false;
        if (influence._createdRound === undefined) influence._createdRound = state.round;
        return (completedRound - influence._createdRound) < 8;
      });
      if (cleanedInfluence.length !== (state.influenceChain || []).length) {
        console.log('[World Engine] auto-removed influence entries:', (state.influenceChain || [])
          .filter(influence => !cleanedInfluence.includes(influence))
          .map(influence => influence.trigger)
          .join(', '));
      }
      state.influenceChain = cleanedInfluence;

      // economy signals giới hạn trên
      if (state.economy && state.economy.signals && state.economy.signals.length > 8) {
        state.economy.signals.length = 8;
      }

      // gộp sự kiện đột phát khu vực
      mergeRegionalIncident(state, update);

      if (update.blackbox) {
        state.blackbox = update.blackbox;
        const totalBlackbox = (state.blackbox.secretActions?.length || 0) + (state.blackbox.secretAssets?.length || 0);
        if (totalBlackbox > 12) {
          const excess = totalBlackbox - 12;
          const actions = state.blackbox.secretActions || [];
          const assets = state.blackbox.secretAssets || [];
          if (actions.length > excess) {
            state.blackbox.secretActions.length = Math.max(1, actions.length - excess);
          } else {
            state.blackbox.secretActions = [];
            state.blackbox.secretAssets.length = Math.max(1, assets.length - excess + actions.length);
          }
        }
      }

      // tự động dọn dẹp: đã tan biến/chuỗi sự kiện đã thất bại & đại thế thiên hạ đã kết thúc
      // - kết cục tiêu cực (đã tan biến/đã thất bại): vòng tiếp theo sẽ xoá
      // - kết cục tích cực (đã bùng phát/đã hoàn thành): giữ lại từ khi vào kết cục 2+level*2 vòng (Lv1=4/Lv2=6/Lv3=8/Lv4=10），
      //   dành thời gian bày bố dư âm, đến hạn tự động dọn dẹp
      const POSITIVE_TERMINALS = ['đã bùng phát', 'đã hoàn thành'];
      const cleanedEvents = (state.events || []).filter(e => {
        if (e.stage === 'đã tan biến' || e.stage === 'đã thất bại') return false;
        if (POSITIVE_TERMINALS.includes(e.stage)) {
          if (e._terminalSince === undefined) e._terminalSince = state.round;
          const keepRounds = 2 + (e.level || 1) * 2;
          return (state.round - e._terminalSince) < keepRounds;
        }
        // không phải kết cục: xoá các đánh dấu đếm ngược có thể còn sót lại (bị API khi đổi về giai đoạn không phải kết cục)
        if (e._terminalSince !== undefined) delete e._terminalSince;
        return true;
      });
      if (cleanedEvents.length !== (state.events || []).length) {
        const removed = (state.events || []).filter(e => !cleanedEvents.includes(e));
        state._terminalEventsThisRound = removed.map(e => JSON.parse(JSON.stringify(e)));
        console.log('[World Engine] 🧹 tự động dọn dẹp chuỗi sự kiện:', removed.map(e => e.name).join('、'));
      }
      state.events = cleanedEvents;

      const cleanedTrends = (state.worldTrends || []).filter(t => t.status !== 'đã kết thúc');
      if (cleanedTrends.length !== (state.worldTrends || []).length) {
        const removed = (state.worldTrends || []).filter(t => !cleanedTrends.includes(t));
        console.log('[World Engine] 🧹 tự động dọn dẹp đại thế thiên hạ:', removed.map(t => t.name).join('、'));
      }
      state.worldTrends = cleanedTrends;

      state.lastEvolveResult = update;

      // [FIX] khối vòng chia ba, căn chỉnh lựa chọn cơ sở chia ba (xem phía trên isForward/isRedo/tự động reroll）：
      //   isForward        → round++ + điểm lưu tiến lên(saveCheckpoint(backup)) + làm mới vân tay(saveFingerprint)。
      //   isRedo           → vòng không đổi(=vòng điểm lưu)；không lưu checkpoint、không cập nhật fingerprint（redo cơ sở chính là điểm lưu, không động vào nó).
      //   tự động thử lại roll       → vòng không đổi(=vòng hiện tại)；không lưu checkpoint、không cập nhật fingerprint。
      //     then chốt: tự động thử lại roll **không saveCheckpoint** —— điểm lưu giữ nguyên forward trạng thái 「vòng trước」 được lưu khi,
      //     đây là tiền đề để phía tiêm sau này có thể lấy 「trạng thái thế giới trước khi sinh ra chính văn tầng này」=của điểm lưu. Nếu tiến điểm lưu lên trước lúc này,
      //     thử lại roll sau khi tiêm sẽ nhận được trạng thái 「thử lại roll trước khi suy diễn」 chứ không phải 「trước khi sinh ra chính văn tầng này」, sai lệch ngữ nghĩa.
      //   mã cũ không phân biệt tại isNew=false sẽ in「reroll/redo vòng không đổi」, nhưng lựa chọn cơ sở phía trên đã đưa tự động thử lại roll
      //   lỗi Object.assign(cp) về điểm lưu (triệu chứng B），hiện cơ sở đã được sửa thành không về điểm lưu, vòng tại đây giữ nguyên vòng hiện tại.
      if (isForward) {
        // suy diễn lần đầu không tạo điểm lưu trống; sau đó trạng thái hiện tại cũ trở thành điểm lưu và giữ lại số tầng gốc.
        state.round++;                             // chỉ tại forward tăng vòng
        if (hadStoredState) core.saveCheckpoint(backup);
        core.saveFingerprint(core.getChatFingerprint());
        console.log('[World Engine] ✅ suy diễn hoàn tất, vòng mới thứ', state.round, 'vòng, điểm lưu đã thúc đẩy');
      } else {
        const label = (mode === 'redo') ? 'redo' : 'tự động reroll';
        console.log('[World Engine] ✅ suy diễn hoàn tất (' + label + '），vòng không đổi: thứ ', state.round, 'vòng');
      }
      core.saveStateWithLayer(state);
      return true;

    } catch(e) {
      if (e.name === 'AbortError') {
        console.log('[World Engine] 🛑 suy diễn đã huỷ bỏ');
        _lastError = 'đã huỷ bỏ';
      } else {
        console.error('[World Engine] suy diễn thất bại', e);
        _lastError = e && e.message ? e.message : 'lỗi không xác định';
      }
      // khôi phục trạng thái trước đó; bản thân câu lệnh khôi phục có thể ném lỗi (như  IDB ghi thất bại dưới áp lực bộ nhớ), nuốt lỗi để tránh bỏ qua  finally đặt lại
      try { Object.assign(state, backup); core.saveState(state); } catch (_) {}
      return false;
    } finally {
      // bất kể thành công/thất bại/câu lệnh khôi phục ném lỗi, đều đặt lại cờ kiểm soát đồng thời; nếu không thì sau đó  evolve sẽ bị  isRunning() thủ vệ bỏ qua vĩnh viễn
      // （tức là thỉnh thoảng xảy ra dưới áp lực bộ nhớ sau khi nâng cấp "suy diễn không bao giờ hoạt động nữa"triệu chứng của)
      _abortController = null;
      _isRunning = false;
    }
  }

  function abort() {
    if (_backfillRunning) {
      _backfillAborted = true;
      console.log('[World Engine] 🛑 nhận được yêu cầu huỷ bỏ backfill hàng loạt');
    }
    if (_abortController) {
      _abortController.abort();
      console.log('[World Engine] 🛑 phát ra tín hiệu huỷ bỏ');
    }
  }

  function isRunning() {
    return _isRunning || _backfillRunning;
  }

  // ========== hàng loạt 「backfill suy diễn thế giới」 ==========
  // từ thứ  1 cái AI tầng bắt đầu, chia lô suy diễn lại trạng thái thế giới đến tầng chỉ định (xoá hết làm lại).
  // mỗi lô chỉ nạp lô này  N cái AI tầng (và kẹp ở giữa  user tầng) hội thoại, nhưng  state tích luỹ từng lô——
  // Thứ k lô ở thứ  k-1 tiếp tục trên kết quả suy diễn của lô, đảm bảo thế giới liền mạch;token mỗi lô không đổi và có thể kiểm soát.
  // opts: { batchSize, retries, endLayer, onProgress }
  //   onProgress({ phase, batch, totalBatches, layerFrom, layerTo, attempt, ok, round })
  // trả về { done, totalBatches, completedBatches, failedAt }
  async function backfillEvolve(opts) {
    opts = opts || {};
    if (_isRunning || _backfillRunning) {
      console.warn('[World Engine] ⚠️ đã có suy diễn/đang backfill, bỏ qua backfill hàng loạt');
      return { done: false, reason: 'busy' };
    }

    const settings = api && api.getSettings ? api.getSettings(true) : {};
    const batchSize = Math.max(1, parseInt(opts.batchSize ?? settings.backfillBatchSize) || 1);
    const retries = Math.max(0, parseInt(opts.retries ?? settings.backfillRetries) || 0);
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

    // 1) thu thập tất cả hợp lệ  AI tầng ở  chat chỉ số trong (nhất quán với tiêu chí suy diễn tự động: không phải  user、mes không rỗng)
    let chat = [];
    let startChatId = 'default';
    try {
      const ctx = SillyTavern.getContext();
      chat = (ctx && ctx.chat) || [];
      if (ctx && ctx.chatId) startChatId = ctx.chatId;
    } catch (e) { chat = []; }
    const aiIdx = [];
    for (let i = 0; i < chat.length; i++) {
      const m = chat[i];
      if (m && !m.is_user && String(m.mes || '').trim()) aiIdx.push(i);
    }
    if (!aiIdx.length) {
      return { done: false, reason: 'no-ai-layers', totalBatches: 0 };
    }

    // 2) kẹp chặt tầng kết thúc (0 hoặc mặc định  = suy diễn đến cuối cùng  AI tầng)
    let endLayer = parseInt(opts.endLayer ?? settings.backfillEndLayer) || 0;
    if (!Number.isFinite(endLayer) || endLayer <= 0 || endLayer > aiIdx.length) endLayer = aiIdx.length;

    // 3) cắt lô: trước  endLayer cái AI tầng theo  batchSize nhóm, lô cuối cùng hấp thụ phần dư (không tạo lô rỗng)
    const batches = [];
    for (let p = 0; p < endLayer; p += batchSize) {
      const pEnd = Math.min(p + batchSize, endLayer) - 1; // bao gồm 
      // phần dư gộp vào lô trước: nếu phần còn lại không đủ một lô và đã có lô, thì gộp nó vào lô cuối cùng
      batches.push({ pStart: p, pEnd });
    }
    // gộp phần lẻ cuối vào lô trước (như  30/7 → 7/7/7/9 chứ không phải  7/7/7/7/2）
    if (batches.length >= 2) {
      const last = batches[batches.length - 1];
      const lastCount = last.pEnd - last.pStart + 1;
      if (lastCount < batchSize) {
        batches[batches.length - 2].pEnd = last.pEnd;
        batches.pop();
      }
    }
    const totalBatches = batches.length;

    // 4) xoá hết làm lại: vứt bỏ trạng thái thế giới hiện tại và điểm lưu, để thứ  1 lô bắt đầu suy diễn từ thế giới trống
    core.clearState();
    core.clearCheckpoint();

    _backfillRunning = true;
    _backfillAborted = false;
    let completedBatches = 0;

    try {
      for (let b = 0; b < totalBatches; b++) {
        if (_backfillAborted) {
          console.log('[World Engine] 🛑 backfill hàng loạt đã huỷ bỏ, dừng ở thứ ', b, '/', totalBatches, 'lô');
          return { done: false, reason: 'aborted', totalBatches, completedBatches, failedAt: b + 1 };
        }
        // Thủ vệ chuyển chat: Người dùng chuyển sang chat khác khi đang backfill → lập tức huỷ bỏ, tuyệt đối không ghi vào B ghi.
        // nếu không thì phần đầu clearState() đã xoá hết A，còn việc đọc ghi tiếp theo dùng động chatId ghi vào B，sẽ làm ô nhiễm B và mất A bản lưu.
        if (core.getChatId() !== startChatId) {
          console.warn('[World Engine] 🛑 Phát hiện chuyển chat, huỷ bỏ backfill hàng loạt (start', startChatId, '→ now', core.getChatId(), '）');
          return { done: false, reason: 'chat-changed', totalBatches, completedBatches, failedAt: b + 1 };
        }
        const { pStart, pEnd } = batches[b];
        const lastChatIdx = aiIdx[pEnd];
        const startChatIdx = pStart === 0 ? 0 : aiIdx[pStart - 1] + 1;
        const aiMsg = String(chat[lastChatIdx].mes || '').trim();

        // Cấu trúc văn bản hội thoại lô này (nhất quán với performEvolution nhất quán: bao gồm cả phần kẹp ở giữa của user tầng)
        const dialogueText = chat.slice(startChatIdx, lastChatIdx + 1)
          .map(m => (m.is_user ? 'người dùng' : 'AI') + '：' + core.filterDialogue(String(m.mes || '').trim(), settings))
          .filter(line => line.length > 3)
          .join('\n');

        onProgress({ phase: 'batch-start', batch: b + 1, totalBatches,
          layerFrom: pStart + 1, layerTo: pEnd + 1, attempt: 0 });

        // đọc lại mỗi lô state（evolve đã ghi ra đĩa), nhất quán với đường dẫn vòng đơn
        let ok = false;
        let lastAttempt = 0;
        for (let attempt = 0; attempt <= retries; attempt++) {
          lastAttempt = attempt;
          if (_backfillAborted) break;
          // mỗi lô/kiểm tra trước mỗi lần thử lại chatId：await api['callApi có vài giây trống'], người dùng rất có thể chuyển chat lúc này
          if (core.getChatId() !== startChatId) {
            console.warn('[World Engine] 🛑 Phát hiện chuyển chat, huỷ bỏ backfill hàng loạt (start', startChatId, '→ now', core.getChatId(), '）');
            return { done: false, reason: 'chat-changed', totalBatches, completedBatches, failedAt: b + 1 };
          }
          const state = core.loadState();
          ok = await evolve(state, '', aiMsg, { mode: 'forward', dialogueText });
          if (ok) break;
          if (_backfillAborted) break;
          if (attempt < retries) {
            console.warn(`[World Engine] ⚠️ Thứ ${b + 1}/${totalBatches} suy diễn lô thất bại, thử lại ${attempt + 1}/${retries}`);
            onProgress({ phase: 'retry', batch: b + 1, totalBatches,
              layerFrom: pStart + 1, layerTo: pEnd + 1, attempt: attempt + 1 });
          }
        }

        if (!ok) {
          if (_backfillAborted) {
            return { done: false, reason: 'aborted', totalBatches, completedBatches, failedAt: b + 1 };
          }
          console.error(`[World Engine] ❌ Thứ ${b + 1}/${totalBatches} suy diễn lô đã hết số lần thử lại vẫn thất bại, huỷ bỏ backfill`);
          onProgress({ phase: 'batch-failed', batch: b + 1, totalBatches,
            layerFrom: pStart + 1, layerTo: pEnd + 1, attempt: lastAttempt });
          return { done: false, reason: 'evolve-failed', totalBatches, completedBatches, failedAt: b + 1 };
        }

        completedBatches++;
        const cur = core.loadState();
        if (window.WORLD_ENGINE_LEDGER) {
          try { window.WORLD_ENGINE_LEDGER.recordChanges(cur); } catch (e) {}
        }
        onProgress({ phase: 'batch-done', batch: b + 1, totalBatches,
          layerFrom: pStart + 1, layerTo: pEnd + 1, attempt: lastAttempt, ok: true, round: cur.round });
      }

      onProgress({ phase: 'all-done', totalBatches, completedBatches });
      return { done: true, totalBatches, completedBatches };
    } catch (e) {
      console.error('[World Engine] backfill hàng loạt bất thường', e);
      return { done: false, reason: 'exception', error: String(e && e.message || e), totalBatches, completedBatches };
    } finally {
      _backfillRunning = false;
      _backfillAborted = false;
    }
  }

  function getLastError() {
    return _lastError;
  }

  window.WORLD_ENGINE_DEBUG = {
    evolve,
    backfillEvolve,
    callEvolutionAPI,
    forceTriggerEvents,
    decayWinds,
    state: () => core.loadState()
  };

  // [MAP] preset engine: phơi bày 4 đoạn văn bản mặc định cho world-engine-preset.js làm nguồn sự thật duy nhất cho 「preset mặc định」.
  // tham chiếu chỉ đọc, tránh preset bản sao kép của module dẫn đến trôi dạt giá trị mặc định.
  window.WORLD_ENGINE_EVOLUTION_DEFAULT_SEGS = {
    'engine-role':   DEFAULT_SEG_ENGINE_ROLE,
    'causal-steps':  DEFAULT_SEG_CAUSAL_STEPS,
    'output-format': OUTPUT_INSTRUCTIONS,
    'json-example':  JSON_EXAMPLE
  };

  return { evolve, backfillEvolve, getLastDebug, abort, isRunning, getLastError };
})();
