import { getGeminiClient, Type } from './gemini.js';

export interface VoiceServiceResult {
  transcript: string;
  intentDetected: string;
  aiResponseText: string;
  spokenActionDescription: string;
  suggestedAIVoiceTone: string;
}

export const LegalVoiceService = {
  /**
   * Processes verbal statement transcripts or raw audio base64, extracting intent
   * and drafting a vocalized, supportive, and formal guidance response.
   */
  async processVoiceInput(options: { 
    transcript?: string; 
    audioBase64?: string; 
    mimeType?: string; 
  }): Promise<VoiceServiceResult> {
    const client = getGeminiClient();

    let contentParts: any[] = [];
    let systemInstruction = `
You are the voice interface engine for Justice AI. You receive legal client dictations, questions, or recorded verbal testimonies.
Your goal is to:
1. Provide highly reassuring, clear, spoken guidance.
2. Formulate responses that are comfortable for conversational audio synthesis. Keep explanations conversational, avoiding complex tables or code blocks.
3. Classify client intent (e.g. general grievance, legal question, contract dispute, emotional distress).
4. Specify the best voice/tone for speech synthesis engines (e.g. Warm and reassuring, authoritative and professional).
`;

    if (options.audioBase64) {
      // Multimodal Audio analysis using Gemini!
      contentParts.push({
        inlineData: {
          mimeType: options.mimeType || 'audio/mp3',
          data: options.audioBase64.replace(/^data:audio\/\w+;base64,/, ''),
        }
      });
      contentParts.push({
        text: `Listen to this client dictation/audio file. Transcribe the audio exactly, detect their main grievance intent, and generate a reassuring conversational response suitable for text-to-speech synthesis.`
      });
    } else if (options.transcript) {
      contentParts.push({
        text: `CLIENT VERBAL TRANSCRIPT: "${options.transcript}"\nAnalyze this verbal inquiry, classify their core intent, and formulate a supportive audio-oriented reply.`
      });
    } else {
      throw new Error('Either a voice transcript or audioBase64 file is required to use the Voice service.');
    }

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentParts,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING, description: 'The exact transcription of the verbal statement. If text-only input was sent, echo the text input.' },
            intentDetected: { type: Type.STRING, description: 'Core intent classification. Example: "Contract Breach Inquiry", "Tenant Distrust", etc.' },
            aiResponseText: { type: Type.STRING, description: 'Sleek, spoken-word conversational response ready for TTS.' },
            spokenActionDescription: { type: Type.STRING, description: 'Action recommended to the user (e.g., "Consulting a contract specialist immediately").' },
            suggestedAIVoiceTone: { type: Type.STRING, description: 'The recommended tone of the speaker agent. Example: "Warm and reassuring" or "Authoritative, comforting".' }
          },
          required: ['transcript', 'intentDetected', 'aiResponseText', 'spokenActionDescription', 'suggestedAIVoiceTone'],
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}') as VoiceServiceResult;
    } catch (err) {
      console.error('Failed to parse voice service response:', err);
      return {
        transcript: options.transcript || 'Audio received.',
        intentDetected: 'Grievance / Consultation',
        aiResponseText: response.text || 'I have heard your issue. Justice AI is analyzing the legal implications. Please consult a licensed professional.',
        spokenActionDescription: 'Consult lawyer',
        suggestedAIVoiceTone: 'Warm and reassuring',
      };
    }
  }
};
