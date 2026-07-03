interface MemoryItem {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface SessionMemory {
  history: MemoryItem[];
  metadata: Record<string, any>;
}

// In-memory store for development/demo (scalable to a persistent DB like Firestore or PostgreSQL later)
const memoryStore: Record<string, SessionMemory> = {};

/**
 * Service to manage conversation memory (recent turn history only).
 *
 * OPTIMIZATION: This service no longer makes a background Gemini call to
 * "summarize" the conversation after every message. That summarization step
 * used to fire an extra LLM request on top of the user's own chat request,
 * adding latency/cost for no visible benefit to response time. Instead, we
 * simply keep the last few raw turns and send those directly — see
 * getFormattedContentsForGemini() below.
 */
export const ConversationMemoryService = {
  /**
   * Retrieves or initializes a session memory structure.
   */
  getOrCreateSession(sessionId: string): SessionMemory {
    if (!memoryStore[sessionId]) {
      memoryStore[sessionId] = {
        history: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    }
    return memoryStore[sessionId];
  },

  /**
   * Adds a new message exchange to the session history.
   */
  addMessage(sessionId: string, role: 'user' | 'model', text: string): void {
    const session = this.getOrCreateSession(sessionId);
    session.history.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });
    session.metadata.updatedAt = new Date().toISOString();

    // Keep the stored history itself bounded too, so it never grows unbounded
    // in memory for very long-running sessions.
    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }
  },

  /**
   * Formats the last few turns of memory history for sending to Gemini.
   * OPTIMIZATION: only the last 5 messages are sent, instead of the previous
   * 10 (+ an injected background summary block). This meaningfully shrinks
   * the prompt Gemini has to process, which directly reduces latency.
   */
  getFormattedContentsForGemini(sessionId: string, currentMessage: string): any[] {
    const session = this.getOrCreateSession(sessionId);
    const contents: any[] = [];

    const recentHistory = session.history.slice(-5);
    recentHistory.forEach((item) => {
      contents.push({
        role: item.role,
        parts: [{ text: item.text }],
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: currentMessage }],
    });

    return contents;
  },

  /**
   * Resets/Clears session memory.
   */
  clearSession(sessionId: string): void {
    if (memoryStore[sessionId]) {
      delete memoryStore[sessionId];
    }
  },
};
