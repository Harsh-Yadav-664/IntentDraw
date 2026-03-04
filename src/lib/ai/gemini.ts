import { GoogleGenerativeAI } from '@google/generative-ai'

let _instance: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (!_instance) {
    const key = process.env.GOOGLE_AI_API_KEY
    if (!key) throw new Error('Missing GOOGLE_AI_API_KEY environment variable')
    _instance = new GoogleGenerativeAI(key)
  }
  return _instance
}

/**
 * Gemini 2.0 Flash — fast, good at vision tasks.
 * Used for analyzing canvas drawings.
 */
export function getVisionModel() {
  return getClient().getGenerativeModel({ model: 'gemini-2.0-flash' })
}

/**
 * Gemini 2.5 flash — higher quality.
 * Used for code generation.
 */
export function getProModel() {
  return getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
}