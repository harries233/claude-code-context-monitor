import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { findCodeBinary } from '../utils/env';
import { UpdateInfo } from './updateChecker';

/** 下载 vsix 到系统临时目录，返回本地路径。 */
export async function downloadVsix(info: UpdateInfo): Promise<string> {
  const dest = path.join(os.tmpdir(), info.vsixName);
  const res = await fetch(info.vsixUrl, {
    headers: { 'User-Agent': 'claude-code-context-monitor' },
  });
  if (!res.ok) {
    throw new Error(`下载失败：HTTP ${res.status}（${info.vsixUrl}）`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new Error('下载失败：文件为空');
  }
  fs.writeFileSync(dest, buf);
  return dest;
}

/**
 * 安装 vsix。优先用 VS Code 内置命令（不依赖 PATH 上的 code）；
 * 失败时回退到 code CLI。
 */
export async function installVsix(vsixPath: string): Promise<boolean> {
  try {
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      vscode.Uri.file(vsixPath)
    );
    return true;
  } catch {
    const code = findCodeBinary();
    if (!code) {
      return false;
    }
    await run(code, ['--install-extension', vsixPath, '--force']);
    return true;
  }
}

/** 一键更新：下载 → 安装。调用方负责进度提示与重载窗口。 */
export async function updateTo(info: UpdateInfo): Promise<boolean> {
  const vsixPath = await downloadVsix(info);
  return installVsix(vsixPath);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
