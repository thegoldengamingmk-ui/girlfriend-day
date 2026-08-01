export interface Surprise {
  id: string
  slug: string
  boyfriend_name: string
  girlfriend_name: string
  letter: string
  spotify_url: string
  voice_note_url: string
  created_at: string
  creator_email?: string
  creator_user_id?: string
}

export interface Photo {
  id: string
  surprise_id: string
  photo_url: string
  position: number
}

export interface Question {
  id: string
  surprise_id: string
  question: string
  answer: string
}

// Client-safe Question (answers stripped out)
export interface PublicQuestion {
  id: string
  surprise_id: string
  question: string
}

export interface CreateQuestionInput {
  question: string
  answer: string
}

export interface CreateSurpriseInput {
  boyfriend_name: string
  girlfriend_name: string
  letter: string
  spotify_url: string
  voice_note_url?: string
  photos: string[]
  questions: CreateQuestionInput[]
  creator_email?: string
  creator_user_id?: string
}

export interface SurpriseDetailResponse {
  surprise: Surprise
  photos: Photo[]
  questions: PublicQuestion[]
}
