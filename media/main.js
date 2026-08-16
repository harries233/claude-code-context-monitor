// Claude Code Context Monitor — Dashboard 前端逻辑
// 与扩展通过 postMessage 通信：{ type: 'update', data: ContextSnapshot }

(function () {
  const vscode = acquireVsCodeApi();

  const $ = (id) => document.getElementById(id);

  // 前端状态：当前正在查看的会话 id（undefined = 跟随当前会话）
  const state = { selectedSessionId: undefined };

  // ---------- 格式化工具 ----------
  function fmtTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }

  function fmtTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  }

  // 告警等级 → 颜色
  const LEVEL_COLORS = {
    normal: '#3fb950',
    warning: '#d29922',
    critical: '#f85149',
    danger: '#ff3b30',
  };

  const LEVEL_BANNER = {
    normal: { text: 'Context 使用正常', icon: '✅', bg: 'rgba(63,185,80,0.12)', fg: '#3fb950' },
    warning: { text: 'Context 偏高，注意观察', icon: '🟡', bg: 'rgba(210,153,34,0.14)', fg: '#d29922' },
    critical: { text: 'Context 即将耗尽，建议 /compact', icon: '🔴', bg: 'rgba(248,81,73,0.14)', fg: '#f85149' },
    danger: { text: '强烈建议开启新 Session', icon: '⚠️', bg: 'rgba(255,59,48,0.16)', fg: '#ff3b30' },
  };

  // 健康等级 → 颜色
  const HEALTH_COLORS = {
    A: '#3fb950',
    B: '#d29922',
    C: '#f0883e',
    D: '#ff3b30',
  };

  // 仪表盘周长
  const CIRCUMFERENCE = 2 * Math.PI * 52;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- 渲染 ----------
  function render(snapshot) {
    const cur = snapshot.current;
    const level = snapshot.warningLevel || 'normal';
    const health = snapshot.health;
    state.selectedSessionId = snapshot.selectedSessionId || undefined;
    // 真实当前会话用于标记列表里的 ★；选中历史会话时 current 已被替换
    const realCurrentId = snapshot.realCurrentId || (cur ? cur.meta.sessionId : null);

    renderHeader(cur, health, state.selectedSessionId);
    renderHealth(health);
    renderGauge(cur, level);
    renderBanner(level, cur);
    renderContextBar(cur, level);
    renderStats(cur);
    renderSessions(snapshot.sessions, realCurrentId, state.selectedSessionId);
    renderLargeFiles(cur);
    renderSuggestions(snapshot.suggestionList);
  }

  function renderHeader(cur, health, selectedSessionId) {
    $('sessionName').textContent = cur
      ? (cur.meta.name || cur.meta.sessionId) + (cur.meta.model ? ' · ' + cur.meta.model : '')
      : '未检测到活动 Session';

    // 查看历史会话时显示「返回当前」按钮
    $('backCurrentBtn').hidden = !selectedSessionId;

    const badge = $('healthBadge');
    if (health) {
      badge.textContent = health.grade;
      badge.style.background = HEALTH_COLORS[health.grade] || HEALTH_COLORS.A;
      badge.style.color = '#fff';
      badge.title = 'Context 健康评分：' + health.label + '（' + health.score + '/100）';
    } else {
      badge.textContent = '—';
      badge.style.background = 'transparent';
      badge.style.color = 'var(--vscode-descriptionForeground)';
      badge.title = 'Context 健康评分';
    }
  }

  function renderHealth(health) {
    if (!health) {
      $('healthGrade').textContent = '—';
      $('healthGrade').style.background = 'var(--vscode-editorWidget-border)';
      $('healthLabel').textContent = 'Context 健康评分';
      $('healthScore').textContent = '暂无活动会话';
      $('healthFactors').innerHTML = '';
      return;
    }
    const color = HEALTH_COLORS[health.grade] || HEALTH_COLORS.A;
    $('healthGrade').textContent = health.grade;
    $('healthGrade').style.background = color;
    $('healthLabel').textContent = health.label;
    $('healthScore').textContent = '评分 ' + health.score + ' / 100';
    $('healthFactors').innerHTML = health.factors
      .map(function (f) {
        return (
          '<li><span class="dot ' +
          esc(f.status) +
          '"></span><span class="fname">' +
          esc(f.name) +
          '</span><span>' +
          esc(f.detail) +
          '</span></li>'
        );
      })
      .join('');
  }

  function renderGauge(cur, level) {
    const pct = cur ? cur.contextPercent : 0;
    const color = LEVEL_COLORS[level] || LEVEL_COLORS.normal;

    $('gaugeValue').textContent = pct + '%';
    const fg = $('gaugeFg');
    fg.setAttribute('stroke', color);
    fg.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct / 100);

    const meta = $('gaugeMeta');
    if (!cur) {
      meta.innerHTML = '<div class="empty">请先启动 Claude Code，或检查数据目录配置。</div>';
      return;
    }
    meta.innerHTML = [
      row('当前 Context', fmtTokens(cur.contextTokens) + ' tokens'),
      row('最大容量', fmtTokens(cur.maxContextTokens) + ' tokens'),
      row('消息数', String(cur.messageCount)),
      row('运行时长', fmtDuration(cur.elapsedMs)),
      row('创建时间', fmtTime(cur.meta.startedAt)),
    ].join('');
  }

  function row(k, v) {
    return '<div class="row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>';
  }

  function renderBanner(level, cur) {
    if (!cur) {
      $('banner').classList.add('hidden');
      return;
    }
    const cfg = LEVEL_BANNER[level] || LEVEL_BANNER.normal;
    const banner = $('banner');
    banner.classList.remove('hidden');
    banner.style.background = cfg.bg;
    banner.style.borderColor = cfg.fg;
    banner.style.color = cfg.fg;
    $('bannerIcon').textContent = cfg.icon;
    $('bannerText').textContent = cfg.text;
  }

  function renderContextBar(cur, level) {
    const pct = cur ? cur.contextPercent : 0;
    const color = LEVEL_COLORS[level] || LEVEL_COLORS.normal;
    const fill = $('contextFill');
    fill.style.width = pct + '%';
    fill.style.background = color;

    // ████████░░ 样式的 ASCII 条
    const segs = 20;
    const filled = Math.round((pct / 100) * segs);
    const ascii = '█'.repeat(filled) + '░'.repeat(segs - filled);
    $('contextBarText').textContent = cur
      ? pct + '%  ' + ascii + '  (' + fmtTokens(cur.contextTokens) + ' / ' + fmtTokens(cur.maxContextTokens) + ' tokens)'
      : '—';
  }

  function renderStats(cur) {
    const grid = $('statsGrid');
    if (!cur) {
      grid.innerHTML = '<div class="empty">暂无数据。</div>';
      return;
    }
    const total = cur.totalInputTokens + cur.totalOutputTokens;
    const items = [
      ['输入 Tokens', fmtTokens(cur.totalInputTokens)],
      ['输出 Tokens', fmtTokens(cur.totalOutputTokens)],
      ['合计 Tokens', fmtTokens(total)],
      ['当前 Context', fmtTokens(cur.contextTokens)],
      ['消息数量', String(cur.messageCount)],
      ['文件读取', String(cur.fileReadCount) + ' 次'],
    ];
    grid.innerHTML = items
      .map(
        (it) =>
          '<div class="stat"><div class="stat-label">' +
          esc(it[0]) +
          '</div><div class="stat-value">' +
          esc(it[1]) +
          '</div></div>'
      )
      .join('');
  }

  function renderSessions(sessions, realCurrentId, selectedSessionId) {
    const list = $('sessionList');
    if (!sessions || sessions.length === 0) {
      list.innerHTML = '<div class="empty">暂无 Session 记录。</div>';
      return;
    }
    list.innerHTML = sessions
      .map(function (s) {
        const isCurrent = s.meta.sessionId === realCurrentId;
        const isSelected = s.meta.sessionId === selectedSessionId;
        const pctColor = LEVEL_COLORS[levelOf(s.contextPercent)] || LEVEL_COLORS.normal;
        return (
          '<div class="session-item' +
          (isCurrent ? ' current' : '') +
          (isSelected ? ' selected' : '') +
          '" data-id="' +
          esc(s.meta.sessionId) +
          '">' +
          '<span class="session-dot ' +
          (s.meta.active ? 'active' : 'ended') +
          '"></span>' +
          '<div class="session-main">' +
          '<div class="session-title">' +
          esc(s.meta.name || s.meta.sessionId) +
          (isCurrent ? ' ★' : '') +
          '</div>' +
          '<div class="session-sub">' +
          esc(fmtTime(s.meta.startedAt)) +
          (s.meta.active ? ' · 运行中' : ' · 已结束') +
          (s.lastActivityAt ? ' · 最近 ' + esc(fmtTime(s.lastActivityAt)) : '') +
          '</div>' +
          '</div>' +
          '<div class="session-right">' +
          '<div class="session-pct" style="color:' +
          pctColor +
          '">' +
          s.contextPercent +
          '%</div>' +
          '<div class="session-tokens">' +
          fmtTokens(s.contextTokens) +
          ' tok</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderSuggestions(list) {
    const ul = $('suggestions');
    if (!list || list.length === 0) {
      ul.innerHTML = '<li>✅ Context 使用正常，无需处理。</li>';
      return;
    }
    ul.innerHTML = list
      .map(function (s) {
        return '<li>' + esc(s) + '</li>';
      })
      .join('');
  }

  function renderLargeFiles(cur) {
    const box = $('largeFiles');
    const hint = $('largeFilesHint');
    if (!cur || !cur.largeFiles || cur.largeFiles.length === 0) {
      box.innerHTML = '<div class="empty">未检测到明显占用 token 的大文件。</div>';
      hint.textContent = '';
      return;
    }
    box.innerHTML = cur.largeFiles
      .map(function (f) {
        return (
          '<div class="large-file"><span class="path">' +
          esc(f.path) +
          '</span><span class="tokens">~' +
          fmtTokens(f.estimatedTokens) +
          ' tokens</span></div>'
        );
      })
      .join('');
    hint.textContent = '💡 建议：把日志、构建产物等大文件加入 .gitignore / CLAUDE.md 的忽略规则，减少 Context 消耗。';
  }

  function levelOf(pct) {
    // 阈值与扩展保持一致；前端仅用于着色
    if (pct >= 95) return 'danger';
    if (pct >= 85) return 'critical';
    if (pct >= 70) return 'warning';
    return 'normal';
  }

  // ---------- 摘要弹窗 ----------
  function openSummary(text) {
    $('summaryText').textContent = text;
    $('summaryModal').classList.remove('hidden');
  }

  function closeSummary() {
    $('summaryModal').classList.add('hidden');
  }

  // ---------- 通信 ----------
  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (!msg) return;
    if (msg.type === 'update') {
      render(msg.data);
    } else if (msg.type === 'summary') {
      openSummary(msg.data.text);
    }
  });

  $('refreshBtn').addEventListener('click', function () {
    vscode.postMessage({ type: 'refresh' });
  });

  $('summaryBtn').addEventListener('click', function () {
    vscode.postMessage({ type: 'generateSummary' });
  });

  $('newSessionBtn').addEventListener('click', function () {
    vscode.postMessage({ type: 'openNewSession' });
  });

  $('compactBtn').addEventListener('click', function () {
    vscode.postMessage({ type: 'copyCompact' });
  });

  $('summaryCopy').addEventListener('click', function () {
    vscode.postMessage({ type: 'copySummary', text: $('summaryText').textContent });
  });

  $('summaryClose').addEventListener('click', closeSummary);
  $('summaryModal').addEventListener('click', function (e) {
    if (e.target === $('summaryModal')) closeSummary();
  });

  // 点击 Session 列表项：查看该会话详情；再次点击当前选中的会话则返回当前
  $('sessionList').addEventListener('click', function (e) {
    const item = e.target.closest('.session-item');
    if (!item) return;
    const id = item.getAttribute('data-id');
    if (state.selectedSessionId && id === state.selectedSessionId) {
      vscode.postMessage({ type: 'backToCurrent' });
    } else {
      vscode.postMessage({ type: 'selectSession', sessionId: id });
    }
  });

  // 查看历史会话时，顶栏「返回当前」按钮
  $('backCurrentBtn').addEventListener('click', function () {
    vscode.postMessage({ type: 'backToCurrent' });
  });

  // 初始状态：请求一次快照（若已有则靠 update 推送）
  vscode.postMessage({ type: 'ready' });
})();
