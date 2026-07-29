import { supabase } from './supabase'

/**
 * Upload a photo file to the Supabase Storage 'photos' bucket.
 * Returns the public URL of the uploaded image.
 */
/**
 * Compress an image file on the client using HTML5 Canvas before uploading.
 * Resizes large images (max 1200px) and converts to WebP/JPEG format at 82% quality.
 * Reduces 5MB-10MB photos to ~150KB-300KB for lightning fast 1-second uploads.
 */
async function compressImageFile(file: File): Promise<Blob> {
  // If already small (< 300KB), don't compress
  if (file.size < 300 * 1024 || !file.type.startsWith('image/')) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxDim = 1200
      let width = img.width
      let height = img.height

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          resolve(blob || file)
        },
        'image/webp',
        0.82
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}

/**
 * Upload a photo file to the Supabase Storage 'photos' bucket with auto-compression.
 * Returns the public URL of the uploaded image.
 */
export async function uploadPhoto(file: File): Promise<string> {
  if (!file) throw new Error('No file provided for photo upload')

  const compressedBlob = await compressImageFile(file)
  const isWebp = compressedBlob.type === 'image/webp'
  const ext = isWebp ? 'webp' : (file.name.split('.').pop() || 'jpg')
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`
  const filePath = `uploads/${fileName}`

  const { error } = await supabase.storage
    .from('photos')
    .upload(filePath, compressedBlob, {
      cacheControl: '31536000', // 1 year cache control
      upsert: true,
      contentType: isWebp ? 'image/webp' : file.type,
    })

  if (error) {
    console.error('Error uploading photo to Supabase Storage:', error)
    throw new Error(`Photo upload failed: ${error.message}`)
  }

  const { data: publicUrlData } = supabase.storage
    .from('photos')
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}

/**
 * Upload a voice note audio file to the Supabase Storage 'voice-notes' bucket.
 * Returns the public URL of the uploaded audio file.
 */
export async function uploadVoiceNote(file: File): Promise<string> {
  if (!file) throw new Error('No audio file provided for voice note upload')

  const ext = file.name.split('.').pop() || 'mp3'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`
  const filePath = `voice_notes/${fileName}`

  const { error } = await supabase.storage
    .from('voice-notes')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Error uploading voice note to Supabase Storage:', error)
    throw new Error(`Voice note upload failed: ${error.message}`)
  }

  const { data: publicUrlData } = supabase.storage
    .from('voice-notes')
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}

/**
 * Upload a custom MP3/audio music file to Supabase Storage 'voice-notes' bucket.
 * Returns the public URL of the uploaded music file.
 */
export async function uploadMusicTrack(file: File): Promise<string> {
  if (!file) throw new Error('No music file provided')

  const ext = file.name.split('.').pop() || 'mp3'
  const fileName = `music_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`
  const filePath = `music/${fileName}`

  const { error } = await supabase.storage
    .from('voice-notes')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Error uploading music track to Supabase Storage:', error)
    throw new Error(`Music upload failed: ${error.message}`)
  }

  const { data: publicUrlData } = supabase.storage
    .from('voice-notes')
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}

