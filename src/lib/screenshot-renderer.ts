/**
 * Screenshot渲染工具类
 * 支持多种图片格式的统一渲染
 */
export class ScreenshotRenderer {
  /**
   * 创建图片元素
   */
  static createImageElement(
    src: string,
    options: {
      className?: string
      alt?: string
      onLoad?: () => void
      onError?: () => void
    } = {}
  ): HTMLImageElement {
    const img = document.createElement('img')

    // 统一处理各种格式
    img.src = this.normalizeImageSrc(src)
    img.className = options.className || ''
    img.alt = options.alt || 'Screenshot'

    if (options.onLoad) img.onload = options.onLoad
    if (options.onError) img.onerror = options.onError

    return img
  }

  /**
   * 标准化图片源地址
   */
  private static normalizeImageSrc(src: string): string {
    if (!src) return ''

    // 浏览器原生支持的格式直接返回
    if (
      src.startsWith('data:') ||
      src.startsWith('http') ||
      src.startsWith('blob:') ||
      src.startsWith('chrome-extension://')
    ) {
      return src
    }

    // 假设是base64，添加前缀
    return `data:image/png;base64,${src}`
  }

  /**
   * 检查是否有有效的截图数据
   */
  static hasValidScreenshot(screenshot: string): boolean {
    return !!(screenshot && screenshot.trim())
  }

  /**
   * 创建截图图标SVG
   */
  static createScreenshotIcon(): string {
    return `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    `
  }
}
