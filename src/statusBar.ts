import * as vscode from 'vscode';
import { ContextMonitor } from './contextMonitor';
import { formatDuration, formatTokens } from './format';
import { ContextSnapshot } from './types';
import { describeWarning } from './warningSystem';

/**
 * 底部状态栏：显示 `Claude Context: XX%`，点击打开 Dashboard。
 */
export class StatusBarController {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly monitor: ContextMonitor) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = 'Claude Context';
    this.item.command = 'claudeContextMonitor.openDashboard';
    this.item.text = '$(circuit-board) Claude Context: --%';
    this.item.tooltip = 'Claude Code Context Monitor';
    this.item.show();

    this.monitor.onUpdate((s) => this.update(s));
  }

  private update(s: ContextSnapshot): void {
    if (!s.current) {
      this.item.text = '$(circuit-board) Claude Context: --%';
      this.item.tooltip = '未检测到活动的 Claude Code Session';
      this.item.color = undefined;
      return;
    }
    const w = describeWarning(s.warningLevel);
    this.item.text = `$(circuit-board) Claude Context: ${s.current.contextPercent}%`;
    this.item.color = w.color;
    this.item.tooltip = this.buildTooltip(s);
  }

  private buildTooltip(s: ContextSnapshot): string {
    const c = s.current!;
    return [
      'Claude Context Monitor',
      '────────────────────────────',
      `Context:  ${c.contextPercent}%  (${formatTokens(c.contextTokens)} / ${formatTokens(c.maxContextTokens)} tokens)`,
      `输入 tokens:  ${formatTokens(c.totalInputTokens)}`,
      `输出 tokens:  ${formatTokens(c.totalOutputTokens)}`,
      `消息数:    ${c.messageCount}`,
      `运行时长:  ${formatDuration(c.elapsedMs)}`,
      '',
      describeWarning(s.warningLevel).label,
      '',
      '点击打开详情面板',
    ].join('\n');
  }

  dispose(): void {
    this.item.dispose();
  }
}
