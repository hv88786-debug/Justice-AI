import { getGeminiClient, Type } from './gemini.js';

export interface NoticeGeneratorParams {
  noticeType: 'cease_and_desist' | 'debt_dispute' | 'tenant_landlord' | 'contract_breach';
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  incidentDetails: string;
  remedyRequested: string;
  deadlineDate: string;
}

export interface GeneratedNoticeResult {
  documentTitle: string;
  formattedContent: string;
  draftNotes: string;
  recommendedDeliveryMethod: string;
}

export const LegalNoticeService = {
  /**
   * Generates a formal, structured legal notice using a structured prompt and schema validation.
   */
  async generateNotice(params: NoticeGeneratorParams): Promise<GeneratedNoticeResult> {
    const client = getGeminiClient();

    const prompt = `
Generate a formal, professionally drafted legal notice of type "${params.noticeType}" based on the following information:

Sender details:
- Name: ${params.senderName}
- Address: ${params.senderAddress}

Recipient details:
- Name: ${params.recipientName}
- Address: ${params.recipientAddress}

Context & Incidents:
${params.incidentDetails}

Required Remedy / Demanded Action:
${params.remedyRequested}

Cure / Response Deadline:
${params.deadlineDate}

Return a structured JSON response containing:
1. "documentTitle": The official legal name of this document.
2. "formattedContent": The full text of the legal notice. Ensure a formal legal layout including dates, standard warning language (e.g., "Govern yourself accordingly"), and clear, bold demand clauses.
3. "draftNotes": Annotations of laws potentially cited, caution warnings for the sender, and specific details they need to double-check.
4. "recommendedDeliveryMethod": Advice on how to legally serve or deliver this notice to ensure compliance and proof of receipt (e.g. Certified Mail).
`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentTitle: { type: Type.STRING },
            formattedContent: { type: Type.STRING },
            draftNotes: { type: Type.STRING },
            recommendedDeliveryMethod: { type: Type.STRING },
          },
          required: ['documentTitle', 'formattedContent', 'draftNotes', 'recommendedDeliveryMethod'],
        },
      },
    });

    try {
      const data = JSON.parse(response.text || '{}') as GeneratedNoticeResult;
      return data;
    } catch (err) {
      console.error('Failed to parse notice generation JSON:', err);
      return {
        documentTitle: `Legal Notice: ${params.noticeType.toUpperCase().replace('_', ' ')}`,
        formattedContent: response.text || 'Failed to format content correctly.',
        draftNotes: 'Verify all dates, addresses, and statutory grounds before sending.',
        recommendedDeliveryMethod: 'Certified Mail with Return Receipt Requested.',
      };
    }
  },
};
