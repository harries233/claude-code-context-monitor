import { ClaudeContextProvider } from './ClaudeContextProvider';
import { ClaudeCliProvider } from './ClaudeCliProvider';

/**
 * Provider 工厂。
 *
 * 未来扩展时在此处按优先级返回不同 Provider（例如优先 Claude VS Code Extension，
 * 回退 Claude Code CLI）。当前只实现 CLI Provider。
 */
export function createProvider(dataDir: string): ClaudeContextProvider {
  return new ClaudeCliProvider(dataDir);
}

/** 探测可用的 Provider（当前仅 CLI）。 */
export function detectProvider(dataDir: string): ClaudeContextProvider {
  // 未来可在这里遍历候选 Provider，返回第一个 detect().available 的。
  return new ClaudeCliProvider(dataDir);
}

export { ClaudeContextProvider } from './ClaudeContextProvider';
export { ClaudeCliProvider } from './ClaudeCliProvider';
