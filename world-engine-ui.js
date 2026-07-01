// world-engine-ui.js — hoàn chỉnh UI bảng điều khiển
window.WORLD_ENGINE_UI = (function() {
  const core = window.WORLD_ENGINE_CORE;
  const evolution = window.WORLD_ENGINE_EVOLUTION;

  let panelElement = null;
  let panelBodyElement = null;
  let panelVisible = false;
  let isEvolving = false;
  let editingEvent = null;
  let editingFaction = null;
  let editingWind = null;
  let editingTrend = null;
  let editingEnemy = null;
  let editingInfluence = null;
  let editingRI = null;
  // Trạng thái thống nhất của trình chỉnh sửa bí mật:{ scope, list:'action'|'asset', index, view:'action'|'asset' }
  //   list  = Thùng hiện tại chứa mục;index = Chỉ số trong thùng đó
  //   view  = Loại biểu mẫu hiển thị hiện tại (chuyển dropdown chỉ đổi view，không đổi dữ liệu; việc chuyển đổi hoãn đến khi lưu)
  let editingSecret = null;
  let listPagerCounter = 0;
  const listPageState = {};
  const sectionCollapsed = { 'checkpoint-section': true, 'set-filter': true };
  const expandedWorldbookGroups = new Set();
  // Cache Worldbook (cấp module, xuyên suốt refresh() tồn tại)
  let _wbCachedEntries = null;
  let _wbCachedSelectedIds = null;
  let _wbCachedOverrides = null;
  let _wbCachedChatId = null;
  let _wbScrollTop = 0;

  function h(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[m] || m));
  }

  /** Render văn bản hiển thị cho người dùng: thay thế {{user}} thành tên nhân vật hiện tại, và escape HTML */
  function u(text) {
    return h(core.renderUserName(text));
  }

  function showToast(msg, isError, duration) {
    const id = 'we-toast';
    let el = document.getElementById(id);
    if (el) el.remove();
    el = document.createElement('div');
    el.id = id;
    el.className = 'we-toast' + (isError ? ' error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    if (duration !== 0) setTimeout(() => el.remove(), duration || 3000);
  }

  // Cổ văn đi kèm của các tiêu đề phụ từng trang (bỏ cp- tiền tố rồi tra bảng; trang cài đặt v.v. không có trong bảng thì không có)
  const SECTION_MOTTOS = {
    trends: 'Thế của thiên hạ, dần dần mà thành',
    regional: 'Một phương có biến, bốn bề đều kinh',
    ledger: 'Từng ly từng tí đều có lai lịch',
    events: 'Rút dây động rừng',
    winds: 'Gió nổi từ ngọn cỏ thanh bình',
    influence: 'Kéo cành động lá',
    reputation: 'Người có danh tiếng, như hình với bóng',
    factions: 'Dưới bóng cây lớn, cỏ không dính sương',
    enemies: 'Kẻ thù hả hê, người thân đau xót',
    economy: 'Cái ăn là gốc của dân, hàng hoá là vốn dùng của dân',
    blackbox: 'Tường có vách tai, giặc nấp bên cạnh'
  };

  function sectionHeader(title, sectionId) {
    const collapsed = sectionCollapsed[sectionId] || false;
    const motto = SECTION_MOTTOS[sectionId.replace(/^cp-/, '')];
    const mottoHtml = motto ? `<span class="we-section-motto">— ${motto}</span>` : '';
    return `<span class="we-section-toggle" data-section="${sectionId}">
      <span class="we-section-arrow" id="we-section-arrow-${sectionId}">${collapsed ? '▶' : '▼'}</span>${title}${mottoHtml}
    </span>`;
  }

  function sectionBody(sectionId, content) {
    const collapsed = sectionCollapsed[sectionId] || false;
    return `<div class="we-section-body" id="we-section-body-${sectionId}" style="${collapsed ? 'display:none' : ''}">${content}</div>`;
  }

  function buildPanel() {
    if (document.getElementById('we-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'we-panel';
    panel.innerHTML = `
      <div class="we-panel-header">
        <div class="we-header-info">
          <div class="we-header-top">
            <span class="we-panel-title">World Engine</span>
            <span class="we-panel-version" id="we-panel-version"></span><!-- [FIX] Số phiên bản -->
            <span class="we-header-round" id="we-header-round"></span>
          </div>
          <div class="we-header-mood" id="we-header-mood">
            <span class="we-header-dot"></span>
            <span class="we-header-mood-text"></span>
          </div>
        </div>
        <div class="we-panel-corner-actions">
          <button class="we-panel-close">✕</button>
          <button class="we-panel-settings" id="we-btn-settings-open" title="cài đặt"><i class="fa-solid fa-gear"></i></button>
        </div>
      </div>
      <div class="we-panel-body" id="we-panel-body">
        <div class="we-loading">đang tải...</div>
      </div>
    `;
    document.body.appendChild(panel);
    panelElement = panel;
    panelBodyElement = panel.querySelector('#we-panel-body');

    // [FIX] Hiển thị số phiên bản tiện ích mở rộng (từ manifest.json，không đọc được thì ẩn)
    const verEl = panel.querySelector('#we-panel-version');
    if (verEl) {
      const v = window.WORLD_ENGINE_VERSION;
      if (v) verEl.textContent = 'v' + v;
      else verEl.style.display = 'none';
    }

    panel.querySelector('.we-panel-close').onclick = () => hidePanel();
    initDrag(panel, panel.querySelector('.we-panel-header'));

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panelVisible) hidePanel();
    });
  }

  // Chế độ xem hiện tại:'home' | 'situation' | 'events' | 'relations' | 'resources' | 'settings'
  let _currentView = 'home';
  // Chế độ hiển thị:'mask'=Che khuất (trang chủ+phân trang) |'expand'=Mở rộng (tất cả section xếp lớp)
  function isExpandMode() {
    const s = window.WORLD_ENGINE_API
      ? window.WORLD_ENGINE_API.getSettings()
      : JSON.parse(window.WORLD_ENGINE_STORE.getItem('world_engine_settings') || '{}');
    return s.displayMode === 'expand';
  }
  // Điều hướng trang chủ: nhấp vào hàng đã chọn (nhấp lần nữa mới vào)
  let _selectedNavView = null;
  // Cờ đánh dấu đang suy diễn + Cơ sở hiển thị của lần suy diễn này:
  //   'checkpoint' = Suy diễn lại (feed điểm lưu B，Hiển thị bảng điều khiển B）
  //   'state'      = Suy diễn tới trước (feed trạng thái hiện tại A，Hiển thị bảng điều khiển A）
  // Trong lúc suy diễn kết quả mới chưa ghi lại, dựa vào hai cái này để quyết định bảng điều khiển hiển thị bản nào, đợi ghi lại rồi mới làm mới.
  let _evolving = false;
  let _evolvingScope = 'state';
  // Thùng trạng thái thực tế tiêm vào chính văn gần nhất; làm mới thông thường phải theo nó, không thể đoán lại theo tầng tức thời.
  let _injectedScope = null;

  /**
   * Tính toán bản trạng thái thế giới thực tế tiêm vào chính văn lúc này (cùng với world-engine.js
   * applyInjectionForCurrentRound dùng chung một điều kiện tầng để phán đoán):
   *   số tầng hội thoại < Số tầng trạng thái hiện tại và có điểm lưu → tiêm/hiển thị điểm lưu (reroll roll rollback)
   *   nếu không thì → tiêm/hiển thị trạng thái hiện tại
   * trả về scope đồng thời quyết định chỉnh sửa ghi lại vào bucket lưu trữ nào.
   */
  function getActiveInjected(state, checkpoint) {
    // đang suy diễn: kết quả mới chưa được ghi lại, hiển thị theo cơ sở của lần suy diễn này——
    //   suy diễn lại (_evolvingScope='checkpoint'）→ hiển thị điểm lưu B；
    //   suy diễn tới (_evolvingScope='state'）   → hiển thị trạng thái hiện tại A。
    if (_evolving) {
      if (_evolvingScope === 'checkpoint' && checkpoint) {
        return { state: checkpoint, scope: 'checkpoint', layer: getCheckpointLayer(checkpoint) };
      }
      return { state: state, scope: 'state', layer: Number.isFinite(Number(state.chatLayer)) ? Number(state.chatLayer) : getChatLayer() };
    }
    if (_injectedScope === 'checkpoint' && checkpoint) {
      return { state: checkpoint, scope: 'checkpoint', layer: getCheckpointLayer(checkpoint) };
    }
    if (_injectedScope === 'state') {
      return { state: state, scope: 'state', layer: Number.isFinite(Number(state.chatLayer)) ? Number(state.chatLayer) : getChatLayer() };
    }
    const chatLayer = core.getChatLayer();
    const stateLayer = Number.isFinite(Number(state.chatLayer)) ? Number(state.chatLayer) : chatLayer;
    if (chatLayer < stateLayer && checkpoint) {
      return { state: checkpoint, scope: 'checkpoint', layer: getCheckpointLayer(checkpoint) };
    }
    return { state: state, scope: 'state', layer: Number.isFinite(Number(state.chatLayer)) ? Number(state.chatLayer) : getChatLayer() };
  }

  // theo hiển thị hiện tại/đọc ghi bucket lưu trữ đã chỉnh sửa:scope==='checkpoint' đọc ghi điểm lưu, phần còn lại đọc ghi trạng thái chính.
  // bảng điều khiển có thể đang hiển thị điểm lưu (reroll roll rollback) hoặc phần điểm lưu của trang cài đặt, lúc này mọi chỉnh sửa phải
  // ghi lại vào điểm lưu thay vì trạng thái chính, nếu không thì“dữ liệu thay đổi, giao diện không đổi / nhấn không phản hồi”（lỗi cùng nguồn gốc với có tiếng đồn).
  function loadScopedState(scope) {
    return scope === 'checkpoint' ? core.restoreCheckpoint() : core.loadState();
  }
  function saveScopedState(scope, scopedState) {
    if (scope === 'checkpoint') core.saveCheckpoint(scopedState);
    else core.saveState(scopedState);
  }

  function refresh(auto) {
    if (!panelElement || !panelVisible) return;
    // trang cài đặt là form tĩnh, tự động làm mới dưới nền sẽ xoá nội dung đang nhập
    if (auto && _currentView === 'settings') return;
    const body = panelBodyElement;
    if (!body) return;
    listPagerCounter = 0;

    const state = core.loadState();
    const checkpoint = core.restoreCheckpoint();
    const cpLayer = getCheckpointLayer(checkpoint);
    const active = getActiveInjected(state, checkpoint);
    const s = active.state;

    const _wbListEl = document.getElementById('we-worldbook-list');
    if (_wbListEl) _wbScrollTop = _wbListEl.scrollTop;

    if (_currentView === 'home') {
      body.innerHTML = isExpandMode()
        ? renderHomeViewExpanded(s, active.layer, active.scope)
        : renderHomeView(s, active.layer, active.scope);
    } else if (_currentView === 'settings') {
      body.innerHTML = renderSettingsView(checkpoint, cpLayer);
    } else {
      body.innerHTML = renderSubView(_currentView, s, active.layer, active.scope);
    }

    updatePanelHeader(s, active.layer);
    bindEvents(state);
  }

  /**
   * độ ổn định thế giới (thuần UI tính toán thời gian thực, chỉ đọc, không ghi bản lưu/không vào prompt/không trả về API）
   * độ ổn định = clamp(100 - áp lực thế giới, 0, 100)
   */
  function computeWorldStability(state) {
    state = state || {};
    const round = Number(state.round) || 0;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // chuỗi sự kiện: chỉ Lv3/4，giới hạn đơn lẻ 60
    const CONFLICT_BASE = { manh nha:0, "ủ biến":1, "cận kề":2, "đã bùng phát":4, "đã tan biến":0 };
    const PROGRESS_BASE = { "chuẩn bị":0, "thực thi":1, then chốt/quan trọng:2, "đã hoàn thành":-2, "đã thất bại":0 };
    let eventP = 0;
    for (const e of (state.events || [])) {
      const level = Number(e.level) || 1;
      if (level < 3) continue;
      const isProgress = e.type === 'progress';
      const base = isProgress ? PROGRESS_BASE : CONFLICT_BASE;
      const keepTotal = 2 + level * 2;
      const remainFactor = () => {
        if (e._terminalSince === undefined) return 1;
        return clamp((keepTotal - (round - e._terminalSince)) / keepTotal, 0, 1);
      };
      let p;
      if (e.stage === 'đã bùng phát') p = 4 * level * 0.5 * remainFactor();
      else if (e.stage === 'đã hoàn thành') p = -2 * remainFactor();        // không nhân level
      else if (e.stage === 'đã tan biến' || e.stage === 'đã thất bại') p = 0;
      else p = (base[e.stage] || 0) * level * 0.5;
      if (e.stall) p *= 0.65;
      eventP += clamp(p, -60, 60);
    }

    // có tiếng đồn: chỉ Lv3/4，tổng giới hạn 25
    const WIND_BASE = { rumor:0.5, announcement:1, report:1.5, sentiment:2 };
    let windP = 0;
    for (const w of (state.winds || [])) {
      const level = Number(w.level) || 1;
      if (level < 3) continue;
      windP += (WIND_BASE[w.type] || 0) * level;
    }
    windP = Math.min(windP, 25);

    // đại thế thiên hạ: mỗi điều đang tiếp diễn +6，tổng giới hạn 20
    let trendP = 0;
    for (const t of (state.worldTrends || [])) if (t.status !== 'đã kết thúc') trendP += 6;
    trendP = Math.min(trendP, 20);

    // thế lực: giá trị quan hệ × hệ số trạng thái, tổng giới hạn 35
    const REL = { huyết minh:-1.5, "đồng minh":-1, "thân thiện":-0.5, "trung lập":0, "lạnh nhạt":0.5, "thù địch":1, "thù truyền kiếp":1.5 };
    const STAT = { "cực thịnh":1.25, "vững chắc":1, "chèn ép lẫn nhau":0.75, "khốn đốn":0.5, "suy tàn":0.25, "tan rã":0 };
    let factionP = 0;
    for (const f of (state.factions || [])) {
      const rel = REL[f.relation] !== undefined ? REL[f.relation] : 0;
      const st = STAT[f.status] !== undefined ? STAT[f.status] : 1;
      factionP += rel * st;
    }
    factionP = clamp(factionP, -35, 35);

    // Kinh tế: chỉ xem climate
    const CLIMATE = { "phồn vinh":-2, "ổn định":0, "suy thoái":1, "biến động":2 };
    const econP = CLIMATE[(state.economy || {}).climate] || 0;

    // Đột phát khu vực: kích hoạt +5
    const regionP = (state.regionalIncident && state.regionalIncident.active) ? 5 : 0;

    // Kẻ thù, "hộp đen": theo cài đặt không tính vào độ ổn định thế giới

    const pressure = eventP + windP + trendP + factionP + econP + regionP;
    const stability = Number(clamp(100 - pressure, 0, 100).toFixed(1));
    const tier =
      stability >= 90 ? 'Thiên hạ thái bình' :
      stability >= 70 ? 'Sóng ngầm cuộn trào' :
      stability >= 45 ? 'Cục diện căng thẳng' :
      stability >= 20 ? 'Biến động mất trật tự' : 'Bờ vực sụp đổ';

    const r1 = v => Number(v.toFixed(1));
    return {
      stability, tier, pressure: r1(pressure),
      breakdown: {
        "sự kiện": r1(eventP), "có tiếng đồn": r1(windP), "đại thế": r1(trendP), "thế lực": r1(factionP),
        kinh tế: r1(econP), "khu vực": r1(regionP)
      }
    };
  }

  const STABILITY_TIER_COLOR = {
    "Thiên hạ thái bình": '#69b68e', "Sóng ngầm cuộn trào": '#58b8a9', "Cục diện căng thẳng": '#d0aa58',
    "Biến động mất trật tự": '#d98a3d', "Bờ vực sụp đổ": '#ff0000'
  };

  // Mức độ ổn định → Chữ nhỏ ở đầu (thơ)
  const STABILITY_TIER_MOOD = {
    "Thiên hạ thái bình": 'Biển lặng không gợn sóng', "Sóng ngầm cuộn trào": 'Nước ngầm cuốn hoa trôi', "Cục diện căng thẳng": 'Mây cuộn gió thêm dữ',
    "Biến động mất trật tự": 'Càn khôn đầy thương tích', "Bờ vực sụp đổ": 'Trục đất nghiêng sắp gãy'
  };

  /** Làm mới phần đầu của 「Thứ X  vòng +  chữ nhỏ độ ổn định」 */
  function updatePanelHeader(state, layer) {
    const roundEl = document.getElementById('we-header-round');
    if (roundEl) {
      const layerText = (layer !== undefined && layer !== null && layer !== '-') ? ' · Thứ  ' + layer + '  tầng' : '';
      roundEl.textContent = 'Thứ  ' + ((state && state.round) || 0) + '  vòng' + layerText;
    }
    const moodEl = document.getElementById('we-header-mood');
    if (moodEl) {
      const stab = computeWorldStability(state || {});
      const color = STABILITY_TIER_COLOR[stab.tier] || '#58b8a9';
      const text = STABILITY_TIER_MOOD[stab.tier] || '';
      const dot = moodEl.querySelector('.we-header-dot');
      const txt = moodEl.querySelector('.we-header-mood-text');
      if (dot) { dot.style.background = color; dot.style.boxShadow = '0 0 6px ' + color; }
      if (txt) { txt.textContent = text; txt.style.color = color; }
    }
  }

  const VIEW_TITLES = {
    situation: 'cục diện', events: 'sự kiện', relations: 'quan hệ', resources: 'tài nguyên', settings: 'cài đặt'
  };

  function renderSection(title, id, content) {
    return '<div class="we-section" id="we-sec-' + id + '"><div class="we-section-title">' + sectionHeader(title, id) + '</div>' + sectionBody(id, content) + '</div>';
  }

  function renderHomeView(s, layer, scope) {
    const stab = computeWorldStability(s);
    const tierColor = STABILITY_TIER_COLOR[stab.tier] || '#58b8a9';

    const rows = [
      { view: 'situation', label: 'cục diện', sub: 'đại thế thiên hạ · sự kiện khu vực · sổ cái', poem: 'Thiên hạ vân tập hưởng ứng' },
      { view: 'events',    label: 'sự kiện', sub: 'chuỗi sự kiện · có tiếng đồn · chuỗi ảnh hưởng',     poem: 'Việc đến thì ứng phó' },
      { view: 'relations', label: 'quan hệ', sub: 'danh tiếng · thế lực · sổ kẻ thù',       poem: 'Đồng thanh tương ứng, đồng khí tương cầu' },
      { view: 'resources', label: 'tài nguyên', sub: 'kinh tế · Bí mật',               poem: 'Địa Tạng Vô Tận Tạng' },
    ];

    const navRows = rows.map((r, i) => {
      const topLine = i === 0 ? '<div class="we-nav-line we-nav-line-hidden"></div>' : '<div class="we-nav-line"></div>';
      const botLine = i === rows.length - 1 ? '<div class="we-nav-line we-nav-line-hidden"></div>' : '<div class="we-nav-line"></div>';
      const sel = _selectedNavView === r.view ? ' we-nav-row--selected' : '';
      return '<div class="we-nav-row' + sel + '" data-view="' + r.view + '">'
        + '<div class="we-nav-label">' + r.label + '</div>'
        + '<div class="we-nav-track">' + topLine + '<div class="we-nav-dot"></div>' + botLine + '</div>'
        + '<div class="we-nav-content"><span class="we-nav-sub">' + r.sub + '</span><span class="we-nav-poem">' + r.poem + '</span></div>'
        + '<i class="fa-solid fa-chevron-right we-nav-arrow"></i>'
        + '</div>';
    }).join('');

    return renderWorldCore(s)
      + '<div class="we-nav-list" style="--we-tier-color:' + tierColor + ';">' + navRows + '</div>'
      + '<div class="we-section" id="we-sec-digest"><div class="we-section-title">tóm tắt thế giới</div><div class="we-digest">' + u(s.worldDigest) + '</div></div>';
  }

  /** Trang chủ chế độ mở rộng: Cốt lõi thế giới + tóm tắt thế giới + Tất cả section Trải phẳng (như điểm lưu) */
  function renderHomeViewExpanded(s, layer, scope) {
    return renderWorldCore(s)
      + '<div class="we-section" id="we-sec-digest"><div class="we-section-title">tóm tắt thế giới</div><div class="we-digest">' + u(s.worldDigest) + '</div></div>'
      + renderSection('đại thế thiên hạ', 'trends', renderWorldTrends(s.worldTrends, scope))
      + renderSection('sự kiện khu vực', 'regional', renderRegionalIncident(s.regionalIncident, scope))
      + renderSection('chuỗi sự kiện', 'events', renderEventList(s.events, scope))
      + renderSection('có tiếng đồn', 'winds', renderWindList(s.winds, scope))
      + renderSection('chuỗi ảnh hưởng', 'influence', renderInfluenceChain(s.influenceChain, scope))
      + renderSection('danh tiếng', 'reputation', renderReputation(s.reputation, scope))
      + renderSection('thế lực', 'factions', renderFactionList(s.factions, scope))
      + renderSection('sổ kẻ thù', 'enemies', renderEnemies(s.enemies, scope))
      + renderSection('kinh tế', 'economy', renderEconomy(s.economy, scope))
      + renderSection('Bí mật', 'blackbox', renderBlackbox(s.blackbox, scope))
      + renderSection('Sổ cái sự kiện', 'ledger', renderLedger(s.memories));
  }

  function renderSubView(viewKey, s, layer, scope) {
    let content = '';
    if (viewKey === 'situation') {
      content = renderSection('đại thế thiên hạ', 'trends', renderWorldTrends(s.worldTrends, scope))
        + renderSection('sự kiện khu vực', 'regional', renderRegionalIncident(s.regionalIncident, scope))
        + renderSection('Sổ cái sự kiện', 'ledger', renderLedger(s.memories));
    } else if (viewKey === 'events') {
      content = renderSection('chuỗi sự kiện', 'events', renderEventList(s.events, scope))
        + renderSection('có tiếng đồn', 'winds', renderWindList(s.winds, scope))
        + renderSection('chuỗi ảnh hưởng', 'influence', renderInfluenceChain(s.influenceChain, scope));
    } else if (viewKey === 'relations') {
      content = renderSection('danh tiếng', 'reputation', renderReputation(s.reputation, scope))
        + renderSection('thế lực', 'factions', renderFactionList(s.factions, scope))
        + renderSection('sổ kẻ thù', 'enemies', renderEnemies(s.enemies, scope));
    } else if (viewKey === 'resources') {
      content = renderSection('kinh tế', 'economy', renderEconomy(s.economy, scope))
        + renderSection('Bí mật', 'blackbox', renderBlackbox(s.blackbox, scope));
    }
    return '<div class="we-sub-topbar">'
      + '<button class="we-icon-btn" id="we-btn-back" title="trả về"><i class="fa-solid fa-arrow-left"></i></button>'
      + '<span class="we-sub-title">' + (VIEW_TITLES[viewKey] || viewKey) + '</span>'
      + '</div>' + content;
  }

  /** Tiêu đề phụ điểm lưu: Chữ nhỏ mặc định màu lục lam + 「- N  vòng - M tầng」 */
  function checkpointTitle(checkpoint, cpLayer) {
    if (!checkpoint) return 'điểm lưu';
    const round = checkpoint.round || 0;
    const layer = (cpLayer === undefined || cpLayer === null) ? '-' : cpLayer;
    return 'điểm lưu - ' + round + '  vòng - ' + layer + '  tầng';
  }

  // Nhật ký cập nhật (dữ liệu thuần; tách rời với render. Khi phát hành phiên bản mới chỉ cần thêm một mục vào đầu mảng).
  //   version —— Văn bản nút thanh chọn phiên bản + và manifest Khớp tô sáng phiên bản hiện tại;
  //   date    —— Tuỳ chọn, ngày không chắc chắn thì để lại tháng/Năm;
  //   items   —— Mục thay đổi của phiên bản này (mỗi mục một dòng, khi render chạy qua h() escape).
  const CHANGELOG = [
    { version: '2.3.19', date: '2026-06-29', items: ['Sửa lỗi 「không reroll roll nhưng lại tiêm điểm lưu (trạng thái thế giới vòng trước)」:v2.3.18 Dùng giá trị thuần state.chatLayer===chatLayer phán đoán reroll roll，Nhưng Tavern GENERATION_STARTED ở tầng người dùng push vào chat **trước khi** emit——khi gửi tin nhắn vòng mới chatLayer vẫn == vòng trước state.chatLayer，bị phán đoán nhầm thành reroll roll、đã tiêm điểm lưu vòng trước (khi xếp chồng với plugin tạo kép như 「Thực Tâm Nhập Ma·Cơ sở dữ liệu」 thì vòng nào cũng xuất hiện). Hiện tại phán đoán reroll roll tiêu chí đổi sang dùng bản địa của Tavern type（GENERATION_STARTED của type=swipe/regenerate mới là reroll thật roll），không còn suy luận dựa trên giá trị số tầng nữa;dryRun（Khởi động của plugin loại cơ sở dữ liệu/tính là token tạo) đều bỏ qua, chấm dứt tình trạng 「tạo xong phần chính lại tiêm thêm một lần nữa」。', 'Tăng cường trình xem tự kiểm tra tiêm (chỉ đọc): 「Chuỗi tin nhắn thực tế gửi đi」 hiện tại mỗi một tin (system/user/assistant tất cả) đều có thể nhấp để mở rộng xem nội dung hoàn chỉnh, không chỉ hiển thị số chữ nữa; thuận tiện đối chiếu toàn bộ nội dung gửi cho mô hình lớn prompt。Gói chẩn đoán vẫn chỉ xuất role+độ dài (không bao gồm phần chính, tránh phình to dung lượng và rò rỉ ngữ cảnh trò chuyện).'] },
    { version: '2.3.18', date: '2026-06-29', items: ['Sửa lỗi reroll roll Lùi vòng suy diễn (tách rời reroll roll và redo）：suy diễn tự động đem 「reroll roll（cùng tầng swipe tạo lại)」 nhầm thành redo（khôi phục cơ sở từ điểm lưu và suy diễn lại)→ lại roll sau đó vòng suy diễn bị kẹt ở vòng điểm lưu thay vì vòng hiện tại. Hiện tại evolve lựa chọn cơ sở chia ba——forward（vòng mới/suy diễn từ hiện tại)/ redo（nút vệ tinh thủ công về điểm lưu)/ tự động thử lại roll（mode chưa truyền và không phải vòng mới→không khôi phục điểm lưu, trực tiếp ở hiện tại state suy diễn tiếp, vòng giữ nguyên vòng hiện tại).', 'Sửa lỗi reroll roll tiêm đi sai nhánh (tách rời tiêu chí tiêm và trình tự sự kiện):v2.3.17 của _pendingReroll cổng phụ thuộc Tavern swipe trình tự sự kiện, dễ bị GENERATION_ENDED xoá về 0 sớm / plugin tạo kép đụng cửa sổ → lại roll khi đó đã tiêm trạng thái vòng hiện tại thay vì điểm lưu. (Chú ý:v2.3.18 tiêu chí thuần số được thay thế có hồi quy mới, đã được v2.3.19 của type tiêu chí sửa chữa triệt để.)', 'xoá bỏ _pendingReroll cổng (v2.3.17 đưa vào, hiện hoàn toàn không cần thiết), code đơn giản hơn'] },
    { version: '2.3.17', date: '2026-06-28', items: ['sửa lỗi với plugin loại 「sẽ làm nhiễu tầng/tạo kép」 (như script trợ thủ Tavern loại cơ sở dữ liệu) khi xếp chồng thì việc tiêm trạng thái thế giới 「lúc được lúc không」: nguyên nhân gốc là v2.3.14 của 「cùng tầng lại roll không tiêm」 tiêu chí thủ vệ fingerprint==chatLayer quá khắt khe——fingerprint tại khoảnh khắc suy diễn bị ghim vào tầng hiện tại, vòng mới thứ①lần tạo (lần thực sự tạo ra chính văn cốt truyện) vừa bắt đầu, tầng người dùng mới chưa hạ cánh thì chatLayer vừa vặn vẫn == fingerprint，bị phán đoán nhầm thành reroll roll mà rút bỏ tiêm, dẫn đến chính văn thực sự không lấy được trạng thái thế giới. Hiện thêm cho thủ vệ 「thực swipe cổng」: chỉ khi thực sự nhận được nguyên bản của Tavern MESSAGE_SWIPED sau sự kiện (_pendingReroll=true）thủ vệ mới có tư cách kích hoạt, tạo mới thông thường không mang swipe sự kiện nên vẫn tiêm trạng thái hiện tại như thường; và khi kích hoạt đổi thành tiêm điểm lưu (trạng thái thế giới trước khi tạo ra chính văn tầng này) thay vì hoàn toàn không tiêm, bám sát hơn ý định ban đầu 「lại roll tiêm điểm lưu」 (không có điểm lưu mới lùi về không tiêm). Tiêu chí là sự kiện nguyên bản của Tavern, dùng chung cho mọi plugin, không chứa bất kỳ phán đoán đặc thù plugin nào'] },
    { version: '2.3.16', date: '2026-06-28', items: ['thêm mới 「tự kiểm tra tiêm」 (đỉnh thẻ gỡ lỗi, chỉ đọc): nhiều khách hàng phản hồi 「tiêm không thành công」 nhưng không có cách nào phán đoán——nguyên nhân gốc là registerInjection thành công chỉ đại diện cho 「gọi API Tavern không báo lỗi」, chưa bao giờ chứng minh trạng thái thế giới thực sự đã vào chính văn gửi cho LLM. Hiện đăng ký Tavern prompt sự kiện lắp ráp hoàn tất (bổ sung hội thoại chat_completion_prompt_ready / bổ sung văn bản generate_after_combine_prompts），đọc những gì Tavern thực sự ghép xong sau khi tiêm prompt chuỗi và theo role phân loại hiển thị, "dùng lời nói dễ hiểu phán đoán vòng này":✅đã vào chính văn / ❌đã đăng ký nhưng chưa vào chính văn(thực sự thất bại) / ⏸bỏ qua theo thiết kế(đã tắt tiêm hoặc cùng tầng lại roll) / —vẫn chưa tạo; thuần chỉ đọc, tách rời thành module độc lập, không đổi logic tiêm, không động eventData、Bỏ qua tính token vòng khởi động, không ảnh hưởng đến suy diễn; gói chẩn đoán đồng bộ thu thập thêm snapshot này'] },
    { version: '2.3.15', date: '2026-06-25', items: ['Sửa lỗi suy diễn tự động tê liệt trong im lặng:API Yêu cầu suy diễn không có timeout, nếu rơi vào hố đen mạng (proxy không phản hồi/upstream không trả về cũng không báo lỗi)fetch sẽ treo vĩnh viễn,evolution của _isRunning không bao giờ reset, sau đó tất cả GENERATION_ENDED suy diễn tự động được kích hoạt bị isRunning() thủ vệ bỏ qua trong im lặng, cho đến khi người dùng chuyển chat một lần mới mở khoá; nay thêm mới apiTimeoutMs（mặc định 120s，0=không timeout), timeout xử lý như suy diễn thất bại để finally reset bình thường và báo rõ lý do timeout trên dòng trạng thái (người dùng chủ động huỷ bỏ/chuyển chat vẫn đi theo đường cũ AbortError hiển thị 「đã huỷ bỏ」)'] },
    { version: '2.3.14', date: '2026-06-23', items: ['sửa lỗi redo số vòng tăng ảo: khi bấm nút vệ tinh 「thúc đẩy lại」 round vô điều kiện +1（tại isNew trước khi phán đoán) dẫn đến redo cũng tăng số vòng, không khớp với comment 「redo vòng không đổi」; nay round++ chuyển vào if(isNew)，chỉ forward / vòng mới tự động tăng', 'sửa lỗi redo thoái hoá im lặng không có điểm lưu: sau lần suy diễn đầu tiên không có checkpoint，điểm redo phiên bản cũ bỏ qua toàn bộ khối→thoái hoá không tiếng động thành 「tại hiện tại state đẩy lên」+ round++ giả của redo（tăng không một vòng không nhắc nhở); nay mode==="redo" và không có cp khi return false và báo lỗi 「không có điểm lưu, không thể thúc đẩy lại (redo）；vui lòng 『thúc đẩy về phía trước』 ít nhất một vòng trước」, không còn giả forward', 'Sửa lỗi reroll roll tiêm trạng thái thế giới cũ cùng tầng: reroll roll cùng tầng (chatLayer==stateLayer）phiên bản cũ đi else tiêm 「trạng thái hiện tại suy diễn dựa trên chính văn cũ」, can thiệp vào chính văn mới đang viết lại; nay applyInjectionForCurrentRound thêm nhánh 「cùng tầng đã suy diễn→không tiêm」, tiêu chí dùng fingerprint（chỉ cập nhật khi thực sự là vòng mới, so với chatLayer trung thực) khớp unregisterInjection，tránh chính văn mới bị trạng thái thế giới cũ làm lệch hướng', 'thêm mới công tắc tổng vệ tinh thứ tư 「phích cắm」 bên trái quả đất nhỏ (bóng nổi): tắt bằng một cú nhấp/bật suy diễn và tiêm (liên kết evolveMode + injectIntoPrompt hai trường cài đặt hiện có, không thêm mới trường; tắt=chuyển suy diễn thủ công+tắt tiêm, bật=chuyển sang suy diễn tự động+bật tiêm;manual chế độ có sẵn chặn pending autoEvolveTimer，không cần chú thích công tắc tổng bổ sung)'] },
    { version: '2.3.13', date: '2026-06-22', items: ['sửa lỗi deadlock suy diễn tự động: đã bật syncToChat chat rỗng (chưa từng suy diễn) lần đầu AI sau tầng, dòng trạng thái kẹt ở 「vòng 0/1 」không bao giờ tự động suy diễn', 'sửa lỗi tiền tố phiên bản tuỳ chỉnh như Volcengine (Ark) (/api/v3、/api/coding/v3）API không thể kéo mô hình:URL chuẩn hoá không còn nhét cứng /v1，tiền tố phiên bản do người dùng điền đầy đủ,URL thêm nhắc nhở định dạng bên cạnh ô', 'chatcache rào chắn đồng bộ đa thiết bị: đám mây thiếu checkpoint/fingerprint khi không theo exact xoá điểm neo cục bộ, tránh rơi vào deadlock lần nữa'] },
    { version: '2.3.12', date: '2026-06-22', items: ['thêm mới tab 「về」: tích hợp nhật ký cập nhật, có thể chọn phiên bản từ dropdown để xem các thay đổi trước đây', 'lọc regex 「chế độ đơn giản」: tick chọn thẻ tự động tạo regex xoá'] },
    { version: '2.3.11', date: '2026-06-22', items: ['lọc regex hỗ trợ /pattern/flags cách viết, xác thực khi lưu, thêm mới nút kiểm thử'] },
    { version: '2.3.10', date: '2026-06-21', items: ['sửa lỗi code review hệ thống preset engine (hiệu suất và giật lag)', 'gói chẩn đoán thu thập bổ sung hệ thống preset và prompt phân đoạn'] },
    { version: '2.3.9',  date: '2026-06',    items: ['hệ thống preset engine: suy diễn prompt đoạn hardcode có thể chỉnh sửa, có thể lưu, có thể chuyển đổi'] },
    { version: '2.3.8',  date: '2026-06',    items: ['suy diễn Prompt hiển thị phân đoạn hoàn toàn minh bạch (chỉ đọc)'] },
    { version: '2.3.7',  date: '2026-06',    items: ['thêm mới cách kết nối 「qua proxy của Tavern」, bỏ qua bên thứ ba API của CORS'] },
    { version: '2.3.6',  date: '2026-06',    items: ['trang cài đặt dạng tab'] },
    { version: '2.3.5',  date: '2026-06',    items: ['xuất gói chẩn đoán 1 click'] },
    { version: '2.3.4',  date: '2026-06',    items: ['hiển thị số phiên bản extension bên cạnh tiêu đề bảng điều khiển'] },
    { version: '2.2.0',  date: '2026',       items: ['cache & bản lưu Tavern: đồng bộ đa thiết bị + bản lưu chống mất mát'] }
  ];

  // [FIX] định nghĩa tab:label + bao gồm những đoạn nào. chỉ phân loại hiện có section，không thêm mới/không xoá tính năng.
  const SETTINGS_TABS = [
    { key: 'common',    label: 'thường dùng' },
    { key: 'advanced',  label: 'nâng cao' },
    { key: 'archive',   label: 'bản lưu' },
    { key: 'worldbook', label: 'Worldbook' },
    { key: 'debug',     label: 'gỡ lỗi' },
    { key: 'about',     label: 'về' }
  ];
  let _settingsTab = 'common';

  function renderSettingsView(checkpoint, cpLayer) {
    const cpContent = checkpoint
      ? renderCheckpointSections(checkpoint, cpLayer)
      : '<div class="we-empty">tạm thời không có điểm lưu</div>';
    const form = renderSettingsForm();              // {api,evolve,backfill,filter,display,chatcache,inject}
    const extra = renderSettingsAfterCheckpoint();  // {worldbook,data,tone}

    // điểm lưu section（giữ nguyên, chuyển vào tab 「bản lưu」)
    const checkpointSection = '<div class="we-section" style="margin-top:16px;"><div class="we-section-title">'
      + sectionHeader(checkpointTitle(checkpoint, cpLayer), 'checkpoint-section') + '</div>'
      + sectionBody('checkpoint-section', cpContent) + '</div>';

    // gỡ lỗi section（giữ nguyên, gồm nút gói chẩn đoán + renderDebug，chuyển vào tab 「gỡ lỗi」)
    const debugSection = '<div class="we-section we-debug-section">'
      + '<div class="we-section-title"><span class="we-debug-toggle" title="mở rộng hoặc thu gọn thông tin gỡ lỗi"><span class="we-toggle-arrow">▶</span>gỡ lỗi</span></div>'
      + '<div id="we-debug-body" style="display:none;">'
      + '<button class="we-btn" id="we-export-diag" style="width:100%;margin-bottom:8px;">xuất gói chẩn đoán</button><!-- [FIX] gói chẩn đoán: không liên quan đến việc đã suy diễn hay chưa, luôn có thể xuất -->'
      + '<div id="we-debug-render">' + renderDebug() + '</div>'
      // [MAP] Quản lý preset engine: Cùng với PR#12 hiển thị phân đoạn chỉ đọc ở cùng thẻ gỡ lỗi, đưa 4 đoạn hardcode nâng cấp thành có thể chỉnh sửa+preset hoá.
      // Điểm neo độc lập #we-preset-manage，làm mới cục bộ; lưu theo độc lập storage key，không vào we-save-settings。
      + '<div class="we-preset-section">'
      + '<div class="we-section-title">Preset engine (suy diễn có thể chỉnh sửa prompt đoạn)</div>'
      + '<div id="we-preset-manage">' + renderPresetManage() + '</div>'
      + '</div>'
      + '</div></div>';

    // Các đoạn được chứa trong từng thẻ (mỗi đoạn section xuất hiện đúng một lần, không trùng lặp)
    const panelContent = {
      common:    form.api + form.evolve + form.inject,
      advanced:  form.backfill + form.filter + form.display + extra.tone,
      archive:   form.chatcache + extra.data + checkpointSection,
      worldbook: extra.worldbook,
      debug:     debugSection,
      about:     renderAbout()
    };

    const tabBar = '<div class="we-settings-tabs">'
      + SETTINGS_TABS.map(t =>
          '<button class="we-settings-tab' + (t.key === _settingsTab ? ' we-settings-tab--active' : '')
          + '" data-tab="' + t.key + '">' + t.label + '</button>').join('')
      + '</div>';

    const panels = SETTINGS_TABS.map(t =>
      '<div class="we-settings-panel" data-tab="' + t.key + '"'
      + (t.key === _settingsTab ? '' : ' style="display:none;"') + '>'
      + (panelContent[t.key] || '') + '</div>').join('');

    return '<div class="we-sub-topbar">'
      + '<button class="we-icon-btn" id="we-btn-back" title="trả về"><i class="fa-solid fa-arrow-left"></i></button>'
      + '<span class="we-sub-title">cài đặt</span>'
      + '</div>'
      + tabBar
      + panels
      // Lưu/Đặt lại: Thường trú ở dưới cùng (sticky），bất kỳ thẻ nào cũng có thể lưu toàn bộ cài đặt bằng một cú nhấp chuột
      + '<div class="we-settings-save-actions we-settings-save-sticky">'
      + '<button class="we-btn" id="we-save-settings">Lưu cài đặt</button>'
      + '<button class="we-btn we-btn-danger" id="we-reset-world">Đặt lại thế giới</button>'
      + '</div>';
  }

  // 「Thẻ "Giới thiệu": Logo phiên bản hiện tại + Nhật ký cập nhật (chọn phiên bản từ menu thả xuống + mỗi phiên bản có bảng điều khiển độc lập, thuần CSS chuyển đổi hiển thị/ẩn).
  //   Dữ liệu từ CHANGELOG hằng số (tách rời với render); menu thả xuống phiên bản tái sử dụng #we-preset-select mô hình——
  //   nhấp để bật lên danh sách có thể cuộn gốc, dù có bao nhiêu phiên bản cũng không làm vỡ bố cục. Mặc định chọn mục đầu tiên (phiên bản mới nhất).
  function renderAbout() {
    if (!CHANGELOG.length) return '<div class="we-empty">Tạm thời chưa có nhật ký cập nhật</div>';
    const cur = window.WORLD_ENGINE_VERSION;
    const curBadge = cur ? '<span class="we-changelog-cur">Phiên bản hiện tại v' + h(cur) + '</span>' : '';

    const optHtml = CHANGELOG.map(function (c, i) {
      const label = 'v' + c.version + (c.date ? '（' + c.date + '）' : '');
      return '<option value="' + h(c.version) + '"' + (i === 0 ? ' selected' : '') + '>' + h(label) + '</option>';
    }).join('');
    const verBar = '<div class="we-changelog-row">'
      + '<label class="we-changelog-row-label">Xem phiên bản</label>'
      + '<select id="we-changelog-select" class="we-changelog-select">' + optHtml + '</select>'
      + '</div>';

    const panels = CHANGELOG.map(function (c, i) {
      const head = '<div class="we-changelog-head">v' + h(c.version)
        + (c.date ? ' <span class="we-changelog-date">' + h(c.date) + '</span>' : '') + '</div>';
      const items = '<ul class="we-changelog-items">'
        + (c.items || []).map(function (it) { return '<li>' + h(it) + '</li>'; }).join('')
        + '</ul>';
      return '<div class="we-changelog-panel" data-ver="' + h(c.version) + '"'
        + (i === 0 ? '' : ' style="display:none;"') + '>' + head + items + '</div>';
    }).join('');

    return '<div class="we-section">'
      + '<div class="we-changelog-top">' + curBadge + '</div>'
      + verBar
      + panels
      + '</div>';
  }

  function renderCheckpointSections(s, layer) {
    return renderSection('đại thế thiên hạ', 'cp-trends', renderWorldTrends(s.worldTrends, 'checkpoint'))
      + renderSection('chuỗi sự kiện', 'cp-events', renderEventList(s.events, 'checkpoint'))
      + renderSection('thế lực', 'cp-factions', renderFactionList(s.factions, 'checkpoint'))
      + renderSection('có tiếng đồn', 'cp-winds', renderWindList(s.winds, 'checkpoint'))
      + renderSection('danh tiếng', 'cp-reputation', renderReputation(s.reputation, 'checkpoint'))
      + renderSection('kinh tế', 'cp-economy', renderEconomy(s.economy, 'checkpoint'))
      + renderSection('sổ kẻ thù', 'cp-enemies', renderEnemies(s.enemies, 'checkpoint'))
      + renderSection('chuỗi ảnh hưởng', 'cp-influence', renderInfluenceChain(s.influenceChain, 'checkpoint'))
      + renderSection('sự kiện khu vực', 'cp-regional', renderRegionalIncident(s.regionalIncident, 'checkpoint'))
      + renderSection('Bí mật', 'cp-blackbox', renderBlackbox(s.blackbox, 'checkpoint'))
      + renderSection('Sổ cái sự kiện', 'cp-ledger', renderLedger(s.memories));
  }

  /** Lõi thế giới: Đồng hồ đo độ ổn định hình vòng + Bốn ô đếm then chốt */
  function renderWorldCore(s) {
    const stab = computeWorldStability(s);
    const tierColor = STABILITY_TIER_COLOR[stab.tier] || '#58b8a9';
    const detail = Object.entries(stab.breakdown)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('　') || 'Không có nguồn áp lực';

    const R = 66, C = 2 * Math.PI * R;
    const pct = Math.max(0, Math.min(1, stab.stability / 100));
    const dash = (pct * C).toFixed(1);
    const theta = (pct * 360 - 90) * Math.PI / 180;       // Bắt đầu từ phía trên cùng, theo chiều kim đồng hồ
    const dotX = (80 + R * Math.cos(theta)).toFixed(1);
    const dotY = (80 + R * Math.sin(theta)).toFixed(1);
    const dashNum = Number(dash);

    function arcPoint(angleDeg) {
      const rad = angleDeg * Math.PI / 180;
      return {
        x: 80 + R * Math.cos(rad),
        y: 80 + R * Math.sin(rad)
      };
    }

    function arcPath(startDeg, endDeg) {
      const a = arcPoint(startDeg);
      const b = arcPoint(endDeg);
      const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
      return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }

    const tailDeg = Math.min(36, pct * 360);
    const tailSegs = 36;
    let tailGlow = '';

    for (let i = 0; i < tailSegs; i++) {
      const t1 = i / tailSegs;
      const t2 = (i + 1) / tailSegs;

      const startDeg = -90 + pct * 360 - tailDeg + t1 * tailDeg;
      const endDeg = -90 + pct * 360 - tailDeg + t2 * tailDeg;

      const alpha = Math.pow(t2, 2.2) * 0.72;

      tailGlow += `
        <path d="${arcPath(startDeg, endDeg)}"
          fill="none"
          stroke="#ffffff"
          stroke-width="6"
          stroke-linecap="butt"
          opacity="${alpha.toFixed(3)}"/>
      `;
    }

    const stats = [
      ['sự kiện', (s.events || []).length],
      ['thế lực', (s.factions || []).length],
      ['có tiếng đồn', (s.winds || []).length],
      ['đại thế', (s.worldTrends || []).length],
    ].map(([k, v]) => `<div class="we-core-stat"><div class="we-core-stat-k">${k}</div><div class="we-core-stat-v">${v}</div></div>`).join('');

    return `
      <div class="we-section we-core-section">
        <div class="we-core" title="Áp lực từ các nguồn (chỉ Lv3/4 tính vào):${detail}　|　Áp lực ${stab.pressure}">
          <div class="we-core-ring">
            <svg viewBox="0 0 160 160" width="160" height="160">
              <defs>
                <filter id="weCoreDotGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="3.2"/>
                </filter>
              </defs>

              <circle cx="80" cy="80" r="${R}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>

              <circle cx="80" cy="80" r="${R}" fill="none" stroke="${tierColor}" stroke-width="6"
                stroke-linecap="round"
                stroke-dasharray="${dash} ${(C - pct * C).toFixed(1)}"
                transform="rotate(-90 80 80)"/>

              ${tailGlow}

              <circle class="we-core-dot-glow" cx="${dotX}" cy="${dotY}" r="8" fill="#ffffff" opacity="0.14" filter="url(#weCoreDotGlow)"/>
              <circle cx="${dotX}" cy="${dotY}" r="4.6" fill="#e8fffb" opacity="0.70"/>
              <circle class="we-core-dot-core" cx="${dotX}" cy="${dotY}" r="2.5" fill="#ffffff" opacity="0.95"/>
            </svg>
            <div class="we-core-center">
              <div class="we-core-title">Lõi thế giới</div>
              <div class="we-core-sub">độ ổn định</div>
              <div class="we-core-pct" style="color:${tierColor};">${stab.stability.toFixed(1)}<span>%</span></div>
              <div class="we-core-tier" style="color:${tierColor};">${stab.tier}</div>
            </div>
          </div>
          <div class="we-core-stats">${stats}</div>
        </div>
      </div>`;
  }

  /** Lấy số tầng hội thoại của điểm lưu */
  function getCheckpointLayer(cp) {
    if (!cp) return '-';
    return Number.isFinite(Number(cp.chatLayer)) ? Number(cp.chatLayer) : '-';
  }

  function renderPagedList(items, key, renderItem, perPage = 4) {
    const rid = `we-list-${key}-${++listPagerCounter}`;
    const totalPages = Math.ceil(items.length / perPage);
    const currentPage = Math.min(totalPages, Math.max(1, listPageState[rid] || 1));
    listPageState[rid] = currentPage;
    const pager = totalPages > 1
      ? `<div class="we-list-pager">
          <span class="we-list-arrow" data-rid="${rid}" data-dir="-1">◀</span>
          <span class="we-list-page"><span class="we-list-cur">${currentPage}</span>/${totalPages}</span>
          <span class="we-list-arrow" data-rid="${rid}" data-dir="1">▶</span>
        </div>`
      : '';
    return pager + `<div class="we-paged-list" data-rid="${rid}">` + items.map((item, index) => {
      const page = Math.floor(index / perPage) + 1;
      return `<div class="we-page-item" data-page="${page}" style="${page !== currentPage ? 'display:none;' : ''}">${renderItem(item, index)}</div>`;
    }).join('') + '</div>';
  }

  function renderEventList(events, scope) {
    if (!events || !events.length) return '<div class="we-empty">Tạm thời chưa có chuỗi sự kiện</div>';
    const curRound = (core.loadState() || {}).round || 0;
    return renderPagedList(events, 'events-' + scope, (e, eventIndex) => {
      const stageColors = {
        manh nha:'#d6b85a',
        "ủ biến":'#d98a3d',
        "cận kề":'#cf5f3f',
        "đã bùng phát":'#b93f3f',
        "đã tan biến":'#888888',
        "chuẩn bị":'#7de9d9',
        "thực thi":'#58e8b3',
        then chốt/quan trọng:'#2a8a5d',
        "đã hoàn thành":'#1b5e3b',
        "đã thất bại":'#888888',
        "Đình trệ":'#6688aa'
      };
      const levelColors = {
        1: '#c0c0c0',
        2: '#f2f2f2',
        3: '#c9a45c',
        4: '#df7cff'
      };
      const color = stageColors[e.stage] || '#888';
      const levelColor = levelColors[e.level] || '#9aa6b2';
      let extras = '';
      const terminalStages = e.type === 'progress' ? ['đã hoàn thành', 'đã thất bại'] : ['đã bùng phát', 'đã tan biến'];
      const isTerminal = terminalStages.includes(e.stage);
      if (e.consecutiveFails > 0 && !isTerminal) {
        const maxFails = e.type === 'progress' ? 2 + (e.level || 1) : 6 - (e.level || 1);
        extras += ` <span class="we-badge" style="background:#6662;color:#888;">${e.consecutiveFails}/${maxFails}</span>`;
      }
      if (e.stall && !isTerminal) {
        extras += ' <span class="we-badge" style="background:#6688aa22;color:#6688aa;">Đình trệ</span>';
      }
      let metaExtra = '';
      if (e.evolveResult && !isTerminal) {
        const resultColors = { 'thành công':'#7a9a7a', 'giữ nguyên':'#b8a070', 'thất bại/chùn bước':'#c46a6a' };
        const color = resultColors[e.evolveResult] || '#888';
        metaExtra = ` <span class="we-badge" style="background:${color}22;color:${color};">${e.evolveResult}</span>`;
      }
      // Thanh tiến trình giai đoạn
      let progressHtml = '';
      if (!isTerminal) {
        const pct = Math.round((e.stageRound / 9) * 100);

        const progressMotionClass = {
          'thành công': 'we-event-progress-success',
          'giữ nguyên': 'we-event-progress-hold',
          'thất bại/chùn bước': 'we-event-progress-fail'
        }[e.evolveResult] || '';

        progressHtml = `<div class="we-event-progress ${progressMotionClass}">
          <div style="width:${pct}%;background:${color};"></div>
        </div>`;
      }
      const typeName = e.type === 'progress' ? 'loại thúc đẩy' : 'loại xung đột';
      const typeColor = e.type === 'progress' ? '#57b7a8' : '#cf5f3f';
      // Logo đếm ngược kết cục chính diện (đã bùng phát/đã hoàn thành, giữ lại 2+level*2 vòng sau tự động xoá)
      let countdownHtml = '';
      const POSITIVE_TERMINALS = ['đã bùng phát', 'đã hoàn thành'];
      if (POSITIVE_TERMINALS.includes(e.stage) && e._terminalSince !== undefined) {
        const keepRounds = 2 + (e.level || 1) * 2;
        const left = keepRounds - (curRound - e._terminalSince) + 1;
        if (left >= 1) {
          const cdColor = e.stage === 'đã hoàn thành' ? '#58e8b3' : '#e07465';
          countdownHtml = ` <span class="we-badge we-event-countdown" style="color:${cdColor};" title="Sự kiện này ở ${left} vòng sau tự động xoá"><i class="fa-regular fa-clock"></i>Còn lại${left} vòng</span>`;
        }
      }
      const terminalStamp = {
        "đã hoàn thành": { text: 'hoàn thành', color: '#58e8b3' },
        "đã bùng phát": { text: 'bùng phát', color: '#e07465' },
        "đã tan biến": { text: 'tan biến', color: '#a6a6ad' },
        "đã thất bại": { text: 'thất bại', color: '#c08aaa' }
      }[e.stage];
      const isEditing = editingEvent?.scope === scope && editingEvent?.index === eventIndex;
      // màu sắc làm CSS biến được truyền xuống, viền/màu nền/hiệu ứng ánh sáng hoàn toàn do lớp style xử lý (không còn inline thanh màu bên trái)
      const itemStyle = `--event-accent:${color};--event-type:${typeColor};--event-level:${levelColor};`;
      const stageClassMap = {
        manh nha: 'we-stage-sprout', "ủ biến": 'we-stage-ferment', "cận kề": 'we-stage-loom',
        "đã bùng phát": 'we-stage-erupt', "đã tan biến": 'we-stage-fade',
        "đã hoàn thành": 'we-stage-done', "đã thất bại": 'we-stage-failed',
      };
      const stageClass = stageClassMap[e.stage] || '';
      const itemClass = (isTerminal ? 'we-event-item we-event-item-terminal' : 'we-event-item') + (stageClass ? ' ' + stageClass : '');
      const metaStyle = isTerminal
        ? 'style="color:var(--we-text2);"'
        : '';
      const stageBadge = isTerminal ? '' : ` <span class="we-badge" style="background:${color}22;color:${color};">${e.stage}</span>`;
      const metaText = isTerminal
        ? (e.desc ? u(e.desc) : '')
        : `${e.stageRound||1}/9 ${e.desc ? '— '+u(e.desc) : ''}${metaExtra}`;
      const stampHtml = isTerminal && terminalStamp
        ? `<div class="we-event-stamp" style="border-color:${terminalStamp.color};color:${terminalStamp.color};">${terminalStamp.text}</div>`
        : '';
      const actionHtml = isEditing ? '' : `
        <div class="we-event-actions">
          <button class="we-icon-btn we-event-delete" data-event-scope="${scope}" data-event-index="${eventIndex}" title="xoá sự kiện"><i class="fa-solid fa-trash-can"></i></button>
          <button class="we-icon-btn we-event-copy" data-event-scope="${scope}" data-event-index="${eventIndex}" title="sao chép sự kiện"><i class="fa-solid fa-copy"></i></button>
          <button class="we-icon-btn we-event-edit" data-event-scope="${scope}" data-event-index="${eventIndex}" title="sửa đổi sự kiện"><i class="fa-solid fa-pen"></i></button>
        </div>`;
      const editHtml = isEditing ? renderEventEditor(e, scope, eventIndex) : '';
      return `<div class="${itemClass}" style="${itemStyle}">
        ${stampHtml}
        <div class="we-event-name"><span style="color:${levelColor};">${u(e.name)}</span> <span class="we-badge" style="background:${levelColor}22;color:${levelColor};">Lv.${e.level||'?'}</span> <span class="we-badge" style="background:${typeColor}22;color:${typeColor};">${typeName}</span>${countdownHtml}${stageBadge}${extras}</div>
        ${metaText ? `<div class="we-event-meta" ${metaStyle}>${metaText}</div>` : ''}
        ${editHtml}
        ${actionHtml}
        ${progressHtml}
      </div>`;
    });
  }

  function renderEventEditor(event, scope, eventIndex) {
    const stages = event.type === 'progress'
      ? ['chuẩn bị', 'thực thi', 'then chốt/quan trọng', 'đã hoàn thành', 'đã thất bại']
      : ['manh nha', 'ủ biến', 'cận kề', 'đã bùng phát', 'đã tan biến'];
    const levelOptions = [1, 2, 3, 4].map(level =>
      `<option value="${level}" ${Number(event.level) === level ? 'selected' : ''}>Lv.${level}</option>`
    ).join('');
    const typeOptions = [
      ['conflict', 'loại xung đột'],
      ['progress', 'loại thúc đẩy']
    ].map(([type, label]) =>
      `<option value="${type}" ${event.type === type ? 'selected' : ''}>${label}</option>`
    ).join('');
    const stageOptions = stages.map(stage =>
      `<option value="${stage}" ${event.stage === stage ? 'selected' : ''}>${stage}</option>`
    ).join('');

    // Đếm ngược kết cục tích cực: giá trị mặc định lấy phần còn lại hiện tại, sự kiện không phải kết cục thì để trống
    const POSITIVE_TERMINALS = ['đã bùng phát', 'đã hoàn thành'];
    const keepRounds = 2 + (Number(event.level) || 1) * 2;
    let leftValue = '';
    if (POSITIVE_TERMINALS.includes(event.stage)) {
      const curRound = (core.loadState() || {}).round || 0;
      const left = event._terminalSince !== undefined
        ? keepRounds - (curRound - event._terminalSince) + 1
        : keepRounds;
      leftValue = Math.min(keepRounds, Math.max(1, left));
    }

    return `
      <div class="we-event-editor" data-event-scope="${scope}" data-event-index="${eventIndex}">
        <button class="we-event-editor-close" title="huỷ sửa đổi"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label class="we-event-editor-wide">tên sự kiện<input class="we-event-edit-name" type="text" value="${u(event.name || '')}"></label>
          <label>cấp độ<select class="we-event-edit-level">${levelOptions}</select></label>
          <label>loại<select class="we-event-edit-type">${typeOptions}</select></label>
          <label>giai đoạn<select class="we-event-edit-stage">${stageOptions}</select></label>
          <label>tiến độ giai đoạn<input class="we-event-edit-round" type="number" min="1" max="9" value="${event.stageRound || 1}"></label>
          <label title="chỉ kết cục tích cực (đã bùng phát/đã hoàn thành) có hiệu lực, đến hạn tự động xoá; không phải kết cục thì để trống">số vòng còn lại<input class="we-event-edit-left" type="number" min="1" placeholder="chuyên dùng cho kết cục" value="${leftValue}"></label>
          <label class="we-event-editor-wide">mô tả<textarea class="we-event-edit-desc" rows="3">${u(event.desc || '')}</textarea></label>
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-event-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function renderFactionList(factions, scope) {
    if (!factions || !factions.length) return '<div class="we-empty">tạm thời không có thế lực</div>';
    return renderPagedList(factions, 'factions', (f, factionIndex) => {
      const relationColors = {
        huyết minh:'#2563eb', "đồng minh":'#0ea5e9', "thân thiện":'#06b6d4', "trung lập":'#94a3b8',
        "lạnh nhạt":'#f59e0b', "căng thẳng":'#f59e0b', "thù địch":'#ef4444', "thù truyền kiếp":'#991b1b'
      };
      const statusColors = { "cực thịnh":'#d0aa58', "vững chắc":'#69b68e', "chèn ép lẫn nhau":'#cf5f3f', "khốn đốn":'#70a8d2', "suy tàn":'#a6a6ad', "tan rã":'#888888' };
      const relColor = relationColors[f.relation] || '#888';
      const stColor = statusColors[f.status] || '#888';

      const isEditing = editingFaction && editingFaction.scope === scope && editingFaction.index === factionIndex;

      let pillarsHtml = '';
      if (f.powerPillars && f.powerPillars.length) {
        pillarsHtml = '<div class="we-faction-meta">trụ cột quyền lực: ' + f.powerPillars.map(p => '<span class="we-pillar-tag">' + u(p) + '</span>').join('') + '</div>';
      }

      const actionHtml = isEditing ? '' : `
        <div class="we-event-actions">
          <button class="we-icon-btn we-faction-delete" data-faction-scope="${scope}" data-faction-index="${factionIndex}" title="xoá thế lực"><i class="fa-solid fa-trash-can"></i></button>
          <button class="we-icon-btn we-faction-copy" data-faction-scope="${scope}" data-faction-index="${factionIndex}" title="sao chép thế lực"><i class="fa-solid fa-copy"></i></button>
          <button class="we-icon-btn we-faction-edit" data-faction-scope="${scope}" data-faction-index="${factionIndex}" title="chỉnh sửa thế lực"><i class="fa-solid fa-pen"></i></button>
        </div>`;
      const editHtml = isEditing ? renderFactionEditor(f, factionIndex, scope) : '';

      return `<div class="we-faction-item">
        <div class="we-faction-name">${u(f.name)}</div>
        <div class="we-faction-tags">
          <span class="we-tag" style="border-color:${stColor};color:${stColor};">${f.status||'vững chắc'}</span>
          <span class="we-tag" style="border-color:${relColor};color:${relColor};">${f.relation||'trung lập'}</span>
          ${f.scope ? '<span class="we-tag">' + u(f.scope) + '</span>' : ''}
        </div>
        ${f.currentGoal ? `<div class="we-faction-goal">${u(f.currentGoal)}</div>` : ''}
        ${f.core_person ? `<div class="we-faction-meta">nhân vật trọng yếu: ${u(f.core_person)}</div>` : ''}
        ${pillarsHtml}
        ${actionHtml}
        ${editHtml}
      </div>`;
    });
  }

  function renderFactionEditor(f, index, scope) {
    const statusOptions = ['cực thịnh','vững chắc','chèn ép lẫn nhau','khốn đốn','suy tàn','tan rã'].map(s =>
      `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('');
    const relationOptions = ['huyết minh','đồng minh','thân thiện','trung lập','lạnh nhạt','thù địch','thù truyền kiếp'].map(r =>
      `<option value="${r}" ${f.relation === r ? 'selected' : ''}>${r}</option>`).join('');
    const pillars = [];
    for (let i = 0; i < 3; i++) pillars.push(f.powerPillars?.[i] || '');

    return `
      <div class="we-event-editor" data-faction-scope="${scope}" data-faction-index="${index}">
        <button class="we-event-editor-close we-faction-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label class="we-event-editor-wide">tên thế lực<input class="we-faction-edit-name" type="text" value="${u(f.name||'')}"></label>
          <label>vận thế<select class="we-faction-edit-status">${statusOptions}</select></label>
          <label>quan hệ<select class="we-faction-edit-relation">${relationOptions}</select></label>
          <label>phạm vi<input class="we-faction-edit-scope" type="text" value="${u(f.scope||'')}"></label>
          <label>mục tiêu<input class="we-faction-edit-goal" type="text" value="${u(f.currentGoal||'')}"></label>
          <label>nhân vật trọng yếu<input class="we-faction-edit-core" type="text" value="${u(f.core_person||'')}"></label>
          ${[0,1,2].map(i => `<label>trụ cột quyền lực${i+1}<input class="we-faction-edit-pillar" data-pillar-idx="${i}" type="text" value="${u(pillars[i])}" maxlength="4" placeholder="tối đa 4 chữ"></label>`).join('')}
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-faction-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function renderWorldTrends(trends, scope) {
    if (!trends || !trends.length) return '<div class="we-empty">tạm thời không có đại thế thiên hạ</div>';
    return renderPagedList(trends, 'world-trends', (trend, trendIndex) => {
      const ended = trend.status === 'đã kết thúc';
      const color = ended ? '#888888' : '#c9a45c';
      const isEditing = editingTrend?.scope === scope && editingTrend?.index === trendIndex;
      const actionHtml = isEditing ? '' : `
        <div class="we-event-actions">
          <button class="we-icon-btn we-trend-delete" data-trend-scope="${scope}" data-trend-index="${trendIndex}" title="xoá đại thế thiên hạ"><i class="fa-solid fa-trash-can"></i></button>
          <button class="we-icon-btn we-trend-copy" data-trend-scope="${scope}" data-trend-index="${trendIndex}" title="sao chép đại thế thiên hạ"><i class="fa-solid fa-copy"></i></button>
          <button class="we-icon-btn we-trend-edit" data-trend-scope="${scope}" data-trend-index="${trendIndex}" title="chỉnh sửa đại thế thiên hạ"><i class="fa-solid fa-pen"></i></button>
        </div>`;
      const editHtml = isEditing ? renderTrendEditor(trend, scope, trendIndex) : '';
      return `<div class="we-trend-item${ended ? ' we-trend-ended' : ''}" style="border-left-color:${color};">
        ${actionHtml}
        <div class="we-trend-header">
          <span class="we-trend-name">${u(trend.name)}</span>
          <span class="we-badge" style="background:${color}22;color:${color};">${u(trend.status || 'đang tiếp diễn')}</span>
        </div>
        <div class="we-trend-scope">${u(trend.scope || 'thiên hạ')}</div>
        <div class="we-trend-description">${u(trend.description || '?')}</div>
        <div class="we-trend-source"><span>nguồn</span>${u(trend.source || '?')}</div>
        ${editHtml}
      </div>`;
    });
  }

  function renderTrendEditor(trend, scope, index) {
    const statusOptions = ['đang tiếp diễn', 'đã kết thúc'].map(s =>
      `<option value="${s}" ${trend.status === s ? 'selected' : ''}>${s}</option>`).join('');
    return `
      <div class="we-event-editor" data-trend-scope="${scope}" data-trend-index="${index}">
        <button class="we-event-editor-close we-trend-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label class="we-event-editor-wide">tên đại thế<input class="we-trend-edit-name" type="text" value="${u(trend.name||'')}"></label>
          <label>trạng thái<select class="we-trend-edit-status">${statusOptions}</select></label>
          <label>phạm vi<input class="we-trend-edit-scope" type="text" value="${u(trend.scope||'')}"></label>
          <label>nguồn<input class="we-trend-edit-source" type="text" value="${u(trend.source||'')}"></label>
          <label class="we-event-editor-wide">mô tả<textarea class="we-trend-edit-desc" rows="3">${u(trend.description||'')}</textarea></label>
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-trend-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function renderWindList(winds, scope) {
    if (!winds || !winds.length) return '<div class="we-empty">tạm thời không có tiếng đồn</div>';
    const typeNames = { announcement:'thông báo', report:'thông báo/tin nhắn', rumor:'tin đồn', sentiment:'dư luận' };
    const typeColors = { announcement:'#c94b4b', report:'#4a8ab5', rumor:'#9178a0', sentiment:'#c17a35' };
    return renderPagedList(winds, 'winds', (w, windIndex) => {
      const typeColor = typeColors[w.type] || '#888';
      // Huy hiệu cấp độ:Lv1/2 Xám trung tính,Lv3/4 Lấy màu gốc của loại (thống nhất phối màu với 4 trạng thái của có tiếng đồn)
      const levelColor = (w.level >= 3) ? typeColor : (w.level === 2 ? '#7a828c' : '#5a6270');
      const isEditing = editingWind && editingWind.scope === scope && editingWind.index === windIndex;

      const actionHtml = isEditing ? '' : `
        <div class="we-event-actions">
          <button class="we-icon-btn we-wind-delete" data-wind-scope="${scope}" data-wind-index="${windIndex}" title="Xoá có tiếng đồn"><i class="fa-solid fa-trash-can"></i></button>
          <button class="we-icon-btn we-wind-copy" data-wind-scope="${scope}" data-wind-index="${windIndex}" title="Sao chép có tiếng đồn"><i class="fa-solid fa-copy"></i></button>
          <button class="we-icon-btn we-wind-edit" data-wind-scope="${scope}" data-wind-index="${windIndex}" title="Chỉnh sửa có tiếng đồn"><i class="fa-solid fa-pen"></i></button>
        </div>`;
      const editHtml = isEditing ? renderWindEditor(w, windIndex, scope) : '';

      const windTypeClass = { announcement:'we-wind-announcement', report:'we-wind-report', rumor:'we-wind-rumor', sentiment:'we-wind-sentiment' }[w.type] || '';
      const windLvClass = 'we-wind-lv' + (w.level || 1);
      let html = '<div class="we-wind-item ' + windTypeClass + ' ' + windLvClass + '" style="--wind-accent:' + typeColor + ';--wind-level-color:' + levelColor + ';">';
      // Lv4 Yếu tố trang trí độc quyền: Vòng xung kích kép thông báo / Gợn sóng nhiều vòng tiêu điểm kép tin đồn
      if (w.level === 4) {
        if (w.type === 'announcement') {
          html += '<span class="we-wind-ring"></span><span class="we-wind-ring we-wind-ring2"></span>';
        } else if (w.type === 'rumor') {
          html += '<span class="we-wind-rp we-rp-a1"></span><span class="we-wind-rp we-rp-a2"></span><span class="we-wind-rp we-rp-a3"></span><span class="we-wind-rp we-rp-b1"></span><span class="we-wind-rp we-rp-b2"></span>';
        }
      }
      html += '<div class="we-wind-header">';
      html += '<span class="we-wind-topic">' + u(w.topic || 'Có tiếng đồn chưa đặt tên') + '</span>';
      html += '<span class="we-badge" style="background:' + typeColor + '22;color:' + typeColor + ';">' + (typeNames[w.type] || 'có tiếng đồn') + '</span>';
      html += '<span class="we-badge" style="background:' + levelColor + '22;color:' + levelColor + ';">Lv.' + (w.level || 1) + '</span>';
      html += '</div>';
      html += '<div class="we-wind-field we-wind-content"><span class="we-wind-label">Nội dung</span><span>' + u(w.content || '?') + '</span></div>';
      html += '<div class="we-wind-field"><span class="we-wind-label">phạm vi</span><span>' + u(w.scope || '?') + '</span></div>';
      html += '<div class="we-wind-field"><span class="we-wind-label">nguồn</span><span>' + u(w.source || '?') + '</span></div>';
      html += editHtml;
      html += actionHtml;
      html += '</div>';
      return html;
    });
  }

  function renderWindEditor(w, index, scope) {
    const typeOptions = [['announcement','thông báo'],['report','thông báo/tin nhắn'],['rumor','tin đồn'],['sentiment','dư luận']].map(([v,label]) =>
      `<option value="${v}" ${w.type === v ? 'selected' : ''}>${label}</option>`).join('');
    const levelOptions = [1,2,3,4].map(l =>
      `<option value="${l}" ${w.level === l ? 'selected' : ''}>Lv.${l}</option>`).join('');

    return `
      <div class="we-event-editor" data-wind-index="${index}" data-wind-scope="${scope}">
        <button class="we-event-editor-close we-wind-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label class="we-event-editor-wide">Chủ đề<input class="we-wind-edit-topic" type="text" value="${u(w.topic||'')}"></label>
          <label>loại<select class="we-wind-edit-type">${typeOptions}</select></label>
          <label>cấp độ<select class="we-wind-edit-level">${levelOptions}</select></label>
          <label>phạm vi<input class="we-wind-edit-scope" type="text" value="${u(w.scope||'')}"></label>
          <label>nguồn<input class="we-wind-edit-source" type="text" value="${u(w.source||'')}"></label>
          <label class="we-event-editor-wide">Nội dung<textarea class="we-wind-edit-content" rows="3">${u(w.content||'')}</textarea></label>
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-wind-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function renderReputation(rep, scope) {
    if (!rep) return '<div class="we-empty">Tạm thời không có dữ liệu danh tiếng</div>';
    const levels = ['trời giận người oán','tai tiếng khắp nơi','vô danh','được kính trọng','được vạn người ngưỡng mộ'];
    const levelColors = { 'trời giận người oán':'#e05555', 'tai tiếng khắp nơi':'#d97a5a', 'vô danh':'#7a8a9a', 'được kính trọng':'#6cae8e', 'được vạn người ngưỡng mộ':'#c9a45c' };
    const legacyMap = { 'có chút danh tiếng':'được kính trọng' };
    const dimLabels = { authority:'triều đình', common:'thị tứ', shadow:'giang hồ', circuit:'đồng đạo' };
    // Các chiều × Cổ văn đính kèm các cấp độ (lược bỏ xuất xứ)
    const quotes = {
      authority: { 'trời giận người oán':'Trên dưới ghét như kẻ thù', 'tai tiếng khắp nơi':'Người tại vị đều nói về cái ác của hắn', 'vô danh':'Chìm trong hạ liêu không ai biết', 'được kính trọng':'Quần thần không ai không kính sợ', 'được vạn người ngưỡng mộ':'Thiên hạ mong ngóng phong thái' },
      common:    { 'trời giận người oán':'Người đi đường chỉ trỏ răn đe nhau', 'tai tiếng khắp nơi':'Kẻ vô lại trong làng cũng lấy làm xấu hổ', 'vô danh':'Ra vào chợ búa không ai nhận ra', 'được kính trọng':'Hàng xóm gọi là bậc trưởng giả', 'được vạn người ngưỡng mộ':'Trẻ con kẻ hầu đều biết tên' },
      shadow:    { 'trời giận người oán':'Lục lâm cũng không chịu nhận', 'tai tiếng khắp nơi':'Hào kiệt nghe mà khinh bỉ', 'vô danh':'Lẫn lộn cùng ngư tiều không ai hỏi', 'được kính trọng':'Hào kiệt giang hồ phần nhiều quy phục', 'được vạn người ngưỡng mộ':'Trong bốn biển đều xưng là hiệp' },
      circuit:   { 'trời giận người oán':'Đồng bối xấu hổ khi làm bạn', 'tai tiếng khắp nơi':'Bạn bè mắng thẳng mặt cái sai', 'vô danh':'Độc hành không ai nói chuyện cùng', 'được kính trọng':'Đồng môn tôn làm lãnh tụ', 'được vạn người ngưỡng mộ':'Bọn ta nhìn lên như Thái Sơn' }
    };
    return '<div class="we-rep-grid">' + Object.entries(rep).filter(([k]) => k !== 'lastChange').map(([key, rawVal]) => {
      const val = legacyMap[rawVal] || rawVal;
      const cn = dimLabels[key] || key;
      const idx = levels.indexOf(val);
      const color = levelColors[val] || '#888';
      const quote = (quotes[key] && quotes[key][val]) || '';
      const dotsHtml = levels.map((l, i) => {
        const active = i <= idx ? ' we-rep-dot-active' : '';
        const dotColor = i <= idx ? color : '#444';
        return `<span class="we-rep-dot${active}" style="background:${dotColor};" data-rep-scope="${scope || 'state'}" data-dim="${key}" data-level="${l}" title="${l}"></span>`;
      }).join('');
      return `<div class="we-rep-row">
        <span class="we-rep-dim">${cn}</span>
        <div class="we-rep-dots">${dotsHtml}</div>
        <span class="we-rep-quote" style="color:${color}">${quote}</span>
      </div>`;
    }).join('') + '</div>';
  }

  function renderEconomy(econ, scope) {
    if (!econ) return '<div class="we-empty">Tạm thời không có dữ liệu kinh tế</div>';
    const sc = scope || 'state';
    const climates = ['phồn vinh','ổn định','suy thoái','biến động'];
    const climateColors = { 'phồn vinh': '#3ecf8e', 'ổn định': '#7a8a9a', 'suy thoái': '#d9a34a', 'biến động': '#e05555' };
    const climateBg = { 'phồn vinh': 'rgba(62,207,142,0.08)', 'ổn định': 'rgba(122,138,154,0.06)', 'suy thoái': 'rgba(217,163,74,0.08)', 'biến động': 'rgba(224,85,85,0.08)' };
    const climate = econ.climate || 'ổn định';
    const cColor = climateColors[climate] || '#7a8a9a';
    let html = '<div class="we-climate-bar" style="background:' + (climateBg[climate]||'rgba(122,138,154,0.06)') + ';">';
    html += '<span class="we-climate-dot" style="background:' + cColor + ';box-shadow:0 0 8px ' + cColor + '88;"></span>';
    html += '<span class="we-climate-label" style="color:' + cColor + '">' + climate + '</span>';
    html += '<div class="we-climate-btns">';
    for (const c of climates) {
      html += '<span class="we-climate-btn' + (c === climate ? ' we-climate-btn-on' : '') + '" style="' + (c === climate ? ('color:'+(climateColors[c]||'#7a8a9a')+';border-color:'+(climateColors[c]||'#7a8a9a')) : '') + '" data-climate-scope="' + sc + '" data-climate="' + c + '">' + c + '</span>';
    }
    html += '</div></div>';
    if (econ.signals?.length) {
      html += renderPagedList(econ.signals, 'economy-signals', (s, i) =>
        '<div class="we-signal-item" data-sig-scope="' + sc + '">' +
        '<span class="we-signal-summary">' + u(s.summary||s) + '</span>' +
        '<span class="we-signal-scope">' + u(s.scope||'?') + '</span>' +
        '<span class="we-signal-del" data-sig-scope="' + sc + '" data-sigidx="' + i + '" title="Xoá tín hiệu">✕</span>' +
        '</div>'
      );
    } else {
      html += '<div class="we-empty" style="margin-top:4px;">Tạm thời không có tín hiệu thị trường</div>';
    }
    html += '<div class="we-signal-add" data-sig-scope="' + sc + '"><i class="fa-solid fa-plus"></i> Thêm tín hiệu</div>';
    return html;
  }

  function renderEnemies(enemiesList, scope) {
    if (!enemiesList || !enemiesList.length) return '<div class="we-empty">Tạm thời không có kẻ thù</div>';
    return renderPagedList(enemiesList, 'enemies', (en, enemyIndex) => {
      const isEditing = editingEnemy?.scope === scope && editingEnemy?.index === enemyIndex;
      const actionHtml = isEditing ? '' : `
        <div class="we-event-actions">
          <button class="we-icon-btn we-enemy-delete" data-enemy-scope="${scope}" data-enemy-index="${enemyIndex}" title="Xoá kẻ thù"><i class="fa-solid fa-trash-can"></i></button>
          <button class="we-icon-btn we-enemy-copy" data-enemy-scope="${scope}" data-enemy-index="${enemyIndex}" title="Sao chép kẻ thù"><i class="fa-solid fa-copy"></i></button>
          <button class="we-icon-btn we-enemy-edit" data-enemy-scope="${scope}" data-enemy-index="${enemyIndex}" title="Chỉnh sửa kẻ thù"><i class="fa-solid fa-pen"></i></button>
        </div>`;
      const editHtml = isEditing ? renderEnemyEditor(en, enemyIndex, scope) : '';
      return `<div class="we-blood-item">
        ${actionHtml}
        <div class="we-blood-title">${u(en.name)} <span class="we-badge we-badge-danger">${en.status||'Đang theo dõi'}</span><span class="we-badge" style="background:var(--we-purple);font-size:10px;">${en.type==='blood'?'huyết cừu':'Ân oán'}</span></div>
        <div class="we-blood-meta">lý do: ${u(en.reason||'?')}</div>
        ${editHtml}
      </div>`;
    });
  }

  function renderEnemyEditor(en, index, scope) {
    const typeOptions = [['blood','huyết cừu'],['grudge','Ân oán']].map(([v,label]) =>
      `<option value="${v}" ${en.type === v ? 'selected' : ''}>${label}</option>`).join('');
    const statusOptions = ['Đang theo dõi','Đang lên kế hoạch','Đang thực thi','Đã kết thúc'].map(s =>
      `<option value="${s}" ${en.status === s ? 'selected' : ''}>${s}</option>`).join('');
    return `
      <div class="we-event-editor" data-enemy-scope="${scope}" data-enemy-index="${index}">
        <button class="we-event-editor-close we-enemy-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label class="we-event-editor-wide">Tên kẻ thù<input class="we-enemy-edit-name" type="text" value="${u(en.name||'')}"></label>
          <label>loại<select class="we-enemy-edit-type">${typeOptions}</select></label>
          <label>trạng thái<select class="we-enemy-edit-status">${statusOptions}</select></label>
          <label class="we-event-editor-wide">lý do<textarea class="we-enemy-edit-reason" rows="2">${u(en.reason||'')}</textarea></label>
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-enemy-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function renderInfluenceChain(chain, scope) {
    if (!chain || !chain.length) return '<div class="we-empty">Tạm thời không có chuỗi ảnh hưởng</div>';
    return renderPagedList(chain, 'influence', (item, infIndex) => {
      const isEditing = editingInfluence?.scope === scope && editingInfluence?.index === infIndex;
      const actionHtml = isEditing ? '' : `
        <div class="we-event-actions">
          <button class="we-icon-btn we-influence-delete" data-influence-scope="${scope}" data-influence-index="${infIndex}" title="Xoá chuỗi ảnh hưởng"><i class="fa-solid fa-trash-can"></i></button>
          <button class="we-icon-btn we-influence-copy" data-influence-scope="${scope}" data-influence-index="${infIndex}" title="Sao chép chuỗi ảnh hưởng"><i class="fa-solid fa-copy"></i></button>
          <button class="we-icon-btn we-influence-edit" data-influence-scope="${scope}" data-influence-index="${infIndex}" title="Chỉnh sửa chuỗi ảnh hưởng"><i class="fa-solid fa-pen"></i></button>
        </div>`;
      const editHtml = isEditing ? renderInfluenceEditor(item, infIndex, scope) : '';
      return `<div class="we-influence-item">
        ${actionHtml}
        <div class="we-influence-step we-influence-trigger">
          <span class="we-influence-label">Nguồn kích hoạt</span>
          <span class="we-influence-text">${u(item.trigger)}</span>
        </div>
        <div class="we-influence-step we-influence-impact">
          <span class="we-influence-label">Ảnh hưởng trực tiếp</span>
          <span class="we-influence-text">${u(item.impact)}</span>
        </div>
        ${item.fallout ? `<div class="we-influence-step we-influence-fallout">
          <span class="we-influence-label">Dư âm tiếp theo</span>
          <span class="we-influence-text">${u(item.fallout)}</span>
        </div>` : ''}
        ${editHtml}
      </div>`;
    });
  }

  function renderInfluenceEditor(item, index, scope) {
    return `
      <div class="we-event-editor" data-influence-index="${index}" data-influence-scope="${scope}">
        <button class="we-event-editor-close we-influence-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label class="we-event-editor-wide">Nguồn kích hoạt<textarea class="we-influence-edit-trigger" rows="2">${u(item.trigger||'')}</textarea></label>
          <label class="we-event-editor-wide">Ảnh hưởng trực tiếp<textarea class="we-influence-edit-impact" rows="2">${u(item.impact||'')}</textarea></label>
          <label class="we-event-editor-wide">Dư âm tiếp theo<textarea class="we-influence-edit-fallout" rows="2">${u(item.fallout||'')}</textarea></label>
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-influence-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function getRegionalIncidentTypeLabel(type) {
    const labels = {
      banditry: 'cướp bóc',
      fire: 'hoả hoạn',
      massacre: 'án mạng nghiêm trọng',
      flood: 'lũ lụt',
      infrastructure: 'đường sá thuỷ lợi sụp đổ',
      plague: 'dịch bệnh',
      famine: 'nạn đói thiếu lương',
      riot: 'bạo loạn',
      rebellion: 'dân biến nổi loạn',
      military: 'Quân vụ đột biến',
      earthquake: 'Động đất lở núi',
      storm: 'Bão tuyết',
      other: 'Khác'
    };
    return labels[type] || 'Khác';
  }

  function renderRegionalIncident(ri, scope) {
    if (!ri) return '<div class="we-empty">Chưa tiến hành phán định sự kiện khu vực</div>';
    const isEditing = editingRI?.active === true && editingRI?.scope === scope;
    const actionHtml = isEditing ? '' : `
      <div class="we-event-actions">
        <button class="we-icon-btn we-ri-delete" data-ri-scope="${scope}" title="Xoá sự kiện khu vực"><i class="fa-solid fa-trash-can"></i></button>
        <button class="we-icon-btn we-ri-copy" data-ri-scope="${scope}" title="Sao chép sự kiện khu vực"><i class="fa-solid fa-copy"></i></button>
        <button class="we-icon-btn we-ri-edit" data-ri-scope="${scope}" title="Chỉnh sửa sự kiện khu vực"><i class="fa-solid fa-pen"></i></button>
      </div>`;
    const editHtml = isEditing ? renderRIEditor(ri, scope) : '';

    if (ri.active) {
      return `<div class="we-accident-item we-regional-incident-item we-accident-triggered">
        ${actionHtml}
        ${u(ri.title)}<br>
        <span style="font-size:11px;color:var(--we-text3);">loại: ${u(getRegionalIncidentTypeLabel(ri.type))} | phạm vi: ${u(ri.scope||'?')} | Còn lại: ${ri.duration||0} vòng</span><br>
        <span style="font-size:11px;color:var(--we-text2);">${u(ri.impact||'')}</span>
        ${editHtml}
      </div>`;
    }
    if (ri.title && ri.title.includes('thử lại')) {
      return `<div class="we-accident-item we-regional-incident-item" style="border-left:3px solid var(--we-gold);">
        ${actionHtml}
        ${u(ri.title)}（loại: ${u(getRegionalIncidentTypeLabel(ri.type))}）
        ${editHtml}
      </div>`;
    }
    if (ri.cooldown > 0) {
      return `<div class="we-accident-item we-regional-incident-item">${actionHtml}Vòng này không có sự kiện khu vực (thời gian hồi còn lại ${ri.cooldown} vòng)${editHtml}</div>`;
    }
    return `<div class="we-accident-item we-regional-incident-item">${actionHtml}Vòng này không có sự kiện khu vực${editHtml}</div>`;
  }

  function renderRIEditor(ri, scope) {
    const types = ['banditry','fire','massacre','flood','infrastructure','plague','famine','riot','rebellion','military','earthquake','storm'];
    if (ri.type && !types.includes(ri.type)) types.push(ri.type);
    const typeOptions = types.map(t =>
      `<option value="${t}" ${ri.type === t ? 'selected' : ''}>${u(getRegionalIncidentTypeLabel(t))}</option>`).join('');
    return `
      <div class="we-event-editor" data-ri-edit="1" data-ri-scope="${scope}">
        <button class="we-event-editor-close we-ri-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">
          <label>trạng thái<select class="we-ri-edit-active">
            <option value="true" ${ri.active ? 'selected' : ''}>Kích hoạt và hiển thị sự kiện</option>
            <option value="false" ${!ri.active ? 'selected' : ''}>Chưa kích hoạt</option>
          </select></label>
          <label class="we-event-editor-wide">tiêu đề<input class="we-ri-edit-title" type="text" value="${u(ri.title||'')}"></label>
          <label>loại<select class="we-ri-edit-type">${typeOptions}</select></label>
          <label>phạm vi<input class="we-ri-edit-scope" type="text" value="${u(ri.scope||'')}"></label>
          <label>số vòng còn lại<input class="we-ri-edit-duration" type="number" min="0" max="99" value="${ri.duration||0}"></label>
          <label>Thời gian hồi<input class="we-ri-edit-cooldown" type="number" min="0" max="99" value="${ri.cooldown||0}"></label>
          <label class="we-event-editor-wide">Ảnh hưởng<textarea class="we-ri-edit-impact" rows="3">${u(ri.impact||'')}</textarea></label>
        </div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-ri-editor-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  const SECRET_STATUS_COLOR = { 'hợp lệ': 'var(--we-green)', 'Hết hạn': 'var(--we-text3)', 'Bộc lộ': 'var(--we-red)', 'Hết hiệu lực': 'var(--we-text3)' };

  function isEditingSecret(scope, list, index) {
    return editingSecret && editingSecret.scope === scope && editingSecret.list === list && editingSecret.index === index;
  }

  function renderBlackbox(blackbox, scope) {
    if (!blackbox) return '<div class="we-empty">Tạm thời không có thông tin hộp đen</div>';
    let html = '';
    const actions = blackbox.secretActions || [];
    const assets = blackbox.secretAssets || [];

    if (actions.length) {
      html += '<div class="we-secret-group-label we-secret-action">hành vi bí mật</div>';
      html += renderPagedList(actions, 'secret-actions', (raw, idx) => {
        const a = (typeof raw === 'string') ? { action: raw } : raw;
        if (isEditingSecret(scope, 'action', idx)) return renderSecretEditor(a, 'action', idx, scope);
        return `<div class="we-secret-card we-secret-action">
          <div class="we-secret-ops">
            <button class="we-icon-btn we-secret-edit" data-secret-scope="${scope}" data-secret-list="action" data-secret-index="${idx}" title="Chỉnh sửa"><i class="fa-solid fa-pen"></i></button>
            <button class="we-icon-btn we-secret-copy" data-secret-scope="${scope}" data-secret-list="action" data-secret-index="${idx}" title="Sao chép"><i class="fa-solid fa-copy"></i></button>
            <button class="we-icon-btn we-secret-del" data-secret-scope="${scope}" data-secret-list="action" data-secret-index="${idx}" title="xoá"><i class="fa-solid fa-trash-can"></i></button>
          </div>
          <div class="we-secret-body">
            <div class="we-secret-title">${u(a.action || 'hành vi chưa đặt tên')}</div>
            <div class="we-secret-meta">người biết chuyện · ${u(a.witnesses || 'không')}</div>
          </div>
        </div>`;
      });
    }

    if (assets.length) {
      html += '<div class="we-secret-group-label we-secret-asset">tài sản bí mật</div>';
      html += renderPagedList(assets, 'secret-assets', (raw, idx) => {
        const a = (typeof raw === 'string') ? { name: raw } : raw;
        if (isEditingSecret(scope, 'asset', idx)) return renderSecretEditor(a, 'asset', idx, scope);
        const expo = Math.min(100, Math.max(0, Number(a.exposure) || 0));
        const status = a.status || 'hợp lệ';
        const stColor = SECRET_STATUS_COLOR[status] || 'var(--we-text3)';
        return `<div class="we-secret-card we-secret-asset">
          <div class="we-secret-ops">
            <button class="we-icon-btn we-secret-edit" data-secret-scope="${scope}" data-secret-list="asset" data-secret-index="${idx}" title="Chỉnh sửa"><i class="fa-solid fa-pen"></i></button>
            <button class="we-icon-btn we-secret-copy" data-secret-scope="${scope}" data-secret-list="asset" data-secret-index="${idx}" title="Sao chép"><i class="fa-solid fa-copy"></i></button>
            <button class="we-icon-btn we-secret-del" data-secret-scope="${scope}" data-secret-list="asset" data-secret-index="${idx}" title="xoá"><i class="fa-solid fa-trash-can"></i></button>
          </div>
          <div class="we-secret-body">
            <div class="we-secret-title">${u(a.name || 'tài sản chưa đặt tên')}<span class="we-secret-status" style="color:${stColor};border-color:${stColor};">${u(status)}</span></div>
            <div class="we-secret-expo">
              <div class="we-secret-expo-track"><div class="we-secret-expo-fill" style="width:${expo}%;"></div></div>
              <span class="we-secret-expo-num">Bộc lộ ${expo}%</span>
            </div>
          </div>
        </div>`;
      });
    }

    if (!html) html = '<div class="we-empty">không có thông tin mặt tối</div>';
    return html;
  }

  /** Trình chỉnh sửa thống nhất bí mật: Dropdown 「loại」 ở trên cùng chỉ chuyển đổi biểu mẫu(view)，chuyển đổi trì hoãn đến khi lưu mới ghi ra đĩa */
  function renderSecretEditor(a, list, index, scope, view) {
    view = view || (editingSecret && editingSecret.view) || list;
    const typeSelect = `<label>loại<select class="we-secret-type">
        <option value="action" ${view === 'action' ? 'selected' : ''}>hành vi bí mật</option>
        <option value="asset" ${view === 'asset' ? 'selected' : ''}>tài sản bí mật</option>
      </select></label>`;
    // Điền trước xuyên suốt các loại: hành vi↔tài sản trường tiêu đề liên thông (action.action ↔ asset.name）
    const titleText = u(a.action || a.name || '');
    let fields;
    if (view === 'action') {
      fields = `${typeSelect}
        <label class="we-event-editor-wide">mô tả hành vi<textarea class="we-secret-f-action" rows="2">${titleText}</textarea></label>
        <label class="we-event-editor-wide">nhân chứng<input class="we-secret-f-witnesses" type="text" value="${u(a.witnesses || 'không')}"></label>`;
    } else {
      const statusOptions = ['hợp lệ','Hết hạn','Bộc lộ','Hết hiệu lực'].map(s =>
        `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('');
      fields = `${typeSelect}
        <label class="we-event-editor-wide">tên tài sản<input class="we-secret-f-name" type="text" value="${titleText}"></label>
        <label>mức độ lộ diện<input class="we-secret-f-exposure" type="number" min="0" max="100" value="${Number(a.exposure) || 0}"></label>
        <label>trạng thái<select class="we-secret-f-status">${statusOptions}</select></label>`;
    }
    return `
      <div class="we-event-editor we-secret-editor" data-secret-scope="${scope}" data-secret-list="${list}" data-secret-index="${index}" data-secret-view="${view}">
        <button class="we-event-editor-close we-secret-editor-close"><i class="fa-solid fa-xmark"></i></button>
        <div class="we-event-editor-grid">${fields}</div>
        <div class="we-event-editor-footer">
          <button class="we-btn we-btn-primary we-secret-save"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
        </div>
      </div>`;
  }

  function renderLedger(memories) {
    const entries = (memories || []).filter(m => m.type === 'ledger').reverse();
    if (!entries.length) return '<div class="we-empty">tạm thời không có ghi chép sự kiện trọng đại</div>';
    return renderPagedList(entries, 'ledger', entry => {
      const lines = [];
      for (const c of (entry.changes || [])) {
        if (c.type === 'event_new') {
          const tn = { conflict: 'loại xung đột', progress: 'loại thúc đẩy' }[c.eventType] || c.eventType;
          lines.push(`[thêm mới Lv${c.level}${tn}] ${u(c.name)} - ${u(c.stage)} - ${u(c.desc||'')}`);
        } else if (c.type === 'event_advance') {
          lines.push(`[thúc đẩy] ${u(c.name)}(Lv${c.level}) ${u(c.fromStage)}->${u(c.toStage)} - ${u(c.desc||'')}`);
        } else if (c.type === 'event_terminal') {
          const transition = c.fromStage ? `${u(c.fromStage)}->${u(c.stage||c.toStage)}` : u(c.stage||c.toStage);
          lines.push(`[chung cuộc] ${u(c.name)}(Lv${c.level}) ${transition} - ${u(c.desc||'')}`);
        } else if (c.type === 'wind_new') {
          lines.push(`[thêm mới Lv${c.level}có tiếng đồn] ${u(c.topic)} - ${u(c.content||'')}`);
        }
      }
      return `<div class="we-ledger-item">
        <span class="we-ledger-round">Thứ ${entry.round} vòng</span>
        <div class="we-ledger-changes">${lines.map(l => `<div class="we-ledger-line">${l}</div>`).join('')}</div>
      </div>`;
    });
  }

  // [FIX] suy diễn prompt Ràng buộc gập thẻ phân đoạn (cấp module, để lắp ráp + tái sử dụng làm mới cục bộ). Ủy thác sự kiện.
  function bindPromptSegToggle(root) {
    if (!root) return;
    root.addEventListener('click', function(e) {
      const head = e.target.closest('[data-we-seg-toggle]');
      if (!head) return;
      const card = head.parentElement;
      const body = card && card.querySelector('.we-prompt-seg-body');
      const arrow = head.querySelector('.we-prompt-seg-arrow');
      if (!body) return;
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
    });
  }

  // [FIX] làm mới cục bộ của thẻ gỡ lỗi renderDebug phần: chỉ thay thế #we-debug-render nội dung và ràng buộc lại gập đoạn,
  // không chạm vào các tab khác DOM（bảo vệ người dùng ở các tab đầu vào chưa lưu). Chuyển sang gỡ lỗi tab khi gọi.
  function refreshDebugRender() {
    const box = document.getElementById('we-debug-render');
    if (!box) return;
    box.innerHTML = renderDebug();
    bindPromptSegToggle(box.querySelector('.we-prompt-debug'));
    // nút xuất ở renderDebug trong đầu ra, ràng buộc lại
    const exportPromptBtn = document.getElementById('we-export-prompt');
    if (exportPromptBtn) {
      exportPromptBtn.onclick = () => {
        const evo = window.WORLD_ENGINE_EVOLUTION;
        if (!evo || !evo.getLastDebug) return;
        const dbg = evo.getLastDebug();
        if (!dbg.prompt) { showToast('không Prompt có thể xuất', true); return; }
        const blob = new Blob([dbg.prompt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'prompt-' + Date.now() + '.txt'; a.click();
        URL.revokeObjectURL(url);
        showToast('Prompt đã xuất');
      };
    }
    const exportRawBtn = document.getElementById('we-export-raw-result');
    if (exportRawBtn) {
      exportRawBtn.onclick = () => {
        const evo = window.WORLD_ENGINE_EVOLUTION;
        if (!evo || !evo.getLastDebug) return;
        const dbg = evo.getLastDebug();
        if (!dbg.rawResult) { showToast('không API trả về có thể xuất', true); return; }
        const blob = new Blob([dbg.rawResult], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'api-raw-' + Date.now() + '.txt'; a.click();
        URL.revokeObjectURL(url);
        showToast('API trả về đã xuất');
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // [MAP] quản lý preset engine UI（và PR#12 hiển thị phân đoạn chỉ đọc ở cùng thẻ gỡ lỗi)
  // đưa suy diễn prompt của 4 đoạn hardcode (①vai trò engine/②nhân quả 10 bước/⑦JSON hướng dẫn đầu ra/⑧JSON ví dụ)
  // nâng cấp thành preset có thể chỉnh sửa, có thể lưu, có thể chuyển đổi, có thể nhập xuất. Lưu đi theo độc lập storage key，
  // không vào we-save-settings、không vào world_engine_settings。
  // ═══════════════════════════════════════════════════════════
  function getPresetMod() {
    return (window.WORLD_ENGINE_PRESET && typeof window.WORLD_ENGINE_PRESET.getAllPresets === 'function')
      ? window.WORLD_ENGINE_PRESET : null;
  }

  // tạo quản lý preset HTML（bộ chọn + nút thao tác + 4 thẻ gập có thể chỉnh sửa đoạn + nhắc nhở).
  // mỗi đoạn textarea giá trị ban đầu = Văn bản có hiệu lực hiện tại (nếu có ghi đè thì dùng ghi đè, nếu không thì mặc định dùng văn bản gốc hardcode).
  function renderPresetManage() {
    const P = getPresetMod();
    if (!P) return '<div class="we-empty">Hệ thống preset chưa tải</div>';

    const all = P.getAllPresets();
    const activeId = P.getActivePresetId();
    const active = P.getActivePreset();
    const overridden = P.getOverriddenSegKeys();
    const keys = P.EDITABLE_SEG_KEYS;
    const labels = P.SEG_LABELS;

    const optHtml = all.map(p =>
      '<option value="' + h(p.id) + '"' + (p.id === activeId ? ' selected' : '') + '>'
      + h(p.name) + (p.builtin ? '（tích hợp sẵn)' : '') + '</option>').join('');

    const segCards = keys.map(k => {
      const text = P.getSegmentDisplayText(k) || '';
      const isOver = overridden.indexOf(k) >= 0;
      const meta = isOver ? 'đã tuỳ chỉnh' : 'mặc định (chưa sửa)';
      return '<div class="we-prompt-seg-card we-preset-seg-card' + (isOver ? ' we-preset-seg-card-over' : '') + '">'
        + '<div class="we-prompt-seg-head" data-we-preset-toggle>'
        + '<span class="we-prompt-seg-arrow">▶</span>'
        + '<span class="we-prompt-seg-label">' + h(labels[k] || k) + '</span>'
        + '<span class="we-prompt-seg-meta">' + meta + '</span>'
        + '</div>'
        + '<div class="we-prompt-seg-body we-preset-seg-body" style="display:none;">'
        + '<textarea class="we-preset-textarea" data-we-preset-seg="' + h(k) + '" rows="14" spellcheck="false" placeholder="Để trống thì sử dụng văn bản gốc hardcode mặc định">'
        + h(text) + '</textarea>'
        + '<div class="we-preset-seg-hint">Để trống lưu lại sẽ trả về văn bản gốc mặc định. Sửa ⑦⑧ có thể dẫn đến phân tích suy diễn thất bại, tự chịu trách nhiệm. Có thể giữ lại {{user}}。</div>'
        + '</div>'
        + '</div>';
    }).join('');

    const builtinActive = !!(active && active.builtin);

    return '<div class="we-preset-manage">'
      + '<div class="we-preset-row">'
      + '<label class="we-preset-select-label">Preset hiện tại</label>'
      + '<select id="we-preset-select" class="we-preset-select">' + optHtml + '</select>'
      + '</div>'
      + '<div class="we-preset-active-desc">' + h(active && active.description || '') + '</div>'
      + '<div class="we-preset-actions">'
      + '<button class="we-btn we-btn-primary" id="we-preset-save">Lưu</button>'
      + '<button class="we-btn" id="we-preset-saveas">Lưu thành</button>'
      + (builtinActive ? '' : '<button class="we-btn we-btn-danger" id="we-preset-delete">xoá</button>')
      + '<button class="we-btn" id="we-preset-export">xuất</button>'
      + '<button class="we-btn" id="we-preset-import">nhập</button>'
      + '<input type="file" id="we-preset-import-file" accept=".json,application/json" style="display:none;">'
      + '</div>'
      + '<div class="we-preset-hint">'
      + 'Chỗ này chỉnh sửa là nội dung "World Engine" gửi cho suy diễn AI của prompt đoạn hardcode. Sửa sẽ làm thay đổi bản thân hành vi suy diễn,'
      + 'vui lòng tự chịu trách nhiệm. Preset "mặc định" tích hợp sẵn không thể xoá, chỉnh sửa preset tích hợp sẵn bấm "lưu" sẽ nhắc nhở lưu thành bản sao.'
      + '</div>'
      + '<div class="we-prompt-seg-list">' + segCards + '</div>'
      + '</div>';
  }

  // [FIX] Làm mới cục bộ quản lý preset: chỉ thay thế #we-preset-manage nội dung và bind lại sự kiện, không động đến cái khác tab nhập.
  function refreshPresetManage() {
    const box = document.getElementById('we-preset-manage');
    if (!box) return;
    box.innerHTML = renderPresetManage();
    bindPresetEvents(box);
  }

  // thu thập 4 cái textarea văn bản hiện tại của → segments đối tượng (chuỗi rỗng→null biểu thị trả về mặc định).
  function collectPresetSegmentsFromDOM() {
    const P = getPresetMod();
    if (!P) return {};
    const out = {};
    P.EDITABLE_SEG_KEYS.forEach(k => {
      const ta = document.querySelector('.we-preset-textarea[data-we-preset-seg="' + cssEscape(k) + '"]');
      if (!ta) { out[k] = null; return; }
      const v = ta.value;
      out[k] = (v == null || v.trim() === '') ? null : v;
    });
    return out;
  }

  // Escape giá trị thuộc tính đơn giản (dùng cho querySelector ghép trong selector seg key，key toàn bộ là chữ thường cố định có dấu gạch nối, fallback an toàn).
  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  // Bind sự kiện quản lý preset (chuyển đổi selector + Lưu/lưu thành/xoá/nhập/xuất + uỷ quyền gập đoạn).
  function bindPresetEvents(root) {
    const P = getPresetMod();
    if (!P) return;
    root = root || document.getElementById('we-preset-manage');
    if (!root) return;

    // Gập đoạn (uỷ quyền sự kiện, độc lập data-attr，không cùng bindPromptSegToggle của data-we-seg-toggle xung đột).
    // [FIX] Uỷ quyền chỉ cần bind một lần:refreshPresetManage mỗi lần chỉ đổi root.innerHTML（node con hoàn toàn mới),
    // root bản thân node không đổi, uỷ quyền dựa vào bubbling luôn hợp lệ. Dùng thủ vệ tránh mỗi lần làm mới đều addEventListener dẫn đến
    // tích luỹ listener (bấm 10 lần lưu sẽ ở trên cùng một root chồng lên 10  tầng click，tiêu đề gập bấm một lần kích hoạt 10 lần).
    if (!root.__wePresetDelegated) {
      root.__wePresetDelegated = true;
      root.addEventListener('click', function (e) {
        const head = e.target.closest('[data-we-preset-toggle]');
        if (!head) return;
        const card = head.parentElement;
        const body = card && card.querySelector('.we-preset-seg-body');
        const arrow = head.querySelector('.we-prompt-seg-arrow');
        if (!body) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      });
    }

    // Chuyển đổi preset
    const sel = root.querySelector('#we-preset-select');
    if (sel) {
      sel.onchange = () => {
        const id = sel.value;
        P.setActivePreset(id);
        showToast('Đã chuyển đổi preset');
        refreshPresetManage();
      };
    }

    // Lưu: preset tích hợp sẵn → nhắc nhở lưu thành bản sao; tuỳ chỉnh → cập nhật hiện tại.
    const saveBtn = root.querySelector('#we-preset-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const activeId = P.getActivePresetId();
        const active = P.getActivePreset();
        const segs = collectPresetSegmentsFromDOM();
        if (active && active.builtin) {
          // Preset tích hợp sẵn không thể ghi đè: đi theo quy trình lưu thành bản sao
          const name = prompt('Hiện tại là preset mặc định, "lưu sẽ lưu thành bản sao preset mới. Vui lòng nhập tên preset mới":', active.name + ' bản sao');
          if (name == null) return;
          const np = P.saveAsCustomPreset({ name: name || (active.name + ' bản sao'), description: active.description, segments: segs });
          P.setActivePreset(np.id);
          showToast('Đã lưu thành preset mới:' + np.name);
          refreshPresetManage();
          return;
        }
        P.saveCustomPreset({ id: activeId, name: active.name, description: active.description, segments: segs });
        showToast('Đã lưu preset');
        refreshPresetManage();
      };
    }

    // Lưu thành: buộc tạo mới id
    const saveAsBtn = root.querySelector('#we-preset-saveas');
    if (saveAsBtn) {
      saveAsBtn.onclick = () => {
        const active = P.getActivePreset();
        const segs = collectPresetSegmentsFromDOM();
        const name = prompt('Vui lòng nhập tên preset mới:', active.name + ' bản sao');
        if (name == null) return;
        const np = P.saveAsCustomPreset({ name: name || (active.name + ' bản sao'), description: active.description, segments: segs });
        P.setActivePreset(np.id);
        showToast('Đã lưu thành preset mới:' + np.name);
        refreshPresetManage();
      };
    }

    // Xoá: chỉ tuỳ chỉnh
    const delBtn = root.querySelector('#we-preset-delete');
    if (delBtn) {
      delBtn.onclick = () => {
        const activeId = P.getActivePresetId();
        const active = P.getActivePreset();
        if (!active || active.builtin) { showToast('Không thể xoá preset mặc định', true); return; }
        if (!confirm('Xác nhận xoá preset「' + active.name + '」？Thao tác này không thể hoàn tác.')) return;
        P.deleteCustomPreset(activeId);
        showToast('Đã xoá preset');
        refreshPresetManage();
      };
    }

    // Xuất preset hiện tại
    const expBtn = root.querySelector('#we-preset-export');
    if (expBtn) {
      expBtn.onclick = () => {
        const json = P.exportPreset(P.getActivePresetId());
        if (!json) { showToast('Không có preset để xuất', true); return; }
        const name = (P.getActivePreset().name || 'preset').replace(/[\\/:*?"<>|]/g, '_');
        setupDownload(json, 'world-engine-preset-' + name + '-' + Date.now() + '.json');
        showToast('Đã xuất preset');
      };
    }

    // Nhập: kích hoạt chọn tệp
    const impBtn = root.querySelector('#we-preset-import');
    const impFile = root.querySelector('#we-preset-import-file');
    if (impBtn && impFile) {
      impBtn.onclick = () => impFile.click();
      impFile.onchange = () => {
        const f = impFile.files && impFile.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const np = P.importPreset(String(reader.result || ''));
            showToast('Đã nhập preset:' + np.name);
            refreshPresetManage();
          } catch (e) {
            showToast('Nhập thất bại: ' + (e && e.message || e), true);
          }
        };
        reader.onerror = () => showToast('Đọc tệp thất bại', true);
        reader.readAsText(f, 'utf-8');
        // Xoá sạch value để có thể chọn lại cùng một tệp
        impFile.value = '';
      };
    }
  }


  // ── Thẻ tự kiểm tra tiêm (chỉ đọc): đọc WORLD_ENGINE_INJECT_INSPECTOR bản snapshot cuối cùng,
  //    bằng ngôn ngữ dễ hiểu+role chuỗi tin nhắn đã phân chia để trả lời 'trạng thái thế giới rốt cuộc có thực sự được gửi cho mô hình lớn không' prompt」。
  //    dữ liệu hoàn toàn từ inspector snapshot chỉ đọc; hàm này chỉ ghép HTML，không kích hoạt bất kỳ tác dụng phụ nào.
  //    trả về là .we-prompt-debug đoạn nội bộ (tái sử dụng header gập data-we-seg-toggle，bởi bindPromptSegToggle tiếp quản thống nhất).
  function renderInjectInspector() {
    const insp = window.WORLD_ENGINE_INJECT_INSPECTOR;
    if (!insp || !insp.getLastSnapshot) return '';
    const snap = insp.getLastSnapshot();
    const status = snap ? snap.status : 'NOT_YET';
    const text = insp.statusText ? insp.statusText(status) : '';

    const palette = {
      SUCCESS:          { icon: '✅', color: '#3fb950', bg: 'rgba(63,185,80,0.10)' },
      MISSING:          { icon: '❌', color: '#f85149', bg: 'rgba(248,81,73,0.10)' },
      SKIPPED_DISABLED: { icon: '⏸', color: 'var(--we-text3)', bg: 'rgba(128,128,128,0.08)' },
      SKIPPED_REROLL:   { icon: '⏸', color: 'var(--we-text3)', bg: 'rgba(128,128,128,0.08)' },
      SKIPPED_OTHER:    { icon: '⏸', color: 'var(--we-text3)', bg: 'rgba(128,128,128,0.08)' },
      NOT_YET:          { icon: '—', color: 'var(--we-text3)', bg: 'rgba(128,128,128,0.08)' },
    };
    const p = palette[status] || palette.NOT_YET;

    let html = '<div class="we-inject-inspector" style="border:1px solid var(--we-border);border-radius:8px;padding:10px;margin-bottom:12px;background:' + p.bg + ';">';
    html += '<div style="font-weight:600;color:' + p.color + ';margin-bottom:4px;">' + p.icon + ' Tự kiểm tra tiêm · ' + h(text) + '</div>';

    if (!snap) {
      html += '<div style="font-size:11px;color:var(--we-text3);">Sau khi gửi một tin nhắn để kích hoạt tạo, ở đây sẽ hiển thị 'trạng thái thế giới' có thực sự đi vào phần thân gửi cho mô hình lớn hay không prompt（với suy diễn phía trên prompt không phải là một).</div>';
      return html + '</div>';
    }

    // Dòng thông tin meta
    const apiLabel = snap.apiType === 'chat' ? 'Hoàn thành hội thoại' : 'bổ sung văn bản';
    let when = '';
    try { when = snap.ts ? new Date(snap.ts).toLocaleTimeString() : ''; } catch (e) {}
    html += '<div style="font-size:11px;color:var(--we-text3);margin-bottom:6px;">'
      + 'API：' + apiLabel + ' · Vòng:' + (snap.round != null ? h(String(snap.round)) : '?')
      + ' · Đã đăng ký:' + (snap.registeredAtSend ? 'Có' : 'Không')
      + ' · Vào phần thân:' + (snap.landed ? 'Có' : 'Không')
      + (when ? ' · ' + h(when) : '')
      + '</div>';

    // role Logo
    const roleColor = { system: '#a371f7', user: '#58a6ff', assistant: '#3fb950', tool: '#d29922' };
    const roleBadge = (role) => {
      const c = roleColor[role] || 'var(--we-text3)';
      return '<span style="display:inline-block;min-width:62px;text-align:center;font-size:10px;padding:1px 6px;border-radius:4px;border:1px solid ' + c + ';color:' + c + ';">' + h(role || '?') + '</span>';
    };

    if (snap.apiType === 'chat' && Array.isArray(snap.messages)) {
      html += '<div style="font-size:11px;color:var(--we-text2);margin-bottom:4px;">Chuỗi tin nhắn thực tế được gửi (tổng cộng ' + h(String(snap.messageCount)) + ' mục, theo role phân chia; nhấp vào mục bất kỳ để mở rộng xem nội dung hoàn chỉnh):</div>';
      html += snap.messages.map((m) => {
        const meta = (m.length != null ? m.length + ' chữ' : '');
        const hasBody = (m.content != null && m.content.length > 0);
        if (m.isOurs) {
          // Mục do extension này tiêm: có thể gập lại, mở rộng để xem trạng thái thế giới hoàn chỉnh (chứng minh thực sự ở trong prompt trong)
          const body = '<pre class="we-prompt-seg-pre">' + u(m.content || snap.ourContent || '') + '</pre>';
          return '<div class="we-prompt-seg-card" style="margin:3px 0;">'
            + '<div class="we-prompt-seg-head" data-we-seg-toggle style="display:flex;align-items:center;gap:6px;">'
            + '<span class="we-prompt-seg-arrow">▶</span>'
            + roleBadge(m.role)
            + '<span class="we-prompt-seg-label" style="color:#3fb950;">✅ chứa tiêm của extension này</span>'
            + '<span class="we-prompt-seg-meta">' + meta + '</span>'
            + '</div>'
            + '<div class="we-prompt-seg-body" style="display:none;">' + body + '</div>'
            + '</div>';
        }
        // Tin nhắn khác: cũng có thể gập mở rộng để xem nội dung hoàn chỉnh (chỉ đọc, không ghi bất kỳ lưu trữ nào)
        if (hasBody) {
          const body = '<pre class="we-prompt-seg-pre">' + u(m.content) + '</pre>';
          return '<div class="we-prompt-seg-card" style="margin:3px 0;">'
            + '<div class="we-prompt-seg-head" data-we-seg-toggle style="display:flex;align-items:center;gap:6px;">'
            + '<span class="we-prompt-seg-arrow">▶</span>'
            + roleBadge(m.role)
            + '<span class="we-prompt-seg-meta">' + meta + '</span>'
            + '</div>'
            + '<div class="we-prompt-seg-body" style="display:none;">' + body + '</div>'
            + '</div>';
        }
        // Nội dung trống: chỉ đọc một dòng
        return '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;color:var(--we-text3);">'
          + roleBadge(m.role)
          + '<span>' + meta + '</span>'
          + '</div>';
      }).join('');
    } else if (snap.apiType === 'text') {
      html += '<div style="font-size:11px;color:var(--we-text2);margin-bottom:4px;">bổ sung văn bản prompt Tổng cộng ' + h(String(snap.promptLength || 0)) + ' chữ (đã flatten thành chuỗi đơn, không có role phân biệt):</div>';
      if (snap.landed && snap.ourExcerpt) {
        const body = '<pre class="we-prompt-seg-pre">' + u(snap.ourExcerpt) + '</pre>';
        html += '<div class="we-prompt-seg-card" style="margin:3px 0;">'
          + '<div class="we-prompt-seg-head" data-we-seg-toggle style="display:flex;align-items:center;gap:6px;">'
          + '<span class="we-prompt-seg-arrow">▶</span>'
          + '<span class="we-prompt-seg-label" style="color:#3fb950;">✅ Trích xuất chỗ khớp lính gác</span>'
          + '</div>'
          + '<div class="we-prompt-seg-body" style="display:none;">' + body + '</div>'
          + '</div>';
      }
    }

    return html + '</div>';
  }

  // [FIX] renderDebug：suy diễn prompt Hiển thị phân đoạn hoàn toàn trong suốt (chỉ đọc, không thể chỉnh sửa).
  // đưa suy diễn API Toàn bộ khối nhận được prompt theo 10 phân đoạn tách ra hiển thị dạng gập + AI trả về JSON tô sáng, chỉ xem vòng mới nhất.
  // Nguồn dữ liệu evo.getLastDebug().segments（evolution['js Bản sao phía lắp ráp'], với thực tế gửi đi prompt nhất quán cấp byte).
  function renderDebug() {
    // Thẻ tự kiểm tra tiêm độc lập với dữ liệu suy diễn: mỗi lần tạo đều sẽ cập nhật, do đó dù chưa suy diễn cũng phải hiển thị nó trước.
    //   Toàn bộ khối vẫn được bọc trong .we-prompt-debug trong, tái sử dụng bindPromptSegToggle uỷ thác đơn lẻ tiếp quản gập.
    const injectCard = renderInjectInspector();
    const evo = window.WORLD_ENGINE_EVOLUTION;
    const wrap = (inner) => '<div class="we-prompt-debug">' + injectCard + inner + '</div>';
    if (!evo || !evo.getLastDebug) return wrap('<div class="we-empty">Dữ liệu gỡ lỗi không khả dụng</div>');
    const dbg = evo.getLastDebug();
    if (!dbg || !dbg.prompt) return wrap('<div class="we-empty">Chưa suy diễn, tạm thời không có dữ liệu gỡ lỗi</div>');

    const segments = Array.isArray(dbg.segments) ? dbg.segments : [];
    const totalLen = dbg.prompt.length || 0;
    // Thanh tỷ lệ phân đoạn: chiều rộng mỗi đoạn theo tỷ lệ số chữ
    const barHtml = segments.length
      ? '<div class="we-prompt-seg-bar">' + segments.map(seg => {
          const len = (seg.content || '').length;
          const pct = totalLen ? (len / totalLen * 100) : 0;
          return '<span class="we-prompt-seg-bar-cell" style="width:' + pct.toFixed(2) + '%" title="' + u(seg.label) + ' ' + len + 'chữ"></span>';
        }).join('') + '</div>'
      : '';

    // Thử đưa content đầu tiên trong JSON đối tượng pretty-print（dùng cho đoạn trạng thái/tô sáng đoạn ví dụ)
    const tryPrettyJson = (text) => {
      if (!text) return null;
      const api = window.WORLD_ENGINE_API;
      // trực tiếp JSON.parse thất bại thì dùng api['parseJSON chịu lỗi']
      let obj = null;
      try { obj = JSON.parse(text); } catch (e) {
        if (api && api.parseJSON) { try { obj = api.parseJSON(text); } catch (e2) {} }
      }
      if (obj === null || typeof obj !== 'object') return null;
      try { return JSON.stringify(obj, null, 2); } catch (e) { return null; }
    };

    // Thẻ gập đoạn đơn
    const segCard = (idx, seg) => {
      const content = seg.content || '';
      const len = content.length;
      const pct = totalLen ? (len / totalLen * 100).toFixed(1) : '0.0';
      const isEmpty = len === 0;
      // Đoạn trạng thái/Thử đoạn ví dụ JSON tô sáng
      let bodyHtml;
      if (isEmpty) {
        bodyHtml = '<div class="we-prompt-seg-empty">Vòng này chưa bật</div>';
      } else {
        const pretty = tryPrettyJson(content);
        const shown = pretty !== null ? pretty : content;
        bodyHtml = '<pre class="we-prompt-seg-pre' + (pretty !== null ? ' we-prompt-seg-pre-json' : '') + '">' + u(shown) + '</pre>';
      }
      return '<div class="we-prompt-seg-card" data-we-seg-key="' + u(seg.key) + '">'
        + '<div class="we-prompt-seg-head" data-we-seg-toggle>'
        + '<span class="we-prompt-seg-arrow">▶</span>'
        + '<span class="we-prompt-seg-label">' + u(seg.label) + '</span>'
        + '<span class="we-prompt-seg-meta">' + (isEmpty ? 'Trống' : (len + 'chữ · ' + pct + '%')) + '</span>'
        + '</div>'
        + '<div class="we-prompt-seg-body" style="display:none;">' + bodyHtml + '</div>'
        + '</div>';
    };

    // AI Thẻ trả về
    const rawResult = dbg.rawResult || '';
    const rawLen = rawResult.length;
    const parsedJson = tryPrettyJson(rawResult);
    const rawBodyHtml = rawLen
      ? (parsedJson !== null
          ? '<pre class="we-prompt-seg-pre we-prompt-seg-pre-json">' + u(parsedJson) + '</pre>'
          : '<pre class="we-prompt-seg-pre">' + u(rawResult) + '</pre>')
      : '<div class="we-prompt-seg-empty">không API trả về</div>';
    const rawCard = '<div class="we-prompt-seg-card we-prompt-seg-card-raw">'
      + '<div class="we-prompt-seg-head" data-we-seg-toggle>'
      + '<span class="we-prompt-seg-arrow">▶</span>'
      + '<span class="we-prompt-seg-label">AI trả về (suy diễn API kết quả gốc)</span>'
      + '<span class="we-prompt-seg-meta">' + (rawLen ? (rawLen + 'chữ' + (parsedJson !== null ? ' · JSON Đã phân tích' : ' · Không thể phân tích thành JSON')) : 'Trống') + '</span>'
      + '</div>'
      + '<div class="we-prompt-seg-body" style="display:none;">' + rawBodyHtml + '</div>'
      + '</div>';

    return ''
      + '<div class="we-prompt-debug">'
      + injectCard
      + '<div class="we-prompt-debug-summary">Gửi cho suy diễn API của Prompt Tổng cộng ' + totalLen + ' chữ, chia ' + segments.length + ' đoạn (hiển thị chỉ đọc, nhất quán với byte thực tế gửi đi)</div>'
      + barHtml
      + '<div class="we-prompt-seg-list">' + segments.map((seg, i) => segCard(i, seg)).join('') + '</div>'
      + rawCard
      + '<div style="display:flex;gap:6px;margin-top:8px;">'
      + '<button class="we-btn" id="we-export-prompt" style="flex:1;">Xuất hoàn chỉnh Prompt</button>'
      + '<button class="we-btn" id="we-export-raw-result" style="flex:1;">xuất API trả về</button>'
      + '</div>'
      + '</div>';
  }

  function renderSettingsForm() {
    const settings = window.WORLD_ENGINE_API
      ? window.WORLD_ENGINE_API.getSettings(true)
      : JSON.parse(window.WORLD_ENGINE_STORE.getItem('world_engine_settings') || '{}');
    const mode = (settings.evolveMode === 'manual' || settings.evolveMode === 'time') ? settings.evolveMode : 'auto';
    const everyX = Math.max(1, parseInt(settings.evolveEveryX) || 1);
    const readRounds = Math.min(everyX, Math.max(1, parseInt(settings.evolveReadRounds) || 1));
    // Giá trị hiện tại của chế độ theo thời gian
    const _stForTime = core.hasState() ? core.loadState() : null;
    const _cpForTime = core.restoreCheckpoint();
    const stTimeVal = (_stForTime && _stForTime.time != null) ? _stForTime.time : '';
    const cpTimeVal = (_cpForTime && _cpForTime.time != null) ? _cpForTime.time : '';
    const lastDayVal = (core.getLastStoryDay && core.getLastStoryDay() != null) ? core.getLastStoryDay() : '';
    const tv = (k, d) => (settings[k] != null && settings[k] !== '') ? settings[k] : d;

    const sec = (id, title, body) =>
      '<div class="we-section"><div class="we-section-title">' + sectionHeader(title, id) + '</div>' +
      sectionBody(id, body) + '</div>';

    const apiBody = `
      <div class="we-input-group">
        <label>Phương thức kết nối</label>
        <select id="we-connection-mode" style="width:100%;">
          <option value="direct" ${settings.connectionMode !== 'proxy' ? 'selected' : ''}>Kết nối trực tiếp (mặc định)</option>
          <option value="proxy" ${settings.connectionMode === 'proxy' ? 'selected' : ''}>Qua proxy của Tavern (giải quyết cross-domain CORS）</option>
        </select>
        <div style="font-size:11px;color:#888;margin-top:3px;">Không thể kết nối / Console báo CORS Khi lỗi, chuyển sang 「qua proxy của Tavern」 để server Tavern chuyển tiếp.</div>
      </div>
      <div class="we-input-group">
        <label>API URL（OpenAI tương thích)</label>
        <input type="text" id="we-api-url" value="${u(settings.apiUrl||'')}" placeholder="https://api.openai.com/v1">
        <div style="font-size:11px;color:#888;margin-top:3px;">Điền đến cấp 「tiền tố phiên bản」 là được,/chat/completions Có thể thêm hoặc không (sẽ tự động bổ sung). Ví dụ:OpenAI <span style="color:#aaa;">https://api.openai.com/v1</span>；Hỏa Sơn Phương Chu <span style="color:#aaa;">https://ark.cn-beijing.volces.com/api/v3</span>（hoặc <span style="color:#aaa;">.../api/coding/v3</span>）。Bắt buộc mang theo tiền tố phiên bản của mình.</div>
      </div>
      <div class="we-input-group">
        <label>API Key</label>
        <input type="password" id="we-api-key" value="${u(settings.apiKey||'')}">
      </div>
      <div class="we-input-group" style="display:flex;gap:6px;align-items:end;">
        <div style="flex:1;">
          <label>Mô hình</label>
          <input type="text" id="we-model" value="${u(settings.model||'gpt-3.5-turbo')}" placeholder="Tên mô hình" style="width:100%;">
        </div>
        <button class="we-btn" id="we-fetch-models" style="white-space:nowrap;flex-shrink:0;">Lấy danh sách</button>
      </div>
      <div class="we-input-group">
        <select id="we-model-list" style="display:none;width:100%;margin-top:4px;">
          <option value="">-- Chọn mô hình --</option>
        </select>
      </div>`;

    const evolveBody = `
      <div class="we-input-group">
        <label>chế độ suy diễn</label>
        <select id="we-evolve-mode" style="width:100%;">
          <option value="auto" ${mode === 'auto' ? 'selected' : ''}>tự động · Theo vòng (mỗi X vòng suy diễn một lần)</option>
          <option value="time" ${mode === 'time' ? 'selected' : ''}>tự động · Theo thời gian (chênh lệch ngày trong văn bản đủ N ngày)</option>
          <option value="manual" ${mode === 'manual' ? 'selected' : ''}>Thủ công (chỉ khi bấm 「suy diễn thủ công」 mới kích hoạt)</option>
        </select>
      </div>
      <div class="we-input-group" id="we-evolve-everyx-group" style="${mode === 'auto' ? '' : 'display:none;'}">
        <label>Mỗi mấy vòng suy diễn một lần (X）</label>
        <input type="number" id="we-evolve-everyx" min="1" step="1" value="${everyX}" style="width:100%;">
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">điền 1 = mỗi vòng suy diễn; điền 3 = mỗi khi tiến tới 3 vòng suy diễn một lần. Reroll roll không tính vào số vòng.</div>
      </div>
      <div class="we-input-group" id="we-evolve-readrounds-group" style="${mode === 'auto' ? '' : 'display:none;'}">
        <label>Mỗi lần suy diễn đọc mấy vòng hội thoại gần đây (a）</label>
        <input type="number" id="we-evolve-readrounds" min="1" max="${everyX}" step="1" value="${readRounds}" style="width:100%;">
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">lấy từ tầng hiện tại ngược về trước a vòng của 「người dùng nhập + AI đầu ra」 đưa cho suy diễn dưới nền. Tối thiểu 1，tối đa không vượt quá X（số vòng mỗi lần suy diễn). Mặc định 1 = chỉ đọc vòng mới nhất.</div>
      </div>
      <div id="we-evolve-time-group" style="${mode === 'time' ? '' : 'display:none;'}">
        <div class="we-input-group" style="display:flex;gap:6px;">
          <div style="flex:1;"><label>Lấy trước văn bản N chữ</label><input type="number" id="we-time-front" min="0" step="1" value="${tv('evolveTimeFront', 0)}" style="width:100%;"></div>
          <div style="flex:1;"><label>Lấy sau văn bản N chữ</label><input type="number" id="we-time-back" min="0" step="1" value="${tv('evolveTimeBack', 80)}" style="width:100%;"></div>
        </div>
        <div class="we-input-group">
          <label>Regex ngày tháng (6 khung:1/3/5 bắt số → nhóm bắt,2/4/6 đơn vị)</label>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <input type="text" id="we-time-re1" value="${u(tv('evolveTimeRe1',''))}" placeholder="khung1 như \\d+ hoặc [một hai ba...]+" style="flex:1 1 30%;">
            <input type="text" id="we-time-re2" value="${u(tv('evolveTimeRe2',''))}" placeholder="khung2 đơn vị như năm" style="flex:1 1 18%;">
            <input type="text" id="we-time-re3" value="${u(tv('evolveTimeRe3',''))}" placeholder="khung3" style="flex:1 1 30%;">
            <input type="text" id="we-time-re4" value="${u(tv('evolveTimeRe4',''))}" placeholder="khung4 như tháng" style="flex:1 1 18%;">
            <input type="text" id="we-time-re5" value="${u(tv('evolveTimeRe5',''))}" placeholder="khung5" style="flex:1 1 30%;">
            <input type="text" id="we-time-re6" value="${u(tv('evolveTimeRe6',''))}" placeholder="khung6 như ngày/ngày" style="flex:1 1 18%;">
          </div>
          <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Khung nào để trống thì bỏ qua. Số tiếng Trung tự động quy đổi, nhiều ngày tháng thì lấy cái cuối cùng.</div>
        </div>
        <div class="we-input-group" style="display:flex;gap:6px;">
          <div style="flex:1;"><label>Hệ số nhân A（khung1）</label><input type="number" id="we-time-mul1" step="any" value="${tv('evolveTimeMul1',360)}" style="width:100%;"></div>
          <div style="flex:1;"><label>Hệ số nhân B（khung3）</label><input type="number" id="we-time-mul2" step="any" value="${tv('evolveTimeMul2',30)}" style="width:100%;"></div>
          <div style="flex:1;"><label>Hệ số nhân C（khung5）</label><input type="number" id="we-time-mul3" step="any" value="${tv('evolveTimeMul3',1)}" style="width:100%;"></div>
        </div>
        <div class="we-input-group">
          <label>đủ N ngày suy diễn một lần</label>
          <input type="number" id="we-time-threshold" min="1" step="1" value="${tv('evolveTimeThreshold',1)}" style="width:100%;">
        </div>
        <div class="we-input-group">
          <label>Đọc tối đa gần đây X vòng hội thoại</label>
          <input type="number" id="we-time-maxrounds" min="1" step="1" value="${tv('evolveTimeMaxRounds',10)}" style="width:100%;">
          <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Từ lần suy diễn trước đã qua bao nhiêu vòng thì đọc bấy nhiêu vòng, nếu vượt quá X thì chỉ đọc gần đây X vòng, giới hạn để tránh prompt quá dài.</div>
        </div>
        <div class="we-input-group" style="border-top:1px solid var(--we-border,#3a3a3a);padding-top:8px;">
          <label>Thời gian trạng thái hiện tại (tổng số ngày)</label>
          <input type="number" id="we-time-state" step="any" value="${stTimeVal}" placeholder="state.time，để trống thì không ghi" style="width:100%;">
        </div>
        <div class="we-input-group">
          <label>Thời gian điểm lưu (tổng số ngày)</label>
          <input type="number" id="we-time-checkpoint" step="any" value="${cpTimeVal}" placeholder="checkpoint.time，để trống thì không ghi" style="width:100%;">
        </div>
        <div class="we-input-group">
          <label>Thời gian hội thoại vòng này (tổng số ngày)</label>
          <input type="number" id="we-time-current" step="any" value="${lastDayVal}" placeholder="Lưu là kiểm tra xem có suy diễn không" style="width:100%;">
          <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Sau khi lưu: trừ đi thời gian cơ sở, nếu đủ N ngày thì lập tức suy diễn. Ba ô thời gian chỉ ghi khi có giá trị, nếu ghi sai có thể tắt plugin mở lại để điền lại.</div>
        </div>
      </div>`;

    const filterBody = `
      <div class="we-input-group">
        <label>Mỗi dòng một regex, nội dung khớp sẽ bị xoá trước khi đưa vào nền</label>
        <div style="margin-bottom:8px;border:1px solid var(--we-border,#3a3a3a);border-radius:4px;padding:6px;">
          <div style="font-size:12px;color:var(--we-text2);margin-bottom:4px;">Chế độ đơn giản: chọn thẻ để tự động tạo regex xoá</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">
            <button class="we-btn" id="we-btn-filter-scan" type="button">🔍 Quét thẻ chat này</button>
            <input type="text" id="we-filter-add-input" placeholder="Thêm tên thẻ thủ công(như tucao)" style="flex:1;min-width:140px;">
            <button class="we-btn" id="we-btn-filter-add" type="button">+ Thêm</button>
          </div>
          <div id="we-filter-tags" style="display:flex;flex-wrap:wrap;gap:4px;min-height:4px;"></div>
          <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Regex tự động tạo chưa chắc đã có hiệu lực——Thẻ có thuộc tính(như &lt;wlog time&gt;)、có ~(như &lt;konatan_planning~&gt;)、Lỗi lồng nhau hoặc thẻ đóng bất thường có thể khiến việc khớp thất bại. Nếu không có hiệu lực, vui lòng chỉnh sửa trực tiếp ô văn bản bên dưới để tự viết tay. Thẻ chưa chọn sẽ không được lưu.</div>
        </div>
        <textarea id="we-filter-regex" rows="4" style="width:100%;resize:vertical;" placeholder="Mỗi dòng một mục; hỗ trợ thuần pattern hoặc /pattern/flags literal. Ví dụ:\n<details>[\\s\\S]*?</details>\\n?\n/&lt;think&gt;[\\s\\S]*?&lt;\\/think&gt;/g">${u(tv('evolveFilterRegex',''))}</textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px;">
          <button class="we-btn" id="we-btn-filter-test" type="button">▶ Kiểm thử regex</button>
        </div>
        <div class="we-hint" id="we-filter-status" style="margin:0 0 4px;white-space:pre-wrap;"></div>
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Mỗi dòng một mục; hỗ trợ thuần pattern（mặc định g toàn cục) hoặc /pattern/flags literal (như /.../gi）；Dòng trống bị bỏ qua. Chỉ ảnh hưởng đến văn bản đưa vào suy diễn dưới nền, không ảnh hưởng đến nội dung chat và việc lấy ngày tháng. Tự động xác thực mỗi mục khi lưu, nút kiểm thử có thể chạy thử trên hội thoại gần nhất.</div>
      </div>`;

    const injectBody = `
      <div class="we-input-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="we-inject-into-prompt" ${settings.injectIntoPrompt !== false ? 'checked' : ''}>
          Tiêm vào nội dung chính
        </label>
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Sau khi tắt sẽ không tiêm trạng thái hiện tại hoặc điểm lưu vào nội dung chat.</div>
      </div>`;

    const displayMode = settings.displayMode === 'expand' ? 'expand' : 'mask';
    const displayBody = `
      <div class="we-input-group">
        <label>Chế độ hiển thị trang chủ</label>
        <select id="we-display-mode" style="width:100%;">
          <option value="mask" ${displayMode === 'mask' ? 'selected' : ''}>Chế độ che khuất (trang chủ + vào theo phân trang)</option>
          <option value="expand" ${displayMode === 'expand' ? 'selected' : ''}>Chế độ mở rộng (trải phẳng toàn bộ nội dung)</option>
        </select>
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Trong chế độ mở rộng, trải phẳng trực tiếp toàn bộ bên dưới tóm tắt thế giới section，không cần vào phân trang.</div>
      </div>`;

    // Cache & bản lưu Tavern: lưu vào của chat hiện tại chat_metadata（lưu cùng tệp chat lên máy chủ Tavern, đồng bộ đa thiết bị).
    // Danh sách và trạng thái ở bindEvents → setupChatcacheSection() được điền động bên trong.
    const chatcacheBody = `
      <div class="we-input-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="we-sync-to-chat" ${settings.syncToChat === true ? 'checked' : ''}>
          Đồng bộ thời gian thực đa thiết bị (lưu vào chat hiện tại)
        </label>
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Sau khi bật, trạng thái thế giới của chat này sẽ liên tục được ghi vào tệp chat Tavern và đồng bộ đa thiết bị theo đó; đổi thiết bị mở cùng một chat là có thể tiếp tục tiến độ (khi xung đột, phiên bản mới hơn sẽ thắng).<b>Sẽ không</b>đồng bộ API Key các cài đặt toàn cục như.</div>
      </div>
      <div class="we-input-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="we-auto-backup" ${settings.autoBackup === true ? 'checked' : ''}>
          Tự động sao lưu cuốn chiếu (mỗi khi vòng thúc đẩy sẽ lưu một bản, giữ lại gần nhất ${'3'} bản)
        </label>
        <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Tránh xoá nhầm sửa nhầm. Tự động sao lưu và bản lưu có tên đều được lưu trong chat này, có thể thấy qua đa thiết bị.</div>
      </div>
      <div class="we-hint" id="we-chatcache-status" style="margin:4px 0;"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;">
        <button class="we-btn we-btn-primary" id="we-chatcache-save">Tạo mới bản lưu có tên</button>
        <button class="we-btn" id="we-chatcache-import">nhập bản lưu</button>
        <input type="file" id="we-chatcache-import-file" accept=".json" style="display:none;">
      </div>
      <div class="we-chatcache-list" id="we-chatcache-snapshots"><div class="we-empty">Chưa có bản lưu</div></div>`;

    // Backfill hàng loạt suy diễn thế giới: Từ tầng 1 cái AI tầng chia lô suy diễn đến tầng chỉ định (xoá hết làm lại).
    const bf = (k, d) => { const v = settings[k]; return (v === undefined || v === null || v === '') ? d : v; };
    const backfillBody = `
      <div style="font-size:11px;color:var(--we-text3);margin-bottom:6px;">Từ tầng 1 cái AI bắt đầu tầng,<b>chia lô</b>suy diễn lại trạng thái thế giới đến tầng chỉ định. Mỗi lô chỉ nạp hội thoại của tầng lô đó, nhưng trạng thái thế giới tích luỹ từng lô, giữ nguyên tính liền mạch.<b>sẽ xoá trạng thái thế giới hiện tại làm lại từ đầu</b>（trước khi bắt đầu tự động lưu một bản sao lưu nhanh).</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <div class="we-input-group" style="flex:1;min-width:90px;margin-bottom:0;"><label>Mỗi lô AI số tầng</label>
          <input type="number" id="we-backfill-batch" min="1" step="1" value="${bf('backfillBatchSize', 5)}"></div>
        <div class="we-input-group" style="flex:1;min-width:90px;margin-bottom:0;"><label>tầng kết thúc (0=tất cả)</label>
          <input type="number" id="we-backfill-end" min="0" step="1" value="${bf('backfillEndLayer', 0)}"></div>
        <div class="we-input-group" style="flex:1;min-width:90px;margin-bottom:0;"><label>số lần thử lại mỗi lô</label>
          <input type="number" id="we-backfill-retries" min="0" step="1" value="${bf('backfillRetries', 2)}"></div>
      </div>
      <div class="we-hint" id="we-backfill-status" style="margin:6px 0;"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;">
        <button class="we-btn we-btn-primary" id="we-backfill-start">▶ bắt đầu backfill suy diễn thế giới</button>
        <button class="we-btn" id="we-backfill-stop">■ dừng</button>
      </div>`;

    // [FIX] Tab hoá: trả về theo section từ điển đoạn đã phân chia, do renderSettingsView đưa vào các tab.
    //   mỗi sec(...) gọi,body nội dung, trường id giữ nguyên không đổi một chữ so với ban đầu, chỉ là không còn ghép trực tiếp thành một chuỗi.
    return {
      api: sec('set-api', 'API cấu hình', apiBody),
      evolve: sec('set-evolve', 'chế độ suy diễn', evolveBody),
      backfill: sec('set-backfill', 'backfill hàng loạt suy diễn thế giới', backfillBody),
      filter: sec('set-filter', 'bộ lọc đầu vào đầu ra', filterBody),
      display: sec('set-display', 'hiển thị giao diện', displayBody),
      chatcache: sec('set-chatcache', 'cache & bản lưu Tavern', chatcacheBody),
      inject: sec('set-inject', 'tiêm nội dung chính', injectBody)
    };
  }

  function renderSettingsAfterCheckpoint() {
    const settings = (window.WORLD_ENGINE_API && window.WORLD_ENGINE_API.getSettings) ? window.WORLD_ENGINE_API.getSettings() : {};
    const sec = (id, title, body) =>
      '<div class="we-section"><div class="we-section-title">' + sectionHeader(title, id) + '</div>' +
      sectionBody(id, body) + '</div>';
    const worldbookBody = `
      <div class="we-worldbook-settings">
        <div class="we-input-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="we-worldbook-trigger" ${settings.worldbookTrigger === true ? 'checked' : ''}>
            bật kích hoạt đèn xanh/lam (theo Worldbook Tavern)
          </label>
          <div style="font-size:11px;color:var(--we-text3);margin-top:3px;">Khi tắt: tất cả mục đã chọn được tiêm vào suy diễn (hiện trạng). Sau khi bật:🔵mục thường trú luôn tiêm,🟢mục từ khoá chỉ tiêm khi hội thoại gần đây khớp từ khoá của nó; mỗi mục có thể ghi đè riêng. Việc quét từ khoá do extension này tự hoàn thành, tách rời với Tavern.</div>
        </div>
        <div class="we-worldbook-header">
          <div><div class="we-worldbook-summary" id="we-worldbook-summary">đang đọc Worldbook chat hiện tại...</div></div>
          <button class="we-icon-btn" id="we-worldbook-reload" title="đọc lại Worldbook chat hiện tại"><i class="fa-solid fa-rotate"></i></button>
        </div>
        <div class="we-worldbook-toolbar">
          <button class="we-btn" id="we-worldbook-select-all">chọn tất cả</button>
          <button class="we-btn" id="we-worldbook-clear-all">bỏ chọn tất cả</button>
          <button class="we-btn we-btn-primary" id="we-worldbook-save">lưu lựa chọn Worldbook</button>
        </div>
        <div class="we-worldbook-list" id="we-worldbook-list"><div class="we-empty">đang đọc...</div></div>
      </div>`;
    const dataBody = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="we-btn" id="we-export-data">xuất JSON</button>
        <button class="we-btn" id="we-import-data">nhập JSON</button>
        <input type="file" id="we-import-file" accept=".json" style="display:none;">
      </div>`;
    const toneBody = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="we-btn" id="we-tone-import">nhập</button>
        <button class="we-btn" id="we-tone-export">xuất</button>
        <button class="we-btn" id="we-tone-clear">xoá</button>
        <input type="file" id="we-tone-file" accept=".txt" style="display:none;">
      </div>
      <div class="we-hint" id="we-tone-status" style="margin-top:6px;"></div>`;
    // [FIX] Tab hoá: tương tự trả về từ điển đoạn
    return {
      worldbook: sec('set-worldbook', 'suy diễn Worldbook dưới nền', worldbookBody),
      data: sec('set-data', 'nhập dữ liệu/xuất', dataBody),
      tone: sec('set-tone', 'prompt bổ sung', toneBody)
    };
  }

  function bindEvents(state) {
    document.querySelectorAll('.we-event-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.eventScope;
        const index = Number(button.dataset.eventIndex);
        const scopedState = loadScopedState(scope);
        const event = scopedState?.events?.[index];
        if (!event || !confirm(`xoá sự kiện“${event.name}”？`)) return;
        scopedState.events.splice(index, 1);
        editingEvent = null;
        saveScopedState(scope, scopedState);
        showToast('sự kiện đã xoá');
        refresh();
      };
    });

    document.querySelectorAll('.we-event-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.eventScope;
        const index = Number(button.dataset.eventIndex);
        const scopedState = loadScopedState(scope);
        const event = scopedState?.events?.[index];
        if (!event) return;
        const copy = JSON.parse(JSON.stringify(event));
        delete copy.evolveResult;
        core.ensureEventFields(copy);
        scopedState.events.push(copy);
        saveScopedState(scope, scopedState);
        showToast('sự kiện đã sao chép xuống cuối danh sách');
        refresh();
      };
    });

    document.querySelectorAll('.we-event-edit').forEach(button => {
      button.onclick = () => {
        editingEvent = {
          scope: button.dataset.eventScope,
          index: Number(button.dataset.eventIndex)
        };
        refresh();
      };
    });

    document.querySelectorAll('.we-event-editor-close').forEach(button => {
      button.onclick = () => {
        editingEvent = null;
        refresh();
      };
    });

    document.querySelectorAll('.we-event-edit-type').forEach(select => {
      select.onchange = () => {
        const stageSelect = select.closest('.we-event-editor').querySelector('.we-event-edit-stage');
        const stages = select.value === 'progress'
          ? ['chuẩn bị', 'thực thi', 'then chốt/quan trọng', 'đã hoàn thành', 'đã thất bại']
          : ['manh nha', 'ủ biến', 'cận kề', 'đã bùng phát', 'đã tan biến'];
        stageSelect.innerHTML = stages.map(stage => `<option value="${stage}">${stage}</option>`).join('');
      };
    });

    document.querySelectorAll('.we-event-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.eventScope;
        const index = Number(editor.dataset.eventIndex);
        const scopedState = loadScopedState(scope);
        const event = scopedState?.events?.[index];
        if (!event) return;

        const name = editor.querySelector('.we-event-edit-name').value.trim();
        if (!name) {
          showToast('tên sự kiện không được để trống', true);
          return;
        }
        event.name = name;
        event.level = Number(editor.querySelector('.we-event-edit-level').value);
        event.type = editor.querySelector('.we-event-edit-type').value;
        event.stage = editor.querySelector('.we-event-edit-stage').value;
        event.stageRound = Math.min(9, Math.max(1, Number(editor.querySelector('.we-event-edit-round').value) || 1));
        event.desc = editor.querySelector('.we-event-edit-desc').value.trim();
        event.consecutiveFails = 0;
        delete event.evolveResult;

        // số vòng còn lại → suy diễn ngược _terminalSince（chỉ kết cục tích cực)
        const POSITIVE_TERMINALS = ['đã bùng phát', 'đã hoàn thành'];
        if (POSITIVE_TERMINALS.includes(event.stage)) {
          const K = 2 + (event.level || 1) * 2;
          const curRound = scopedState.round || 0;
          let left = Number(editor.querySelector('.we-event-edit-left').value);
          left = Number.isFinite(left) && left >= 1 ? Math.min(K, left) : K;
          event._terminalSince = curRound - K + left - 1;
        } else {
          delete event._terminalSince;
        }
        core.ensureEventFields(event);
        saveScopedState(scope, scopedState);
        editingEvent = null;
        showToast('thay đổi sự kiện đã lưu');
        refresh();
      };
    });

    // Sự kiện trình chỉnh sửa thế lực
    document.querySelectorAll('.we-faction-edit').forEach(button => {
      button.onclick = () => {
        editingFaction = { scope: button.dataset.factionScope, index: Number(button.dataset.factionIndex) };
        refresh();
      };
    });
    document.querySelectorAll('.we-faction-editor-close').forEach(button => {
      button.onclick = () => { editingFaction = null; refresh(); };
    });
    document.querySelectorAll('.we-faction-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.factionScope;
        const index = Number(editor.dataset.factionIndex);
        const state = loadScopedState(scope);
        const faction = state.factions?.[index];
        if (!faction) return;
        const name = editor.querySelector('.we-faction-edit-name').value.trim();
        if (!name) { showToast('Tên thế lực không được để trống', true); return; }
        faction.name = name;
        faction.status = editor.querySelector('.we-faction-edit-status').value;
        faction.relation = editor.querySelector('.we-faction-edit-relation').value;
        faction.scope = editor.querySelector('.we-faction-edit-scope').value.trim();
        faction.currentGoal = editor.querySelector('.we-faction-edit-goal').value.trim();
        faction.core_person = editor.querySelector('.we-faction-edit-core').value.trim();
        const pillars = [];
        editor.querySelectorAll('.we-faction-edit-pillar').forEach(input => {
          const v = input.value.trim().slice(0, 4);
          if (v) pillars.push(v);
        });
        faction.powerPillars = pillars;
        saveScopedState(scope, state);
        editingFaction = null;
        showToast('Đã lưu thay đổi thế lực');
        refresh();
      };
    });
    document.querySelectorAll('.we-faction-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.factionScope;
        const index = Number(button.dataset.factionIndex);
        const state = loadScopedState(scope);
        const faction = state.factions?.[index];
        if (!faction || !confirm(`xoá thế lực"${faction.name}"？`)) return;
        state.factions.splice(index, 1);
        saveScopedState(scope, state);
        showToast('Đã xoá thế lực');
        refresh();
      };
    });
    document.querySelectorAll('.we-faction-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.factionScope;
        const index = Number(button.dataset.factionIndex);
        const state = loadScopedState(scope);
        const faction = state.factions?.[index];
        if (!faction) return;
        const copy = JSON.parse(JSON.stringify(faction));
        state.factions.splice(index + 1, 0, copy);
        saveScopedState(scope, state);
        showToast('Đã sao chép thế lực');
        refresh();
      };
    });

    // Sự kiện trình chỉnh sửa tiếng đồn
    document.querySelectorAll('.we-wind-edit').forEach(button => {
      button.onclick = () => {
        editingWind = { scope: button.dataset.windScope, index: Number(button.dataset.windIndex) };
        refresh();
      };
    });
    document.querySelectorAll('.we-wind-editor-close').forEach(button => {
      button.onclick = () => { editingWind = null; refresh(); };
    });
    document.querySelectorAll('.we-wind-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.windScope;
        const index = Number(editor.dataset.windIndex);
        const scopedState = loadScopedState(scope);
        const wind = scopedState.winds?.[index];
        if (!wind) return;
        const topic = editor.querySelector('.we-wind-edit-topic').value.trim();
        if (!topic) { showToast('Chủ đề tiếng đồn không được để trống', true); return; }
        wind.topic = topic;
        wind.type = editor.querySelector('.we-wind-edit-type').value;
        wind.level = Number(editor.querySelector('.we-wind-edit-level').value);
        wind.scope = editor.querySelector('.we-wind-edit-scope').value.trim();
        wind.source = editor.querySelector('.we-wind-edit-source').value.trim();
        wind.content = editor.querySelector('.we-wind-edit-content').value.trim();
        wind.quietRounds = 0;
        saveScopedState(scope, scopedState);
        editingWind = null;
        showToast('Đã lưu thay đổi tiếng đồn');
        refresh();
      };
    });
    document.querySelectorAll('.we-wind-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.windScope;
        const index = Number(button.dataset.windIndex);
        const scopedState = loadScopedState(scope);
        const wind = scopedState.winds?.[index];
        if (!wind || !confirm(`Xoá có tiếng đồn"${wind.topic}"？`)) return;
        scopedState.winds.splice(index, 1);
        saveScopedState(scope, scopedState);
        showToast('Đã xoá tiếng đồn');
        refresh();
      };
    });
    document.querySelectorAll('.we-wind-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.windScope;
        const index = Number(button.dataset.windIndex);
        const scopedState = loadScopedState(scope);
        const wind = scopedState.winds?.[index];
        if (!wind) return;
        const copy = JSON.parse(JSON.stringify(wind));
        copy.quietRounds = 0;
        scopedState.winds.push(copy);
        saveScopedState(scope, scopedState);
        showToast('Đã sao chép tiếng đồn');
        refresh();
      };
    });

    // ===== Sự kiện trình chỉnh sửa đại thế thiên hạ =====
    document.querySelectorAll('.we-trend-edit').forEach(button => {
      button.onclick = () => {
        editingTrend = { scope: button.dataset.trendScope, index: Number(button.dataset.trendIndex) };
        refresh();
      };
    });
    document.querySelectorAll('.we-trend-editor-close').forEach(button => {
      button.onclick = () => { editingTrend = null; refresh(); };
    });
    document.querySelectorAll('.we-trend-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.trendScope;
        const index = Number(editor.dataset.trendIndex);
        const scopedState = loadScopedState(scope);
        const trend = scopedState?.worldTrends?.[index];
        if (!trend) return;
        const name = editor.querySelector('.we-trend-edit-name').value.trim();
        if (!name) { showToast('Tên đại thế không được để trống', true); return; }
        trend.name = name;
        trend.status = editor.querySelector('.we-trend-edit-status').value;
        trend.scope = editor.querySelector('.we-trend-edit-scope').value.trim();
        trend.source = editor.querySelector('.we-trend-edit-source').value.trim();
        trend.description = editor.querySelector('.we-trend-edit-desc').value.trim();
        saveScopedState(scope, scopedState);
        editingTrend = null;
        showToast('Đã lưu thay đổi đại thế thiên hạ');
        refresh();
      };
    });
    document.querySelectorAll('.we-trend-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.trendScope;
        const index = Number(button.dataset.trendIndex);
        const scopedState = loadScopedState(scope);
        const trend = scopedState?.worldTrends?.[index];
        if (!trend || !confirm(`Xoá đại thế"${trend.name}"？`)) return;
        scopedState.worldTrends.splice(index, 1);
        saveScopedState(scope, scopedState);
        showToast('Đã xoá đại thế thiên hạ');
        refresh();
      };
    });
    document.querySelectorAll('.we-trend-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.trendScope;
        const index = Number(button.dataset.trendIndex);
        const scopedState = loadScopedState(scope);
        const trend = scopedState?.worldTrends?.[index];
        if (!trend) return;
        const copy = JSON.parse(JSON.stringify(trend));
        scopedState.worldTrends.push(copy);
        saveScopedState(scope, scopedState);
        showToast('Đã sao chép đại thế thiên hạ');
        refresh();
      };
    });

    // ===== Sự kiện trình chỉnh sửa kẻ thù =====
    document.querySelectorAll('.we-enemy-edit').forEach(button => {
      button.onclick = () => {
        editingEnemy = { scope: button.dataset.enemyScope, index: Number(button.dataset.enemyIndex) };
        refresh();
      };
    });
    document.querySelectorAll('.we-enemy-editor-close').forEach(button => {
      button.onclick = () => { editingEnemy = null; refresh(); };
    });
    document.querySelectorAll('.we-enemy-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.enemyScope;
        const index = Number(editor.dataset.enemyIndex);
        const state = loadScopedState(scope);
        const enemy = state.enemies?.[index];
        if (!enemy) return;
        const name = editor.querySelector('.we-enemy-edit-name').value.trim();
        if (!name) { showToast('Tên kẻ thù không được để trống', true); return; }
        enemy.name = name;
        enemy.type = editor.querySelector('.we-enemy-edit-type').value;
        enemy.status = editor.querySelector('.we-enemy-edit-status').value;
        enemy.reason = editor.querySelector('.we-enemy-edit-reason').value.trim();
        saveScopedState(scope, state);
        editingEnemy = null;
        showToast('Đã lưu thay đổi kẻ thù');
        refresh();
      };
    });
    document.querySelectorAll('.we-enemy-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.enemyScope;
        const index = Number(button.dataset.enemyIndex);
        const state = loadScopedState(scope);
        const enemy = state.enemies?.[index];
        if (!enemy || !confirm(`Xoá kẻ thù"${enemy.name}"？`)) return;
        state.enemies.splice(index, 1);
        saveScopedState(scope, state);
        showToast('Đã xoá kẻ thù');
        refresh();
      };
    });
    document.querySelectorAll('.we-enemy-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.enemyScope;
        const index = Number(button.dataset.enemyIndex);
        const state = loadScopedState(scope);
        const enemy = state.enemies?.[index];
        if (!enemy) return;
        const copy = JSON.parse(JSON.stringify(enemy));
        state.enemies.splice(index + 1, 0, copy);
        saveScopedState(scope, state);
        showToast('Đã sao chép kẻ thù');
        refresh();
      };
    });

    // ===== Sự kiện trình chỉnh sửa chuỗi ảnh hưởng =====
    document.querySelectorAll('.we-influence-edit').forEach(button => {
      button.onclick = () => {
        editingInfluence = { scope: button.dataset.influenceScope, index: Number(button.dataset.influenceIndex) };
        refresh();
      };
    });
    document.querySelectorAll('.we-influence-editor-close').forEach(button => {
      button.onclick = () => { editingInfluence = null; refresh(); };
    });
    document.querySelectorAll('.we-influence-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.influenceScope;
        const index = Number(editor.dataset.influenceIndex);
        const scopedState = loadScopedState(scope);
        const inf = scopedState.influenceChain?.[index];
        if (!inf) return;
        const trigger = editor.querySelector('.we-influence-edit-trigger').value.trim();
        const impact = editor.querySelector('.we-influence-edit-impact').value.trim();
        if (!trigger || !impact) { showToast('Nguồn kích hoạt và ảnh hưởng trực tiếp không được để trống', true); return; }
        inf.trigger = trigger;
        inf.impact = impact;
        inf.fallout = editor.querySelector('.we-influence-edit-fallout').value.trim();
        saveScopedState(scope, scopedState);
        editingInfluence = null;
        showToast('Đã lưu thay đổi chuỗi ảnh hưởng');
        refresh();
      };
    });
    document.querySelectorAll('.we-influence-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.influenceScope;
        const index = Number(button.dataset.influenceIndex);
        const scopedState = loadScopedState(scope);
        const inf = scopedState.influenceChain?.[index];
        if (!inf || !confirm(`Xoá chuỗi ảnh hưởng"${inf.trigger}"？`)) return;
        scopedState.influenceChain.splice(index, 1);
        saveScopedState(scope, scopedState);
        showToast('Đã xoá chuỗi ảnh hưởng');
        refresh();
      };
    });
    document.querySelectorAll('.we-influence-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.influenceScope;
        const index = Number(button.dataset.influenceIndex);
        const scopedState = loadScopedState(scope);
        const inf = scopedState.influenceChain?.[index];
        if (!inf) return;
        const copy = JSON.parse(JSON.stringify(inf));
        copy._createdRound = Number(scopedState.round) || 0;
        scopedState.influenceChain.push(copy);
        saveScopedState(scope, scopedState);
        showToast('Đã sao chép chuỗi ảnh hưởng');
        refresh();
      };
    });

    // ===== Sự kiện trình chỉnh sửa sự kiện khu vực =====
    document.querySelectorAll('.we-ri-edit').forEach(button => {
      button.onclick = () => {
        editingRI = { active: true, scope: button.dataset.riScope };
        refresh();
      };
    });
    document.querySelectorAll('.we-ri-editor-close').forEach(button => {
      button.onclick = () => { editingRI = null; refresh(); };
    });
    document.querySelectorAll('.we-ri-editor-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-event-editor');
        const scope = editor.dataset.riScope;
        const state = loadScopedState(scope);
        if (!state.regionalIncident) {
          state.regionalIncident = { active: false, title: '', type: '', scope: '', impact: '', duration: 0, cooldown: 0, _retry: false, _retryType: '' };
        }
        const ri = state.regionalIncident;
        ri.active = editor.querySelector('.we-ri-edit-active').value === 'true';
        ri.title = editor.querySelector('.we-ri-edit-title').value.trim();
        ri.type = editor.querySelector('.we-ri-edit-type').value;
        ri.scope = editor.querySelector('.we-ri-edit-scope').value.trim();
        ri.duration = Math.max(0, Number(editor.querySelector('.we-ri-edit-duration').value) || 0);
        ri.cooldown = Math.max(0, Number(editor.querySelector('.we-ri-edit-cooldown').value) || 0);
        ri.impact = editor.querySelector('.we-ri-edit-impact').value.trim();
        saveScopedState(scope, state);
        editingRI = null;
        showToast('Đã lưu thay đổi sự kiện khu vực');
        refresh();
      };
    });
    document.querySelectorAll('.we-ri-delete').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.riScope;
        const state = loadScopedState(scope);
        if (!state.regionalIncident) return;
        if (!confirm('Xoá sự kiện khu vực?')) return;
        state.regionalIncident = { active: false, title: '', type: '', scope: '', impact: '', cooldown: state.regionalIncident.cooldown || 0, _retry: false, _retryType: '' };
        saveScopedState(scope, state);
        showToast('Đã xoá sự kiện khu vực');
        refresh();
      };
    });
    document.querySelectorAll('.we-ri-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.riScope;
        const state = loadScopedState(scope);
        if (!state.regionalIncident) return;
        const copy = JSON.parse(JSON.stringify(state.regionalIncident));
        copy._retry = false;
        copy._retryType = '';
        copy.cooldown = 0;
        state.regionalIncident = copy;
        saveScopedState(scope, state);
        showToast('Đã sao chép sự kiện khu vực (đã đặt lại thời gian hồi)');
        refresh();
      };
    });

    // ===== Bí mật (hành vi bí mật/tài sản) sự kiện trình chỉnh sửa thống nhất =====
    const SECRET_ARR = { action: 'secretActions', asset: 'secretAssets' };

    document.querySelectorAll('.we-secret-edit').forEach(button => {
      button.onclick = () => {
        const list = button.dataset.secretList;
        editingSecret = { scope: button.dataset.secretScope, list, index: Number(button.dataset.secretIndex), view: list };
        refresh();
      };
    });
    document.querySelectorAll('.we-secret-editor-close').forEach(button => {
      button.onclick = () => { editingSecret = null; refresh(); };
    });
    // Dropdown loại: chỉ chuyển đổi biểu mẫu hiển thị(view)，Không thay đổi dữ liệu, không lưu
    document.querySelectorAll('.we-secret-type').forEach(select => {
      select.onchange = () => {
        if (editingSecret) { editingSecret.view = select.value; refresh(); }
      };
    });
    document.querySelectorAll('.we-secret-save').forEach(button => {
      button.onclick = () => {
        const editor = button.closest('.we-secret-editor');
        const scope = editor.dataset.secretScope;
        const list = editor.dataset.secretList;            // Bucket hiện tại của mục
        const index = Number(editor.dataset.secretIndex);
        const view = editor.dataset.secretView;            // Loại mục tiêu (có thể với list khác nhau)
        const state = loadScopedState(scope);
        state.blackbox = state.blackbox || {};
        const srcArr = state.blackbox[SECRET_ARR[list]];
        if (!srcArr || srcArr[index] === undefined) return;

        // theo view Đọc biểu mẫu, lắp ráp mục mục tiêu
        let item, okMsg;
        if (view === 'action') {
          const action = editor.querySelector('.we-secret-f-action').value.trim();
          if (!action) { showToast('Mô tả hành vi không được để trống', true); return; }
          item = { action, witnesses: editor.querySelector('.we-secret-f-witnesses').value.trim() || 'không' };
        } else {
          const name = editor.querySelector('.we-secret-f-name').value.trim();
          if (!name) { showToast('Tên tài sản không được để trống', true); return; }
          item = {
            name,
            exposure: Math.min(100, Math.max(0, Number(editor.querySelector('.we-secret-f-exposure').value) || 0)),
            status: editor.querySelector('.we-secret-f-status').value
          };
        }

        if (view === list) {
          srcArr[index] = item;                            // Cập nhật tại chỗ
          okMsg = view === 'action' ? 'Đã lưu hành vi bí mật' : 'Đã lưu tài sản bí mật';
        } else {
          srcArr.splice(index, 1);                         // Xoá khỏi bucket cũ
          const arrKey = SECRET_ARR[view];
          if (!Array.isArray(state.blackbox[arrKey])) state.blackbox[arrKey] = [];
          state.blackbox[arrKey].push(item);               // Rơi vào bucket mới = Chuyển đổi loại thực sự
          okMsg = view === 'action' ? 'Đã chuyển thành hành vi bí mật' : 'Đã chuyển thành tài sản bí mật';
        }
        saveScopedState(scope, state);
        editingSecret = null;
        showToast(okMsg);
        refresh();
      };
    });
    document.querySelectorAll('.we-secret-del').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.secretScope;
        const list = button.dataset.secretList;
        const index = Number(button.dataset.secretIndex);
        const state = loadScopedState(scope);
        const arr = state.blackbox?.[SECRET_ARR[list]];
        if (!arr || arr[index] === undefined) return;
        if (!confirm(list === 'action' ? 'Xoá hành vi bí mật?' : 'Xoá tài sản bí mật?')) return;
        arr.splice(index, 1);
        saveScopedState(scope, state);
        showToast('Đã xoá');
        refresh();
      };
    });
    document.querySelectorAll('.we-secret-copy').forEach(button => {
      button.onclick = () => {
        const scope = button.dataset.secretScope;
        const list = button.dataset.secretList;
        const index = Number(button.dataset.secretIndex);
        const state = loadScopedState(scope);
        const arr = state.blackbox?.[SECRET_ARR[list]];
        if (!arr || arr[index] === undefined) return;
        arr.splice(index + 1, 0, JSON.parse(JSON.stringify(arr[index])));  // Chèn gần nhất
        saveScopedState(scope, state);
        showToast('Đã sao chép');
        refresh();
      };
    });

    // ===== Sự kiện điều hướng =====
    const backBtn = document.getElementById('we-btn-back');
    if (backBtn) backBtn.onclick = () => { _currentView = 'home'; refresh(); };

    const settingsOpenBtn = document.getElementById('we-btn-settings-open');
    if (settingsOpenBtn) settingsOpenBtn.onclick = () => { _currentView = 'settings'; refresh(); };

    document.querySelectorAll('.we-nav-row[data-view]').forEach(row => {
      row.onclick = () => {
        if (_selectedNavView === row.dataset.view) {
          // Nhấp đúp: vào phân trang
          _selectedNavView = null;
          _currentView = row.dataset.view;
          refresh();
        } else {
          // Nhấp lần đầu: chọn dòng này
          _selectedNavView = row.dataset.view;
          refresh();
        }
      };
    });

    // Nhấp ra ngoài danh sách điều hướng để huỷ chọn
    const panelBody = panelBodyElement;
    if (panelBody) {
      panelBody.onclick = (e) => {
        if (_currentView === 'home' && _selectedNavView && !e.target.closest('.we-nav-row')) {
          _selectedNavView = null;
          refresh();
        }
      };
    }

    // ===== Thu gọn khối/Mở rộng sự kiện =====
    document.querySelectorAll('.we-section-toggle').forEach(toggle => {
      toggle.onclick = () => {
        const sectionId = toggle.dataset.section;
        sectionCollapsed[sectionId] = !sectionCollapsed[sectionId];
        const body = document.getElementById('we-section-body-' + sectionId);
        const arrow = document.getElementById('we-section-arrow-' + sectionId);
        if (body) body.style.display = sectionCollapsed[sectionId] ? 'none' : '';
        if (arrow) arrow.textContent = sectionCollapsed[sectionId] ? '▶' : '▼';
      };
    });

    // [FIX] Chuyển tab trang cài đặt: thuần CSS hiển thị/ẩn, không render lại (bảo vệ nội dung nhập + Trường thường trú DOM đảm bảo lưu không mất)
    document.querySelectorAll('.we-settings-tab').forEach(tab => {
      tab.onclick = () => {
        const key = tab.dataset.tab;
        _settingsTab = key;
        document.querySelectorAll('.we-settings-tab').forEach(t =>
          t.classList.toggle('we-settings-tab--active', t.dataset.tab === key));
        document.querySelectorAll('.we-settings-panel').forEach(p =>
          p.style.display = (p.dataset.tab === key) ? '' : 'none');
        // [FIX] Chuyển sang gỡ lỗi tab khi, làm mới cục bộ renderDebug Kéo dữ liệu suy diễn vòng mới nhất (không động đến cái khác tab nhập)
        if (key === 'debug') { refreshDebugRender(); refreshPresetManage(); }
      };
    });

    // 「Chuyển đổi dropdown phiên bản trong thẻ Giới thiệu: tái sử dụng #we-preset-select mô hình (nhấp để bật lên danh sách cuộn gốc).
    //   Thuần CSS hiển thị/ẩn, không render lại, không chạm vào cái khác tab。
    const clSel = document.getElementById('we-changelog-select');
    if (clSel) {
      clSel.onchange = () => {
        const ver = clSel.value;
        document.querySelectorAll('.we-changelog-panel').forEach(p =>
          p.style.display = (p.dataset.ver === ver) ? '' : 'none');
      };
    }

    const refreshBtn = document.getElementById('we-btn-refresh');
    if (refreshBtn) refreshBtn.onclick = () => refresh();

    // —— Lọc regex: render dòng trạng thái + Nút kiểm thử ——
    // Đem core.validateFilterRegex kết quả viết thành we-hint dòng trạng thái (tái sử dụng chatcache/backfill của we-hint mô hình).
    function renderFilterStatus(v, prefix) {
      const el = document.getElementById('we-filter-status');
      if (!el) return;
      const pfx = prefix || '';
      if (!v || (!v.ok && !v.bad.length)) { el.textContent = pfx + '（chưa điền regex)'; return; }
      if (!v.bad.length) { el.textContent = pfx + `✅ ${v.ok} điều đều có hiệu lực`; return; }
      let s = pfx + `⚠️ ${v.ok} điều có hiệu lực / ${v.bad.length} điều thất bại:`;
      for (const b of v.bad) s += `\n dòng ${b.line} 「${b.raw}」không hợp lệ:${b.reason}`;
      el.textContent = s;
    }

    const testBtn = document.getElementById('we-btn-filter-test');
    if (testBtn) {
      testBtn.onclick = () => {
        const core = window.WORLD_ENGINE_CORE;
        const raw = (document.getElementById('we-filter-regex')?.value) || '';
        if (!raw.trim()) { showToast('Chưa điền regex', true); renderFilterStatus(null); return; }
        if (!core || !core.validateFilterRegex) { showToast('core Module không khả dụng', true); return; }
        const v = core.validateFilterRegex(raw);
        if (v.bad.length) { renderFilterStatus(v, 'Kiểm thử huỷ bỏ——'); showToast(`Có ${v.bad.length} điều regex không hợp lệ, vui lòng sửa trước`, true); return; }
        // Lấy một văn bản hội thoại không rỗng gần nhất (không giới hạn user/ai，Tiếp tục dùng manualEvolve Lấy chat mô hình của)
        let sample = '';
        try {
          const ctx = SillyTavern.getContext();
          const chat = (ctx && ctx.chat) || [];
          for (let i = chat.length - 1; i >= 0; i--) {
            const t = chat[i] && String(chat[i].mes || '').trim();
            if (t) { sample = String(chat[i].mes); break; }
          }
        } catch (e) {}
        if (!sample) { showToast('Chat hiện tại không có văn bản có thể kiểm thử', true); return; }
        // Chạy bộ lọc + Tích luỹ số chỗ xoá theo thứ tự (cùng filterDialogue cùng thứ tự: mỗi điều trên kết quả của điều trước replace）
        let removed = 0, work = sample;
        for (const e of v.entries) {
          try {
            const re = new RegExp(e.pattern, e.flags);
            let m, n = 0;
            while ((m = re.exec(work)) !== null) { n++; if (m.index === re.lastIndex) re.lastIndex++; }
            work = work.replace(re, '');
            removed += n;
          } catch (err) { /* Sẽ không vào */ }
        }
        const filtered = work;
        const before = sample.slice(0, 60), after = filtered.slice(0, 60);
        const el = document.getElementById('we-filter-status');
        if (el) el.textContent = `Đã xoá ${removed} chỗ.\n Trước: ${before}${sample.length > 60 ? '…' : ''}\nsau: ${after}${filtered.length > 60 ? '…' : ''}`;
        showToast(`Đã xoá ${removed} chỗ`);
      };
    }

    // —— Lọc regex [Chế độ đơn giản]: Tự động tạo thẻ đánh dấu <tag>[\s\S]*?</tag>\n? ——
    // Tách rời: Tầng dưới vẫn là #we-filter-regex hộp văn bản(evolveFilterRegex trường)làm nguồn sự thật duy nhất.
    //   đánh dấu ↔ đồng bộ hai chiều hộp văn bản; không phải <tag> dòng có định dạng(tạp mục người dùng viết tay)giữ nguyên như cũ, không đưa vào danh sách đánh dấu.
    // phân tích ngược chỉ nhận chuẩn <tag>...</tag> định dạng; có ~? / có thuộc tính / /pat/g / Thuần pattern tạp mục → coi là viết tay nâng cao, giữ lại.
    const SIMPLE_TAG_LINE = /^<([a-zA-Z_][\w-]*)>[\s\S]*?<\/\1>(?:\\n\?)?$/;
    const SCAN_TAG_RE = /<([a-zA-Z_][\w-]*)/g;

    // Danh sách thẻ hiện tại:{ name, checked }[]。dẫn xuất không trạng thái, từ textarea phân tích ngược + quét/thêm thủ công tích luỹ.
    let _filterTags = [];

    // từ textarea phân tích ngược ra chuẩn <tag> thẻ đánh dấu có định dạng (dòng không chuẩn coi là viết tay nâng cao, trả về tags + dòng tạp mục được giữ lại)
    function parseTextareaTags(raw) {
      const tags = [];
      const advanced = [];
      for (const line of String(raw || '').split('\n')) {
        const m = line.match(SIMPLE_TAG_LINE);
        if (m) { if (!tags.includes(m[1])) tags.push(m[1]); }
        else if (line.trim()) advanced.push(line);
      }
      return { tags, advanced };
    }

    // thẻ đánh dấu → tạo dòng mẫu chuẩn; hợp nhất với dòng viết tay nâng cao rồi ghi lại textarea
    function writeTextareaFromTags(checkedTags, advancedLines) {
      const tagLines = checkedTags.map(t => `<${t}>[\\s\\S]*?</${t}>\\n?`);
      const all = tagLines.concat(advancedLines);
      const ta = document.getElementById('we-filter-regex');
      if (ta) ta.value = all.join('\n');
    }

    // kết xuất danh sách đánh dấu chip danh sách
    function renderFilterTags() {
      const box = document.getElementById('we-filter-tags');
      if (!box) return;
      box.innerHTML = '';
      for (const t of _filterTags) {
        const chip = document.createElement('label');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border:1px solid var(--we-border,#3a3a3a);border-radius:3px;font-size:12px;cursor:pointer;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = !!t.checked;
        cb.onchange = () => {
          t.checked = cb.checked;
          syncTextareaFromTags();
        };
        const name = document.createElement('span'); name.textContent = t.name;
        const del = document.createElement('span');
        del.textContent = '✕'; del.style.cssText = 'color:var(--we-text3);cursor:pointer;margin-left:2px;';
        del.onclick = (e) => { e.preventDefault(); _filterTags = _filterTags.filter(x => x.name !== t.name); renderFilterTags(); syncTextareaFromTags(); };
        chip.appendChild(cb); chip.appendChild(name); chip.appendChild(del);
        box.appendChild(chip);
      }
    }

    // thay đổi đánh dấu → ghi lại textarea（giữ lại dòng viết tay nâng cao)
    function syncTextareaFromTags() {
      const ta = document.getElementById('we-filter-regex');
      const raw = ta ? ta.value : '';
      const { advanced } = parseTextareaTags(raw);
      const checked = _filterTags.filter(t => t.checked).map(t => t.name);
      writeTextareaFromTags(checked, advanced);
    }

    // textarea sửa thủ công → phân tích ngược cập nhật danh sách đánh dấu (giữ lại trạng thái đánh dấu của các thẻ không chuẩn đã có trong danh sách)
    let _taSyncTimer = null;
    function syncTagsFromTextarea() {
      const ta = document.getElementById('we-filter-regex');
      if (!ta) return;
      const { tags } = parseTextareaTags(ta.value);
      // tags Có textarea chuẩn trong <tag> tên thẻ tương ứng với dòng (coi là đã đánh dấu)
      const tagSet = new Set(tags);
      // đã có trong danh sách: theo textarea có còn nhận nó để cập nhật không checked；thẻ chuẩn không có trong danh sách: thêm vào (đánh dấu)
      for (const t of _filterTags) t.checked = tagSet.has(t.name);
      for (const name of tags) {
        if (!_filterTags.some(t => t.name === name)) _filterTags.push({ name, checked: true });
      }
      renderFilterTags();
    }

    // quét một tin nhắn mới nhất AI trả lời, trích xuất các mục xuất hiện trong đó <xxx tên thẻ
    function scanTagsFromLastAI() {
      let text = '';
      try {
        const ctx = SillyTavern.getContext();
        const chat = (ctx && ctx.chat) || [];
        for (let i = chat.length - 1; i >= 0; i--) {
          const m = chat[i];
          if (m && !m.is_user && String(m.mes || '').trim()) { text = String(m.mes); break; }
        }
      } catch (e) {}
      if (!text) { showToast('không tìm thấy AI trả lời', true); return; }
      const found = [];
      let m;
      SCAN_TAG_RE.lastIndex = 0;
      while ((m = SCAN_TAG_RE.exec(text)) !== null) {
        const name = m[1];
        if (name && !found.includes(name)) found.push(name);
      }
      if (!found.length) { showToast('mới nhất AI không phát hiện thẻ trong câu trả lời', true); return; }
      // hợp nhất vào danh sách: cái đã có giữ nguyên trạng thái đánh dấu, cái mới phát hiện mặc định đánh dấu
      for (const name of found) {
        if (!_filterTags.some(t => t.name === name)) _filterTags.push({ name, checked: true });
      }
      renderFilterTags();
      syncTextareaFromTags();
      showToast(`quét được ${found.length} thẻ`);
    }

    // Ràng buộc: Nút quét
    const scanBtn = document.getElementById('we-btn-filter-scan');
    if (scanBtn) scanBtn.onclick = scanTagsFromLastAI;

    // Ràng buộc: Thêm thủ công
    const addBtn = document.getElementById('we-btn-filter-add');
    const addInput = document.getElementById('we-filter-add-input');
    function doAddTag() {
      const v = (addInput && addInput.value || '').trim();
      if (!v) return;
      if (!/^[a-zA-Z_][\w-]*$/.test(v)) { showToast('Tên thẻ không hợp lệ (chỉ cho phép chữ cái, số, dấu gạch dưới, dấu gạch ngang)', true); return; }
      if (!_filterTags.some(t => t.name === v)) _filterTags.push({ name: v, checked: true });
      if (addInput) addInput.value = '';
      renderFilterTags();
      syncTextareaFromTags();
    }
    if (addBtn) addBtn.onclick = doAddTag;
    if (addInput) addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAddTag(); } });

    // Ràng buộc:textarea sửa thủ công → Phân tích ngược cập nhật đánh dấu (debounce)
    const filterTa = document.getElementById('we-filter-regex');
    if (filterTa) filterTa.addEventListener('input', () => {
      clearTimeout(_taSyncTimer);
      _taSyncTimer = setTimeout(syncTagsFromTextarea, 300);
    });

    // Khởi tạo: Khi mở trang cài đặt, phân tích ngược trạng thái đánh dấu từ trường đã lưu
    syncTagsFromTextarea();

    const saveBtn = document.getElementById('we-save-settings');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const _modeRaw = document.getElementById('we-evolve-mode')?.value;
        const gv = id => document.getElementById(id)?.value;
        const ns = {
          ...(window.WORLD_ENGINE_API ? window.WORLD_ENGINE_API.getSettings(true) : {}),
          apiUrl: document.getElementById('we-api-url')?.value || '',
          apiKey: document.getElementById('we-api-key')?.value || '',
          model: document.getElementById('we-model')?.value || 'gpt-3.5-turbo',
          connectionMode: document.getElementById('we-connection-mode')?.value === 'proxy' ? 'proxy' : 'direct',
          injectIntoPrompt: document.getElementById('we-inject-into-prompt')?.checked !== false,
          syncToChat: document.getElementById('we-sync-to-chat')?.checked === true,
          autoBackup: document.getElementById('we-auto-backup')?.checked === true,
          evolveMode: (_modeRaw === 'manual' || _modeRaw === 'time') ? _modeRaw : 'auto',
          evolveEveryX: Math.max(1, parseInt(document.getElementById('we-evolve-everyx')?.value) || 1),
          evolveReadRounds: Math.max(1, parseInt(document.getElementById('we-evolve-readrounds')?.value) || 1),
          evolveFilterRegex: gv('we-filter-regex') || '',
          displayMode: document.getElementById('we-display-mode')?.value === 'expand' ? 'expand' : 'mask',
          // Chế độ theo thời gian
          evolveTimeFront: Math.max(0, parseInt(gv('we-time-front')) || 0),
          evolveTimeBack: Math.max(0, parseInt(gv('we-time-back')) || 0),
          evolveTimeRe1: gv('we-time-re1') || '', evolveTimeRe2: gv('we-time-re2') || '',
          evolveTimeRe3: gv('we-time-re3') || '', evolveTimeRe4: gv('we-time-re4') || '',
          evolveTimeRe5: gv('we-time-re5') || '', evolveTimeRe6: gv('we-time-re6') || '',
          evolveTimeMul1: parseFloat(gv('we-time-mul1')) || 0,
          evolveTimeMul2: parseFloat(gv('we-time-mul2')) || 0,
          evolveTimeMul3: parseFloat(gv('we-time-mul3')) || 0,
          evolveTimeThreshold: Math.max(1, parseInt(gv('we-time-threshold')) || 1),
          evolveTimeMaxRounds: Math.max(1, parseInt(gv('we-time-maxrounds')) || 10)
        };
        // a Không được vượt quá X（số vòng mỗi lần suy diễn)
        ns.evolveReadRounds = Math.min(ns.evolveReadRounds, ns.evolveEveryX);
        window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify(ns));
        if (window.WORLD_ENGINE_API) window.WORLD_ENGINE_API.getSettings(true);

        // [FIX] Kiểm tra lọc regex sau khi lưu: Tái sử dụng core.validateFilterRegex。Mục không hợp lệ không ngăn cản việc lưu (với giá trị hiện tại clamp nhất quán với mô hình),
        //   nhưng hiển thị hiệu lực trên dòng trạng thái/thất bại+lý do, điều chỉnh bên dưới dựa trên việc có thất bại hay không toast。
        let _filterBad = 0;
        try {
          const _core = window.WORLD_ENGINE_CORE;
          if (_core && _core.validateFilterRegex) {
            const _v = _core.validateFilterRegex(ns.evolveFilterRegex);
            renderFilterStatus(_v, 'Đã lưu:');
            _filterBad = _v.bad.length;
          }
        } catch (e) { /* Kiểm tra thất bại không ảnh hưởng đến việc lưu */ }

        // Chế độ theo thời gian: Ba ô thời gian "có giá trị mới ghi", thời gian hội thoại vòng này sau khi ghi sẽ kích hoạt phán đoán
        if (ns.evolveMode === 'time') {
          const stIn = gv('we-time-state');
          if (stIn != null && stIn !== '') {
            const s2 = core.loadState();
            if (s2) { s2.time = Number(stIn); core.saveState(s2); }
          }
          const cpIn = gv('we-time-checkpoint');
          if (cpIn != null && cpIn !== '') {
            const cp2 = core.restoreCheckpoint();
            if (cp2) { cp2.time = Number(cpIn); core.saveCheckpoint(cp2); }
          }
          const curIn = gv('we-time-current');
          if (curIn != null && curIn !== '') {
            window.WORLD_ENGINE?.manualTimeEvolve?.(Number(curIn));
          }
        }

        window.WORLD_ENGINE?.applyInjection?.();
        showToast(_filterBad > 0 ? `Đã lưu, nhưng có ${_filterBad} regex không hợp lệ` : 'Cài đặt đã lưu', _filterBad > 0);
      };
    }

    // Chuyển đổi chế độ suy diễn: Hiển thị theo vòng X/a，Hiển thị nhóm thời gian theo thời gian, thủ công đều ẩn
    const evolveModeSel = document.getElementById('we-evolve-mode');
    if (evolveModeSel) {
      evolveModeSel.onchange = () => {
        const v = evolveModeSel.value;
        const roundShow = v === 'auto' ? '' : 'none';
        const timeShow = v === 'time' ? '' : 'none';
        const g1 = document.getElementById('we-evolve-everyx-group');
        if (g1) g1.style.display = roundShow;
        const g2 = document.getElementById('we-evolve-readrounds-group');
        if (g2) g2.style.display = roundShow;
        const g3 = document.getElementById('we-evolve-time-group');
        if (g3) g3.style.display = timeShow;
      };
    }

    const worldbookList = document.getElementById('we-worldbook-list');
    if (worldbookList) {
      const worldbook = window.WORLD_ENGINE_WORLDBOOK;
      const summary = document.getElementById('we-worldbook-summary');
      const reloadBtn = document.getElementById('we-worldbook-reload');
      const selectAllBtn = document.getElementById('we-worldbook-select-all');
      const clearAllBtn = document.getElementById('we-worldbook-clear-all');
      const saveWorldbookBtn = document.getElementById('we-worldbook-save');

      function updateWorldbookSummary() {
        const checkboxes = [...worldbookList.querySelectorAll('.we-worldbook-entry-check')];
        const selected = checkboxes.filter(checkbox => checkbox.checked);
        const chars = selected.reduce((total, checkbox) => total + Number(checkbox.dataset.chars || 0), 0);
        if (summary) summary.textContent = `${selected.length}/${checkboxes.length} mục đã chọn, khoảng ${chars} ký tự`;
      }

      async function loadWorldbookEntries() {
        if (!worldbook) {
          worldbookList.innerHTML = '<div class="we-empty">Module Worldbook chưa tải</div>';
          return;
        }
        worldbookList.innerHTML = '<div class="we-empty">đang đọc Worldbook chat hiện tại...</div>';
        if (reloadBtn) reloadBtn.disabled = true;
        try {
          const entries = await worldbook.loadCurrentEntries();
          const currentChatId = worldbook.getChatId ? worldbook.getChatId() : (window.WORLD_ENGINE_CORE?.getChatId?.() || 'default');
          // Dùng hasSelection() phân biệt"Chưa từng lưu"và"Đã lưu mảng rỗng"，Tránh kích hoạt nhầm tự động chọn tất cả sau khi làm mới
          const isFirstVisit = worldbook.hasSelection ? !worldbook.hasSelection() : false;
          const savedIds = worldbook.getSelectedIds();
          _wbCachedEntries = entries;
          _wbCachedChatId = currentChatId;
          _wbCachedOverrides = worldbook.getOverrides ? { ...worldbook.getOverrides() } : {};
          // Lần đầu vào chat này (không có bản ghi trong lưu trữ) thì tự động chọn tất cả các mục đã bật
          if (isFirstVisit && entries.length) {
            const allIds = entries.filter(e => !e.disabled).map(e => e.id);
            worldbook.saveSelectedIds(allIds);
            _wbCachedSelectedIds = new Set(allIds);
            showToast(`Đã tự động chọn tất cả ${allIds.length} mục Worldbook`);
          } else {
            const enabledIds = new Set(entries.filter(e => !e.disabled).map(e => e.id));
            const validSavedIds = savedIds.filter(id => enabledIds.has(id));
            _wbCachedSelectedIds = new Set(validSavedIds);
            // Chỉ ghi lại khi có mục khớp, tránh sau khi làm mới entry['world chưa tải dẫn đến ID tất cả không khớp'],
            // nhầm lẫn xoá bản ghi đã lưu thành []（sau khi xoá, lần mở bảng điều khiển tiếp theo sẽ kích hoạt nhầm tự động chọn tất cả)
            if (validSavedIds.length > 0 && validSavedIds.length !== savedIds.length) {
              worldbook.saveSelectedIds(validSavedIds);
            }
          }
          renderWorldbookList();
        } catch(error) {
          worldbookList.innerHTML = `<div class="we-empty">Đọc thất bại:${u(error.message)}</div>`;
          if (summary) summary.textContent = 'Đọc thất bại';
          _wbCachedEntries = null;
          _wbCachedSelectedIds = null;
          _wbCachedOverrides = null;
          _wbCachedChatId = null;
        } finally {
          if (reloadBtn) reloadBtn.disabled = false;
        }
      }

      function renderWorldbookList() {
        const entries = _wbCachedEntries;
        const selectedIds = _wbCachedSelectedIds || new Set();
        const overrides = _wbCachedOverrides || {};
        const triggerOn = !!(window.WORLD_ENGINE_WORLDBOOK?.triggerEnabled?.());
        if (!entries || !entries.length) {
          worldbookList.innerHTML = '<div class="we-empty">Chat hiện tại chưa liên kết mục Worldbook có thể đọc</div>';
          if (summary) summary.textContent = '0 mục tuỳ chọn';
          return;
        }
        const groups = new Map();
        for (const entry of entries) {
          if (!groups.has(entry.world)) groups.set(entry.world, []);
          groups.get(entry.world).push(entry);
        }
        worldbookList.innerHTML = [...groups.entries()].map(([world, worldEntries]) => {
          const expanded = expandedWorldbookGroups.has(world);
          return `
          <div class="we-worldbook-group" data-worldbook-group="${u(world)}">
            <div class="we-worldbook-group-header">
              <span>${expanded ? '▼' : '▶'}</span>
              <div class="we-worldbook-group-title">
                <div>${u(world)} <span>${worldEntries.length}mục</span></div>
              </div>
              <div class="we-worldbook-group-actions">
                <button type="button" data-worldbook-group-action="select">chọn tất cả</button>
                <button type="button" data-worldbook-group-action="clear">bỏ chọn tất cả</button>
              </div>
            </div>
            <div class="we-worldbook-group-body" style="${expanded ? '' : 'display:none;'}">
            ${worldEntries.map(entry => {
              const keys = entry.keys || [];
              const badge = entry.constant ? '🔵' : (entry.vectorized ? '🔗' : (keys.length ? '🟢' : '⚪'));
              const keyHint = keys.length ? ' · Từ khoá:' + keys.slice(0, 5).join('、') + (keys.length > 5 ? '…' : '') : '';
              const ov = overrides[entry.id] || 'auto';
              const overrideSel = (triggerOn && !entry.disabled) ? `
                <select class="we-wb-override" data-entry-id="${u(entry.id)}" title="Cách kích hoạt mục này">
                  <option value="auto"${ov === 'auto' ? ' selected' : ''}>theo Tavern</option>
                  <option value="const"${ov === 'const' ? ' selected' : ''}>buộc luôn thường trú</option>
                  <option value="key"${ov === 'key' ? ' selected' : ''}>từ khoá bắt buộc</option>
                  <option value="off"${ov === 'off' ? ' selected' : ''}>tắt</option>
                </select>` : '';
              return `
              <div class="we-worldbook-entry${entry.disabled ? ' is-disabled' : ''}">
                <label class="we-wb-entry-main">
                  <input class="we-worldbook-entry-check" type="checkbox" value="${u(entry.id)}" data-chars="${entry.content.length}" ${selectedIds.has(entry.id) && !entry.disabled ? 'checked' : ''} ${entry.disabled ? 'disabled' : ''}>
                  <span>
                    <strong>${badge} ${u(entry.title)}</strong>
                    <small>${entry.content.length} ký tự${u(keyHint)}${entry.disabled ? ' · Đã vô hiệu hoá trong Worldbook' : ''}</small>
                  </span>
                </label>${overrideSel}
              </div>`;
            }).join('')}
            </div>
          </div>`;
        }).join('');
          worldbookList.querySelectorAll('.we-worldbook-entry-check').forEach(checkbox => {
            checkbox.onchange = () => {
              _wbCachedSelectedIds = new Set([...worldbookList.querySelectorAll('.we-worldbook-entry-check:checked')].map(cb => cb.value));
              updateWorldbookSummary();
            };
          });
          worldbookList.querySelectorAll('.we-wb-override').forEach(sel => {
            sel.onchange = () => {
              const id = sel.dataset.entryId;
              if (!id) return;
              if (!_wbCachedOverrides) _wbCachedOverrides = {};
              if (sel.value === 'auto') delete _wbCachedOverrides[id];
              else _wbCachedOverrides[id] = sel.value;
            };
          });
          worldbookList.querySelectorAll('.we-worldbook-group-header').forEach(header => {
            header.onclick = () => {
              const body = header.nextElementSibling;
              const arrow = header.querySelector('span');
              if (body) {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? '' : 'none';
                if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
                const world = header.closest('.we-worldbook-group')?.dataset.worldbookGroup;
                if (world) {
                  if (isHidden) expandedWorldbookGroups.add(world);
                  else expandedWorldbookGroups.delete(world);
                }
              }
            };
          });
          worldbookList.querySelectorAll('[data-worldbook-group-action]').forEach(button => {
            button.onclick = (e) => {
              e.stopPropagation();
              const group = button.closest('.we-worldbook-group');
              if (!group) return;
              const checked = button.dataset.worldbookGroupAction === 'select';
              group.querySelectorAll('.we-worldbook-entry-check:not(:disabled)').forEach(checkbox => {
                checkbox.checked = checked;
                checkbox.onchange();
              });
            };
          });
          updateWorldbookSummary();
          // Khôi phục vị trí cuộn (refresh() tái tạo DOM sau đó bù lại)
          if (_wbScrollTop) worldbookList.scrollTop = _wbScrollTop;
      }

      if (reloadBtn) reloadBtn.onclick = () => { _wbCachedEntries = null; _wbCachedChatId = null; loadWorldbookEntries(); };
      if (selectAllBtn) selectAllBtn.onclick = () => {
        worldbookList.querySelectorAll('.we-worldbook-entry-check:not(:disabled)').forEach(checkbox => {
          checkbox.checked = true;
          checkbox.onchange();
        });
      };
      if (clearAllBtn) clearAllBtn.onclick = () => {
        worldbookList.querySelectorAll('.we-worldbook-entry-check').forEach(checkbox => {
          checkbox.checked = false;
          checkbox.onchange();
        });
      };
      if (saveWorldbookBtn) saveWorldbookBtn.onclick = () => {
        const ids = [..._wbCachedSelectedIds];
        if (worldbook.saveSelection) worldbook.saveSelection(ids, _wbCachedOverrides || {});
        else worldbook.saveSelectedIds(ids);
        showToast(`Đã lưu ${_wbCachedSelectedIds.size} mục Worldbook dưới nền`);
        updateWorldbookSummary();
      };
      const triggerBox = document.getElementById('we-worldbook-trigger');
      if (triggerBox) triggerBox.onchange = () => {
        const wapi = window.WORLD_ENGINE_API;
        const cur = wapi && wapi.getSettings ? wapi.getSettings(true) : {};
        window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({ ...cur, worldbookTrigger: triggerBox.checked }));
        if (wapi && wapi.getSettings) wapi.getSettings(true);
        showToast(triggerBox.checked ? 'Đã bật kích hoạt đèn xanh/lam' : 'Đã tắt kích hoạt đèn xanh/lam (khôi phục tiêm tất cả đã chọn)');
        renderWorldbookList(); // Render lại để hiển thị/Ẩn dropdown ghi đè kích hoạt của mỗi mục
      };
      // refresh() tái tạo DOM khi, nếu chatId không đổi và đã có cache, render trực tiếp, tránh mất tick chọn
      const currentChatIdNow = worldbook.getChatId ? worldbook.getChatId() : (window.WORLD_ENGINE_CORE?.getChatId?.() || 'default');
      if (_wbCachedEntries && _wbCachedChatId === currentChatIdNow) {
        renderWorldbookList();
      } else {
        loadWorldbookEntries();
      }
    }

    const resetBtn = document.getElementById('we-reset-world');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm('Đặt lại toàn bộ trạng thái thế giới và ký ức của chat hiện tại? Không thể khôi phục!')) {
          core.clearState();
          core.clearCheckpoint();
          core.saveFingerprint(String(core.getChatLayer()));
          showToast('Thế giới đã đặt lại');
          refresh();
        }
      };
    }

    const settingsToggle = document.querySelector('.we-settings-toggle');
    if (settingsToggle) {
      settingsToggle.onclick = () => {
        const body = document.getElementById('we-settings-body');
        const arrow = settingsToggle.querySelector('.we-toggle-arrow');
        if (body) {
          const isHidden = body.style.display === 'none';
          body.style.display = isHidden ? 'block' : 'none';
          if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
        }
      };
    }

    const debugToggle = document.querySelector('.we-debug-toggle');
    if (debugToggle) {
      debugToggle.onclick = () => {
        const body = document.getElementById('we-debug-body');
        const arrow = debugToggle.querySelector('.we-toggle-arrow');
        if (body) {
          const isHidden = body.style.display === 'none';
          body.style.display = isHidden ? 'block' : 'none';
          if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
          if (!isHidden) { refreshDebugRender(); refreshPresetManage(); } // [FIX] Làm mới cục bộ dữ liệu thẻ debug, không đổi thứ khác tab Nhập
        }
      };
    }

    const fetchBtn = document.getElementById('we-fetch-models');
    if (fetchBtn) {
      fetchBtn.onclick = async () => {
        const api = window.WORLD_ENGINE_API;
        if (!api) { showToast('API Module chưa tải', true); return; }
        window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({
          ...(api.getSettings ? api.getSettings(true) : {}),
          apiUrl: document.getElementById('we-api-url')?.value || '',
          apiKey: document.getElementById('we-api-key')?.value || '',
          model: document.getElementById('we-model')?.value || '',
          connectionMode: document.getElementById('we-connection-mode')?.value === 'proxy' ? 'proxy' : 'direct',
          injectIntoPrompt: document.getElementById('we-inject-into-prompt')?.checked !== false
        }));
        if (api.getSettings) api.getSettings(true);
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Đang lấy...';
        try {
          const models = await api.fetchModelList();
          const select = document.getElementById('we-model-list');
          if (select) {
            select.innerHTML = '<option value="">-- Chọn mô hình --</option>' +
              models.map(m => '<option value="' + u(m) + '">' + u(m) + '</option>').join('');
            select.style.display = 'block';
            select.onchange = () => {
              const modelInput = document.getElementById('we-model');
              if (modelInput) modelInput.value = select.value;
            };
          }
          showToast('Lấy được ' + models.length + ' mô hình');
        } catch(e) {
          showToast('' + e.message, true);
        }
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = 'Lấy danh sách';
      };
    }

    const exportBtn = document.getElementById('we-export-data');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const s = core.loadState();
        const checkpoint = core.restoreCheckpoint();
        const clean = core.getCleanExport(s);
        const cleanCheckpoint = checkpoint ? core.getCleanExport(checkpoint) : null;
        const exportData = {
          version: '1.2',
          exportedAt: new Date().toISOString(),
          chatId: core.getChatId(),
          state: clean,
          checkpoint: cleanCheckpoint,
          fingerprint: core.loadFingerprint()
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'world-engine-' + core.getChatId() + '-' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('đã xuất');
      };
    }

    const importBtn = document.getElementById('we-import-data');
    const importFile = document.getElementById('we-import-file');
    if (importBtn && importFile) {
      importBtn.onclick = () => importFile.click();
      importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            const isRegionalIncident = data && typeof data === 'object' &&
              Object.prototype.hasOwnProperty.call(data, 'active') &&
              Object.prototype.hasOwnProperty.call(data, 'title') &&
              Object.prototype.hasOwnProperty.call(data, 'impact');
            if (isRegionalIncident) {
              const state = core.loadState();
              state.regionalIncident = {
                active: data.active === true || data.active === 'true',
                title: String(data.title || ''),
                type: String(data.type || 'other'),
                scope: String(data.scope || ''),
                impact: String(data.impact || ''),
                cooldown: Math.max(0, Number(data.cooldown) || 0),
                _retry: data._retry === true || data._retry === 'true',
                _retryType: String(data._retryType || '')
              };
              core.saveState(state);
              showToast('Nhập sự kiện khu vực thành công');
              refresh();
              return;
            }
            if (data.version !== '1.2') { showToast('Phiên bản định dạng bản lưu không được hỗ trợ', true); return; }
            if (!data.state) { showToast('Tệp nhập không hợp lệ', true); return; }
            const s = data.state;
            if (s.round === undefined) { showToast('Thiếu round trường', true); return; }
            core.importState(s);
            if (Object.prototype.hasOwnProperty.call(data, 'checkpoint')) {
              if (data.checkpoint) {
                data.checkpoint.chatLayer = core.getChatLayer();
                core.saveCheckpoint(data.checkpoint);
              }
              else core.clearCheckpoint();
            }
            core.saveFingerprint(String(core.getChatLayer()));
            showToast('Nhập thành công! Vòng ' + s.round + 'vòng, ' + (s.memories||[]).filter(m=>m.type==='ledger').length + 'sổ cái vòng');
            refresh();
          } catch(err) {
            showToast('Phân tích thất bại: ' + err.message, true);
          }
        };
        reader.readAsText(file);
        importFile.value = '';
      };
    }

    // ===== prompt bổ sung nhập / xuất / xoá =====
    function getTonePrompt() {
      return (window.WORLD_ENGINE_API?.getSettings(true)?.tonePrompt || '');
    }
    function saveTonePrompt(text) {
      const wapi = window.WORLD_ENGINE_API;
      const cur = wapi && wapi.getSettings ? wapi.getSettings(true) : {};
      window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({ ...cur, tonePrompt: text }));
      if (wapi && wapi.getSettings) wapi.getSettings(true);
    }
    function updateToneStatus() {
      const el = document.getElementById('we-tone-status');
      if (!el) return;
      const t = getTonePrompt().trim();
      el.textContent = t ? `Hiện đã cài đặt prompt bổ sung (${t.length}  chữ)` : 'Hiện chưa cài đặt prompt bổ sung';
    }
    updateToneStatus();

    const toneImportBtn = document.getElementById('we-tone-import');
    const toneFile = document.getElementById('we-tone-file');
    if (toneImportBtn && toneFile) {
      toneImportBtn.onclick = () => toneFile.click();
      toneFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = String(ev.target.result || '').trim();
          if (!text) { showToast('Tệp trống', true); return; }
          saveTonePrompt(text);
          updateToneStatus();
          showToast('Đã nhập prompt bổ sung');
        };
        reader.readAsText(file);
        toneFile.value = '';
      };
    }

    const toneExportBtn = document.getElementById('we-tone-export');
    if (toneExportBtn) {
      toneExportBtn.onclick = () => {
        const t = getTonePrompt();
        if (!t.trim()) { showToast('Hiện không có prompt bổ sung để xuất', true); return; }
        const blob = new Blob([t], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'world-engine-tone-' + Date.now() + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất prompt bổ sung');
      };
    }

    const toneClearBtn = document.getElementById('we-tone-clear');
    if (toneClearBtn) {
      toneClearBtn.onclick = () => {
        if (!getTonePrompt().trim()) { showToast('Hiện không có prompt bổ sung', true); return; }
        saveTonePrompt('');
        updateToneStatus();
        showToast('Đã xoá prompt bổ sung');
      };
    }

    // ===== cache & bản lưu Tavern =====
    (function setupChatcacheSection() {
      const cc = window.WORLD_ENGINE_CHATCACHE;
      const listEl = document.getElementById('we-chatcache-snapshots');
      if (!cc || !listEl) return; // Không ở trang cài đặt hoặc thiếu module

      const statusEl = document.getElementById('we-chatcache-status');
      const fmtTime = (ms) => {
        if (!ms) return '';
        const d = new Date(ms), p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      };

      function render() {
        const st = cc.getStatus();
        if (statusEl) {
          if (!st.usable) statusEl.textContent = 'Hiện không có chat khả dụng (vui lòng mở một nhân vật trước/chat nhóm).';
          else if (!st.apiAvailable) statusEl.textContent = 'Phiên bản Tavern hiện tại không hỗ trợ ghi chat_metadata，Cache Tavern không khả dụng.';
          else statusEl.textContent = `đồng bộ thời gian thực${st.syncEnabled ? 'Đã bật' : 'Đã tắt'} · Bản sửa đổi cục bộ ${st.localRev} / đám mây ${st.liveRev} · Tổng cộng ${st.snapshotCount} bản lưu`;
        }
        const snaps = cc.listSnapshots();
        if (!snaps.length) { listEl.innerHTML = '<div class="we-empty">Chưa có bản lưu</div>'; return; }
        listEl.innerHTML = snaps.map(s => `
          <div class="we-snapshot-row" data-snap-id="${u(s.id)}">
            <div class="we-snapshot-main">
              <div class="we-snapshot-name"><span class="we-snapshot-badge${s.auto ? ' is-auto' : ''}">${s.auto ? 'tự động' : 'thủ công'}</span>${u(s.name)}</div>
              <div class="we-snapshot-meta">Thứ  ${s.round || 0}  vòng · ${fmtTime(s.createdAt)}</div>
            </div>
            <div class="we-snapshot-actions">
              <button class="we-icon-btn" data-snap-action="restore" title="Khôi phục về chat hiện tại"><i class="fa-solid fa-rotate-left"></i></button>
              <button class="we-icon-btn" data-snap-action="rename" title="đổi tên"><i class="fa-solid fa-pen"></i></button>
              <button class="we-icon-btn" data-snap-action="export" title="xuất JSON"><i class="fa-solid fa-download"></i></button>
              <button class="we-icon-btn" data-snap-action="delete" title="xoá"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`).join('');
        listEl.querySelectorAll('[data-snap-action]').forEach(btn => {
          btn.onclick = () => {
            const row = btn.closest('.we-snapshot-row');
            const id = row && row.dataset.snapId;
            if (!id) return;
            const action = btn.dataset.snapAction;
            const snap = cc.listSnapshots().find(s => s.id === id);
            if (action === 'restore') {
              if (!confirm(`Khôi phục bản lưu 「${snap ? snap.name : id}」vào chat hiện tại?\n Trạng thái hiện tại sẽ được tự động sao lưu trước, có thể khôi phục lại sau.`)) return;
              if (cc.restoreSnapshot(id)) { showToast('Đã khôi phục bản lưu'); refresh(); }
              else showToast('Khôi phục thất bại', true);
            } else if (action === 'rename') {
              const name = prompt('Tên bản lưu mới:', snap ? snap.name : '');
              if (name == null) return;
              if (cc.renameSnapshot(id, name)) { showToast('Đã đổi tên'); render(); }
            } else if (action === 'export') {
              const obj = cc.exportSnapshot(id);
              if (!obj) { showToast('Xuất thất bại', true); return; }
              const safe = String(obj.name || id).replace(/[^\w Một-Dụ-]+/g, '_');
              setupDownload(JSON.stringify(obj, null, 2), 'we-snapshot-' + safe + '-' + Date.now() + '.json');
              showToast('Đã xuất bản lưu');
            } else if (action === 'delete') {
              if (!confirm(`Xoá bản lưu 「${snap ? snap.name : id}」？Không thể khôi phục.`)) return;
              if (cc.deleteSnapshot(id)) { showToast('Đã xoá'); render(); }
            }
          };
        });
      }

      // Có hiệu lực ngay và lưu trữ vĩnh viễn công tắc đơn (cùng saveTonePrompt cùng chế độ)
      const persist = (key, val) => {
        const wapi = window.WORLD_ENGINE_API;
        const cur = wapi && wapi.getSettings ? wapi.getSettings(true) : {};
        window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({ ...cur, [key]: val }));
        if (wapi && wapi.getSettings) wapi.getSettings(true);
      };

      const syncBox = document.getElementById('we-sync-to-chat');
      if (syncBox) syncBox.onchange = () => {
        persist('syncToChat', syncBox.checked);
        if (syncBox.checked && cc.pushLiveNow) cc.pushLiveNow(); // Bật sẽ gieo hạt cục bộ vào chat
        showToast(syncBox.checked ? 'Đã bật đồng bộ đa thiết bị' : 'Đã tắt đồng bộ đa thiết bị');
        render();
      };
      const autoBox = document.getElementById('we-auto-backup');
      if (autoBox) autoBox.onchange = () => {
        persist('autoBackup', autoBox.checked);
        showToast(autoBox.checked ? 'Đã bật tự động sao lưu' : 'Đã tắt tự động sao lưu');
      };

      const ccSaveBtn = document.getElementById('we-chatcache-save');
      if (ccSaveBtn) ccSaveBtn.onclick = () => {
        const name = prompt('Đặt tên cho bản lưu này:', 'bản lưu ' + fmtTime(Date.now()));
        if (name == null) return;
        if (cc.createSnapshot(name)) { showToast('Đã lưu'); render(); }
        else showToast('Lưu thất bại (chat hiện tại không có dữ liệu thế giới hoặc không thể ghi)', true);
      };

      const ccImportBtn = document.getElementById('we-chatcache-import');
      const ccImportFile = document.getElementById('we-chatcache-import-file');
      if (ccImportBtn && ccImportFile) {
        ccImportBtn.onclick = () => ccImportFile.click();
        ccImportFile.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const obj = JSON.parse(ev.target.result);
              if (cc.importSnapshot(obj)) { showToast('Đã nhập bản lưu'); render(); }
              else showToast('Không phải tệp bản lưu hợp lệ', true);
            } catch (err) { showToast('Phân tích thất bại: ' + err.message, true); }
          };
          reader.readAsText(file);
          ccImportFile.value = '';
        };
      }

      render();
    })();

    // ===== backfill hàng loạt suy diễn thế giới =====
    (function setupBackfillSection() {
      const startBtn = document.getElementById('we-backfill-start');
      const stopBtn = document.getElementById('we-backfill-stop');
      if (!startBtn) return; // Không ở trang cài đặt

      const persistBf = (key, val) => {
        const wapi = window.WORLD_ENGINE_API;
        const cur = wapi && wapi.getSettings ? wapi.getSettings(true) : {};
        window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({ ...cur, [key]: val }));
        if (wapi && wapi.getSettings) wapi.getSettings(true);
      };
      const batchEl = document.getElementById('we-backfill-batch');
      const endEl = document.getElementById('we-backfill-end');
      const retriesEl = document.getElementById('we-backfill-retries');
      if (batchEl) batchEl.onchange = () => persistBf('backfillBatchSize', Math.max(1, parseInt(batchEl.value) || 1));
      if (endEl) endEl.onchange = () => persistBf('backfillEndLayer', Math.max(0, parseInt(endEl.value) || 0));
      if (retriesEl) retriesEl.onchange = () => persistBf('backfillRetries', Math.max(0, parseInt(retriesEl.value) || 0));

      startBtn.onclick = () => runBackfill();
      if (stopBtn) stopBtn.onclick = () => {
        if (evolution && evolution.abort) { evolution.abort(); showToast('Đã gửi tín hiệu dừng'); }
      };
    })();

    // Nút xuất khu vực gỡ lỗi
    function setupDownload(content, filename) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    const exportPromptBtn = document.getElementById('we-export-prompt');
    if (exportPromptBtn) {
      exportPromptBtn.onclick = () => {
        const evo = window.WORLD_ENGINE_EVOLUTION;
        if (!evo || !evo.getLastDebug) return;
        const dbg = evo.getLastDebug();
        if (!dbg.prompt) { showToast('không Prompt có thể xuất', true); return; }
        setupDownload(dbg.prompt, 'prompt-' + Date.now() + '.txt');
        showToast('Prompt đã xuất');
      };
    }

    const exportRawBtn = document.getElementById('we-export-raw-result');
    if (exportRawBtn) {
      exportRawBtn.onclick = () => {
        const evo = window.WORLD_ENGINE_EVOLUTION;
        if (!evo || !evo.getLastDebug) return;
        const dbg = evo.getLastDebug();
        if (!dbg.rawResult) { showToast('không API trả về có thể xuất', true); return; }
        setupDownload(dbg.rawResult, 'api-raw-' + Date.now() + '.txt');
        showToast('API trả về đã xuất');
      };
    }

    // [FIX] suy diễn prompt Thu gọn thẻ phân đoạn (uỷ quyền sự kiện, logic ở cấp module bindPromptSegToggle）
    bindPromptSegToggle(document.querySelector('.we-prompt-debug'));

    // [FIX] xuất gói chẩn đoán
    const exportDiagBtn = document.getElementById('we-export-diag');
    if (exportDiagBtn) {
      exportDiagBtn.onclick = () => {
        const diag = window.WORLD_ENGINE_DIAG;
        if (!diag || !diag.download) { showToast('Module chẩn đoán không khả dụng', true); return; }
        try {
          diag.download();
          showToast('Đã xuất gói chẩn đoán');
        } catch (e) {
          showToast('Xuất gói chẩn đoán thất bại: ' + (e && e.message || e), true);
        }
      };
    }

    // [MAP] Quản lý preset engine: Lần đầu liên kết sau khi lắp ráp toàn trang (uỷ quyền sự kiện tại bindPresetEvents bên trong).
    bindPresetEvents(document.getElementById('we-preset-manage'));
  }

  function showPanel() {
    if (!panelElement) buildPanel();
    panelElement.style.display = 'flex';
    panelVisible = true;
    refresh();
  }

  function hidePanel() {
    if (!panelElement) return;
    panelElement.style.display = 'none';
    panelVisible = false;
  }

  function togglePanel() {
    if (panelVisible) hidePanel();
    else showPanel();
  }

  function initDrag(panel, handle) {
    let dragging = false, startX, startY, startLeft, startTop;
    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', function(e) {
      if (e.target.closest('.we-panel-close') || e.target.closest('.we-panel-header-actions')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      panel.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (startLeft + dx) + 'px';
      panel.style.top = (startTop + dy) + 'px';
    });

    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      panel.style.cursor = '';
    });
  }

  /** Lấy số tầng hội thoại hiện tại */
  function getChatLayer() {
    try {
      const ctx = SillyTavern.getContext();
      const chat = ctx?.chat || [];
      return Math.max(0, chat.length - 1);
    } catch(e) { return '?'; }
  }

  /** Thanh trạng thái bảng điều khiển cài đặt */
  function setStatus(text, isError) {
    const statusBar = document.getElementById('we-status-bar');
    if (!statusBar) return;
    statusBar.textContent = text;
    statusBar.className = 'we-status-bar' + (isError ? ' error' : '');
  }

  // ========== Uỷ quyền sự kiện toàn cục: Click danh tiếng + economy Chỉnh sửa ==========
  document.addEventListener('click', function(e) {
    // Click khối danh tiếng
    var dot = e.target.closest('.we-rep-dot');
    if (dot) {
      var dim = dot.getAttribute('data-dim');
      var level = dot.getAttribute('data-level');
      if (dim && level) {
        var scope = dot.getAttribute('data-rep-scope');
        var s = loadScopedState(scope);
        s.reputation = s.reputation || {};
        s.reputation[dim] = level;
        saveScopedState(scope, s);
        refresh();
      }
      return;
    }
    // climate Click nút
    var cb = e.target.closest('.we-climate-btn');
    if (cb) {
      var c = cb.getAttribute('data-climate');
      if (c) {
        var scope = cb.getAttribute('data-climate-scope');
        var s = loadScopedState(scope);
        s.economy = s.economy || {};
        s.economy.climate = c;
        saveScopedState(scope, s);
        refresh();
      }
      return;
    }
    // Chuyển trang danh sách chung
    var arr = e.target.closest('.we-list-arrow');
    if (arr) {
      var rid = arr.getAttribute('data-rid');
      var dir = parseInt(arr.getAttribute('data-dir'));
      if (!rid || isNaN(dir)) return;
      // Tìm bộ chuyển trang tương ứng
      var pager = arr.parentNode;
      var curSpan = pager.querySelector('.we-list-cur');
      if (!curSpan) return;
      var curPage = parseInt(curSpan.textContent);
      var list = document.querySelector('.we-paged-list[data-rid="' + rid + '"]');
      if (!list) return;
      var items = list.querySelectorAll('.we-page-item');
      var pages = Array.from(items).map(function(el) {
        return { el: el, page: parseInt(el.getAttribute('data-page')) };
      });
      if (!pages.length) return;
      var maxPage = Math.max.apply(null, pages.map(function(p){return p.page;}));
      var newPage = ((curPage - 1 + dir) % maxPage + maxPage) % maxPage + 1;
      pages.forEach(function(p) { p.el.style.display = p.page === newPage ? '' : 'none'; });
      curSpan.textContent = newPage;
      listPageState[rid] = newPage;
      return;
    }
    // xoá signal
    var sd = e.target.closest('.we-signal-del');
    if (sd) {
      var idx = parseInt(sd.getAttribute('data-sigidx'));
      if (!isNaN(idx)) {
        var scope = sd.getAttribute('data-sig-scope');
        var s = loadScopedState(scope);
        if (s.economy && s.economy.signals && s.economy.signals[idx] !== undefined) {
          s.economy.signals.splice(idx, 1);
          saveScopedState(scope, s);
          refresh();
        }
      }
      return;
    }
    // Thêm signal
    var sa = e.target.closest('.we-signal-add');
    if (sa) {
      var scope = sa.getAttribute('data-sig-scope');
      var s = loadScopedState(scope);
      s.economy = s.economy || {};
      if (!s.economy.signals) s.economy.signals = [];
      if (s.economy.signals.length < 5) {
        s.economy.signals.push({ summary: 'Tín hiệu mới', scope: 'khu vực' });
        saveScopedState(scope, s);
        refresh();
      }
      return;
    }

    // Click vào thẻ tín hiệu sẽ hiển thị nút xoá; click lại vào cùng một thẻ sẽ giữ nguyên hiển thị, thuận tiện cho thao tác trên thiết bị di động
    var signalCard = e.target.closest('.we-signal-item');
    if (signalCard && panelBodyElement && panelBodyElement.contains(signalCard)) {
      panelBodyElement.querySelectorAll('.we-card-active').forEach(function(c){ c.classList.remove('we-card-active'); });
      signalCard.classList.add('we-card-active');
      return;
    }

    // ===== Click thẻ mục hiển thị/Ẩn nút chỉnh sửa của nó (di động không có hover, thống nhất đổi thành chạm)=====
    if (!panelBodyElement || !panelBodyElement.contains(e.target)) return;
    // Click vào nút/Control đầu vào/Trong trình chỉnh sửa đã mở rộng: giao cho bộ xử lý tương ứng, không chuyển đổi
    if (e.target.closest('button, select, input, textarea, label, a, .we-event-editor, .we-rep-dot, .we-climate-btn, .we-signal-item, .we-list-arrow, .we-nav-row, .we-section-toggle')) return;
    var card = findActionCard(e.target);
    var wasActive = card && card.classList.contains('we-card-active');
    // Thu gọn các thẻ đã mở rộng khác trước
    panelBodyElement.querySelectorAll('.we-card-active').forEach(function(c){ c.classList.remove('we-card-active'); });
    if (card && !wasActive) card.classList.add('we-card-active');
  });

  /** Tìm thẻ mục chứa nhóm nút chỉnh sửa (trong node con trực tiếp của nó có .we-event-actions / .we-secret-ops） */
  function findActionCard(target) {
    var el = target;
    while (el && el.nodeType === 1 && el.id !== 'we-panel-body') {
      if (el.querySelector && el.querySelector(':scope > .we-event-actions, :scope > .we-secret-ops')) return el;
      el = el.parentElement;
    }
    return null;
  }

  // Ủy thác sự kiện toàn cục:signal Nhấp đúp để chỉnh sửa
  document.addEventListener('dblclick', function(e) {
    var sum = e.target.closest('.we-signal-summary');
    var sc = e.target.closest('.we-signal-scope');
    if (!sum && !sc) return;
    e.preventDefault();
    var item = sum || sc;
    var isScope = !!sc;
    var parent = item.closest('.we-signal-item');
    if (!parent) return;
    var del = parent.querySelector('.we-signal-del');
    var idx = del ? parseInt(del.getAttribute('data-sigidx')) : -1;
    if (isNaN(idx)) return;
    var dispScope = parent.getAttribute('data-sig-scope');
    var oldText = item.textContent;
    item.contentEditable = 'true';
    item.focus();
    // select all text
    var range = document.createRange();
    range.selectNodeContents(item);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    item.onblur = function() {
      item.contentEditable = 'false';
      var s = loadScopedState(dispScope);
      if (s.economy && s.economy.signals && s.economy.signals[idx]) {
        if (isScope) s.economy.signals[idx].scope = item.textContent;
        else s.economy.signals[idx].summary = item.textContent;
        saveScopedState(dispScope, s);
      }
    };
    item.onkeydown = function(ke) {
      if (ke.key === 'Enter') { ke.preventDefault(); item.blur(); }
    };
  });

  // ========== suy diễn UI Chuyển đổi trạng thái ==========
  function setEvolvingUI(active, scope) {
    // Chỉ đặt cờ, tuyệt đối không gọi ở đây refresh()：bindEvents() Mỗi lần làm mới đều sẽ gọi hàm này,
    // một khi quay lại refresh sẽ setEvolvingUI→refresh→bindEvents→setEvolvingUI đệ quy vô hạn gây treo.
    // Hiển thị bản nào do getActiveInjected thủ vệ/canh giữ + _evolvingScope chịu trách nhiệm, việc làm mới do bên gọi thực hiện ở bên ngoài.
    _evolving = !!active;
    if (active && scope) _evolvingScope = scope;
    // Nút vệ tinh bóng nổi: vô hiệu hoá khi đang suy diễn Tiến lên/Làm lại, kích hoạt Dừng; rảnh rỗi thì ngược lại
    const fwd = document.getElementById('we-sat-forward');
    const redo = document.getElementById('we-sat-redo');
    const ab = document.getElementById('we-sat-abort');
    if (fwd) fwd.classList.toggle('we-sat-off', !!active);
    if (redo) redo.classList.toggle('we-sat-off', !!active);
    if (ab) ab.classList.toggle('we-sat-off', !active);
    const ball = document.getElementById('we-input-btn');
    if (ball && active) {
      ball.classList.add('we-ball-evolving');
      ball.classList.remove('we-ball-success', 'we-ball-fail');
    } else if (ball && !active) {
      ball.classList.remove('we-ball-evolving');
    }
  }

  function setInjectedScope(scope) {
    _injectedScope = scope === 'checkpoint' ? 'checkpoint' : 'state';
  }

  // Suy diễn thủ công (dành cho nút vệ tinh bóng nổi gọi): chỉ định rõ cơ sở, không xem isNewRound。
  //   Thúc đẩy lại → Nạp điểm lưu B（mode 'redo'），bảng điều khiển hiển thị điểm lưu;
  //   Thúc đẩy về phía trước → Nạp trạng thái hiện tại A（mode 'forward'），bảng điều khiển hiển thị trạng thái hiện tại.
  async function runManualEvolve(mode, scope) {
    if (isEvolving) return;
    if (evolution.isRunning?.()) {
      if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('đã có suy diễn đang chạy...');
      showToast('Đã có suy diễn đang chạy, vui lòng đợi');
      return;
    }
    isEvolving = true;
    setEvolvingUI(true, scope);
    refresh(true);
    if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('đang suy diễn...');
    try {
      const ctx = SillyTavern.getContext();
      const s = core.loadState();
      const chat = ctx?.chat || [];
      const lastMsg = chat[chat.length - 1];
      const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
      const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';
      // Đọc số vòng: thủ công/Chế độ thời gian → min(Số vòng đã qua kể từ lần suy diễn trước, Giới hạn trên X)；Chế độ theo vòng → a（≤X）。start Bảo vệ số âm.
      const st = window.WORLD_ENGINE_API ? window.WORLD_ENGINE_API.getSettings(true) : {};
      let rounds;
      if (st.evolveMode === 'manual' || st.evolveMode === 'time') {
        const Xmax = Math.max(1, parseInt(st.evolveTimeMaxRounds) || 10);
        const cpp = core.restoreCheckpoint();
        const L = core.getChatLayer();
        let anchorL = (cpp && cpp.chatLayer != null) ? Number(cpp.chatLayer)
                    : (s && s.chatLayer != null ? Number(s.chatLayer) : L);
        if (!Number.isFinite(anchorL)) anchorL = L;
        const since = Math.floor(Math.max(0, L - anchorL) / 2);
        rounds = Math.max(1, Math.min(since, Xmax));
      } else {
        const everyX = Math.max(1, parseInt(st.evolveEveryX) || 1);
        rounds = Math.min(everyX, Math.max(1, parseInt(st.evolveReadRounds) || 1));
      }
      const start = Math.max(0, chat.length - rounds * 2);
      const dialogueText = chat.slice(start)
        .map(m => (m.is_user ? 'người dùng' : 'AI') + '：' + core.filterDialogue((m.mes || '').trim(), st))
        .filter(line => line.length > 3)
        .join('\n');
      const ok = await evolution.evolve(s, userMsg, aiMsg, { mode, dialogueText });
      if (ok && window.WORLD_ENGINE_LEDGER) window.WORLD_ENGINE_LEDGER.recordChanges(s);
      if (ok && window.WORLD_ENGINE?.applyInjection) window.WORLD_ENGINE.applyInjection();
      const reason = !ok && evolution.getLastError ? evolution.getLastError() : '';
      if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus(ok ? 'suy diễn hoàn tất' : (reason ? 'Suy diễn thất bại:' + reason : 'suy diễn thất bại'), !ok);
      if (ok) showToast('suy diễn hoàn tất');
    } catch(e) {
      if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('suy diễn thất bại: ' + e.message, true);
      showToast('' + e.message, true);
    }
    isEvolving = false;
    setEvolvingUI(false);
    refresh();
  }

  // Hàng loạt "backfill suy diễn thế giới": xoá trạng thái thế giới hiện tại, từ tầng thứ 1 cái AI chia lô suy diễn đến tầng chỉ định.
  async function runBackfill() {
    if (isEvolving) { showToast('Đã có suy diễn đang chạy, vui lòng đợi'); return; }
    if (evolution.isRunning?.()) { showToast('Đã có suy diễn đang chạy, vui lòng đợi'); return; }

    const st = window.WORLD_ENGINE_API ? window.WORLD_ENGINE_API.getSettings(true) : {};
    const batchSize = Math.max(1, parseInt(st.backfillBatchSize) || 1);
    const retries = Math.max(0, parseInt(st.backfillRetries) || 0);
    let endLayer = Math.max(0, parseInt(st.backfillEndLayer) || 0);

    // Thống kê hiện tại AI số tầng, đưa ra thông báo xác nhận
    let aiCount = 0;
    try {
      const ctx = SillyTavern.getContext();
      const chat = (ctx && ctx.chat) || [];
      for (const m of chat) if (m && !m.is_user && String(m.mes || '').trim()) aiCount++;
    } catch (e) {}
    if (!aiCount) { showToast('Trò chuyện hiện tại không có gì để suy diễn AI tầng/lượt chat', true); return; }
    const effectiveEnd = (endLayer > 0 && endLayer <= aiCount) ? endLayer : aiCount;
    const totalBatches = Math.max(1, Math.ceil(effectiveEnd / batchSize));

    const statusEl = document.getElementById('we-backfill-status');
    const setBfStatus = (t) => { if (statusEl) statusEl.textContent = t; };

    if (!confirm(
      `「backfill suy diễn thế giới" sẽ xoá trạng thái thế giới hiện tại, từ tầng thứ 1 cái AI suy diễn lại đến tầng thứ ${effectiveEnd} ,` +
      `tổng cộng khoảng ${totalBatches} lô, mỗi lô thử lại tối đa ${retries} lần.\n` +
      `Trước khi bắt đầu sẽ tự động lưu một bản sao lưu nhanh.\n Xác nhận xoá hết làm lại?`
    )) return;

    // tự động sao lưu trước khi backfill (chatcache không khả dụng thì âm thầm bỏ qua)
    try {
      const cc = window.WORLD_ENGINE_CHATCACHE;
      if (cc && cc.createSnapshot) {
        const snap = cc.createSnapshot('tự động sao lưu trước khi backfill');
        if (snap) showToast('đã lưu snapshot sao lưu trước khi backfill');
      }
    } catch (e) { console.warn('[World Engine] sao lưu trước khi backfill thất bại (không ảnh hưởng backfill)', e); }

    isEvolving = true;
    setEvolvingUI(true, 'state');
    refresh(true);
    if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('đang backfill...');
    setBfStatus('bắt đầu backfill...');

    try {
      const result = await evolution.backfillEvolve({
        batchSize, retries, endLayer,
        onProgress: (p) => {
          if (p.phase === 'batch-start') {
            setBfStatus(`Thứ  ${p.batch}/${p.totalBatches} lô (thứ ${p.layerFrom}-${p.layerTo} tầng) đang suy diễn...`);
            if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus(`đang backfill ${p.batch}/${p.totalBatches}`);
          } else if (p.phase === 'retry') {
            setBfStatus(`Thứ  ${p.batch}/${p.totalBatches} lô thất bại, thử lại ${p.attempt}/${retries}...`);
            if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus(`đang backfill ${p.batch}/${p.totalBatches}`);
          } else if (p.phase === 'batch-done') {
            setBfStatus(`Thứ  ${p.batch}/${p.totalBatches} lô hoàn thành (đã thúc đẩy đến thứ ${p.round} vòng)`);
            refresh(true);
          }
        }
      });

      if (result.done) {
        setBfStatus(`✅ backfill hoàn tất, tổng cộng ${result.completedBatches}/${result.totalBatches} lô`);
        showToast(`backfill hoàn tất, tổng cộng ${result.completedBatches} lô`);
        if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('backfill hoàn tất');
        if (window.WORLD_ENGINE?.applyInjection) window.WORLD_ENGINE.applyInjection();
      } else if (result.reason === 'aborted') {
        setBfStatus(`🛑 đã huỷ bỏ, hoàn thành ${result.completedBatches}/${result.totalBatches} lô`);
        showToast(`backfill đã huỷ bỏ (hoàn thành ${result.completedBatches} lô)`);
        if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('backfill đã huỷ bỏ');
        if (window.WORLD_ENGINE?.applyInjection) window.WORLD_ENGINE.applyInjection();
      } else if (result.reason === 'no-ai-layers') {
        setBfStatus('Trò chuyện hiện tại không có gì để suy diễn AI tầng/lượt chat');
        showToast('Trò chuyện hiện tại không có gì để suy diễn AI tầng/lượt chat', true);
      } else if (result.reason === 'busy') {
        showToast('Đã có suy diễn đang chạy, vui lòng đợi', true);
      } else {
        setBfStatus(`❌ Thứ  ${result.failedAt || '?'} lô thất bại, đã dừng (hoàn thành ${result.completedBatches || 0} lô)`);
        showToast(`backfill ở thứ ${result.failedAt || '?'} lô thất bại đã dừng`, true);
        if (window.__WE_SetExternalStatus) window.__WE_SetExternalStatus('backfill thất bại', true);
        if (window.WORLD_ENGINE?.applyInjection) window.WORLD_ENGINE.applyInjection();
      }
    } catch (e) {
      setBfStatus('❌ backfill bất thường: ' + (e && e.message || e));
      showToast('backfill bất thường: ' + (e && e.message || e), true);
    } finally {
      isEvolving = false;
      setEvolvingUI(false);
      refresh();
    }
  }

  // ========== Bóng nổi World Engine ==========
  let inputButtonObserver = null;
  let inputButtonRetryTimer = null;
  const WE_BALL_POS_KEY = 'we-ball-pos';
  let _ballStatusTimer = null;

  function loadBallPos() {
    try {
      const raw = localStorage.getItem(WE_BALL_POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.left === 'number' && typeof p.top === 'number') return p;
      }
    } catch (_) {}
    return null;
  }

  function saveBallPos(left, top, tucked, side) {
    try { localStorage.setItem(WE_BALL_POS_KEY, JSON.stringify({ left, top, tucked: !!tucked, side: side || null })); } catch (_) {}
  }

  // Tham số hít cạnh bên
  const WE_TUCK_EDGE = 28;    // Khoảng cách đến cạnh bao nhiêu thì tính là "hít"
  const WE_TUCK_HANDLE = 15;  // Chiều rộng dải nhỏ lộ ra sau khi thu vào
  const WE_TUCK_INSET = 8;    // Khoảng trống đến cạnh sau khi kéo ra

  function applyBallTuck(ball, side) {
    const vw = window.innerWidth;
    const size = ball.offsetWidth || 52;
    ball.classList.add('we-ball-tucked');
    ball.classList.toggle('we-ball-tucked-left', side === 'left');
    ball.classList.toggle('we-ball-tucked-right', side === 'right');
    ball.style.left = (side === 'left' ? (WE_TUCK_HANDLE - size) : (vw - WE_TUCK_HANDLE)) + 'px';
  }

  function untuckBall(ball) {
    const pos = loadBallPos() || {};
    const vw = window.innerWidth, vh = window.innerHeight, size = ball.offsetWidth || 52;
    let left = typeof pos.left === 'number' ? pos.left : (vw - size - 18);
    let top = typeof pos.top === 'number' ? pos.top : (vh - size - 90);
    left = Math.max(4, Math.min(left, vw - size - 4));
    top = Math.max(4, Math.min(top, vh - size - 4));
    ball.classList.remove('we-ball-tucked', 'we-ball-tucked-left', 'we-ball-tucked-right');
    ball.style.left = left + 'px';
    ball.style.top = top + 'px';
    saveBallPos(left, top, false, null);
  }

  function applyBallPos(ball) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const size = ball.offsetWidth || 52;
    let pos = loadBallPos();
    if (!pos) pos = { left: vw - size - 44, top: vh - size - 90 };
    // Kẹp vào khu vực hiển thị, tránh kéo ra khỏi màn hình rồi không tìm thấy
    pos.left = Math.max(4, Math.min(pos.left, vw - size - 4));
    pos.top = Math.max(4, Math.min(pos.top, vh - size - 4));
    ball.style.top = pos.top + 'px';
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
    if (pos.tucked && (pos.side === 'left' || pos.side === 'right')) {
      ball.style.left = pos.left + 'px';   // Ghi lại vị trí "sau khi kéo ra"
      applyBallTuck(ball, pos.side);        // Thu vào cạnh về mặt thị giác
    } else {
      ball.classList.remove('we-ball-tucked', 'we-ball-tucked-left', 'we-ball-tucked-right');
      ball.style.left = pos.left + 'px';
    }
  }

  function makeBallDraggable(ball) {
    let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      dragging = true; moved = false;
      sx = pt.clientX; sy = pt.clientY;
      const rect = ball.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      ball.classList.add('we-ball-dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    };
    const onMove = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - sx, dy = pt.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (e.cancelable) e.preventDefault();
      const size = ball.offsetWidth || 52;
      let left = Math.max(4, Math.min(ox + dx, window.innerWidth - size - 4));
      let top = Math.max(4, Math.min(oy + dy, window.innerHeight - size - 4));
      ball.style.left = left + 'px';
      ball.style.top = top + 'px';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      ball.classList.remove('we-ball-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      if (!moved) return;
      const vw = window.innerWidth, size = ball.offsetWidth || 52;
      const left = parseFloat(ball.style.left) || 0;
      const top = parseFloat(ball.style.top) || 0;
      if (left <= WE_TUCK_EDGE) {                          // Sát mép trái → Thu vào bên trái
        saveBallPos(WE_TUCK_INSET, top, true, 'left');
        applyBallTuck(ball, 'left');
      } else if (left >= vw - size - WE_TUCK_EDGE) {        // Sát mép phải → Thu vào bên phải
        saveBallPos(vw - size - WE_TUCK_INSET, top, true, 'right');
        applyBallTuck(ball, 'right');
      } else {
        saveBallPos(left, top, false, null);
      }
    };
    ball.addEventListener('mousedown', onDown);
    ball.addEventListener('touchstart', onDown, { passive: true });
    // Xử lý click: sau khi kéo không tính là click; đã thu vào thì "kéo ra" chứ không mở bảng điều khiển
    ball.addEventListener('click', (e) => {
      if (moved) { e.preventDefault(); e.stopImmediatePropagation(); moved = false; return; }
      if (ball.classList.contains('we-ball-tucked')) {
        e.preventDefault(); e.stopImmediatePropagation();
        untuckBall(ball);
      }
    }, true);
  }

  function observeInputButton() {
    if (inputButtonObserver || !document.body) return;
    inputButtonObserver = new MutationObserver(() => {
      if (!document.getElementById('we-input-btn')) {
        clearTimeout(inputButtonRetryTimer);
        inputButtonRetryTimer = setTimeout(buildInputButton, 50);
      }
    });
    inputButtonObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Phân tích văn bản trạng thái suy diễn → Chuyển đổi hình thái trái đất + Vòng tiến độ
  function setBallState(text, isError) {
    const ball = document.getElementById('we-input-btn');
    if (!ball) return;
    const ring = ball.querySelector('.we-ball-ring');
    const badge = ball.querySelector('.we-ball-badge');
    // Bóng nổi không hiển thị chữ trạng thái (chữ chạy banner trên cùng màn hình)

    ball.classList.remove('we-ball-evolving', 'we-ball-success', 'we-ball-fail');
    clearTimeout(_ballStatusTimer);

    const count = ball.querySelector('.we-ball-count');
    const clearCount = () => {
      ball.classList.remove('we-ball-counting');
      if (count) count.textContent = '';
      if (ring) ring.style.setProperty('--we-ring-pct', '0deg');
    };

    if (/đang backfill/.test(text)) {
      // Backfill hàng loạt: trái đất tiếp tục xoay + Góc dưới bên phải hiển thị tiến độ "lô/tổng"
      ball.classList.add('we-ball-evolving');
      if (badge) badge.textContent = '';
      const mb = /(\d+)\s*\/\s*(\d+)/.exec(text);
      if (mb && ring) {
        const cur = Number(mb[1]), total = Number(mb[2]) || 1;
        const pct = Math.max(0, Math.min(1, cur / total));
        ring.style.setProperty('--we-ring-pct', (pct * 360) + 'deg');
        ball.classList.add('we-ball-counting');
        if (count) count.textContent = `${cur}/${total}`;
      } else {
        clearCount();
      }
    } else if (/đang suy diễn/.test(text)) {
      ball.classList.add('we-ball-evolving');
      if (badge) badge.textContent = '';
      clearCount(); // Đang suy diễn không hiển thị đếm vòng, tránh sót lại cái cũ N/X
    } else if (isError || /thất bại|Bất thường/.test(text)) {
      ball.classList.add('we-ball-fail');
      if (badge) badge.textContent = '✕';
      _ballStatusTimer = setTimeout(() => clearBallBadge(), 6000);
    } else if (/hoàn thành/.test(text)) {
      ball.classList.add('we-ball-success');
      if (badge) badge.textContent = '✓';
      clearCount(); // suy diễn hoàn tất → Đếm đã về 0, xoá vòng tiến độ và số
      _ballStatusTimer = setTimeout(() => clearBallBadge(), 4000);
    }

    // Phân tích "vòng N/X thứ"→ Vòng tiến độ + Số (chỉ hiển thị ở trạng thái nhắc nhở chưa đến suy diễn)
    const m = /Thứ \s*(\d+)\s*\/\s*(\d+)\s* vòng/.exec(text || '');
    if (ring && m) {
      const cur = Number(m[1]), total = Number(m[2]) || 1;
      const pct = Math.max(0, Math.min(1, cur / total));
      ring.style.setProperty('--we-ring-pct', (pct * 360) + 'deg');
      ball.classList.toggle('we-ball-counting', cur > 0 && cur < total);
      if (count) count.textContent = (cur < total) ? `${cur}/${total}` : '';
    }
  }

  function clearBallBadge() {
    const ball = document.getElementById('we-input-btn');
    if (!ball) return;
    ball.classList.remove('we-ball-success', 'we-ball-fail');
    const badge = ball.querySelector('.we-ball-badge');
    if (badge) badge.textContent = '';
  }

  // Banner trạng thái chính giữa trên cùng màn hình: hiển thị khoảng 5s rồi mờ dần
  let _topStatusTimer = null;
  function showTopStatus(text, isError) {
    if (!document.body || !text) return;
    let el = document.getElementById('we-top-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'we-top-status';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle('we-top-status-error', !!isError);
    el.classList.add('show');
    clearTimeout(_topStatusTimer);
    _topStatusTimer = setTimeout(() => { el.classList.remove('show'); }, 5000);
  }

  // Gắn sự kiện cho ba nút vệ tinh của quả cầu lơ lửng; ngăn chặn nổi bọt, tránh kích hoạt kéo thả / Mở bảng điều khiển
  function wireSatellites(ball) {
    const wire = (id, fn) => {
      const el = ball.querySelector('#' + id);
      if (!el) return;
      const stop = e => e.stopPropagation();
      el.addEventListener('mousedown', stop);
      el.addEventListener('touchstart', stop, { passive: true });
      el.addEventListener('click', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (el.classList.contains('we-sat-off')) return;
        fn();
      });
    };
    wire('we-sat-forward', () => runManualEvolve('forward', 'state'));
    wire('we-sat-redo', () => runManualEvolve('redo', 'checkpoint'));
    wire('we-sat-abort', () => { evolution.abort(); showToast('Đã gửi tín hiệu dừng'); });

    // 「Công tắc chính "Phích cắm"(Vệ tinh thứ tư bên trái quả cầu):Liên kết một chạm evolveMode + injectIntoPrompt
    //   Trạng thái tắt(Cắm vào)= evolveMode='manual'(Không tự động suy diễn) + injectIntoPrompt=false(Không tiêm)；
    //   Không thêm mới trường cài đặt:Trạng thái suy ngược từ hai trường này(`manual && inject===false` = Tắt)。
    //   Có hiệu lực ngay:Chuyển xong gọi applyInjection Để inject thủ vệ/canh giữ(world-engine.js:148) Có hiệu lực(Tắt→unregister,Bật→Tiêm lại)。
    //   Lưu trữ lâu dài:Chạy persist Cùng chế độ(setKV Nội tuyến,Xem ui.js:3393 persist Thân),Cái thay đổi là trường đã lưu trữ lâu dài.
    //   manual Tự mang chặn pending autoEvolveTimer Khả năng(world-engine.js:282 thủ vệ/canh giữ),Không cần thêm engineEnabled thủ vệ/canh giữ
    //   (Rút ra PR#26 Mối nguy ngầm A Bài học:Không dựa vào engineEnabled,Dựa vào manual Chặn tự nhiên timer fire)。
    //   Không dùng we-sat-off(wire Bên trong sẽ chặn we-sat-off Không thể nhấp);Dùng .on class Đánh dấu trạng thái tắt,power Luôn có thể nhấp.
    const wapi = window.WORLD_ENGINE_API;
    const readSettings = () => (wapi && wapi.getSettings ? wapi.getSettings(true) : {}) || {};
    const isPowerOff = (s) => s.evolveMode === 'manual' && s.injectIntoPrompt === false;
    const syncPowerState = () => {
      const el = ball.querySelector('#we-sat-power');
      if (el) el.classList.toggle('on', isPowerOff(readSettings()));
    };
    syncPowerState(); // Trạng thái thị giác ban đầu
    wire('we-sat-power', () => {
      const turnOff = !isPowerOff(readSettings()); // Chuyển sang đối diện
      const setKV = (k, v) => {
        const c = wapi && wapi.getSettings ? wapi.getSettings(true) : {};
        window.WORLD_ENGINE_STORE.setItem('world_engine_settings', JSON.stringify({ ...c, [k]: v }));
        if (wapi && wapi.getSettings) wapi.getSettings(true);
      };
      setKV('evolveMode', turnOff ? 'manual' : 'auto');
      setKV('injectIntoPrompt', !turnOff); // Tắt=false, Bật=true
      window.WORLD_ENGINE?.applyInjection?.(); // Tiêm lại ngay lập tức:Tắt→unregisterInjection,Bật→Tiêm lại
      syncPowerState(); // Cập nhật .on Trạng thái thị giác
      showToast(turnOff ? 'Đã tắt suy diễn và tiêm' : 'Đã bật suy diễn và tiêm');
      if (typeof _currentView !== 'undefined' && _currentView === 'settings') refresh();
    });
  }

  function buildInputButton() {
    if (!document.body) return;

    let btn = document.getElementById('we-input-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'we-input-btn';
      btn.type = 'button';
      btn.title = 'World Engine';
      btn.setAttribute('aria-label', 'World Engine');
      btn.className = 'we-ball';
      btn.innerHTML =
        '<span class="we-ball-orbit"></span>' +
        '<span class="we-ball-ring"></span>' +
        '<span class="we-ball-globe"></span>' +
        '<span class="we-ball-count"></span>' +
        '<span class="we-ball-badge"></span>' +
        '<span class="we-ball-tip"></span>' +
        '<span class="we-sat we-sat-up" id="we-sat-forward" role="button" title="Thúc đẩy về phía trước"><i class="fa-solid fa-forward"></i></span>' +
        '<span class="we-sat we-sat-right we-sat-off" id="we-sat-abort" role="button" title="Dừng suy diễn"><i class="fa-solid fa-stop"></i></span>' +
        '<span class="we-sat we-sat-down" id="we-sat-redo" role="button" title="Thúc đẩy lại"><i class="fa-solid fa-rotate-right"></i></span>' +
        '<span class="we-sat we-sat-left" id="we-sat-power" role="button" title="Cắm vào=Tắt suy diễn và tiêm / Rút ra=bật"><i class="fa-solid fa-power-off"></i></span>';
      btn.onclick = () => togglePanel();
      document.body.appendChild(btn);
      wireSatellites(btn);
      applyBallPos(btn);
      makeBallDraggable(btn);
      window.addEventListener('resize', () => applyBallPos(btn));
      setEvolvingUI(isEvolving || Boolean(evolution.isRunning?.()));
    } else if (btn.parentElement !== document.body) {
      document.body.appendChild(btn);
      applyBallPos(btn);
    }

    // Tương thích giao diện trạng thái bên ngoài cũ: giữ lại phần tử ẩn, chuyển tiếp đến máy trạng thái trái đất
    let statusIndicator = document.getElementById('we-external-status');
    if (!statusIndicator) {
      statusIndicator = document.createElement('span');
      statusIndicator.id = 'we-external-status';
      statusIndicator.style.display = 'none';
      document.body.appendChild(statusIndicator);
    }

    window.__WE_SetExternalStatus = function(text, isError) {
      const el = document.getElementById('we-external-status');
      if (el) el.textContent = text;
      setBallState(text || '', !!isError);
      // Loại tiến độ (thứ N/X  vòng/ngày, đang backfill i/M）chỉ hiển thị trên bóng nổi; các trạng thái còn lại đi qua biểu ngữ trên cùng màn hình
      if (text && !/Thứ \s*\d+\s*\/\s*\d+\s*[vòng ngày]/.test(text) && !/đang backfill/.test(text)) {
        showTopStatus(text, !!isError);
      }
    };

    buildPanel();
    observeInputButton();
  }

  return { buildPanel, buildInputButton, showPanel, hidePanel, togglePanel, refresh, setStatus, setEvolvingUI, setInjectedScope };
})();
