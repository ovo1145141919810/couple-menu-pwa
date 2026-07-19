export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > 12 * 1024 * 1024) throw new Error('图片不能超过 12MB。')

  let source: CanvasImageSource
  let width: number
  let height: number
  let release: () => void = () => undefined

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      source = bitmap
      width = bitmap.width
      height = bitmap.height
      release = () => bitmap.close()
    } catch {
      const loaded = await loadImageElement(file)
      source = loaded.image
      width = loaded.image.naturalWidth
      height = loaded.image.naturalHeight
      release = loaded.release
    }
  } else {
    const loaded = await loadImageElement(file)
    source = loaded.image
    width = loaded.image.naturalWidth
    height = loaded.image.naturalHeight
    release = loaded.release
  }

  if (!width || !height) {
    release()
    throw new Error('无法读取这张图片，请换一张再试。')
  }

  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    release()
    throw new Error('当前浏览器无法处理图片。')
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  release()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败。'))),
      'image/webp',
      quality
    )
  })
}

function loadImageElement(file: File): Promise<{ image: HTMLImageElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    const release = () => URL.revokeObjectURL(objectUrl)
    image.onload = () => resolve({ image, release })
    image.onerror = () => {
      release()
      reject(new Error('无法读取这张图片，请换一张再试。'))
    }
    image.src = objectUrl
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败。'))
    reader.readAsDataURL(blob)
  })
}
