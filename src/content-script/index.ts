/**
 * Immersive Memorize V2 - 主入口文件
 * 基于新的多字幕源架构
 */

import { ImmersiveMemorize } from './immersive-memorize';
import { SubtitleControlPanel } from './ui/subtitle-control-panel';

class Application {
  private immersiveMemorize: ImmersiveMemorize;
  private controlPanel: SubtitleControlPanel;
  private isInitialized: boolean = false;

  constructor() {
    this.immersiveMemorize = new ImmersiveMemorize();
    this.controlPanel = new SubtitleControlPanel(this.immersiveMemorize, true);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[Application] 开始初始化 Immersive Memorize V2...');

      // 初始化主控制器
      await this.immersiveMemorize.init();

      // 显示控制界面
      this.setupUI();

      // 设置清理函数
      this.setupCleanup();

      this.isInitialized = true;
      console.log('[Application] Immersive Memorize V2 初始化完成');

      // 显示启动通知
      this.showStartupNotification();

    } catch (error) {
      console.error('[Application] 初始化失败:', error);
    }
  }

  private setupUI(): void {
    // 显示激活按钮
    this.controlPanel.showActivationButton();
  }

  private setupCleanup(): void {
    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // 监听扩展程序消息，支持手动清理
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'cleanup') {
        this.cleanup();
        sendResponse({ success: true });
      }
    });
  }

  private cleanup(): void {
    try {
      this.immersiveMemorize.cleanup();
      this.controlPanel.cleanup();
      console.log('[Application] 应用程序清理完成');
    } catch (error) {
      console.error('[Application] 清理时发生错误:', error);
    }
  }

  private showStartupNotification(): void {
    const status = this.immersiveMemorize.getStatus();
    
    let message = 'Immersive Memorize V2 已启动';
    if (status.activeSource) {
      message += ` - 使用 ${status.activeSource}`;
    }

    this.showNotification(message, 'success');
  }

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ): void {
    const notification = document.createElement('div');
    let bgColor: string, icon: string;

    switch (type) {
      case 'error':
        bgColor = '#f44336';
        icon = '✗';
        break;
      case 'warning':
        bgColor = '#ff9800';
        icon = '⚠';
        break;
      case 'success':
        bgColor = '#4caf50';
        icon = '✓';
        break;
      default:
        bgColor = '#2196f3';
        icon = 'ℹ';
    }

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      max-width: 350px;
      word-wrap: break-word;
      animation: slideInRight 0.3s ease-out;
    `;

    // 添加动画样式
    if (!document.head.querySelector('#im-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'im-notification-styles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    notification.textContent = `${icon} ${message}`;

    const appendTarget = document.fullscreenElement || document.body;
    appendTarget.appendChild(notification);

    const duration = type === 'error' ? 4000 : 2500;
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, duration);
  }

  // 公共API方法，供调试使用
  getStatus() {
    return this.immersiveMemorize.getStatus();
  }

  switchToCustomMode(srtFile: File, targetVideo: HTMLVideoElement) {
    return this.immersiveMemorize.switchToCustomSubtitleMode(srtFile, targetVideo);
  }

  switchToNativeMode() {
    return this.immersiveMemorize.switchToNativeSubtitleMode();
  }
}

// 创建全局应用实例
const app = new Application();

// 暴露到全局作用域供调试使用
(window as any).ImmersiveMemorizeV2 = app;

// 初始化应用
function initializeApp(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => app.initialize(), 1000);
    });
  } else {
    setTimeout(() => app.initialize(), 1000);
  }
}

// 确保在扩展程序上下文中运行
if (typeof chrome !== 'undefined' && chrome.runtime) {
  initializeApp();
} else {
  console.warn('[Application] 非扩展程序环境，跳过初始化');
}

export default app;

// HMR (Hot Module Replacement) 支持
// if (import.meta.webpackHot) {
//   import.meta.webpackHot.accept();
// }