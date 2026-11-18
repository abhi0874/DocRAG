// Only fixed-size RGB thumbnails travel to DocRAG. File metadata and external
// image URLs are never rendered or needed to display the saved profile picture.
export const avatarSize = 64
export const avatarLength = avatarSize * avatarSize * 4 // base64 length of 3 bytes per pixel
export const avatarPrefix = 'docrag-rgb:'
export function isAvatar(value: unknown): value is string {
  return typeof value === 'string' && value.length === avatarLength && /^[A-Za-z0-9+/]+$/.test(value)
}
export function storedAvatar(image?: string | null) {
  const pixels = image?.startsWith(avatarPrefix) ? image.slice(avatarPrefix.length) : null
  return isAvatar(pixels) ? pixels : null
}
