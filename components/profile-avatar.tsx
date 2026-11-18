'use client'
import {useEffect, useRef} from 'react'
import {avatarSize} from '@/lib/profile-avatar'

export function ProfileAvatar({pixels, name, small = false}: {pixels?: string | null; name: string; small?: boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !pixels) return
    const rgb = atob(pixels)
    const image = ctx.createImageData(avatarSize, avatarSize)
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      image.data[j] = rgb.charCodeAt(i)
      image.data[j+1] = rgb.charCodeAt(i+1)
      image.data[j+2] = rgb.charCodeAt(i+2)
      image.data[j+3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }, [pixels])
  const style = 'profile-avatar' + (small ? ' profile-avatar-small' : '')
  return pixels
    ? <canvas ref={canvas} className={style} width={avatarSize} height={avatarSize} aria-label="Profile picture" role="img"/>
    : <span aria-hidden="true" className={style}>{Array.from(name.trim())[0]?.toUpperCase() || '•'}</span>
}

export async function thumbnail(file: File) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG or WebP image up to 4 MB.')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = avatarSize
    const ctx = canvas.getContext('2d')
    if (!ctx || !side) throw new Error('Unable to read this picture.')
    ctx.fillStyle = '#e7ebe3'
    ctx.fillRect(0, 0, avatarSize, avatarSize)
    ctx.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, avatarSize, avatarSize)
    const rgba = ctx.getImageData(0, 0, avatarSize, avatarSize).data
    let rgb = ''
    for (let i = 0; i < rgba.length; i += 4) rgb += String.fromCharCode(rgba[i], rgba[i+1], rgba[i+2])
    return btoa(rgb)
  } finally {bitmap.close()}
}
