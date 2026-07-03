import { GoogleGenAI, Type } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

/**
 * Lazily initializes and retrieves the Google GenAI client.
 * Respects the safety guidelines by avoiding module-load crash if key is missing.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add it to your environment variables or secrets.'
      );
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'justice-ai-backend',
        },
      },
    });
  }
  return geminiClient;
}

export { Type };
