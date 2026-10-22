import type { CropRect } from '@/lib/messages'

const MAX_WIDTH = 1280
const JPEG_QUALITY = 0.8

/** Captures the visible tab, cropped to the video when its position is known, as a JPEG data URL. */
export async function captureScreenshot(tab: chrome.tabs.Tab, crop?: CropRect): Promise<string> {
  const capture = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
  const bitmap = await createImageBitmap(await (await fetch(capture)).blob())

  let [sx, sy, sw, sh] = [0, 0, bitmap.width, bitmap.height]
  if (crop && crop.width > 0 && crop.height > 0) {
    const scale = bitmap.width / crop.viewportWidth
    sx = Math.max(0, Math.round(crop.x * scale))
    sy = Math.max(0, Math.round(crop.y * scale))
    sw = Math.min(bitmap.width - sx, Math.round(crop.width * scale))
    sh = Math.min(bitmap.height - sy, Math.round(crop.height * scale))
    if (sw <= 0 || sh <= 0) [sx, sy, sw, sh] = [0, 0, bitmap.width, bitmap.height]
  }

  const width = Math.min(MAX_WIDTH, sw)
  const height = Math.round((sh * width) / sw)
  const canvas = new OffscreenCanvas(width, height)
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close()

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:image/jpeg;base64,${btoa(binary)}`
}
