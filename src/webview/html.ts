import * as vscode from 'vscode';

/**
 * 生成 Dashboard WebView 的 HTML（含 CSP 与资源 URI 注入）。
 */
export function getDashboardHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Claude Context Monitor</title>
  <link href="${styleUri}" rel="stylesheet" />
</head>
<body>
  <div id="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo">◉</span>
        <div class="brand-text">
          <h1>Claude Context Monitor</h1>
          <div class="subtitle" id="sessionName">—</div>
        </div>
      </div>
      <div class="topbar-actions">
        <span class="health-badge" id="healthBadge" title="Context 健康评分">—</span>
        <button id="refreshBtn" class="btn" title="刷新数据">↻ 刷新</button>
      </div>
    </header>

    <section class="banner hidden" id="banner">
      <span class="banner-icon" id="bannerIcon">⚠️</span>
      <span id="bannerText"></span>
    </section>

    <section class="card" id="healthCard">
      <div class="health-main">
        <div class="health-grade" id="healthGrade">—</div>
        <div class="health-info">
          <div class="health-label" id="healthLabel">Context 健康评分</div>
          <div class="health-score" id="healthScore">—</div>
        </div>
      </div>
      <ul class="health-factors" id="healthFactors"></ul>
    </section>

    <section class="gauge-card" id="gaugeCard">
      <div class="gauge">
        <svg viewBox="0 0 120 120" class="gauge-svg">
          <circle class="gauge-bg" cx="60" cy="60" r="52"></circle>
          <circle class="gauge-fg" cx="60" cy="60" r="52" id="gaugeFg"></circle>
        </svg>
        <div class="gauge-center">
          <div class="gauge-value" id="gaugeValue">--%</div>
          <div class="gauge-label">Context 使用率</div>
        </div>
      </div>
      <div class="gauge-meta" id="gaugeMeta"></div>
    </section>

    <section class="card">
      <h2>Context</h2>
      <div class="context-bar"><div class="context-fill" id="contextFill"></div></div>
      <div class="context-bar-text" id="contextBarText"></div>
    </section>

    <section class="card">
      <h2>Tokens</h2>
      <div class="stats-grid" id="statsGrid"></div>
    </section>

    <section class="card">
      <h2>操作</h2>
      <div class="actions">
        <button class="btn primary" id="summaryBtn">Generate Summary</button>
        <button class="btn" id="newSessionBtn">Open New Session</button>
        <button class="btn" id="compactBtn">复制 /compact</button>
      </div>
    </section>

    <section class="card">
      <h2>Session 列表</h2>
      <div class="session-list" id="sessionList"></div>
    </section>

    <section class="card" id="largeFilesCard">
      <h2>Largest Context Consumers</h2>
      <div class="large-files" id="largeFiles"></div>
      <div class="hint" id="largeFilesHint"></div>
    </section>

    <section class="card">
      <h2>优化建议</h2>
      <ul class="suggestions" id="suggestions"></ul>
    </section>
  </div>

  <div class="modal hidden" id="summaryModal">
    <div class="modal-box">
      <div class="modal-head">
        <span>Session 摘要</span>
        <button class="modal-close" id="summaryClose" title="关闭">×</button>
      </div>
      <pre class="summary-text" id="summaryText"></pre>
      <div class="modal-foot">
        <button class="btn primary" id="summaryCopy">复制</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
