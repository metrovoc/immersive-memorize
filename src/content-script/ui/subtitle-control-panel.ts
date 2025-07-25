/**
 * 字幕控制面板UI组件
 * 提供字幕源切换和自定义字幕配置界面
 */

import type { ImmersiveMemorize } from '../immersive-memorize';

export class SubtitleControlPanel {
  private main: ImmersiveMemorize;
  private panelElement: HTMLElement | null = null;
  private isVisible: boolean = false;
  private debugMode: boolean;

  constructor(main: ImmersiveMemorize, debugMode: boolean = false) {
    this.main = main;
    this.debugMode = debugMode;
  }

  /**
   * 显示激活按钮
   */
  showActivationButton(): void {
    // 如果已经存在按钮，不重复创建
    if (document.querySelector('.im-activation-button')) return;

    const button = document.createElement('button');
    button.className = 'im-activation-button';
    button.innerHTML = '🎌';
    button.title = 'Immersive Memorize - 字幕设置';
    
    button.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      z-index: 2147483646;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    button.addEventListener('click', () => {
      this.togglePanel();
    });

    document.body.appendChild(button);

    if (this.debugMode) {
      console.log('[SubtitleControlPanel] 激活按钮已创建');
    }
  }

  /**
   * 切换面板显示状态
   */
  private togglePanel(): void {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  /**
   * 显示控制面板
   */
  private showPanel(): void {
    if (this.panelElement) {
      this.panelElement.remove();
    }

    this.panelElement = this.createPanel();
    document.body.appendChild(this.panelElement);
    this.isVisible = true;

    // 添加点击外部关闭功能
    setTimeout(() => {
      document.addEventListener('click', this.handlerOutsideClick, true);
    }, 100);

    if (this.debugMode) {
      console.log('[SubtitleControlPanel] 面板已显示');
    }
  }

  /**
   * 隐藏控制面板
   */
  private hidePanel(): void {
    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }
    this.isVisible = false;
    document.removeEventListener('click', this.handlerOutsideClick, true);

    if (this.debugMode) {
      console.log('[SubtitleControlPanel] 面板已隐藏');
    }
  }

  /**
   * 处理点击外部关闭
   */
  private handlerOutsideClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (this.panelElement && !this.panelElement.contains(target) && 
        !target.classList.contains('im-activation-button')) {
      this.hidePanel();
    }
  };

  /**
   * 创建控制面板
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'im-subtitle-control-panel';
    
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      left: 20px;
      width: 350px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
    `;

    const status = this.main.getStatus();
    
    panel.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #e0e0e0;">
        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">字幕设置</h3>
        <div style="font-size: 14px; color: #666;">
          <div style="margin-bottom: 5px;">
            <strong>当前字幕源:</strong> 
            <span style="color: ${status.activeSource ? '#4caf50' : '#f44336'};">
              ${status.activeSource || '未激活'}
            </span>
          </div>
          <div style="margin-bottom: 5px;">
            <strong>状态:</strong> 
            <span style="color: ${status.isReady ? '#4caf50' : '#ff9800'};">
              ${status.isReady ? '就绪' : '等待中'}
            </span>
          </div>
          <div>
            <strong>已学词汇:</strong> 
            <span style="color: #2196f3;">${status.learnedWordsCount} 个</span>
          </div>
        </div>
      </div>
      
      <div style="padding: 20px;">
        ${this.createSourceSwitchSection(status)}
        ${this.createCustomSubtitleSection()}
      </div>
    `;

    this.attachEventListeners(panel);
    return panel;
  }

  /**
   * 创建字幕源切换区域
   */
  private createSourceSwitchSection(status: any): string {
    const hasNativeSource = status.availableSources.some((name: string) => name !== 'Custom SRT');
    
    if (!hasNativeSource) {
      return `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 14px; color: #999; text-align: center;">
            当前网站无原生字幕支持
          </div>
        </div>
      `;
    }

    return `
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #555; font-size: 16px;">字幕源</h4>
        <div style="display: flex; gap: 10px;">
          <button id="im-switch-native" 
                  style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; 
                         background: ${status.activeSource !== 'Custom SRT' ? '#e3f2fd' : 'white'}; 
                         cursor: pointer; font-size: 14px;">
            原生字幕
          </button>
          <button id="im-switch-custom" 
                  style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; 
                         background: ${status.activeSource === 'Custom SRT' ? '#e3f2fd' : 'white'}; 
                         cursor: pointer; font-size: 14px;">
            自定义字幕
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 创建自定义字幕区域
   */
  private createCustomSubtitleSection(): string {
    return `
      <div id="im-custom-subtitle-section">
        <h4 style="margin: 0 0 10px 0; color: #555; font-size: 16px;">自定义字幕</h4>
        
        <div id="im-video-selection" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #666;">选择视频元素:</label>
          <button id="im-select-video" 
                  style="width: 100%; padding: 10px; border: 2px dashed #ddd; border-radius: 6px; 
                         background: white; cursor: pointer; font-size: 14px; color: #666;">
            点击选择视频元素
          </button>
          <div id="im-selected-video-info" style="margin-top: 5px; font-size: 12px; color: #999; display: none;">
            已选择视频元素
          </div>
        </div>
        
        <div id="im-srt-upload" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #666;">上传SRT文件:</label>
          <input type="file" id="im-srt-file" 
                 accept=".srt" 
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; 
                        font-size: 14px;">
        </div>
        
        <button id="im-activate-custom" 
                disabled
                style="width: 100%; padding: 12px; background: #4caf50; color: white; border: none; 
                       border-radius: 6px; font-size: 14px; cursor: pointer; opacity: 0.5;">
          激活自定义字幕
        </button>
      </div>
    `;
  }

  /**
   * 绑定事件监听器
   */
  private attachEventListeners(panel: HTMLElement): void {
    // 原生字幕切换
    const nativeButton = panel.querySelector('#im-switch-native') as HTMLButtonElement;
    if (nativeButton) {
      nativeButton.addEventListener('click', () => {
        this.main.switchToNativeSubtitleMode();
        this.hidePanel();
      });
    }

    // 自定义字幕切换（仅切换UI状态）
    const customButton = panel.querySelector('#im-switch-custom') as HTMLButtonElement;
    if (customButton) {
      customButton.addEventListener('click', () => {
        // 这里只是高亮显示，实际切换在激活时进行
        this.updateButtonStates(panel, 'custom');
      });
    }

    // 视频选择
    const selectVideoButton = panel.querySelector('#im-select-video') as HTMLButtonElement;
    if (selectVideoButton) {
      selectVideoButton.addEventListener('click', () => {
        this.startVideoSelection(panel);
      });
    }

    // SRT文件上传
    const srtFileInput = panel.querySelector('#im-srt-file') as HTMLInputElement;
    if (srtFileInput) {
      srtFileInput.addEventListener('change', () => {
        this.handleSRTFileChange(panel);
      });
    }

    // 激活自定义字幕
    const activateButton = panel.querySelector('#im-activate-custom') as HTMLButtonElement;
    if (activateButton) {
      activateButton.addEventListener('click', () => {
        this.activateCustomSubtitles(panel);
      });
    }
  }

  /**
   * 更新按钮状态
   */
  private updateButtonStates(panel: HTMLElement, activeMode: 'native' | 'custom'): void {
    const nativeButton = panel.querySelector('#im-switch-native') as HTMLButtonElement;
    const customButton = panel.querySelector('#im-switch-custom') as HTMLButtonElement;

    if (nativeButton && customButton) {
      if (activeMode === 'native') {
        nativeButton.style.background = '#e3f2fd';
        customButton.style.background = 'white';
      } else {
        nativeButton.style.background = 'white';
        customButton.style.background = '#e3f2fd';
      }
    }
  }

  /**
   * 开始视频选择
   */
  private startVideoSelection(panel: HTMLElement): void {
    const videos = document.querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
    
    if (videos.length === 0) {
      this.showMessage('页面中未找到视频元素', 'error');
      return;
    }

    if (videos.length === 1) {
      // 只有一个视频，直接选择
      this.selectVideo(videos[0], panel);
      return;
    }

    // 多个视频，让用户选择
    this.showVideoSelectionDialog(Array.from(videos), panel);
  }

  /**
   * 显示视频选择对话框
   */
  private showVideoSelectionDialog(videos: HTMLVideoElement[], panel: HTMLElement): void {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 300px;
      width: 100%;
    `;

    content.innerHTML = `
      <h4 style="margin: 0 0 15px 0;">选择视频元素</h4>
      <div id="im-video-list">
        ${videos.map((video, index) => `
          <div style="margin-bottom: 10px;">
            <button class="im-video-option" data-index="${index}"
                    style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; 
                           background: white; cursor: pointer; text-align: left;">
              视频 ${index + 1} (${Math.round(video.videoWidth || 0)}x${Math.round(video.videoHeight || 0)})
            </button>
          </div>
        `).join('')}
      </div>
      <button id="im-cancel-selection" 
              style="width: 100%; padding: 8px; background: #f44336; color: white; border: none; 
                     border-radius: 4px; margin-top: 10px; cursor: pointer;">
        取消
      </button>
    `;

    dialog.appendChild(content);
    panel.appendChild(dialog);

    // 绑定事件
    content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('im-video-option')) {
        const index = parseInt(target.dataset.index || '0');
        this.selectVideo(videos[index], panel);
        dialog.remove();
      } else if (target.id === 'im-cancel-selection') {
        dialog.remove();
      }
    });
  }

  /**
   * 选择视频
   */
  private selectVideo(video: HTMLVideoElement, panel: HTMLElement): void {
    // 存储选中的视频
    (panel as any).selectedVideo = video;

    // 更新UI
    const videoInfo = panel.querySelector('#im-selected-video-info') as HTMLElement;
    if (videoInfo) {
      videoInfo.textContent = `已选择: ${Math.round(video.videoWidth || 0)}x${Math.round(video.videoHeight || 0)}`;
      videoInfo.style.display = 'block';
    }

    const selectButton = panel.querySelector('#im-select-video') as HTMLButtonElement;
    if (selectButton) {
      selectButton.textContent = '重新选择视频元素';
      selectButton.style.borderColor = '#4caf50';
      selectButton.style.color = '#4caf50';
    }

    this.checkActivationReadiness(panel);

    if (this.debugMode) {
      console.log('[SubtitleControlPanel] 视频元素已选择');
    }
  }

  /**
   * 处理SRT文件变化
   */
  private handleSRTFileChange(panel: HTMLElement): void {
    const fileInput = panel.querySelector('#im-srt-file') as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (file && file.name.endsWith('.srt')) {
      // 存储选中的文件
      (panel as any).selectedSRTFile = file;
      this.checkActivationReadiness(panel);

      if (this.debugMode) {
        console.log('[SubtitleControlPanel] SRT文件已选择:', file.name);
      }
    } else {
      this.showMessage('请选择有效的SRT文件', 'error');
    }
  }

  /**
   * 检查激活按钮是否可用
   */
  private checkActivationReadiness(panel: HTMLElement): void {
    const hasVideo = !!(panel as any).selectedVideo;
    const hasSRT = !!(panel as any).selectedSRTFile;
    
    const activateButton = panel.querySelector('#im-activate-custom') as HTMLButtonElement;
    if (activateButton) {
      activateButton.disabled = !(hasVideo && hasSRT);
      activateButton.style.opacity = hasVideo && hasSRT ? '1' : '0.5';
      activateButton.style.cursor = hasVideo && hasSRT ? 'pointer' : 'not-allowed';
    }
  }

  /**
   * 激活自定义字幕
   */
  private async activateCustomSubtitles(panel: HTMLElement): Promise<void> {
    const selectedVideo = (panel as any).selectedVideo as HTMLVideoElement;
    const selectedSRTFile = (panel as any).selectedSRTFile as File;

    if (!selectedVideo || !selectedSRTFile) {
      this.showMessage('请先选择视频和SRT文件', 'error');
      return;
    }

    try {
      await this.main.switchToCustomSubtitleMode(selectedSRTFile, selectedVideo);
      this.hidePanel();
    } catch (error) {
      this.showMessage('激活失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 显示消息
   */
  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // 这里可以复用主程序的通知系统，或者创建一个简单的消息显示
    console.log(`[SubtitleControlPanel] ${type.toUpperCase()}: ${message}`);
    
    // 简单的消息显示
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 2147483648;
      font-size: 14px;
    `;
    messageElement.textContent = message;
    
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 3000);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }

    const activationButton = document.querySelector('.im-activation-button');
    if (activationButton) {
      activationButton.remove();
    }

    document.removeEventListener('click', this.handlerOutsideClick, true);

    if (this.debugMode) {
      console.log('[SubtitleControlPanel] UI清理完成');
    }
  }
}