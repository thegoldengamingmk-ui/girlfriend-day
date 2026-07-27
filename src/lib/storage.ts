import { supabase } from './supabase'

/**
 * Upload a photo file to the Supabase Storage 'photos' bucket.
 * Returns the public URL of the uploaded image.
 */
export async function uploadPhoto(file: File): Promise<string> {
  if (!file) throw new Error('No file provided for photo upload')

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`
  const filePath = `uploads/${fileName}`

  const { error } = await supabase.storage
    .from('photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
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
