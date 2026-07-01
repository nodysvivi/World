// world-engine-ledger.js — Sổ cái sự kiện quan trọng (thuần cục bộ, thay thế module bộ nhớ cũ)
window.WORLD_ENGINE_LEDGER = (function() {
  const core = window.WORLD_ENGINE_CORE;
  const MAX_LEDGER_ROUNDS = 20;

  const EVENT_TYPE_NAMES = { conflict: 'loại xung đột', progress: 'loại thúc đẩy' };
  const TERMINAL_STAGES = new Set(['đã hoàn thành', 'đã thất bại', 'đã tan biến', 'đã bùng phát']);

  /**
   * So sánh điểm lưu (trước suy diễn) và trạng thái hiện tại (sau suy diễn), ghi lại Lv3/4 thay đổi.
   * Tất cả thay đổi gộp thành một mục, nhóm theo vòng.
   */
  function recordChanges(state) {
    const removedTerminalEvents = state._terminalEventsThisRound || [];
    delete state._terminalEventsThisRound;

    const cp = core.restoreCheckpoint();
    if (!cp) {
      core.saveState(state);
      return;
    }

    const changes = [];

    // —— Chuỗi sự kiện: ghi chép thay đổi thông thường Lv3/4，Ghi lại kết cục ở bất kỳ cấp độ nào ——
    const cpEventMap = new Map((cp.events || []).map(e => [e.name, e]));
    const currentEvents = state.events || [];
    for (const ev of [...currentEvents, ...removedTerminalEvents]) {
      const isTerminal = TERMINAL_STAGES.has(ev.stage);
      if ((!ev.level || ev.level < 3) && !isTerminal) continue;
      const cpEv = cpEventMap.get(ev.name);
      if (!cpEv) {
        changes.push({
          type: isTerminal ? 'event_terminal' : 'event_new',
          name: ev.name,
          eventType: ev.type || 'conflict',
          level: ev.level,
          stage: ev.stage || '?',
          desc: ev.desc || ''
        });
      } else if (cpEv.stage !== ev.stage) {
        changes.push({
          type: isTerminal ? 'event_terminal' : 'event_advance',
          name: ev.name,
          level: ev.level,
          fromStage: cpEv.stage || '?',
          toStage: ev.stage || '?',
          stage: ev.stage || '?',
          desc: ev.desc || ''
        });
      }
    }
    // —— Có tiếng đồn: thêm mới Lv3/4 ——
    const cpWindTopics = new Set((cp.winds || []).map(w => w.topic));
    for (const wind of (state.winds || [])) {
      if (!wind.level || wind.level < 3) continue;
      if (!cpWindTopics.has(wind.topic)) {
        changes.push({
          type: 'wind_new',
          topic: wind.topic,
          level: wind.level,
          content: wind.content || ''
        });
      }
    }

    if (changes.length === 0) {
      core.saveState(state);
      return;
    }

    // Dọn dẹp bộ nhớ định dạng cũ, xoá các bản ghi đã có trong cùng vòng (xử lý trùng roll ghi đè)
    state.memories = (state.memories || []).filter(m => {
      if (m.type !== 'ledger') return false;
      if (m.round === state.round) return false;
      return true;
    });

    state.memories.unshift({
      id: `ledger_${state.round}`,
      type: 'ledger',
      round: state.round,
      changes: changes
    });

    if (state.memories.length > MAX_LEDGER_ROUNDS) {
      state.memories.length = MAX_LEDGER_ROUNDS;
    }

    core.saveState(state);
    console.log(`[World Engine] sổ cái: Thứ${state.round}vòng ghi chép${changes.length}thay đổi`);
  }

  /** Xây dựng văn bản sổ cái dùng để tiêm */
  function buildLedgerText(state) {
    const entries = (state.memories || []).filter(m => m.type === 'ledger').reverse();
    if (!entries.length) return 'Tạm thời không có ghi chép sự kiện quan trọng';

    return entries.map(entry => {
      const lines = [`Thứ${entry.round}vòng (${entry.changes.length}thay đổi):`];
      for (const c of entry.changes) {
        if (c.type === 'event_new') {
          const tn = EVENT_TYPE_NAMES[c.eventType] || c.eventType;
          lines.push(`  [thêm mới Lv${c.level}${tn}chuỗi sự kiện] ${c.name} - ${c.stage} - ${c.desc}`);
        } else if (c.type === 'event_advance') {
          lines.push(`  [thúc đẩy chuỗi sự kiện] ${c.name}(Lv${c.level}) ${c.fromStage}->${c.toStage} - ${c.desc}`);
        } else if (c.type === 'event_terminal') {
          lines.push(`  [kết cục chuỗi sự kiện] ${c.name}(Lv${c.level}) ${c.fromStage ? c.fromStage + '->' : ''}${c.stage || c.toStage} - ${c.desc}`);
        } else if (c.type === 'wind_new') {
          lines.push(`  [thêm mới Lv${c.level}có tiếng đồn] ${c.topic} - ${c.content}`);
        }
      }
      return lines.join('\n');
    }).join('\n\n');
  }

  return { recordChanges, buildLedgerText };
})();
