/**
 * 自动更新：从 GitHub Releases API 探测最新版本，与当前安装版本比较。
 *
 * 纯逻辑，不依赖 vscode，便于单元测试。
 * 检测到新版本后，由 UI 层展示「更新」按钮 / 通知，点击后走 updater.ts 下载并安装 vsix。
 */

const GITHUB_API_URL =
  'https://api.github.com/repos/harries233/claude-code-context-monitor/releases/latest';
/** vsix 资产命名：claude-code-context-monitor-<版本>.vsix */
const VSIX_RE = /^claude-code-context-monitor-(\d+\.\d+\.\d+)\.vsix$/;

/** 一个可下载的更新版本。 */
export interface UpdateInfo {
  /** 不带 v 前缀的版本号，如 "0.2.1"。 */
  version: string;
  /** 完整 tag 名，如 "v0.2.1"。 */
  tagName: string;
  /** vsix 资产名称。 */
  vsixName: string;
  /** vsix 下载地址。 */
  vsixUrl: string;
  /** Release 页面地址。 */
  releaseUrl: string;
  /** Release 说明（可为空）。 */
  notes?: string;
  publishedAt?: string;
}

/** 去掉版本号前后的空白与 v 前缀。 */
export function normalizeVersion(v: string): string {
  return String(v || '')
    .trim()
    .replace(/^v/i, '');
}

/**
 * 简单 semver 比较（仅数字段）：a>b 返回 1，a<b 返回 -1，相等返回 0。
 * 忽略预发布后缀（如 0.2.1-beta 与 0.2.1 视为相同数字段）。
 */
export function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a)
    .split('.')
    .map((x) => parseInt(x.replace(/\D/g, ''), 10) || 0);
  const pb = normalizeVersion(b)
    .split('.')
    .map((x) => parseInt(x.replace(/\D/g, ''), 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) {
      return da > db ? 1 : -1;
    }
  }
  return 0;
}

/** 当前安装版本是否落后于最新发布版本。 */
export function hasUpdate(current: string, latest: string): boolean {
  return compareVersions(latest, current) > 0;
}

/**
 * 从 GitHub Releases API 拉取最新发布信息。
 * 网络失败 / 被限流 / 找不到 vsix 资产时返回 null。
 */
export async function fetchLatestRelease(timeoutMs = 10_000): Promise<UpdateInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: { 'User-Agent': 'claude-code-context-monitor' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      tag_name?: string;
      html_url?: string;
      body?: string;
      published_at?: string;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };
    const tagName = data.tag_name;
    const vsix = (data.assets ?? []).find((a) => a.name && VSIX_RE.test(a.name));
    if (!tagName || !vsix?.name || !vsix.browser_download_url) {
      return null;
    }
    return {
      version: normalizeVersion(tagName),
      tagName,
      vsixName: vsix.name,
      vsixUrl: vsix.browser_download_url,
      releaseUrl:
        data.html_url ??
        `https://github.com/harries233/claude-code-context-monitor/releases/tag/${tagName}`,
      notes: typeof data.body === 'string' ? data.body : undefined,
      publishedAt: data.published_at,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
