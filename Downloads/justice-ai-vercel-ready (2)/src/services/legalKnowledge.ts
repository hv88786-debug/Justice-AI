import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface LocalLawEntry {
  id: string;
  keywords: string[];
  citations: string[];
  answers: {
    english: string;
    hindi: string;
    hadoti: string;
  };
}

export interface LegalDocumentReference {
  title: string;
  citation: string;
  relevanceScore: number;
  snippet: string;
}

export interface IRagRetrievalEngine {
  retrieveRelevantContext(query: string, limit?: number): Promise<LegalDocumentReference[]>;
}

/**
 * OPTIMIZATION: local_laws.json is read from disk exactly once, at module load
 * (server startup), instead of on every single request. This removes a
 * synchronous disk read from the hot path of every chat/search call.
 *
 * ROBUSTNESS: resolves the path relative to this module's own file location
 * (via import.meta.url) first — this survives serverless bundlers whose
 * process.cwd() doesn't match the project root — then falls back to
 * process.cwd()-based paths for traditional Node server deployments.
 */
function loadLocalLawsOnce(): LocalLawEntry[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  const candidatePaths = [
    path.join(moduleDir, '../knowledge/local_laws.json'), // src/services -> src/knowledge (dev/tsx)
    path.join(moduleDir, 'knowledge/local_laws.json'), // bundled next to output (some bundlers flatten dirs)
    path.join(process.cwd(), 'src/knowledge/local_laws.json'), // traditional Node server, run from project root
    path.join(process.cwd(), 'knowledge/local_laws.json'),
  ];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`[Startup] local_laws.json resolved at: ${filePath}`);
        return JSON.parse(fileContent) as LocalLawEntry[];
      }
    } catch (err) {
      console.error(`Error reading local_laws.json from ${filePath}:`, err);
    }
  }

  console.warn(
    `[Startup] local_laws.json not found in any candidate path: ${candidatePaths.join(', ')}. ` +
      `Local knowledge search will be empty — all chat requests will fall through to Gemini.`
  );
  return [];
}

const LOCAL_LAWS: LocalLawEntry[] = loadLocalLawsOnce();
console.log(`[Startup] Loaded ${LOCAL_LAWS.length} local law entries into memory.`);

function resolveLanguage(language: string): 'english' | 'hindi' | 'hadoti' {
  const selected = (language || 'english').toLowerCase();
  return (['english', 'hindi', 'hadoti'].includes(selected) ? selected : 'english') as
    | 'english'
    | 'hindi'
    | 'hadoti';
}

/** Shared scoring pass over the in-memory law list — no I/O, pure computation. */
function scoreBestMatch(query: string): { bestMatch: LocalLawEntry | null; highestScore: number } {
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery.split(/[\s,.:;?!()\-"]+/).filter(Boolean);

  let bestMatch: LocalLawEntry | null = null;
  let highestScore = 0;

  for (const law of LOCAL_LAWS) {
    let score = 0;

    // 1. Substring/phrase matching (high confidence)
    for (const kw of law.keywords) {
      const kwLower = kw.toLowerCase();
      if (normalizedQuery.includes(kwLower)) {
        score += 3;
      }
    }

    // 2. Individual token matching
    for (const token of tokens) {
      if (token.length > 2) {
        for (const kw of law.keywords) {
          if (kw.toLowerCase() === token) {
            score += 1;
          }
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = law;
    }
  }

  return { bestMatch, highestScore };
}

class EmbeddedKnowledgeBase implements IRagRetrievalEngine {
  async retrieveRelevantContext(query: string, limit: number = 2): Promise<LegalDocumentReference[]> {
    const normalizedQuery = query.toLowerCase();
    const results: LegalDocumentReference[] = [];

    for (const law of LOCAL_LAWS) {
      let matches = 0;
      for (const keyword of law.keywords) {
        if (normalizedQuery.includes(keyword.toLowerCase())) {
          matches++;
        }
      }
      if (matches > 0) {
        results.push({
          title: law.id.replace(/_/g, ' ').toUpperCase(),
          citation: law.citations.join(', '),
          relevanceScore: matches / law.keywords.length,
          snippet: law.answers.english.substring(0, 200) + '...',
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
  }
}

export const LegalKnowledgeService = {
  retrievalEngine: new EmbeddedKnowledgeBase() as IRagRetrievalEngine,

  setRetrievalEngine(engine: IRagRetrievalEngine) {
    this.retrievalEngine = engine;
  },

  /**
   * Performs high-accuracy local keyword matching over the multi-language law base.
   * Reads only from the in-memory LOCAL_LAWS array (loaded once at startup).
   */
  searchLocalKnowledge(query: string, language: string): { answer: string; citations: string[] } | null {
    const { bestMatch, highestScore } = scoreBestMatch(query);

    // Require a minimum score threshold (at least 2 matching points) to trigger a confident local match.
    if (bestMatch && highestScore >= 2) {
      const selectedLang = resolveLanguage(language);
      const answer = bestMatch.answers[selectedLang] || bestMatch.answers.english;
      return {
        answer,
        citations: bestMatch.citations,
      };
    }

    return null;
  },

  /**
   * Lower-confidence lookup used only as a fast fallback when Gemini is too
   * slow to respond in time (see the 8s timeout guard in server.ts). Returns
   * the best partial match even below the strict confidence threshold, so we
   * always have *something* useful to show instead of making the user wait.
   */
  getBestEffortLocalAnswer(query: string, language: string): { answer: string; citations: string[] } | null {
    const { bestMatch, highestScore } = scoreBestMatch(query);
    if (bestMatch && highestScore > 0) {
      const selectedLang = resolveLanguage(language);
      const answer = bestMatch.answers[selectedLang] || bestMatch.answers.english;
      return {
        answer,
        citations: bestMatch.citations,
      };
    }
    return null;
  },
};
