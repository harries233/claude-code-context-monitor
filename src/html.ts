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
      <button id="refreshBtn" class="btn" title="刷新数据">↻ 刷新</button>
    </header>

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

    <div class="banner hidden" id="banner">
      <span class="banner-icon" id="bannerIcon">⚠️</span>
      <span id="bannerText"></span>
    </div>

    <section class="stats-grid" id="statsGrid"></section>

    <section class="card">
      <h2>Session 列表</h2>
      <div class="session-list" id="sessionList"></div>
    </section>

    <section class="card">
      <h2>优化建议</h2>
      <ul class="suggestions" id="suggestions"></ul>
    </section>

    <section class="card" id="largeFilesCard">
      <h2>占用 Token 较多的文件</h2>
      <div class="large-files" id="largeFiles"></div>
    </section>
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
