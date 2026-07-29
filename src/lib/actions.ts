import { createSurprise, getSurpriseBySlug, verifyQuestions } from './surpriseService'
import type { CreateSurpriseInput } from '../types/database'

/**
 * Server action to create a surprise record
 */
export async function createSurpriseAction(input: CreateSurpriseInput) {
  try {
    if (!input.girlfriend_name || !input.boyfriend_name) {
      return { success: false, error: 'Names are required' }
    }
    const slug = await createSurprise(input)
    return { success: true, slug }
  } catch (err) {
    console.error('Server action createSurpriseAction error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create surprise',
    }
  }
}

/**
 * Server action to fetch surprise data by slug
 */
export async function getSurpriseAction(slug: string) {
  try {
    if (!slug) return { success: false, error: 'Slug is required' }
    const data = await getSurpriseBySlug(slug)
    if (!data) return { success: false, error: 'Surprise not found' }
    return { success: true, data }
  } catch (err) {
    console.error('Server action getSurpriseAction error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch surprise',
    }
  }
}

/**
 * Server action to verify secret question answers securely without exposing correct answers
 */
export async function verifyQuestionsAction(slug: string, answers: string[]) {
  try {
    if (!slug) return { success: false, message: 'Invalid slug' }
    const result = await verifyQuestions(slug, answers)
    return result
  } catch (err) {
    console.error('Server action verifyQuestionsAction error:', err)
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Verification failed',
    }
  }
}
