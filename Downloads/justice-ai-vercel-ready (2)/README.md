# Justice AI — Full Stack (Nyaya Deep)

A multilingual (English / Hindi / Hadoti) legal assistant app.
- **Backend**: Express + Google Gemini (`server.ts`, `src/services/*`) — chat, document analysis, legal notice drafting, voice grievance processing.
- **Frontend**: React 19 + Vite + Tailwind v4 + Framer Motion, in the "Nyaya Deep" dark-gold design system.
  - `src/screens/LandingScreen.jsx` — app home / continue screen
  - `src/screens/AnalyzingScreen.jsx` — workspace-preparation loader
  - `src/screens/ChatHome.jsx` — main chat, document analyzer, voice assistant, legal notice generator, nearby courts finder
  - `src/App.tsx` wires the three screens together in sequence.

## Run locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```
   npm install
   ```
2. Add your Gemini API key. Copy `.env.example` to `.env` and fill it in:
   ```
   GEMINI_API_KEY="your-real-key"
   ```
3. Start the dev server (Express + Vite middleware, hot reload):
   ```
   npm run dev
   ```
   Open http://localhost:3000

## Production build

```
npm run build   # builds client (dist/) + bundles server (dist/server.cjs)
npm start       # NODE_ENV=production node dist/server.cjs
```

## What's wired to the real backend vs. local demo data

- **Chat** (free-form legal questions) → calls `POST /api/chat` for real Gemini answers, grounded first against `src/knowledge/local_laws.json`, in the selected language.
- **Document analyzer** → uploaded **images** and **.txt** files are sent to `POST /api/document/analyze` for real Gemini analysis (governing law, red flags, compliance rating, etc). PDF/DOCX uploads fall back to an illustrative local sample analysis, since parsing those binary formats needs an extra server-side extraction library that isn't included.
- **Legal notice generator** and **voice assistant flows** currently use local templating/logic for a smooth, fast demo experience. The backend already exposes matching endpoints (`POST /api/notice/generate`, `POST /api/voice`) if you want to wire them the same way `askJusticeAI()` is wired in `ChatHome.jsx`.
- **Nearby courts/legal aid map** uses illustrative generated data (not a real Places API) — swap `generateNearbyPlaces()` for a real geocoding/places call if needed.

## REST API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Server + Gemini key diagnostics |
| POST | `/api/chat` | `{ message, language, conversationId }` → conversational legal answer |
| POST | `/api/document/analyze` | `{ text }` or `{ imageBase64, mimeType }` → structured contract/document analysis |
| POST | `/api/notice/generate` | `{ noticeType, senderName, recipientName, incidentDetails, remedyRequested, ... }` → formal legal notice |
| POST | `/api/voice` | `{ transcript }` or `{ audioBase64, mimeType }` → grievance intent + supportive reply |
