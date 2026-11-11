/** Convierte la foto (incluye HEIC de iPhone) a JPEG comprimido para que el servidor la acepte. */
export async function prepareProgressPhoto(file: File): Promise<File> {
  const image = await loadImage(file)
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.82)
  })
  if (!blob) throw new Error('blob')

  const base = file.name.replace(/\.[^.]+$/, '').trim() || 'checkin'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

/**
 * Recorta la foto de perfil al cuadrado central y la reduce a 1024 px. El servidor la
 * vuelve a codificar a 512 px; aquí solo se aligera la subida (y se convierte HEIC).
 */
export async function prepareAvatar(file: File): Promise<File> {
  const image = await loadImage(file)
  const side = Math.min(image.width, image.height)
  const size = Math.min(1024, side)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.88)
  })
  if (!blob) throw new Error('blob')

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg', lastModified: Date.now() })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      if (image.naturalWidth < 1) {
        reject(new Error('empty'))
        return
      }
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    image.src = url
  })
}
