import type { ToastType } from '@/types'

const UI_STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .layer {
    position: fixed; inset: 0; pointer-events: none;
    font: 14px/1.4 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
    color: #111827;
  }
  .toasts {
    position: absolute; top: 20px; right: 20px; display: flex; flex-direction: column;
    gap: 8px; align-items: flex-end;
  }
  .toast {
    max-width: 360px; padding: 10px 16px; border-radius: 8px; color: #fff; font-weight: 600;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3); overflow-wrap: anywhere;
    animation: toast-in 0.2s ease-out; transition: opacity 0.3s, transform 0.3s;
  }
  .toast.leaving { opacity: 0; transform: translateX(16px); }
  .toast.success { background: #16a34a; }
  .toast.error { background: #dc2626; }
  .toast.warning { background: #d97706; }
  .toast.info { background: #2563eb; }
  @keyframes toast-in { from { opacity: 0; transform: translateX(16px); } }
  .video-choice {
    position: fixed; pointer-events: auto; cursor: pointer; display: flex;
    flex-direction: column; align-items: center; justify-content: center; gap: 12px;
    background: rgba(17, 24, 39, 0.72); border: 3px solid #3b82f6; border-radius: 12px;
    color: #fff; text-align: center; backdrop-filter: blur(2px); transition: border-color 0.2s;
  }
  .video-choice:hover { border-color: #93c5fd; }
  .video-choice strong { font-size: 18px; }
  .video-choice span { color: #d1d5db; font-size: 13px; }
  .button {
    border: 1px solid transparent; border-radius: 8px; padding: 8px 16px; font: inherit;
    font-weight: 600; cursor: pointer; background: #2563eb; color: #fff;
  }
  .button:hover { background: #1d4ed8; }
  .button.secondary { background: #f3f4f6; color: #374151; border-color: #d1d5db; }
  .button.secondary:hover { background: #e5e7eb; }
  .panel {
    position: fixed; pointer-events: auto; width: 320px; padding: 20px; border-radius: 12px;
    background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  }
  .panel h2 { margin: 0; font-size: 17px; font-weight: 600; }
  .panel p { margin: 4px 0 0; color: #6b7280; font-size: 13px; }
  .drop-zone {
    margin: 16px 0; padding: 24px 16px; border: 2px dashed #d1d5db; border-radius: 8px;
    background: #f9fafb; text-align: center; cursor: pointer; transition: all 0.2s;
  }
  .drop-zone:hover, .drop-zone.dragging { border-color: #3b82f6; background: #eff6ff; }
  .drop-zone strong { display: block; font-weight: 600; color: #374151; }
  .drop-zone span { display: block; margin-top: 4px; font-size: 12px; color: #6b7280; }
  .panel .error { color: #dc2626; margin: -8px 0 12px; font-size: 13px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
`

let host: HTMLElement | null = null
let layer: HTMLElement | null = null

/** A shadow-DOM layer above the page, so page styles cannot change the extension's UI. */
export function uiLayer(): HTMLElement {
  if (!layer) {
    host = document.createElement('immersive-memorize-ui')
    const root = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = UI_STYLES
    layer = document.createElement('div')
    layer.className = 'layer'
    root.append(style, layer)
    // Elements outside the fullscreen element are hidden, so follow it in and out of fullscreen.
    document.addEventListener('fullscreenchange', placeHost)
  }
  placeHost()
  return layer
}

function placeHost(): void {
  if (!host) return
  const fullscreen = document.fullscreenElement
  const parent =
    fullscreen && fullscreen.localName !== 'video' ? fullscreen : document.documentElement
  if (host.parentNode !== parent) parent.appendChild(host)
}

export function toast(message: string, type: ToastType = 'success'): void {
  const container = uiLayer()
  let list = container.querySelector<HTMLElement>('.toasts')
  if (!list) {
    list = document.createElement('div')
    list.className = 'toasts'
    container.appendChild(list)
  }
  const item = document.createElement('div')
  item.className = `toast ${type}`
  item.textContent = message
  list.appendChild(item)
  const duration = type === 'error' ? 4000 : type === 'warning' ? 3000 : 2000
  setTimeout(() => {
    item.classList.add('leaving')
    setTimeout(() => item.remove(), 300)
  }, duration)
}

/** Keyframes for the highlight pulse, which lives in the page's own DOM. */
export function ensureHighlightStyle(): void {
  if (document.getElementById('immersive-memorize-highlight')) return
  const style = document.createElement('style')
  style.id = 'immersive-memorize-highlight'
  style.textContent = `@keyframes im-pulse {
    0%, 100% { box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
    50% { box-shadow: 0 0 15px rgba(255, 152, 0, 0.9); }
  }`
  ;(document.head ?? document.documentElement).appendChild(style)
}
