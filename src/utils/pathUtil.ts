import * as os from 'os';
import * as path from 'path';

/**
 * 解析 Claude Code 数据目录。
 * 默认 ~/.claude，支持配置中以 ~ 开头或绝对路径。
 */
export function getClaudeDataDir(configured: string): string {
  if (configured && configured.trim().length > 0) {
    const trimmed = configured.trim();
    if (trimmed.startsWith('~')) {
      return path.join(os.homedir(), trimmed.slice(1));
    }
    return trimmed;
  }
  return path.join(os.homedir(), '.claude');
}

export function getSessionsDir(dataDir: string): string {
  return path.join(dataDir, 'sessions');
}

export function getProjectsDir(dataDir: string): string {
  return path.join(dataDir, 'projects');
}

/**
 * Claude Code 用 cwd 生成项目子目录名：把 '/' 替换成 '-'。
 * 例如 /Users/lzhharreis -> -Users-lzhharreis
 */
export function hashCwd(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

export function getProjectDir(dataDir: string, cwd: string): string {
  return path.join(getProjectsDir(dataDir), hashCwd(cwd));
}
