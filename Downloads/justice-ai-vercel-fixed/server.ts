import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// Import modular AI services
import { getGeminiClient } from './src/services/gemini.js';
import { ConversationMemoryService } from './src/services/memory.js';
import { LegalKnowledgeService } from './src/services/legalKnowledge.js';
import { LegalNoticeService } from './src/services/notice.js';
import { LegalDocumentService } from './src/services/document.js';
import { LegalVoiceService } from './src/services/voice.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Custom logging middleware for API tracing
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`
      );
    });
    next();
  });

  // --- REST APIs ---

  // 1. GET /api/health - Clean, production-ready health indicator
  app.get('/api/health', (req, res) => {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    res.json({
      status: 'ok',
      service: 'Justice AI Backend Service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      diagnostics: {
        geminiKeyConfigured: hasApiKey,
        environment: process.env.NODE_ENV || 'development',
      },
    });
  });

  // In-memory response cache, keyed by conversationId + language + message.
  // Repeated identical questions (e.g. the person re-sends or a retry fires)
  // are answered instantly without hitting local search or Gemini again.
  const chatResponseCache = new Map<string, any>();
  const CHAT_CACHE_MAX_ENTRIES = 500;
  const GEMINI_TIMEOUT_MS = 8000;
  const FASTEST_FLASH_MODEL = 'gemini-2.5-flash-lite';

  function buildChatCacheKey(conversationId: string, language: string, message: string): string {
    return `${conversationId}::${language}::${message.trim().toLowerCase()}`;
  }

  function rememberChatResponse(key: string, value: any) {
    if (chatResponseCache.size >= CHAT_CACHE_MAX_ENTRIES) {
      const oldestKey = chatResponseCache.keys().next().value;
      if (oldestKey !== undefined) chatResponseCache.delete(oldestKey);
    }
    chatResponseCache.set(key, value);
  }

  /** Rejects with a TIMEOUT error if the wrapped promise doesn't settle in time. */
  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  // 2. POST /api/chat - Core conversational AI flow with Local Knowledge prioritisation and Memory
  app.post('/api/chat', async (req, res) => {
    const totalStart = Date.now();
    try {
      const { message, language = 'english', conversationId = 'default-session' } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message payload is required and must be a string.' });
      }

      const activeLanguage = language.toLowerCase();
      if (!['english', 'hindi', 'hadoti'].includes(activeLanguage)) {
        return res.status(400).json({ error: 'Unsupported language. Accepted values: english, hindi, hadoti.' });
      }

      // --- Cache check: identical (conversationId + language + message) already answered ---
      const cacheKey = buildChatCacheKey(conversationId, activeLanguage, message);
      const cached = chatResponseCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] "${message.slice(0, 40)}" — [Total] ${Date.now() - totalStart}ms`);
        return res.json({ ...cached, timestamp: new Date().toISOString() });
      }

      // --- 1. Local legal knowledge search (never calls Gemini if this hits) ---
      const localSearchStart = Date.now();
      const localResult = LegalKnowledgeService.searchLocalKnowledge(message, activeLanguage);
      const localSearchMs = Date.now() - localSearchStart;
      console.log(`[Local Search] ${localSearchMs}ms`);

      if (localResult) {
        const memoryStart = Date.now();
        ConversationMemoryService.addMessage(conversationId, 'user', message);
        ConversationMemoryService.addMessage(conversationId, 'model', localResult.answer);
        const memoryMs = Date.now() - memoryStart;
        console.log(`[Memory] ${memoryMs}ms`);

        const payload = {
          success: true,
          answer: localResult.answer,
          source: 'Local Knowledge',
          citations: localResult.citations,
          language: activeLanguage,
        };
        rememberChatResponse(cacheKey, payload);

        console.log(`[Total] ${Date.now() - totalStart}ms`);
        return res.json({ ...payload, timestamp: new Date().toISOString() });
      }

      // --- 2. Fallback to Gemini (only reached when no local match was found) ---
      const memoryStart = Date.now();
      const client = getGeminiClient();
      const contents = ConversationMemoryService.getFormattedContentsForGemini(conversationId, message);
      const memoryMs = Date.now() - memoryStart;
      console.log(`[Memory] ${memoryMs}ms`);

      // Trimmed system instruction — only the essentials Gemini needs
      // (target language + the compulsory disclaimer). Shorter prompts mean
      // fewer tokens to process, which reduces response latency.
      const systemInstruction = `You are Justice AI, a legal assistant focused only on Indian law, legal rights, and legal procedures. If the user's message is unrelated to these topics, do not attempt to answer it — reply only, in "${activeLanguage}", that this question is outside your scope as a legal assistant, and stop there (no disclaimer needed for that case). Otherwise, answer clearly and helpfully in "${activeLanguage}" only (hindi = Devanagari Hindi, hadoti = Devanagari Hadoti Rajasthani, english = English), and end every such answer with: "DISCLAIMER: Justice AI provides informational analyses and does not constitute formal legal counsel."`;

      const geminiStart = Date.now();
      let answerText: string;
      let timedOut = false;

      try {
        const response = await withTimeout(
          client.models.generateContent({
            model: FASTEST_FLASH_MODEL,
            contents,
            config: { systemInstruction },
          }),
          GEMINI_TIMEOUT_MS
        );
        answerText = response.text?.trim() || 'An answer could not be compiled.';
      } catch (err: any) {
        if (err?.message === 'TIMEOUT') {
          timedOut = true;
          const fallback = LegalKnowledgeService.getBestEffortLocalAnswer(message, activeLanguage);
          answerText = fallback
            ? `${fallback.answer}\n\nGenerating a more detailed answer...`
            : 'Generating a more detailed answer...';
        } else {
          throw err;
        }
      }
      console.log(`[Gemini] ${Date.now() - geminiStart}ms${timedOut ? ' (timed out, served local fallback)' : ''}`);

      ConversationMemoryService.addMessage(conversationId, 'user', message);
      ConversationMemoryService.addMessage(conversationId, 'model', answerText);

      const payload = {
        success: true,
        answer: answerText,
        source: timedOut ? 'Local Knowledge (Fallback)' : 'Gemini',
        citations: [],
        language: activeLanguage,
      };
      // Timed-out responses are intentionally not cached, so a retry gets a
      // fresh chance to reach Gemini instead of being stuck on the fallback.
      if (!timedOut) rememberChatResponse(cacheKey, payload);

      console.log(`[Total] ${Date.now() - totalStart}ms`);
      return res.json({ ...payload, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('Justice AI Chat API Error:', error);
      console.log(`[Total] ${Date.now() - totalStart}ms (error)`);
      res.status(500).json({
        success: false,
        error: error.message || 'An error occurred during chat processing.',
      });
    }
  });

  // 3. POST /api/document/analyze - Document analyzer
  app.post('/api/document/analyze', async (req, res) => {
    try {
      const { text, imageBase64, mimeType, focusArea } = req.body;

      if (!text && !imageBase64) {
        return res.status(400).json({ error: 'Either document text or imageBase64 is required for analysis.' });
      }

      let analysisResult;
      if (imageBase64) {
        analysisResult = await LegalDocumentService.analyzeDocumentImage(
          imageBase64,
          mimeType || 'image/jpeg',
          { prompt: focusArea }
        );
      } else {
        analysisResult = await LegalDocumentService.analyzeDocumentText(text!, { focusArea });
      }

      res.json(analysisResult);
    } catch (error: any) {
      console.error('Document Analyzer API Error:', error);
      res.status(500).json({ error: error.message || 'An error occurred during document processing.' });
    }
  });

  // 4. POST /api/notice/generate - Formal legal notice generator
  app.post('/api/notice/generate', async (req, res) => {
    try {
      const {
        noticeType,
        senderName,
        senderAddress,
        recipientName,
        recipientAddress,
        incidentDetails,
        remedyRequested,
        deadlineDate,
      } = req.body;

      if (!noticeType || !senderName || !recipientName || !incidentDetails || !remedyRequested) {
        return res.status(400).json({
          error: 'Missing required notice parameters: noticeType, senderName, recipientName, incidentDetails, remedyRequested are required.',
        });
      }

      const noticeResult = await LegalNoticeService.generateNotice({
        noticeType,
        senderName,
        senderAddress: senderAddress || 'Not Specified',
        recipientName,
        recipientAddress: recipientAddress || 'Not Specified',
        incidentDetails,
        remedyRequested,
        deadlineDate: deadlineDate || 'Within 10 business days from the date of this notice',
      });

      res.json(noticeResult);
    } catch (error: any) {
      console.error('Notice Generator API Error:', error);
      res.status(500).json({ error: error.message || 'An error occurred during legal notice drafting.' });
    }
  });

  // 5. POST /api/voice - Voice grievance and testimony processing
  app.post('/api/voice', async (req, res) => {
    try {
      const { transcript, audioBase64, mimeType } = req.body;

      if (!transcript && !audioBase64) {
        return res.status(400).json({ error: 'Either voice transcript text or raw audioBase64 data is required.' });
      }

      const voiceResult = await LegalVoiceService.processVoiceInput({
        transcript,
        audioBase64,
        mimeType,
      });

      res.json(voiceResult);
    } catch (error: any) {
      console.error('Voice Assistant API Error:', error);
      res.status(500).json({ error: error.message || 'An error occurred during voice process analysis.' });
    }
  });

  // Serving Frontend / Static Assets (Required for dev mode and clean production container starts)
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      // Fallback if client is entirely clean/removed
      app.get('*', (req, res) => {
        res.json({ status: "ok", message: "Justice AI REST Backend active." });
      });
    }
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Justice AI REST Backend running at http://0.0.0.0:${port}`);
  });
}

startServer();
