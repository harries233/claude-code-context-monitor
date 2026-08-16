import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** 判断某路径是否可执行。 */
function isExecutable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** 在 PATH 中查找可执行文件（等价于 `which`）。 */
function which(name: string): string | undefined {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const full = path.join(dir, name);
    if (isExecutable(full)) {
      return full;
    }
  }
  return undefined;
}

/**
 * 查找 Claude Code CLI 可执行文件。优先 PATH，其次常见安装位置。
 * 注意：Claude Code 通过 VS Code 扩展启动时，`claude` 未必在 PATH 上，
 * 因此这里的探测只是「打开新 Session」动作的辅助信号，不是唯一信号。
 */
export function findClaudeBinary(): string | undefined {
  const fromPath = which('claude');
  if (fromPath) {
    return fromPath;
  }
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), '.claude', 'local', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];
  return candidates.find(isExecutable);
}

/** 查找 VS Code 的 `code` CLI（用于 Homebrew 安装脚本与扩展自检）。 */
export function findCodeBinary(): string | undefined {
  const fromPath = which('code');
  if (fromPath) {
    return fromPath;
  }
  const candidates = [
    '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
    '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code',
    '/Applications/VSCodium.app/Contents/Resources/app/bin/code',
  ];
  return candidates.find(isExecutable);
}

/** 判断路径是否为存在的目录。 */
export function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
