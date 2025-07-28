/**
 * 条件分析器 - 根据环境自动选择本地或远程分析
 * 在 Content Script 中使用远程分析，在 Background Service Worker 中使用本地分析
 */

import type { Word } from './common'

// 动态导入分析器
let localAnalyzer: typeof import('./index') | null = null
let remoteAnalyzer: typeof import('./remote-analyzer') | null = null

/**
 * 检测当前运行环境
 */
function isInServiceWorker(): boolean {
  try {
    return typeof (globalThis as any).importScripts === 'function' && 
           typeof window === 'undefined' &&
           typeof document === 'undefined'
  } catch {
    return false
  }
}

/**
 * 检测是否在内容脚本环境
 */
function isInContentScript(): boolean {
  return typeof window !== 'undefined' &&
         typeof document !== 'undefined' &&
         typeof chrome !== 'undefined' &&
         !!chrome.runtime
}

/**
 * 获取适当的分析器
 */
async function getAnalyzer(): Promise<{
  analyze: (text: string) => Promise<Word[]>
}> {
  if (isInServiceWorker()) {
    // 在 Service Worker 中使用本地分析器
    if (!localAnalyzer) {
      localAnalyzer = await import('./index')
    }
    return localAnalyzer
  } else if (isInContentScript()) {
    // 在内容脚本中使用远程分析器
    if (!remoteAnalyzer) {
      remoteAnalyzer = await import('./remote-analyzer')
    }
    return remoteAnalyzer
  } else {
    // 默认情况下使用本地分析器（例如在选项页面或弹出窗口中）
    if (!localAnalyzer) {
      localAnalyzer = await import('./index')
    }
    return localAnalyzer
  }
}

/**
 * 统一的分析接口
 */
export async function analyze(text: string): Promise<Word[]> {
  const analyzer = await getAnalyzer()
  return analyzer.analyze(text)
}

/**
 * 导出类型
 */
export type { Word } from './common'