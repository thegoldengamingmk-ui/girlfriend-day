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
 * Retrieves all gift surprises created by a user (by email or user_id) from Supabase.
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
    const cleanId = identifier.trim().toLowerCase()
    const { data } = await supabase
      .from("surprises")
      .select("slug, girlfriend_name, boyfriend_name, created_at")
      .or(`creator_email.eq.${cleanId},creator_user_id.eq.${identifier}`)
      .order("created_at", { ascending: false })

    if (data && data.length > 0) {
      return data
    }
  } catch (err) {
    console.warn("getUserCreatedSurprises notice:", err)
  }

  return []
}
