import { supabase, getSupabaseAdmin } from "./supabase"
import type {
  CreateSurpriseInput,
  SurpriseDetailResponse,
  PublicQuestion,
} from "../types/database"

/**
 * Generate a random unique 8-character slug (e.g. AB72KD91)
 */
export function generateSlug(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Creates a surprise entry in Supabase DB with photos and secret questions.
 */
export async function createSurprise(
  input: CreateSurpriseInput,
): Promise<string> {
  const slug = generateSlug()

  const payload: any = {
    slug,
    boyfriend_name: input.boyfriend_name,
    girlfriend_name: input.girlfriend_name,
    letter: input.letter,
    spotify_url: input.spotify_url,
    voice_note_url: input.voice_note_url || null,
  }

  if (input.creator_email) {
    payload.creator_email = input.creator_email
  }
  if (input.creator_user_id) {
    payload.creator_user_id = input.creator_user_id
  }
  if (input.creator_device_token) {
    payload.creator_device_token = input.creator_device_token
  }

  // 1. Insert Surprise Record
  const { data: surpriseData, error: surpriseError } = await supabase
    .from("surprises")
    .insert([payload])
    .select("id")
    .single()

  if (surpriseError || !surpriseData) {
    console.error("Error creating surprise in DB:", surpriseError)
    throw new Error(
      `Failed to create surprise: ${surpriseError?.message || "Unknown error"}`,
    )
  }

  const surpriseId = surpriseData.id

  // 2. Insert Photos with position order
  if (input.photos && input.photos.length > 0) {
    const photoRecords = input.photos.map((url, idx) => ({
      surprise_id: surpriseId,
      photo_url: url,
      position: idx,
    }))

    const { error: photosError } = await supabase
      .from("photos")
      .insert(photoRecords)

    if (photosError) {
      console.error("Error inserting photos into DB:", photosError)
      throw new Error(`Failed to save photos: ${photosError.message}`)
    }
  }

  // 3. Insert Questions with answers
  if (input.questions && input.questions.length > 0) {
    const validQuestions = input.questions.filter(
      (q) => q.question.trim() && q.answer.trim(),
    )

    if (validQuestions.length > 0) {
      const questionRecords = validQuestions.map((q) => ({
        surprise_id: surpriseId,
        question: q.question.trim(),
        answer: q.answer.trim(),
      }))

      const { error: questionsError } = await supabase
        .from("questions")
        .insert(questionRecords)

      if (questionsError) {
        console.error("Error inserting questions into DB:", questionsError)
        throw new Error(`Failed to save questions: ${questionsError.message}`)
      }
    }
  }

  return slug
}

const surpriseCache = new Map<
  string,
  { data: SurpriseDetailResponse; timestamp: number }
>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function invalidateSurpriseCache(slug?: string) {
  if (slug) {
    surpriseCache.delete(slug)
  } else {
    surpriseCache.clear()
  }
}

/**
 * Fetches a surprise by slug using a single consolidated relational query and in-memory cache.
 * Answers to secret questions are NOT returned for security.
 */
export async function getSurpriseBySlug(
  slug: string,
): Promise<SurpriseDetailResponse | null> {
  if (!slug) return null

  // Return cached result if available and fresh
  const cached = surpriseCache.get(slug)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  // Single relational query retrieving surprise, photos, and questions in 1 DB roundtrip
  const { data: surpriseData, error } = await supabase
    .from("surprises")
    .select(`
      *,
      photos:photos(*),
      questions:questions(id, surprise_id, question)
    `)
    .eq("slug", slug)
    .single()

  if (error || !surpriseData) {
    console.warn(`Surprise not found for slug: ${slug}`, error?.message)
    return null
  }

  // Sort photos by position index
  const sortedPhotos = Array.isArray(surpriseData.photos)
    ? [...surpriseData.photos].sort((a, b) => (a.position || 0) - (b.position || 0))
    : []

  const result: SurpriseDetailResponse = {
    surprise: {
      id: surpriseData.id,
      slug: surpriseData.slug,
      boyfriend_name: surpriseData.boyfriend_name,
      girlfriend_name: surpriseData.girlfriend_name,
      letter: surpriseData.letter,
      spotify_url: surpriseData.spotify_url,
      voice_note_url: surpriseData.voice_note_url,
      created_at: surpriseData.created_at,
    },
    photos: sortedPhotos,
    questions: (surpriseData.questions as PublicQuestion[]) || [],
  }

  // Store in memory cache
  surpriseCache.set(slug, { data: result, timestamp: Date.now() })

  return result
}

/**
 * Server-side verification of submitted answers.
 * Compares submitted answers with the database securely without sending answers to client.
 */
export async function verifyQuestions(
  slug: string,
  submittedAnswers: string[],
): Promise<{ success: boolean; message?: string }> {
  if (!slug) return { success: false, message: "Invalid slug" }

  // Use admin client or DB query to retrieve actual answers
  const adminClient = getSupabaseAdmin()

  const { data: surprise, error: surpriseError } = await adminClient
    .from("surprises")
    .select("id")
    .eq("slug", slug)
    .single()

  if (surpriseError || !surprise) {
    return { success: false, message: "Surprise not found" }
  }

  const { data: dbQuestions, error: questionsError } = await adminClient
    .from("questions")
    .select("id, question, answer")
    .eq("surprise_id", surprise.id)

  if (questionsError || !dbQuestions || dbQuestions.length === 0) {
    // If no questions were configured, verification passes automatically
    return { success: true }
  }

  // Compare submitted answers with DB answers (case-insensitive & trimmed)
  const allCorrect = dbQuestions.every((q, idx) => {
    const userAns = (submittedAnswers[idx] || "").trim().toLowerCase()
    const correctAns = (q.answer || "").trim().toLowerCase()

    // Normalize date format if comparing dates or text
    return userAns === correctAns
  })

  return {
    success: allCorrect,
    message: allCorrect
      ? "Answers verified successfully!"
      : "Incorrect answer(s). Please try again ❤️",
  }
}

/**
 * Retrieves all gift surprises created by a device (by device token) from Supabase.
 * Falls back to email/userId lookup for backward compatibility with old records.
 */
export async function getUserCreatedSurprises(
  identifier: string,
): Promise<{
  slug: string
  girlfriend_name: string
  boyfriend_name: string
  created_at: string
}[]> {
  if (!identifier) return []

  try {
    // Primary: query by device token (new system)
    const { data: byToken } = await supabase
      .from("surprises")
      .select("slug, girlfriend_name, boyfriend_name, created_at")
      .eq("creator_device_token", identifier)
      .order("created_at", { ascending: false })

    if (byToken && byToken.length > 0) {
      return byToken
    }

    // Fallback: legacy email/userId lookup for old records
    const cleanId = identifier.trim().toLowerCase()
    const { data: byLegacy } = await supabase
      .from("surprises")
      .select("slug, girlfriend_name, boyfriend_name, created_at")
      .or(`creator_email.eq.${cleanId},creator_user_id.eq.${identifier}`)
      .order("created_at", { ascending: false })

    if (byLegacy && byLegacy.length > 0) {
      return byLegacy
    }
  } catch (err) {
    console.warn("getUserCreatedSurprises notice:", err)
  }

  return []
}

/**
 * Fetches complete surprise details (including secret questions & answers) for editing.
 */
export async function getSurpriseForEdit(slug: string): Promise<{
  slug: string
  boyfriend_name: string
  girlfriend_name: string
  letter: string
  spotify_url: string
  voice_note_url: string | null
  photos: string[]
  questions: { question: string; answer: string }[]
} | null> {
  if (!slug) return null

  try {
    const adminClient = getSupabaseAdmin()
    const { data: surpriseData, error } = await adminClient
      .from("surprises")
      .select(`
        *,
        photos:photos(*),
        questions:questions(id, question, answer)
      `)
      .eq("slug", slug)
      .single()

    if (error || !surpriseData) {
      console.warn("Failed to fetch surprise for edit via relational query, trying public fallback:", error?.message)
      const publicData = await getSurpriseBySlug(slug)
      if (publicData) {
        return {
          slug: publicData.surprise.slug,
          boyfriend_name: publicData.surprise.boyfriend_name || "",
          girlfriend_name: publicData.surprise.girlfriend_name || "",
          letter: publicData.surprise.letter || "",
          spotify_url: publicData.surprise.spotify_url || "",
          voice_note_url: publicData.surprise.voice_note_url || null,
          photos: (publicData.photos || []).map((p: any) => p?.photo_url).filter(Boolean),
          questions: (publicData.questions || []).map((q: any) => ({
            question: q?.question || "",
            answer: "",
          })),
        }
      }
      return null
    }

    const sortedPhotos = Array.isArray(surpriseData.photos)
      ? [...surpriseData.photos].sort(
          (a, b) => (a.position || 0) - (b.position || 0),
        )
      : []

    return {
      slug: surpriseData.slug || slug,
      boyfriend_name: surpriseData.boyfriend_name || "",
      girlfriend_name: surpriseData.girlfriend_name || "",
      letter: surpriseData.letter || "",
      spotify_url: surpriseData.spotify_url || "",
      voice_note_url: surpriseData.voice_note_url || null,
      photos: sortedPhotos.map((p: any) => p?.photo_url).filter(Boolean),
      questions: Array.isArray(surpriseData.questions)
        ? surpriseData.questions.map((q: any) => ({
            question: q?.question || "",
            answer: q?.answer || "",
          }))
        : [],
    }
  } catch (err) {
    console.error("getSurpriseForEdit error:", err)
    try {
      const publicData = await getSurpriseBySlug(slug)
      if (publicData) {
        return {
          slug: publicData.surprise.slug,
          boyfriend_name: publicData.surprise.boyfriend_name || "",
          girlfriend_name: publicData.surprise.girlfriend_name || "",
          letter: publicData.surprise.letter || "",
          spotify_url: publicData.surprise.spotify_url || "",
          voice_note_url: publicData.surprise.voice_note_url || null,
          photos: (publicData.photos || []).map((p: any) => p?.photo_url).filter(Boolean),
          questions: (publicData.questions || []).map((q: any) => ({
            question: q?.question || "",
            answer: "",
          })),
        }
      }
    } catch {}
    return null
  }
}

/**
 * Updates an existing surprise entry in Supabase DB with new photos, letter, and secret questions.
 */
export async function updateSurprise(
  slug: string,
  input: CreateSurpriseInput,
): Promise<void> {
  if (!slug) throw new Error("Slug is required for update")

  const adminClient = getSupabaseAdmin()

  // 1. Fetch surprise ID
  const { data: surprise, error: fetchErr } = await adminClient
    .from("surprises")
    .select("id")
    .eq("slug", slug)
    .single()

  if (fetchErr || !surprise) {
    throw new Error("Surprise record not found for update")
  }

  const surpriseId = surprise.id

  // 2. Update surprise record
  const updatePayload: any = {
    boyfriend_name: input.boyfriend_name,
    girlfriend_name: input.girlfriend_name,
    letter: input.letter,
    spotify_url: input.spotify_url,
    voice_note_url: input.voice_note_url || null,
  }

  const { error: updateErr } = await adminClient
    .from("surprises")
    .update(updatePayload)
    .eq("id", surpriseId)

  if (updateErr) {
    console.error("Error updating surprise DB:", updateErr)
    throw new Error(`Failed to update surprise: ${updateErr.message}`)
  }

  // 3. Update Photos: Delete existing photos and insert new photos
  await adminClient.from("photos").delete().eq("surprise_id", surpriseId)

  if (input.photos && input.photos.length > 0) {
    const photoRecords = input.photos.map((url, idx) => ({
      surprise_id: surpriseId,
      photo_url: url,
      position: idx,
    }))

    const { error: photosError } = await adminClient
      .from("photos")
      .insert(photoRecords)

    if (photosError) {
      console.error("Error updating photos in DB:", photosError)
    }
  }

  // 4. Update Secret Questions: Delete existing questions and insert new valid questions
  await adminClient.from("questions").delete().eq("surprise_id", surpriseId)

  if (input.questions && input.questions.length > 0) {
    const validQuestions = input.questions.filter(
      (q) => q.question.trim() && q.answer.trim(),
    )

    if (validQuestions.length > 0) {
      const questionRecords = validQuestions.map((q) => ({
        surprise_id: surpriseId,
        question: q.question.trim(),
        answer: q.answer.trim(),
      }))

      const { error: questionsError } = await adminClient
        .from("questions")
        .insert(questionRecords)

      if (questionsError) {
        console.error("Error updating questions in DB:", questionsError)
      }
    }
  }

  // Invalidate in-memory cache so client receives updated content immediately
  surpriseCache.delete(slug)
}
