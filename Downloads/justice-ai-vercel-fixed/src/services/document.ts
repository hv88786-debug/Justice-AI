import { getGeminiClient, Type } from './gemini.js';

export interface DocumentAnalysisResult {
  summary: string;
  governingLaw: string;
  jurisdiction: string;
  keyClauses: {
    title: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
  }[];
  redFlags: {
    description: string;
    riskFactor: string;
    remedyRecommendation: string;
  }[];
  complianceRating: number; // Scale of 1 to 10
}

export const LegalDocumentService = {
  /**
   * Analyzes legal document text, scans for liability risk, red flags, and compliance rating.
   */
  async analyzeDocumentText(text: string, options?: { focusArea?: string }): Promise<DocumentAnalysisResult> {
    const client = getGeminiClient();

    const prompt = `
You are a highly precise legal contract analyst and compliance risk engine.
Perform a thorough analysis of the following legal document content.

Focus Area: ${options?.focusArea || 'General liability, critical risks, unilateral clauses, and missing terms.'}

Document Content to Analyze:
---
${text}
---

Extract the governing law, jurisdiction, core clauses, red flags (with specific remedies), and rate the compliance/safety of the terms (1-10 scale).
Return your response inside a strictly validated JSON structure.
`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'High level summary of the document purpose and scope.' },
            governingLaw: { type: Type.STRING, description: 'State, country, or system of laws governing this agreement. Write "Unknown" if not mentioned.' },
            jurisdiction: { type: Type.STRING, description: 'Venue or court specified for disputes. Write "Unknown" if not mentioned.' },
            keyClauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING, description: 'Simple summary of what this clause covers.' },
                  riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                },
                required: ['title', 'description', 'riskLevel'],
              }
            },
            redFlags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: 'Specific text or condition that poses legal liability risk.' },
                  riskFactor: { type: Type.STRING, description: 'Explanation of why this is dangerous for the user.' },
                  remedyRecommendation: { type: Type.STRING, description: 'Action item to renegotiate or modify the term.' },
                },
                required: ['description', 'riskFactor', 'remedyRecommendation'],
              }
            },
            complianceRating: { type: Type.INTEGER, description: 'Strict compliance rating from 1 (dangerous/unbalanced) to 10 (neutral/safe).' }
          },
          required: ['summary', 'governingLaw', 'jurisdiction', 'keyClauses', 'redFlags', 'complianceRating'],
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}') as DocumentAnalysisResult;
    } catch (err) {
      console.error('Failed to parse document analysis JSON output:', err);
      throw new Error('Analysis completed but the response format was invalid.');
    }
  },

  /**
   * Multimodal analysis of a scanned document image.
   */
  async analyzeDocumentImage(imageBase64: string, mimeType: string, options?: { prompt?: string }): Promise<DocumentAnalysisResult> {
    const client = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    };

    const textPart = {
      text: `
You are a highly precise legal document analyzer.
Perform a OCR and analytical review on this document scan image.
Focus Area: ${options?.prompt || 'General legal risk assessment, key terms, compliance score, and red flags.'}

Extract the governing law, jurisdiction, core clauses, red flags (with specific remedies), and rate the compliance/safety of the terms (1-10 scale).
Return your response inside a strictly validated JSON structure.
`
    };

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'High level summary of the document purpose and scope.' },
            governingLaw: { type: Type.STRING, description: 'State, country, or system of laws governing this agreement. Write "Unknown" if not mentioned.' },
            jurisdiction: { type: Type.STRING, description: 'Venue or court specified for disputes. Write "Unknown" if not mentioned.' },
            keyClauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING, description: 'Simple summary of what this clause covers.' },
                  riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                },
                required: ['title', 'description', 'riskLevel'],
              }
            },
            redFlags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: 'Specific text or condition that poses legal liability risk.' },
                  riskFactor: { type: Type.STRING, description: 'Explanation of why this is dangerous for the user.' },
                  remedyRecommendation: { type: Type.STRING, description: 'Action item to renegotiate or modify the term.' },
                },
                required: ['description', 'riskFactor', 'remedyRecommendation'],
              }
            },
            complianceRating: { type: Type.INTEGER, description: 'Strict compliance rating from 1 (dangerous/unbalanced) to 10 (neutral/safe).' }
          },
          required: ['summary', 'governingLaw', 'jurisdiction', 'keyClauses', 'redFlags', 'complianceRating'],
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}') as DocumentAnalysisResult;
    } catch (err) {
      console.error('Failed to parse multimodal document analysis JSON output:', err);
      throw new Error('Analysis completed but the visual output format was invalid.');
    }
  }
};
