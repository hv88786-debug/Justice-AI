import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Scale,
  Bell,
  Paperclip,
  Mic,
  Square,
  ArrowUp,
  MessageCircle,
  FileText,
  Clock,
  User,
  Landmark,
  BookOpen,
  FileStack,
  Languages,
  Image as ImageIcon,
  File as FileGeneric,
  Check,
  Loader2,
  Download,
  FileSignature,
  MessageCircleQuestion,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Copy,
  Pencil,
  Wand2,
  X,
  MapPin,
  Navigation,
  Phone,
  Star,
  ShieldAlert,
  HeartHandshake,
  Users,
  ShoppingBag,
  Building2,
  LocateFixed,
  Search,
  Globe,
  ChevronDown,
} from "lucide-react";

/**
 * Justice AI — Main Chat Screen
 * Document Upload / AI Analysis + Voice Assistant + AI Legal Notice Generator
 * + Nearby Courts & Legal Aid Finder
 * Theme: "Nyaya Deep" (न्याय दीप) — continues Landing + Analyzing exactly.
 *
 * Every flow happens inline, inside this ONE conversation.
 * No routing, no new page, no separate screens — including the map,
 * which renders as a compact "attachment" inside a chat bubble.
 */

const GOLD = "#F2B857";
const GOLD_SOFT = "#D9A24E";
const INK = "#0F1613";
const CARD = "#161F1B";
const PAPER = "#182119";
const TEXT = "#E9E5D8";
const MUTED = "#9A9686";
const INK_ON_GOLD = "#1A1408";
const BORDER_CARD = "rgba(233,229,216,0.08)";
const BORDER_PILL = "rgba(233,229,216,0.14)";
const BORDER_PILL_ACTIVE = "rgba(242,184,87,0.55)";
const ROW_DIVIDER = "rgba(233,229,216,0.08)";
const GREEN = "#7FBF8E";

/* ---------------------------------------------------------------------- */
/* Smart Multilingual Conversation — languages, UI strings, response bank */
/* ---------------------------------------------------------------------- */

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हिं" },
  { code: "hd", label: "हाड़ौती", short: "हाड़" },
];

const LANG_STORAGE_KEY = "justiceai_language";

function getStoredLanguage() {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : "en";
  } catch {
    return "en";
  }
}

function persistLanguage(code) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, code);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/* ---------------------------------------------------------------------- */
/* Live backend integration — talks to the real Express + Gemini API      */
/* ---------------------------------------------------------------------- */

const LANG_API_MAP = { en: "english", hi: "hindi", hd: "hadoti" };

/** Calls POST /api/chat on the Justice AI backend and returns the answer text. */
async function askJusticeAI(message, langCode, conversationId) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      language: LANG_API_MAP[langCode] || "english",
      conversationId,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false) {
    throw new Error(data?.error || "Justice AI backend request failed.");
  }
  return data.answer;
}

/** Calls POST /api/voice with recorded audio and returns the real transcript + AI reply. */
async function askJusticeAIVoice(audioBase64, mimeType) {
  const res = await fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || "Justice AI voice backend request failed.");
  }
  return data; // { transcript, intentDetected, aiResponseText, spokenActionDescription, suggestedAIVoiceTone }
}

/** Reads a File/Blob as a base64 data URL. */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Reads a File as plain text. */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/** Calls POST /api/document/analyze with either image bytes or raw text. */
async function analyzeDocumentOnBackend(file, category) {
  let body;
  if (category === "Image") {
    const dataUrl = await readFileAsBase64(file);
    body = { imageBase64: dataUrl, mimeType: file.type || "image/jpeg" };
  } else {
    const text = await readFileAsText(file);
    body = { text };
  }
  const res = await fetch("/api/document/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error || "Document analysis failed.");
  }
  return data;
}

/** Maps the backend's DocumentAnalysisResult shape onto the chat card's expected shape. */
function mapBackendAnalysis(result, fileName) {
  const info = [
    { label: "Governing Law", value: result.governingLaw || "Unknown" },
    { label: "Jurisdiction", value: result.jurisdiction || "Unknown" },
    { label: "Compliance Rating", value: `${result.complianceRating ?? "—"}/10` },
    ...(result.keyClauses || []).map((c) => ({
      label: c.title,
      value: `${c.description} (Risk: ${c.riskLevel})`,
    })),
  ];
  const observations = (result.redFlags || []).map(
    (f) => `${f.description} — ${f.riskFactor}`
  );
  const nextSteps = (result.redFlags || []).map((f) => f.remedyRecommendation);
  return {
    summary: result.summary,
    info,
    observations: observations.length ? observations : ["No major red flags were detected in this document."],
    nextSteps: nextSteps.length ? nextSteps : ["Keep a copy of this document for your records."],
    fileName,
  };
}

/** Calls POST /api/notice/generate on the real backend. */
async function generateNoticeOnBackend(params) {
  const res = await fetch("/api/notice/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(data?.error || "Notice generation failed.");
  }
  return data;
}

/** Small conversational UI strings that change with the active language. */
const UI_TEXT = {
  en: {
    placeholder: "Ask your legal question...",
    noticePlaceholder: "Type your answer...",
    listeningTitle: "Listening...",
    listeningHint: "Speak in English, हिन्दी or हाड़ौती",
    uploadHint: "Tap the attachment icon to upload your document",
    questionOf: (a, b) => `Question ${a} of ${b}`,
    locating: "Finding nearby legal services...",
    analyzing: "Analyzing your document",
    generatingNotice: "Generating Legal Notice...",
    systemLangChange: "Language changed to English",
    cityPlaceholder: "Enter your city...",
  },
  hi: {
    placeholder: "अपना कानूनी प्रश्न पूछें...",
    noticePlaceholder: "अपना उत्तर टाइप करें...",
    listeningTitle: "सुन रहा हूं...",
    listeningHint: "अंग्रेज़ी, हिन्दी या हाड़ौती में बोलें",
    uploadHint: "अपना दस्तावेज़ अपलोड करने के लिए अटैचमेंट आइकन दबाएं",
    questionOf: (a, b) => `प्रश्न ${a} में से ${b}`,
    locating: "आस-पास की कानूनी सेवाएं खोजी जा रही हैं...",
    analyzing: "आपका दस्तावेज़ विश्लेषण किया जा रहा है",
    generatingNotice: "कानूनी सूचना तैयार की जा रही है...",
    systemLangChange: "भाषा हिन्दी में बदल दी गई।",
    cityPlaceholder: "अपना शहर दर्ज करें...",
  },
  hd: {
    placeholder: "अपनो कानूनी सवाल पूछो...",
    noticePlaceholder: "अपणो जवाब लिखो...",
    listeningTitle: "सुण रह्यो हूं...",
    listeningHint: "अंग्रेज़ी, हिन्दी या हाड़ौती में बोलो",
    uploadHint: "अपणो दस्तावेज़ अपलोड करण खातर अटैचमेंट आइकन दबाओ",
    questionOf: (a, b) => `सवाल ${a} मांयलो ${b}`,
    locating: "लाग्गे री कानूनी सेवावां खोजी जा रही है...",
    analyzing: "थारो दस्तावेज़ जांच्यो जा रह्यो है",
    generatingNotice: "कानूनी सूचना बणाई जा रही है...",
    systemLangChange: "भासा हाड़ौती में बदल दी गई।",
    cityPlaceholder: "अपणो शहर लिखो...",
  },
};

const NAV = [
  { icon: MessageCircle, label: "Chat" },
  { icon: FileText, label: "Documents" },
  { icon: Clock, label: "History" },
  { icon: User, label: "Profile" },
];

/* ---------------------------------------------------------------------- */
/* Demo data — Profile / Documents / History                              */
/* Reusable, centralized mock objects so the app reads like a real,       */
/* populated production build instead of an empty prototype.              */
/* ---------------------------------------------------------------------- */

const profileData = {
  name: "Harish Verma",
  role: "Citizen",
  status: "Conversation Active",
  verification: "Verified Citizen",
  location: "Rajasthan, India",
  languages: "English • हिन्दी • हाड़ौती",
  memberSince: "July 2026",
  statistics: [
    { label: "Conversations", value: 47 },
    { label: "Documents Analyzed", value: 18 },
    { label: "Legal Notices Generated", value: 9 },
    { label: "Nearby Court Searches", value: 14 },
  ],
  preferences: {
    preferredLanguage: "हिन्दी",
    voiceAssistant: "Enabled",
    notifications: "Enabled",
  },
  recentActivity: [
    "Consumer Complaint Guidance",
    "Rent Agreement Analysis",
    "Legal Notice Draft",
    "Nearby District Court Search",
  ],
};

const documentsData = [
  {
    id: "doc-1",
    name: "Rent Agreement.pdf",
    category: "Property Law",
    status: "Analyzed",
    risk: "Low Risk",
    uploaded: "Today • 10:15 AM",
    fileType: "PDF",
  },
  {
    id: "doc-2",
    name: "Consumer_Complaint.pdf",
    category: "Consumer Law",
    status: "Reviewed",
    risk: "Medium Risk",
    uploaded: "Yesterday",
    fileType: "PDF",
  },
  {
    id: "doc-3",
    name: "Employment_Contract.pdf",
    category: "Labour Law",
    status: "Completed",
    risk: "High Risk",
    uploaded: "2 days ago",
    fileType: "PDF",
  },
  {
    id: "doc-4",
    name: "FIR_Copy.jpg",
    category: "Criminal Law",
    status: "OCR Completed",
    risk: "Information Only",
    uploaded: "Last Week",
    fileType: "Image",
  },
];

const DOC_RISK_STYLE = {
  "Low Risk": { color: "#7FBF8E", bg: "rgba(127,191,142,0.12)", border: "rgba(127,191,142,0.4)" },
  "Medium Risk": { color: "#E0B058", bg: "rgba(224,176,88,0.12)", border: "rgba(224,176,88,0.4)" },
  "High Risk": { color: "#E0796A", bg: "rgba(224,121,106,0.12)", border: "rgba(224,121,106,0.4)" },
  "Information Only": { color: "#9A9686", bg: "rgba(154,150,134,0.12)", border: "rgba(154,150,134,0.4)" },
};

const historyData = [
  {
    date: "Today",
    items: [
      { icon: "⚖️", title: "What is Article 21?", preview: "Right to life and personal liberty explained in simple terms.", time: "11:42 AM", language: "English", status: "Answered" },
      { icon: "🛡", title: "Consumer Complaint Guidance", preview: "Steps to file a complaint against a defective product.", time: "10:20 AM", language: "हिन्दी", status: "Answered" },
      { icon: "📄", title: "Rent Agreement Analysis", preview: "Reviewed clauses for security deposit and notice period.", time: "10:16 AM", language: "English", status: "Completed" },
    ],
  },
  {
    date: "Yesterday",
    items: [
      { icon: "📝", title: "Generated Legal Notice", preview: "Drafted a notice regarding delayed rent deposit refund.", time: "6:05 PM", language: "English", status: "Generated" },
      { icon: "🏛", title: "Nearby District Court Search", preview: "Found 5 courts and legal aid centers near Ajmer.", time: "4:30 PM", language: "हिन्दी", status: "Completed" },
      { icon: "⚖️", title: "Legal Aid Eligibility", preview: "Checked eligibility criteria for free legal aid under DLSA.", time: "2:12 PM", language: "English", status: "Answered" },
    ],
  },
  {
    date: "2 Days Ago",
    items: [
      { icon: "🛡", title: "Cyber Crime Complaint", preview: "Guidance on reporting online financial fraud.", time: "8:47 PM", language: "हिन्दी", status: "Answered" },
      { icon: "⚖️", title: "FIR Process Explanation", preview: "Step-by-step process for filing an FIR at a police station.", time: "1:05 PM", language: "हाड़ौती", status: "Answered" },
    ],
  },
  {
    date: "Last Week",
    items: [
      { icon: "⚖️", title: "Property Dispute Guidance", preview: "Explained remedies available under the Specific Relief Act.", time: "Mon", language: "English", status: "Answered" },
      { icon: "⚖️", title: "Motor Accident Compensation", preview: "Overview of claim process under the Motor Vehicles Act.", time: "Mon", language: "हिन्दी", status: "Answered" },
      { icon: "🛡", title: "Women Protection Laws", preview: "Summary of key protections under the Domestic Violence Act.", time: "Sun", language: "English", status: "Answered" },
    ],
  },
];

/**
 * Quick-action chips & suggested questions, translated per language.
 * `key` is the canonical id used to look up the AI reply in RESPONSE_BANK —
 * it never changes with language, only the displayed label/prompt does.
 */
const QUICK_ACTIONS = [
  { icon: Scale, key: "legalGuidance", label: { en: "Legal Guidance", hi: "कानूनी सलाह", hd: "कानूनी सलाह" } },
  { icon: FileSignature, key: "generateNotice", action: "start-notice-flow", label: { en: "Generate Legal Notice", hi: "कानूनी सूचना बनाएं", hd: "कानूनी सूचना बणाओ" } },
  { icon: Landmark, key: "nearbyCourts", action: "start-courts-flow", label: { en: "Nearby Courts", hi: "आस-पास की अदालतें", hd: "लाग्गे री अदालतां" } },
  { icon: FileStack, key: "summarizeDocument", action: "start-document-flow", label: { en: "Summarize Document", hi: "दस्तावेज़ सारांश", hd: "दस्तावेज़ रो सार" } },
  { icon: BookOpen, key: "knowRights", label: { en: "Know Your Rights", hi: "अपने अधिकार जानें", hd: "अपणा हक जाणो" } },
  { icon: Languages, key: "translateTerm", label: { en: "Translate", hi: "अनुवाद करें", hd: "अनुवाद करो" } },
  { icon: Mic, key: "voiceAssistant", action: "start-voice", label: { en: "Voice Assistant", hi: "वॉइस असिस्टेंट", hd: "आवाज़ सहायक" } },
];

const SUGGESTIONS = [
  { key: "fileFIR", text: { en: "How do I file an FIR?", hi: "एफआईआर कैसे दर्ज करें?", hd: "एफआईआर कियां दर्ज करां?" } },
  { key: "article21", text: { en: "Explain Article 21.", hi: "अनुच्छेद 21 समझाएं।", hd: "अनुच्छेद 21 समझाओ।" } },
  { key: "affidavit", text: { en: "Generate an affidavit.", hi: "एक शपथ पत्र बनाएं।", hd: "एक शपथ पत्र बणाओ।" } },
  { key: "translateTerm", text: { en: "Translate this legal term.", hi: "इस कानूनी शब्द का अनुवाद करें।", hd: "आ कानूनी शब्द रो अनुवाद करो।" } },
  { key: "legalAidNear", text: { en: "Find legal aid near me.", hi: "मेरे पास कानूनी सहायता खोजें।", hd: "म्हारे लाग्गे कानूनी मदद खोजो।" } },
];

/** Canonical AI replies for every quick action / suggestion, in all 3 languages. */
const RESPONSE_BANK = {
  legalGuidance: {
    en: "Sure, Harish. Tell me the situation — property, employment, family, or criminal matter — and I'll walk you through the relevant law and next steps.",
    hi: "ज़रूर, हरीश। मुझे स्थिति बताएं — संपत्ति, रोजगार, पारिवारिक या आपराधिक मामला — और मैं आपको संबंधित कानून और अगले कदम बताऊंगा।",
    hd: "हां हरीश, थे बताओ के मामलो है — ज़मीन-जायदाद, नौकरी, परिवार या फौजदारी — म्है थने कानून अर अगला कदम बताऊं छूं।",
  },
  knowRights: {
    en: "Which area concerns you — Fundamental Rights, consumer protection, tenancy, workplace, or something else? I'll explain it clearly with the relevant articles or acts.",
    hi: "आपको किस क्षेत्र की चिंता है — मौलिक अधिकार, उपभोक्ता संरक्षण, किरायेदारी, कार्यस्थल या कुछ और? मैं संबंधित अनुच्छेदों के साथ स्पष्ट रूप से समझाऊंगा।",
    hd: "थने कुण सी बात री चिंता है — मूल अधिकार, ग्राहक सुरक्षा, किराएदारी, काम री जगा या कोई और? म्है सम्बंधित अनुच्छेद गैला समझाऊं।",
  },
  translateTerm: {
    en: "Go ahead and type the legal term or phrase — I'll translate and explain it in English, हिन्दी or हाड़ौती.",
    hi: "कानूनी शब्द या वाक्यांश टाइप करें — मैं इसे अंग्रेज़ी, हिन्दी या हाड़ौती में अनुवाद कर समझाऊंगा।",
    hd: "कानूनी शब्द या वाक्य लिखो — म्है इणनै अंग्रेज़ी, हिन्दी या हाड़ौती में अनुवाद करी समझाऊं।",
  },
  fileFIR: {
    en: "To file an FIR: visit the police station with jurisdiction over the incident, narrate the facts to the officer in-charge, and ensure it's recorded under Section 154 CrPC. You're entitled to a free copy. Want a step-by-step checklist?",
    hi: "एफआईआर दर्ज करने के लिए: घटना के अधिकार क्षेत्र वाले थाने जाएं, प्रभारी अधिकारी को तथ्य बताएं, और सुनिश्चित करें कि यह धारा 154 सीआरपीसी के तहत दर्ज हो। आपको एक निःशुल्क प्रति पाने का अधिकार है। क्या आपको चरण-दर-चरण सूची चाहिए?",
    hd: "एफआईआर दर्ज करण खातर: घटना वाळे थाने जावो, प्रभारी नै बात बताओ, अर ध्यान राखो के धारा 154 सीआरपीसी में दर्ज हो। थनै मुफत नकल पावण रो हक है। कदम-दर-कदम सूची चइए के?",
  },
  article21: {
    en: "Article 21 of the Constitution guarantees the Right to Life and Personal Liberty — no person shall be deprived of it except by procedure established by law. Courts have expanded it to include dignity, privacy, and a fair trial. Want relevant case law?",
    hi: "संविधान का अनुच्छेद 21 जीवन और व्यक्तिगत स्वतंत्रता के अधिकार की गारंटी देता है — कानून द्वारा स्थापित प्रक्रिया के अलावा किसी को भी इससे वंचित नहीं किया जा सकता। अदालतों ने इसमें गरिमा, गोपनीयता और निष्पक्ष सुनवाई को भी शामिल किया है। संबंधित केस लॉ चाहिए?",
    hd: "संविधान रो अनुच्छेद 21 जीवन अर आजादी रो हक देवे है — कानून री रीत बिना कोई भी इणसूं वंचित कोनी हुय सकै। अदालतां इण में इज्जत, निजता अर निष्पक्ष सुनवाई भी जोड़ी। सम्बंधित केस चइए के?",
  },
  affidavit: {
    en: "I can help draft an affidavit. Tell me the purpose — address proof, name change, income declaration, or court submission — and the facts to include.",
    hi: "मैं शपथ पत्र बनाने में मदद कर सकता हूं। उद्देश्य बताएं — पता प्रमाण, नाम परिवर्तन, आय घोषणा, या अदालत में प्रस्तुति — और शामिल करने वाले तथ्य।",
    hd: "म्है शपथ पत्र बणावण में मदद करी सकूं। मकसद बताओ — पतो साबित करणो, नाम बदलणो, आमदनी बतावणी, या अदालत में देणो — अर के-के बातां लिखणी है।",
  },
  legalAidNear: {
    en: "Free legal aid is available through District Legal Services Authorities (DLSA) under NALSA. Tap 'Nearby Courts' and I'll show you the closest Legal Aid Center along with directions.",
    hi: "नालसा के तहत जिला विधिक सेवा प्राधिकरण (डीएलएसए) के माध्यम से निःशुल्क कानूनी सहायता उपलब्ध है। 'आस-पास की अदालतें' दबाएं और मैं आपको निकटतम कानूनी सहायता केंद्र और दिशा-निर्देश दिखाऊंगा।",
    hd: "नालसा रे तहत जिला कानूनी सेवा अधिकरण (डीएलएसए) सूं मुफत कानूनी मदद मिळे। 'लाग्गे री अदालतां' दबाओ, म्है थनै सारू लाग्गे रो कानूनी मदद केंद्र अर रस्तो दिखाऊं।",
  },
  documentFlowUser: {
    en: "I want to analyze a legal document.",
    hi: "मैं एक कानूनी दस्तावेज़ का विश्लेषण करना चाहता हूं।",
    hd: "म्है एक कानूनी दस्तावेज़ री जांच करावणी चावूं।",
  },
  documentFlowAi: {
    en: "Please upload your document. You can share a PDF, DOCX, or a clear image of the document — I'll read through it and prepare a summary for you.",
    hi: "कृपया अपना दस्तावेज़ अपलोड करें। आप पीडीएफ, डीओसीएक्स, या दस्तावेज़ की स्पष्ट छवि साझा कर सकते हैं — मैं इसे पढ़कर आपके लिए सारांश तैयार करूंगा।",
    hd: "अपणो दस्तावेज़ अपलोड करो। थे पीडीएफ, डीओसीएक्स, या दस्तावेज़ री साफ फोटो भेज सको — म्है पढ़ी'र सार बणाऊं।",
  },
};

/** Fixed-language explain buttons on the document-analysis card (independent of the global switcher). */
const EXPLAIN_IN_LANG = {
  "Explain in Hindi":
    "ज़रूर, यह दस्तावेज़ एक सिविल संपत्ति विवाद है, जो अजमेर जिला एवं सत्र न्यायालय में दायर किया गया है। इसमें वादी और प्रतिवादी के बीच संपत्ति के स्वामित्व को लेकर विवाद है।",
  "Explain in Hadoti":
    "थारो दस्तावेज़ एक ज़मीन-जायदाद रो झगड़ो है, जकौ अजमेर री जिला अदालत में दायर हुयो है। वादी अर प्रतिवादी बिचाळै मालिकी नै ल्यार विवाद है।",
};

const DEFAULT_RESPONSE_BY_LANG = {
  en: "Understood. Let me look into that for you and provide accurate legal guidance shortly.",
  hi: "समझ गया। मैं इसे देखता हूं और जल्द ही आपको सटीक कानूनी सलाह दूंगा।",
  hd: "समझ गयो। म्है देखूं छूं अर जल्दी सही कानूनी सलाह देऊंगो।",
};

/* ---------------------------------------------------------------------- */
/* Legal Notice Generator — conversational interview + document builder */
/* ---------------------------------------------------------------------- */

const NOTICE_INTRO_TEXT = {
  en: "I can help you create a legal notice. Please answer a few quick questions.",
  hi: "मैं आपको कानूनी सूचना बनाने में मदद कर सकता हूं। कृपया कुछ छोटे प्रश्नों के उत्तर दें।",
  hd: "म्है थनै कानूनी सूचना बणावण में मदद करी सकूं। थोड़ा सवालां रा जवाब देओ।",
};

const NOTICE_QUESTIONS = [
  {
    key: "recipient",
    text: {
      en: "Who are you sending this notice to? Please share their name and address.",
      hi: "आप यह सूचना किसे भेज रहे हैं? कृपया उनका नाम और पता बताएं।",
      hd: "थे आ सूचना कीनै भेज रया हो? उणरो नाम अर पतो बताओ।",
    },
  },
  {
    key: "reason",
    text: {
      en: "What's the reason for this notice — for example, a payment dispute, property matter, or breach of agreement?",
      hi: "इस सूचना का कारण क्या है — जैसे भुगतान विवाद, संपत्ति मामला, या समझौते का उल्लंघन?",
      hd: "आ सूचना रो कारण के है — जिसा पइसा रो झगड़ो, ज़मीन-जायदाद रो मामलो, या करार तोड़णो?",
    },
  },
  {
    key: "details",
    text: {
      en: "Could you briefly describe what happened?",
      hi: "कृपया संक्षेप में बताएं कि क्या हुआ था?",
      hd: "थोड़ा में बताओ के हुयो हो?",
    },
  },
  {
    key: "date",
    text: {
      en: "When did this happen?",
      hi: "यह कब हुआ था?",
      hd: "आ कद हुई?",
    },
  },
  {
    key: "outcome",
    text: {
      en: "What outcome or resolution are you expecting from them?",
      hi: "आप उनसे किस परिणाम या समाधान की अपेक्षा कर रहे हैं?",
      hd: "थे उणसूं के चावो हो — के हल चइए?",
    },
  },
];

function todayFormatted() {
  return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function buildLegalNotice(answers, signature = "Harish Kumar") {
  return {
    lang: "en",
    heading: "LEGAL NOTICE",
    recipient: answers.recipient,
    subject: `Legal notice regarding ${answers.reason}`,
    date: todayFormatted(),
    body: `This notice is being issued to you regarding ${answers.reason}.\n\nOn or around ${answers.date}, ${answers.details}\n\nYou are hereby called upon to ${answers.outcome}, within 15 (fifteen) days from the receipt of this notice. Should you fail to comply within the stipulated period, appropriate legal proceedings — civil and/or criminal as advised — shall be initiated against you entirely at your cost, risk and consequences, without any further reference to you.\n\nThis notice is issued without prejudice to any other rights and remedies available under law.`,
    signOff: "Yours sincerely,",
    signature,
  };
}

function buildImprovedNotice(base) {
  return {
    ...base,
    body: `TAKE NOTICE that:\n\n1. This notice concerns ${base.subject.replace("Legal notice regarding ", "")}.\n\n2. ${base.body.split("\n\n")[1] || base.body}\n\n3. You are hereby called upon to remedy the above within 15 (fifteen) days from receipt of this notice.\n\n4. In the event of your failure to comply within the stipulated period, appropriate legal proceedings, both civil and criminal as advised, shall be initiated against you entirely at your cost, risk and consequences, without further reference to you.\n\nThis notice is issued without prejudice to any other rights and remedies available under law.`,
  };
}

function buildHindiNotice(base) {
  return {
    ...base,
    lang: "hi",
    heading: "कानूनी सूचना",
    subject: "उक्त विषय के संबंध में कानूनी सूचना",
    body: `आपको सूचित किया जाता है कि उपरोक्त विषय के संबंध में यह सूचना जारी की जा रही है।\n\nघटित घटना का विवरण ऊपर उल्लेखित तथ्यों के अनुसार है।\n\nआपसे अनुरोध है कि इस सूचना की प्राप्ति के 15 (पंद्रह) दिनों के भीतर उचित समाधान करें, अन्यथा आपके विरुद्ध सिविल एवं आवश्यकतानुसार आपराधिक कानूनी कार्यवाही, पूर्णतः आपके व्यय, जोखिम एवं परिणाम पर, बिना किसी अतिरिक्त सूचना के प्रारंभ की जाएगी।\n\nयह सूचना कानून के अंतर्गत उपलब्ध अन्य सभी अधिकारों एवं उपायों पर प्रतिकूल प्रभाव डाले बिना जारी की जा रही है।`,
    signOff: "भवदीय,",
  };
}

/* ---------------------------------------------------------------------- */
/* Nearby Courts & Legal Aid Finder                                      */
/* ---------------------------------------------------------------------- */

const CITY_COORDS = {
  ajmer: { lat: 26.4499, lng: 74.6399 },
  jodhpur: { lat: 26.2389, lng: 73.0243 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  udaipur: { lat: 24.5854, lng: 73.7125 },
  kota: { lat: 25.2138, lng: 75.8648 },
};

const COURT_CATEGORY_DEFS = [
  { category: "District Court", emoji: "🏛️", icon: Landmark, suffix: "District & Sessions Court" },
  { category: "High Court", emoji: "⚖️", icon: Building2, suffix: "High Court Bench" },
  { category: "Legal Aid Center", emoji: "🤝", icon: HeartHandshake, suffix: "Legal Services Authority (DLSA)" },
  { category: "Family Court", emoji: "👪", icon: Users, suffix: "Family Court" },
  { category: "Consumer Court", emoji: "🛒", icon: ShoppingBag, suffix: "Consumer Disputes Redressal Commission" },
  { category: "Police Station", emoji: "🚓", icon: ShieldAlert, suffix: "Kotwali Police Station" },
];

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function generateNearbyPlaces(center, cityLabel) {
  const cleanLabel = cityLabel.split("(")[0].trim();
  return COURT_CATEGORY_DEFS.map((def, i) => {
    const lat = center.lat + (Math.random() - 0.5) * 0.045;
    const lng = center.lng + (Math.random() - 0.5) * 0.045;
    const rating = (4 + Math.random() * 0.9).toFixed(1);
    const isOpen = Math.random() > 0.3;
    return {
      id: `place-${i}`,
      category: def.category,
      icon: def.icon,
      emoji: def.emoji,
      name: def.category === "Police Station" ? `${cleanLabel} ${def.suffix}` : `${cleanLabel} ${def.suffix}`,
      address: `${["Civil Lines", "Court Road", "Collectorate Road", "Station Road"][i % 4]}, ${cleanLabel}`,
      lat,
      lng,
      rating,
      isOpen,
      hours: "10:00 AM – 5:00 PM (Mon–Sat)",
      phone: `+91 ${9400000000 + Math.floor(Math.random() * 99999999)}`,
      distanceKm: haversineKm(center, { lat, lng }).toFixed(1),
      jurisdiction:
        def.category === "Legal Aid Center"
          ? "Provides free legal aid to eligible citizens under NALSA guidelines."
          : "Handles civil & criminal matters within district limits.",
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

function categoryDivIcon(emoji) {
  return L.divIcon({
    className: "justice-ai-marker",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${GOLD};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px rgba(0,0,0,0.4);border:2px solid ${INK_ON_GOLD}22;">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/** Auto-fits the map to show every marker, with a touch of padding. */
function FitBounds({ places }) {
  const map = useMap();
  useEffect(() => {
    if (!places.length) return;
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [26, 26] });
  }, [places, map]);
  return null;
}

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut", delay } },
});

/** Identical signature element from Landing / Analyzing screens. */
function NyayaDeep({ size = 30 }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 2.2,
          height: size * 2.2,
          background: "radial-gradient(circle, rgba(242,184,87,0.18) 0%, rgba(242,184,87,0) 70%)",
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg width={size} height={size} viewBox="0 0 100 100" className="relative">
        <ellipse cx="50" cy="78" rx="26" ry="6" fill="#3A2E17" opacity="0.5" />
        <path
          d="M26 68 C26 52, 74 52, 74 68 C74 76, 62 80, 50 80 C38 80, 26 76, 26 68 Z"
          fill="none"
          stroke={GOLD_SOFT}
          strokeWidth="1.5"
          opacity="0.9"
        />
        <motion.path
          d="M50 62 C42 52, 44 40, 50 30 C56 40, 58 52, 50 62 Z"
          fill={GOLD}
          animate={{ opacity: [0.88, 1, 0.88] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M50 56 C46 50, 47 43, 50 37 C53 43, 54 50, 50 56 Z"
          fill="#FCEFCB"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
      </svg>
    </div>
  );
}

function AiAvatar() {
  return (
    <div
      className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border"
      style={{ backgroundColor: CARD, borderColor: GOLD_SOFT }}
    >
      <Scale size={11} color={GOLD} strokeWidth={2} />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: GOLD }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

/** Generic labelled "working" indicator — analyzing document / generating notice / locating, etc. */
function WorkingIndicator({ label }) {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <Loader2 size={13} color={GOLD} strokeWidth={2.25} className="spin-slow" />
      <span className="text-[11.5px] font-medium" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="flex items-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-[3.5px] w-[3.5px] rounded-full"
            style={{ backgroundColor: GOLD }}
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.16 }}
          />
        ))}
      </span>
    </div>
  );
}

/** Voice-processing indicator — cycles AI is listening / understanding / preparing. */
function VoiceProcessingIndicator() {
  const STAGES = ["AI is listening...", "AI is understanding...", "AI is preparing response..."];
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [stage]);
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <Loader2 size={13} color={GOLD} strokeWidth={2.25} className="spin-slow" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={stage}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.25 }}
          className="text-[11.5px] font-medium"
          style={{ color: MUTED }}
        >
          {STAGES[stage]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/** Static-height waveform bars — used both live (listening) and as a message preview. */
function Waveform({ bars = 22, active = false, color = GOLD, height = 22 }) {
  const heightsRef = useRef(Array.from({ length: bars }, () => 0.25 + Math.random() * 0.75));
  return (
    <div className="flex items-center gap-[2.5px]" style={{ height }}>
      {heightsRef.current.map((h, i) =>
        active ? (
          <motion.span
            key={i}
            className="w-[2.5px] rounded-full"
            style={{ backgroundColor: color }}
            animate={{ height: [`${h * 35}%`, `100%`, `${h * 45}%`, `${h * 90}%`, `${h * 30}%`] }}
            transition={{ duration: 1.1 + (i % 5) * 0.08, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }}
          />
        ) : (
          <span
            key={i}
            className="w-[2.5px] rounded-full"
            style={{ backgroundColor: color, height: `${Math.max(15, h * 100)}%`, opacity: 0.55 }}
          />
        )
      )}
    </div>
  );
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ---------------------------------------------------------------------- */
/* File helpers                                                          */
/* ---------------------------------------------------------------------- */

function formatFileSize(bytes) {
  if (bytes === 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getFileCategory(file) {
  const name = file.name.toLowerCase();
  if (file.type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".doc") || name.endsWith(".docx") || file.type.includes("word")) return "DOCX";
  if (file.type.startsWith("image/")) return "Image";
  return "File";
}

function FileTypeIcon({ category, size = 17 }) {
  if (category === "Image") return <ImageIcon size={size} color={GOLD} strokeWidth={1.9} />;
  if (category === "PDF" || category === "DOCX") return <FileText size={size} color={GOLD} strokeWidth={1.9} />;
  return <FileGeneric size={size} color={GOLD} strokeWidth={1.9} />;
}

function buildAnalysis(fileName) {
  return {
    summary:
      "This appears to be a civil suit filing concerning a property ownership dispute. In simple terms, the plaintiff has asked the court to confirm their rightful ownership over a shared piece of land, and to restrain the defendant from interfering with it.",
    info: [
      { label: "Case Type", value: "Property Dispute — Civil Suit" },
      { label: "Parties", value: "Ramesh Kumar (Plaintiff) vs. Suresh Chand (Defendant)" },
      { label: "Important Dates", value: "Filed 14 Feb 2026 · Next Hearing 22 Aug 2026" },
      { label: "Legal Sections", value: "Section 34, Specific Relief Act · Order VII Rule 11, CPC" },
      { label: "Court Name", value: "District & Sessions Court, Ajmer" },
    ],
    observations: [
      "The document references a boundary survey report that isn't attached — this may be needed for the hearing.",
      "One of the dates in the timeline (para 4) doesn't match the date on the cover page — worth double-checking.",
      "The relief sought is broad; a more specific prayer clause is usually stronger in court.",
    ],
    nextSteps: [
      "Collect the missing survey report and any related revenue records.",
      "Verify the mismatched date with your lawyer before the next hearing.",
      "Prepare a short written timeline of events to support your side.",
    ],
    fileName,
  };
}

const WELCOME_TEXT = {
  en: "Hello Harish,\n\nWelcome to Justice AI. I'm here to help you understand legal procedures, generate legal documents, explain your rights and guide you in English, हिन्दी and हाड़ौती.\n\nHow can I assist you today?",
  hi: "नमस्ते हरीश,\n\nJustice AI में आपका स्वागत है। मैं आपको कानूनी प्रक्रियाएं समझाने, कानूनी दस्तावेज़ बनाने, आपके अधिकार बताने और अंग्रेज़ी, हिन्दी व हाड़ौती में मार्गदर्शन देने के लिए यहां हूं।\n\nमैं आज आपकी कैसे मदद कर सकता हूं?",
  hd: "राम राम हरीश,\n\nJustice AI में थारो स्वागत है। म्है थनै कानूनी रीत समझावण, कानूनी दस्तावेज़ बणावण, थारा हक बतावण अर अंग्रेज़ी, हिन्दी अर हाड़ौती में मदद करण खातर स्यूं छूं।\n\nआज म्है थारी के मदद करूं?",
};

let msgCounter = 1;
const nextId = () => `m${msgCounter++}`;

/* ---------------------------------------------------------------------- */
/* AI Conversation Memory & Context Awareness                             */
/* ---------------------------------------------------------------------- */

/** Fresh, empty memory card — created on mount and whenever the chat is cleared. */
function createInitialMemory(language) {
  return {
    userName: null,
    preferredLanguage: language,
    uploadedDocuments: [], // { id, fileName, analysis, uploadedAt }
    generatedNotices: [], // { id, subject, recipient, data, createdAt }
    selectedCourt: null, // { name, category, address }
    conversationSummary: "",
    lastReference: null, // { type: "document" | "notice", id }
  };
}

/** Lightweight name capture — "My name is X", "I'm X", "Call me X", etc. */
function extractName(text) {
  const STOP_WORDS = new Set([
    "a", "an", "the", "not", "looking", "trying", "going", "here", "sorry",
    "asking", "wondering", "still", "also", "just", "new",
  ]);
  const patterns = [
    /\bmy name is\s+([a-zA-Z]{2,20})/i,
    /\bi am\s+([a-zA-Z]{2,20})\b/i,
    /\bi'm\s+([a-zA-Z]{2,20})\b/i,
    /\bcall me\s+([a-zA-Z]{2,20})\b/i,
    /\bthis is\s+([a-zA-Z]{2,20})\s+(?:speaking|here)\b/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      const raw = match[1];
      if (STOP_WORDS.has(raw.toLowerCase())) continue;
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }
  return null;
}

/** Swaps the default "Harish" placeholder for whatever name Justice AI has remembered. */
function personalize(text, name) {
  if (!text || !name) return text;
  return text.replace(/Harish Kumar/g, name).replace(/Harish/g, name).replace(/हरीश/g, name);
}

/** Rolling, capped conversation summary — a few short bullet-style facts, newest last. */
function appendSummary(prev, entry) {
  const items = prev ? prev.split(" • ").filter(Boolean) : [];
  items.push(entry);
  return items.slice(-5).join(" • ");
}

const NAME_ACK_TEXT = {
  en: (name) => `Nice to meet you, ${name}! I'll remember that for our conversation. How can I help you today?`,
  hi: (name) => `आपसे मिलकर अच्छा लगा, ${name}! मैं इसे याद रखूंगा। आज मैं आपकी कैसे मदद कर सकता हूं?`,
  hd: (name) => `थारे सूं मिलनै आछो लाग्यो, ${name}! म्है याद राखूं छूं। आज म्है थारी के मदद करूं?`,
};

/** Natural follow-up phrases ("this", "that", "it") mapped to an intent kind. */
const FOLLOWUP_TRIGGERS = [
  { test: /what does (this|that|it) mean/i, kind: "explain" },
  { test: /explain (this|that|it)\b/i, kind: "explain" },
  { test: /translate (it|this|that)\b/i, kind: "translate" },
  { test: /make (it|this) (shorter|brief|simpler)/i, kind: "shorten" },
  { test: /summar(y|ize|ise)\s*(this|that|it)?/i, kind: "summarize" },
  { test: /important sections?/i, kind: "sections" },
  { test: /\bwhat about (this|that|it)\b/i, kind: "explain" },
];

function detectFollowUp(text) {
  for (const f of FOLLOWUP_TRIGGERS) {
    if (f.test.test(text)) return f.kind;
  }
  return null;
}

export default function JusticeAIChatHome() {
  // ---- multilingual conversation state ----
  // Restored on mount so a returning user picks up right where they left off.
  const [appLanguage, setAppLanguage] = useState(getStoredLanguage);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const t = UI_TEXT[appLanguage];

  const [messages, setMessages] = useState(() => [
    {
      id: "welcome",
      role: "ai",
      type: "text",
      text: WELCOME_TEXT[getStoredLanguage()],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [typing, setTyping] = useState(null); // null | "dots" | "analyzing" | "voice-processing" | "notice-generating" | "locating"
  const [awaitingUpload, setAwaitingUpload] = useState(false);

  // ---- voice mode state ----
  const [voiceMode, setVoiceMode] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [speakingPaused, setSpeakingPaused] = useState(false);

  // ---- legal notice interview state ----
  const [noticeFlow, setNoticeFlow] = useState(null); // { step, answers } | null

  // ---- AI conversation memory & context awareness ----
  // A hidden context object the AI consults so the whole session feels continuous:
  // who it's talking to, what's been uploaded/generated, and what "this"/"that" refers to.
  const [memory, setMemory] = useState(() => createInitialMemory(getStoredLanguage()));
  const [profileOpen, setProfileOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const displayName = memory.userName || "Harish";

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const timeoutsRef = useRef([]);
  const intervalsRef = useRef([]);
  const voiceIntervalRef = useRef(null);
  const pendingVoiceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const conversationIdRef = useRef(
    `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  const hasUserSentMessage = messages.some((m) => m.role === "user");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, voiceMode]);

  useEffect(
    () => () => {
      timeoutsRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
      if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  const after = (fn, delay) => {
    const t = setTimeout(fn, delay);
    timeoutsRef.current.push(t);
    return t;
  };

  const pushMessage = (msg) => setMessages((prev) => [...prev, { id: nextId(), ...msg }]);

  // Keep the memory card's preferred-language field in sync with the language switcher.
  useEffect(() => {
    setMemory((m) => (m.preferredLanguage === appLanguage ? m : { ...m, preferredLanguage: appLanguage }));
  }, [appLanguage]);

  /* ---------------- context-aware follow-up resolution ---------------- */

  /** Builds a reply that points back at whatever document/notice was last referenced. */
  const buildFollowUpReply = (kind) => {
    const name = memory.userName;
    const greet = name ? `${name}, ` : "";
    const ref = memory.lastReference;

    if (!ref) return personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], name);

    if (ref.type === "document") {
      const doc = memory.uploadedDocuments.find((d) => d.id === ref.id);
      if (!doc) return personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], name);
      if (kind === "sections") {
        const sectionsRow = doc.analysis.info.find((r) => r.label === "Legal Sections");
        const list = sectionsRow
          ? sectionsRow.value
          : doc.analysis.info.map((r) => `• ${r.label}: ${r.value}`).join("\n");
        return `${greet}here are the important sections from "${doc.fileName}":\n\n${list}`;
      }
      if (kind === "shorten") {
        return `${greet}in short — ${doc.analysis.summary.split(". ")[0]}.`;
      }
      // "explain" / "summarize" default back to the same document
      return `${greet}going back to "${doc.fileName}" — ${doc.analysis.summary}`;
    }

    if (ref.type === "notice") {
      const notice = memory.generatedNotices.find((n) => n.id === ref.id);
      if (!notice) return personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], name);
      const subject = notice.data.subject.replace("Legal notice regarding ", "");
      if (kind === "shorten") {
        return `${greet}in short — this notice asks ${notice.data.recipient} to resolve the matter regarding ${subject} within 15 days.`;
      }
      return `${greet}that's referring to the legal notice we drafted for ${notice.data.recipient}, regarding ${subject}.`;
    }

    return personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], name);
  };

  /* ---------------- plain text send / reply ---------------- */

  const sendMessage = (text, replyOverride) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    pushMessage({ role: "user", type: "text", text: trimmed });
    setInputValue("");

    // ---- memory: capture the user's name the moment they share it ----
    const detectedName = !replyOverride ? extractName(trimmed) : null;
    if (detectedName && detectedName !== memory.userName) {
      setMemory((m) => ({
        ...m,
        userName: detectedName,
        conversationSummary: appendSummary(m.conversationSummary, `User introduced themselves as ${detectedName}.`),
      }));
    }

    // ---- context: is this a natural follow-up referring to "this"/"that"/"it"? ----
    const followUpKind = !replyOverride && !detectedName ? detectFollowUp(trimmed) : null;
    const ref = memory.lastReference;

    // Follow-up "translate" gets routed into the real translate action so the
    // person sees the same rich card (Hindi notice / Hindi explanation) they'd
    // get from tapping the button — not just a text description of it.
    if (followUpKind === "translate" && ref) {
      setTyping("dots");
      after(() => {
        setTyping(null);
        if (ref.type === "document") {
          pushMessage({ role: "ai", type: "text", text: EXPLAIN_IN_LANG["Explain in Hindi"] });
        } else if (ref.type === "notice") {
          const notice = memory.generatedNotices.find((n) => n.id === ref.id);
          if (notice) {
            const translated = buildHindiNotice(notice.data);
            const id = nextId();
            pushMessage({ id, role: "ai", type: "notice", data: translated, variant: "hindi", editing: false });
            setMemory((m) => ({
              ...m,
              generatedNotices: [
                ...m.generatedNotices,
                { id, subject: translated.subject, recipient: translated.recipient, data: translated, createdAt: new Date().toISOString() },
              ],
              lastReference: { type: "notice", id },
            }));
          } else {
            pushMessage({ role: "ai", type: "text", text: personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], memory.userName) });
          }
        }
      }, 700);
      return;
    }

    setTyping("dots");

    // A genuine free-form legal question (no canned override, no name capture,
    // no follow-up pronoun match) goes straight to the real Justice AI backend.
    if (!detectedName && !followUpKind && !replyOverride) {
      askJusticeAI(trimmed, appLanguage, conversationIdRef.current)
        .then((reply) => {
          pushMessage({ role: "ai", type: "text", text: personalize(reply, memory.userName) });
        })
        .catch(() => {
          pushMessage({
            role: "ai",
            type: "text",
            text: personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], memory.userName),
          });
        })
        .finally(() => setTyping(null));
      return;
    }

    const delay = 700 + Math.random() * 500;
    after(() => {
      let reply;
      if (detectedName) {
        reply = NAME_ACK_TEXT[appLanguage](detectedName);
      } else if (followUpKind) {
        reply = buildFollowUpReply(followUpKind);
      } else {
        reply = personalize(replyOverride ?? DEFAULT_RESPONSE_BY_LANG[appLanguage], memory.userName);
      }
      pushMessage({ role: "ai", type: "text", text: reply });
      setTyping(null);
    }, delay);
  };

  /* ---------------- document flow ---------------- */

  const startDocumentFlow = () => {
    pushMessage({ role: "user", type: "text", text: RESPONSE_BANK.documentFlowUser[appLanguage] });
    setTyping("dots");
    after(() => {
      pushMessage({ role: "ai", type: "text", text: RESPONSE_BANK.documentFlowAi[appLanguage] });
      setTyping(null);
      setAwaitingUpload(true);
    }, 750);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAwaitingUpload(false);
    const category = getFileCategory(file);
    const uploadId = nextId();

    setMessages((prev) => [
      ...prev,
      {
        id: uploadId,
        role: "user",
        type: "upload",
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        category,
        progress: 4,
        status: "uploading",
      },
    ]);

    const interval = setInterval(() => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== uploadId || m.status !== "uploading") return m;
          const next = Math.min(100, m.progress + 8 + Math.random() * 16);
          return { ...m, progress: next };
        })
      );
    }, 160);
    intervalsRef.current.push(interval);

    after(() => {
      clearInterval(interval);
      setMessages((prev) =>
        prev.map((m) => (m.id === uploadId ? { ...m, progress: 100, status: "done" } : m))
      );
      after(() => startAnalysis(file, category), 450);
    }, 1750);
  };

  const finishAnalysis = (fileName, analysisData) => {
    const docId = nextId();
    pushMessage({ id: docId, role: "ai", type: "analysis", data: analysisData });
    setMemory((m) => ({
      ...m,
      uploadedDocuments: [
        ...m.uploadedDocuments,
        { id: docId, fileName, analysis: analysisData, uploadedAt: new Date().toISOString() },
      ],
      lastReference: { type: "document", id: docId },
      conversationSummary: appendSummary(m.conversationSummary, `Uploaded and analyzed "${fileName}".`),
    }));
    setTyping(null);
  };

  const startAnalysis = (file, category) => {
    setTyping("analyzing");
    const fileName = typeof file === "string" ? file : file.name;

    // Images and plain text can be sent straight to the real Gemini-powered
    // /api/document/analyze endpoint. Other formats (PDF/DOCX binary) fall
    // back to a local illustrative analysis, since parsing those requires a
    // server-side extraction library that isn't wired up here.
    const isPlainText = typeof file !== "string" && (file.type === "text/plain" || fileName.toLowerCase().endsWith(".txt"));
    const canAnalyzeLive = typeof file !== "string" && (category === "Image" || isPlainText);

    if (canAnalyzeLive) {
      analyzeDocumentOnBackend(file, category)
        .then((result) => finishAnalysis(fileName, mapBackendAnalysis(result, fileName)))
        .catch(() => finishAnalysis(fileName, buildAnalysis(fileName)));
      return;
    }

    after(() => {
      finishAnalysis(fileName, buildAnalysis(fileName));
    }, 2000 + Math.random() * 500);
  };

  const handleExplainHindi = () => sendMessage("Explain in Hindi", EXPLAIN_IN_LANG["Explain in Hindi"]);
  const handleExplainHadoti = () => sendMessage("Explain in Hadoti", EXPLAIN_IN_LANG["Explain in Hadoti"]);
  const handleAskFollowUp = () => document.getElementById("justice-ai-chat-input")?.focus();
  const handleDownloadSummary = () =>
    pushMessage({ role: "ai", type: "system", text: "⬇ Summary saved as JusticeAI_Summary.pdf" });

  /* ---------------- voice assistant flow (real mic + Gemini via /api/voice) ---------------- */

  const startVoiceMode = async () => {
    setInputValue("");
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setVoiceMode(true);
      setRecordSeconds(0);
      voiceIntervalRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      // Mic permission denied or unavailable — let the person know and fall back to typing.
      pushMessage({
        role: "ai",
        type: "text",
        text:
          appLanguage === "hi"
            ? "माइक्रोफ़ोन तक पहुंच नहीं मिली। कृपया ब्राउज़र सेटिंग में माइक्रोफ़ोन की अनुमति दें, या टाइप करके पूछें।"
            : appLanguage === "hd"
            ? "माइक तक पौंच कोनी मिली। ब्राउज़र सेटिंग में माइक री परमिशन दो, या टाइप कर'र पूछो।"
            : "Couldn't access your microphone. Please allow mic permission in your browser, or type your question instead.",
      });
    }
  };

  const stopMicAndTimer = () => {
    if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  };

  const cancelVoiceMode = () => {
    stopMicAndTimer();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setVoiceMode(false);
    setRecordSeconds(0);
  };

  const stopVoiceMode = () => {
    const duration = Math.max(1, recordSeconds);
    const recorder = mediaRecorderRef.current;
    setVoiceMode(false);
    if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);

    if (!recorder) return;

    recorder.onstop = async () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;

      if (blob.size === 0) return; // nothing recorded (e.g. instant tap)

      try {
        const dataUrl = await readFileAsBase64(blob);
        sendRecordedVoice(dataUrl, blob.type || "audio/webm", duration);
      } catch {
        pushMessage({ role: "ai", type: "text", text: DEFAULT_RESPONSE_BY_LANG[appLanguage] });
      }
    };
    recorder.stop();
  };

  /** Sends recorded audio to the real backend and renders the actual transcript + AI reply. */
  const sendRecordedVoice = (audioDataUrl, mimeType, duration) => {
    setTyping("voice-processing");

    askJusticeAIVoice(audioDataUrl, mimeType)
      .then((result) => {
        pushMessage({
          role: "user",
          type: "voice",
          text: result.transcript || "(voice message)",
          duration,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        const replyId = nextId();
        setMessages((prev) => [
          ...prev,
          {
            id: replyId,
            role: "ai",
            type: "spoken",
            text: personalize(result.aiResponseText || DEFAULT_RESPONSE_BY_LANG[appLanguage], memory.userName),
          },
        ]);
        setSpeakingMessageId(replyId);
        setSpeakingPaused(false);
      })
      .catch(() => {
        pushMessage({
          role: "ai",
          type: "text",
          text: personalize(DEFAULT_RESPONSE_BY_LANG[appLanguage], memory.userName),
        });
      })
      .finally(() => setTyping(null));
  };

  const handleMicTap = () => {
    if (voiceMode) stopVoiceMode();
    else startVoiceMode();
  };

  const togglePlayback = (id) => {
    if (speakingMessageId === id) setSpeakingPaused((p) => !p);
    else {
      setSpeakingMessageId(id);
      setSpeakingPaused(false);
    }
  };
  const replayMessage = (id) => {
    setSpeakingMessageId(id);
    setSpeakingPaused(false);
  };
  const stopSpeaking = () => {
    setSpeakingMessageId(null);
    setSpeakingPaused(false);
  };

  const handleRepeatResponse = (id) => replayMessage(id);
  const handleTranslateSpoken = () => sendMessage("Explain in Hindi", EXPLAIN_IN_LANG["Explain in Hindi"]);
  const handleCopySpoken = (text) => {
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(text);
    pushMessage({ role: "ai", type: "system", text: "✓ Copied to clipboard" });
  };

  /* ---------------- legal notice generator flow ---------------- */

  const NOTICE_START_TEXT = {
    en: "I want to generate a legal notice.",
    hi: "मैं एक कानूनी सूचना बनाना चाहता हूं।",
    hd: "म्है एक कानूनी सूचना बणावणी चावूं।",
  };

  const startNoticeFlow = () => {
    pushMessage({ role: "user", type: "text", text: NOTICE_START_TEXT[appLanguage] });
    setTyping("dots");
    after(() => {
      pushMessage({ role: "ai", type: "text", text: NOTICE_INTRO_TEXT[appLanguage] });
      setTyping(null);
      after(() => {
        pushMessage({ role: "ai", type: "text", text: NOTICE_QUESTIONS[0].text[appLanguage] });
        setNoticeFlow({ step: 0, answers: {} });
      }, 550);
    }, 700);
  };

  const handleNoticeAnswer = (text) => {
    const trimmed = text.trim();
    if (!trimmed || !noticeFlow) return;

    pushMessage({ role: "user", type: "text", text: trimmed });
    setInputValue("");

    const key = NOTICE_QUESTIONS[noticeFlow.step].key;
    const newAnswers = { ...noticeFlow.answers, [key]: trimmed };
    const nextStep = noticeFlow.step + 1;

    if (nextStep < NOTICE_QUESTIONS.length) {
      setTyping("dots");
      setNoticeFlow({ step: nextStep, answers: newAnswers });
      after(() => {
        pushMessage({ role: "ai", type: "text", text: NOTICE_QUESTIONS[nextStep].text[appLanguage] });
        setTyping(null);
      }, 650 + Math.random() * 400);
    } else {
      setNoticeFlow(null);
      setTyping("notice-generating");
      after(() => {
        const notice = buildLegalNotice(newAnswers, memory.userName || "Harish Kumar");
        const noticeId = nextId();
        pushMessage({ id: noticeId, role: "ai", type: "notice", data: notice, variant: "original", editing: false });
        setMemory((m) => ({
          ...m,
          generatedNotices: [
            ...m.generatedNotices,
            { id: noticeId, subject: notice.subject, recipient: notice.recipient, data: notice, createdAt: new Date().toISOString() },
          ],
          lastReference: { type: "notice", id: noticeId },
          conversationSummary: appendSummary(m.conversationSummary, `Generated a legal notice for ${notice.recipient}.`),
        }));
        setTyping(null);
      }, 2200 + Math.random() * 500);
    }
  };

  const handleDownloadNotice = () =>
    pushMessage({ role: "ai", type: "system", text: "⬇ Legal notice saved as JusticeAI_LegalNotice.pdf" });

  const handleCopyNotice = (m) => {
    const full = `${m.data.heading}\n\nTo: ${m.data.recipient}\nDate: ${m.data.date}\n\nSubject: ${m.data.subject}\n\n${m.data.body}\n\n${m.data.signOff}\nSd/-\n${m.data.signature}`;
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(full);
    pushMessage({ role: "ai", type: "system", text: "✓ Notice copied to clipboard" });
  };

  const handleToggleEditNotice = (id) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, editing: !m.editing, draftBody: m.editing ? undefined : m.data.body } : m))
    );

  const handleNoticeDraftChange = (id, value) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, draftBody: value } : m)));

  const handleSaveNoticeEdit = (id) => {
    const target = messages.find((mm) => mm.id === id);
    const newBody = target?.draftBody;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, data: { ...m.data, body: m.draftBody }, editing: false } : m))
    );
    if (newBody !== undefined) {
      setMemory((m) => ({
        ...m,
        generatedNotices: m.generatedNotices.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, body: newBody } } : n
        ),
      }));
    }
    pushMessage({ role: "ai", type: "system", text: "✓ Notice updated" });
  };

  const handleTranslateNotice = (m) => {
    setTyping("dots");
    after(() => {
      const translated = buildHindiNotice(m.data);
      const id = nextId();
      pushMessage({ id, role: "ai", type: "notice", data: translated, variant: "hindi", editing: false });
      setMemory((mem) => ({
        ...mem,
        generatedNotices: [
          ...mem.generatedNotices,
          { id, subject: translated.subject, recipient: translated.recipient, data: translated, createdAt: new Date().toISOString() },
        ],
        lastReference: { type: "notice", id },
      }));
      setTyping(null);
    }, 750);
  };

  const handleImproveNotice = (m) => {
    setTyping("notice-generating");
    after(() => {
      const improved = buildImprovedNotice(m.data);
      const id = nextId();
      pushMessage({ id, role: "ai", type: "notice", data: improved, variant: "improved", editing: false });
      setMemory((mem) => ({
        ...mem,
        generatedNotices: [
          ...mem.generatedNotices,
          { id, subject: improved.subject, recipient: improved.recipient, data: improved, createdAt: new Date().toISOString() },
        ],
        lastReference: { type: "notice", id },
      }));
      setTyping(null);
    }, 1800);
  };

  /* ---------------- nearby courts & legal aid finder flow ---------------- */

  const COURTS_START_TEXT = {
    en: "I want to find nearby legal services.",
    hi: "मैं आस-पास की कानूनी सेवाएं खोजना चाहता हूं।",
    hd: "म्है लाग्गे री कानूनी सेवावां खोजणी चावूं।",
  };
  const CURRENT_LOCATION_LABEL = { en: "your current location", hi: "आपकी वर्तमान स्थिति", hd: "थारी अबार री जगा" };
  const GEO_UNAVAILABLE_TEXT = {
    en: "Location isn't available on this device. No worries — just tell me your city.",
    hi: "इस डिवाइस पर लोकेशन उपलब्ध नहीं है। कोई बात नहीं — बस मुझे अपना शहर बताएं।",
    hd: "इण डिवाइस में लोकेशन कोनी मिळे। कोई बात कोनी — बस अपणो शहर बताओ।",
  };
  const GEO_DENIED_TEXT = {
    en: "Location access was denied — no worries, just tell me your city and I'll find services near you.",
    hi: "लोकेशन एक्सेस अस्वीकृत कर दिया गया — कोई बात नहीं, बस अपना शहर बताएं और मैं आपके पास की सेवाएं खोज दूंगा।",
    hd: "लोकेशन री मंजूरी कोनी मिळी — कोई बात कोनी, अपणो शहर बताओ, म्है लाग्गे री सेवावां खोज देऊं।",
  };
  const AJMER_FALLBACK_SUFFIX = {
    en: " — showing nearby results for Ajmer",
    hi: " — अजमेर के आस-पास के परिणाम दिखाए जा रहे हैं",
    hd: " — अजमेर रे लाग्गे रा नतीजा दिखाया जा रया है",
  };

  const startCourtsFlow = () => {
    pushMessage({ role: "user", type: "text", text: COURTS_START_TEXT[appLanguage] });
    setTyping("dots");
    after(() => {
      pushMessage({ role: "ai", type: "permission" });
      setTyping(null);
    }, 700);
  };

  const loadNearbyPlaces = (coords, label) => {
    setTyping("locating");
    after(() => {
      const places = generateNearbyPlaces(coords, label);
      pushMessage({ role: "ai", type: "places", center: coords, places, label });
      setTyping(null);

      after(() => {
        const recommended = places.find((p) => p.category === "District Court") || places[0];
        const legalAid = places.find((p) => p.category === "Legal Aid Center");
        const legalAidName = legalAid ? legalAid.name : null;
        const GUIDANCE = {
          en: `Based on what you need, the ${recommended.name} looks like your best option — it's ${recommended.distanceKm} km away and currently ${
            recommended.isOpen ? "open" : "closed"
          }.\n\nIf you're looking for free legal assistance instead, ${legalAidName || "the nearest Legal Aid Center"} can help at no cost.`,
          hi: `आपकी ज़रूरत के अनुसार, ${recommended.name} आपके लिए सबसे अच्छा विकल्प लगता है — यह ${recommended.distanceKm} किमी दूर है और अभी ${
            recommended.isOpen ? "खुला" : "बंद"
          } है।\n\nयदि आपको मुफ्त कानूनी सहायता चाहिए, तो ${legalAidName || "निकटतम कानूनी सहायता केंद्र"} निःशुल्क मदद कर सकता है।`,
          hd: `थारी जरूरत मुजब, ${recommended.name} सारू बढ़िया विकल्प लागे है — आ ${recommended.distanceKm} किमी दूर है अर अबार ${
            recommended.isOpen ? "खुली" : "बंद"
          } है।\n\nजे थनै मुफत कानूनी मदद चइए, तो ${legalAidName || "लाग्गे रो कानूनी मदद केंद्र"} मुफत में मदद करी सकै।`,
        };
        pushMessage({ role: "ai", type: "courts-guidance", text: GUIDANCE[appLanguage], recommended, legalAid });
        setMemory((m) => ({
          ...m,
          selectedCourt: { name: recommended.name, category: recommended.category, address: recommended.address },
          conversationSummary: appendSummary(m.conversationSummary, `Found nearby legal services near ${label}; recommended ${recommended.name}.`),
        }));
      }, 600);
    }, 1400 + Math.random() * 400);
  };

  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      pushMessage({ role: "ai", type: "text", text: GEO_UNAVAILABLE_TEXT[appLanguage] });
      pushMessage({ role: "ai", type: "city-input", value: "" });
      return;
    }
    setTyping("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setTyping(null);
        loadNearbyPlaces(coords, CURRENT_LOCATION_LABEL[appLanguage]);
      },
      () => {
        setTyping(null);
        pushMessage({ role: "ai", type: "text", text: GEO_DENIED_TEXT[appLanguage] });
        pushMessage({ role: "ai", type: "city-input", value: "" });
      },
      { timeout: 8000 }
    );
  };

  const handleEnterCityManually = () => pushMessage({ role: "ai", type: "city-input", value: "" });

  const handleCityDraftChange = (id, value) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, value } : m)));

  const handleManualCitySubmit = (id, cityText) => {
    const trimmed = cityText.trim();
    if (!trimmed) return;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, submitted: true } : m)));
    pushMessage({ role: "user", type: "text", text: trimmed });

    const key = trimmed.toLowerCase();
    const match = CITY_COORDS[key];
    const coords = match || CITY_COORDS.ajmer;
    const label = match ? trimmed : `${trimmed}${AJMER_FALLBACK_SUFFIX[appLanguage]}`;
    loadNearbyPlaces(coords, label);
  };

  const rememberSelectedCourt = (place) =>
    setMemory((m) => ({ ...m, selectedCourt: { name: place.name, category: place.category, address: place.address } }));

  const handleNavigatePlace = (place) => {
    rememberSelectedCourt(place);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, "_blank", "noopener");
  };
  const handleCallPlace = (place) => {
    rememberSelectedCourt(place);
    window.open(`tel:${place.phone}`, "_self");
  };

  const VIEW_DETAILS_HEADER = { en: "Here are more details about", hi: "यहां अधिक विवरण हैं", hd: "इणरी और जाणकारी" };
  const OPEN_LABEL = { en: "Open Now", hi: "अभी खुला है", hd: "अबार खुली है" };
  const CLOSED_LABEL = { en: "Closed", hi: "बंद है", hd: "बंद है" };
  const handleViewDetails = (place) => {
    rememberSelectedCourt(place);
    const header =
      appLanguage === "en" ? `${VIEW_DETAILS_HEADER.en} ${place.name}:` : `${place.name} — ${VIEW_DETAILS_HEADER[appLanguage]}:`;
    pushMessage({
      role: "ai",
      type: "text",
      text: `${header}\n\n📍 ${place.address}\n🕒 ${place.hours}\n📞 ${place.phone}\n⭐ ${place.rating}\n\n${place.jurisdiction}`,
    });
  };

  const ASK_PROCESS_LABEL = { en: "Ask About Court Process", hi: "अदालत प्रक्रिया के बारे में पूछें", hd: "अदालत री रीत रे बारे में पूछो" };
  const COURT_PROCESS_TEXT = {
    en: "Here's the typical process:\n\n1. File your case (plaint/complaint) with the court registry.\n2. The court issues summons/notice to the other party.\n3. Both sides appear on the hearing date.\n4. Evidence and arguments are presented over subsequent hearings.\n5. The court delivers its judgement.\n\nTimelines vary by case type — want guidance for your specific matter?",
    hi: "सामान्य प्रक्रिया इस प्रकार है:\n\n1. अदालत रजिस्ट्री में अपना मामला (वाद/शिकायत) दर्ज करें।\n2. अदालत दूसरे पक्ष को समन/सूचना जारी करती है।\n3. दोनों पक्ष सुनवाई की तारीख पर उपस्थित होते हैं।\n4. अगली सुनवाइयों में सबूत और तर्क प्रस्तुत किए जाते हैं।\n5. अदालत अपना फैसला सुनाती है।\n\nमामले के प्रकार के अनुसार समय अलग होता है — क्या आपको अपने मामले के लिए मार्गदर्शन चाहिए?",
    hd: "आमतौर पे रीत आवी है:\n\n1. अदालत में अपणो मामलो (वाद/शिकायत) दर्ज करो।\n2. अदालत दूजा पक्ष नै समन भेजे।\n3. दोन्यूं पक्ष सुनवाई री तारीख पे हाजर हुवै।\n4. अगली सुनवाई में सबूत अर बात राखी जावै।\n5. अदालत फैसलो सुणावै।\n\nमामला रे हिसाब सूं टेम बदले — थारे मामला खातर मदद चइए के?",
  };
  const handleAskAboutProcess = () => {
    pushMessage({ role: "user", type: "text", text: ASK_PROCESS_LABEL[appLanguage] });
    setTyping("dots");
    after(() => {
      pushMessage({ role: "ai", type: "text", text: COURT_PROCESS_TEXT[appLanguage] });
      setTyping(null);
    }, 750);
  };

  const LEGAL_AID_LABEL = { en: "Legal Aid Eligibility", hi: "कानूनी सहायता पात्रता", hd: "कानूनी मदद री हकदारी" };
  const LEGAL_AID_TEXT = {
    en: "Under NALSA, free legal aid is available to: women and children, SC/ST members, industrial workmen, persons with disabilities, victims of disaster or trafficking, persons in custody, and anyone with annual income below the state-notified limit (usually ₹1–3 lakh). Want me to check the exact income limit for your state?",
    hi: "नालसा के तहत, निःशुल्क कानूनी सहायता इन्हें मिलती है: महिलाएं और बच्चे, एससी/एसटी सदस्य, औद्योगिक कामगार, दिव्यांगजन, आपदा या तस्करी के पीड़ित, हिरासत में मौजूद व्यक्ति, और राज्य द्वारा तय आय सीमा (आमतौर पर ₹1–3 लाख) से कम आय वाले लोग। क्या मैं आपके राज्य की सटीक आय सीमा जांचूं?",
    hd: "नालसा रे तहत, मुफत कानूनी मदद इणनै मिळे: बाईयां अर बाळक, एससी/एसटी सदस्य, कारखाना काम करणिया, दिव्यांगजन, आपदा या तस्करी रा शिकार, हिरासत में रया लोग, अर राज्य री तय आमदनी हद (आमतौर पे ₹1–3 लाख) सूं कम कमावणिया। थारे राज्य री सही हद बताऊं के?",
  };
  const handleLegalAidEligibility = () => {
    pushMessage({ role: "user", type: "text", text: LEGAL_AID_LABEL[appLanguage] });
    setTyping("dots");
    after(() => {
      pushMessage({ role: "ai", type: "text", text: LEGAL_AID_TEXT[appLanguage] });
      setTyping(null);
    }, 750);
  };

  /* ---------------- shared quick actions / input ---------------- */

  const handleQuickAction = (a) => {
    if (a.action === "start-document-flow") startDocumentFlow();
    else if (a.action === "start-voice") startVoiceMode();
    else if (a.action === "start-notice-flow") startNoticeFlow();
    else if (a.action === "start-courts-flow") startCourtsFlow();
    else sendMessage(a.label[appLanguage], RESPONSE_BANK[a.key]?.[appLanguage]);
  };
  const handleSuggestion = (s) => sendMessage(s.text[appLanguage], RESPONSE_BANK[s.key]?.[appLanguage]);

  /* ---------------- language switcher ---------------- */

  const handleLanguageChange = (code) => {
    setLangMenuOpen(false);
    if (code === appLanguage) return;
    setAppLanguage(code);
    persistLanguage(code);
    pushMessage({ role: "ai", type: "system", text: UI_TEXT[code].systemLangChange });
  };

  const handleSend = () => {
    if (noticeFlow) handleNoticeAnswer(inputValue);
    else sendMessage(inputValue);
  };

  /* ---------------- clear chat — wipes messages AND conversation memory ---------------- */

  const handleClearChat = () => {
    timeoutsRef.current.forEach(clearTimeout);
    intervalsRef.current.forEach(clearInterval);
    if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    timeoutsRef.current = [];
    intervalsRef.current = [];
    pendingVoiceRef.current = null;

    setMessages([{ id: "welcome", role: "ai", type: "text", text: WELCOME_TEXT[appLanguage] }]);
    setMemory(createInitialMemory(appLanguage));
    setNoticeFlow(null);
    setAwaitingUpload(false);
    setTyping(null);
    setVoiceMode(false);
    setRecordSeconds(0);
    setSpeakingMessageId(null);
    setSpeakingPaused(false);
    setInputValue("");
    setProfileOpen(false);
  };

  return (
    <div
      className="relative mx-auto flex h-screen max-h-[844px] w-full max-w-[420px] flex-col overflow-hidden"
      style={{ backgroundColor: INK, color: TEXT }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Merriweather', serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .card-shadow { box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset, 0 10px 22px -16px rgba(0,0,0,0.55); }
        .btn-shadow { box-shadow: 0 1px 1px rgba(0,0,0,0.25), 0 14px 26px -14px rgba(242,184,87,0.4); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .spin-slow { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(242,184,87,0.35);} 50% { box-shadow: 0 0 0 6px rgba(242,184,87,0);} }
        .attach-pulse { animation: pulseGlow 1.6s ease-in-out infinite; }
        @keyframes micRipple { 0% { box-shadow: 0 0 0 0 rgba(242,184,87,0.35);} 100% { box-shadow: 0 0 0 14px rgba(242,184,87,0);} }
        .mic-ripple { animation: micRipple 1.6s ease-out infinite; }
        .dark-map .leaflet-tile-pane { filter: brightness(0.62) invert(1) hue-rotate(180deg) contrast(0.85) saturate(0.35); }
        .dark-map .leaflet-control-attribution { background: rgba(15,22,19,0.65) !important; color: ${MUTED} !important; font-size: 8px !important; }
        .dark-map .leaflet-control-attribution a { color: ${MUTED} !important; }
        .dark-map .leaflet-control-zoom a { background: ${CARD} !important; color: ${TEXT} !important; border-color: ${BORDER_CARD} !important; }
      `}</style>

      {/* Ambient background — identical to Landing / Analyzing */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute left-1/2 top-[-6%] h-[360px] w-[420px] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse at center, rgba(242,184,87,0.06) 0%, rgba(242,184,87,0) 68%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 30%, transparent 45%, rgba(0,0,0,0.42) 100%)" }}
        />
      </div>

      <div className="font-body relative flex h-full flex-col">
        {/* ---------------- Header ---------------- */}
        <div
          className="flex items-center justify-between px-5 pb-3 pt-[max(16px,env(safe-area-inset-top))]"
          style={{ borderBottom: `1px solid ${BORDER_CARD}` }}
        >
          <div className="flex items-center gap-2.5">
            <NyayaDeep />
            <div className="flex flex-col">
              <span className="font-display text-[14.5px] font-bold leading-tight" style={{ color: TEXT }}>
                Good Evening, {displayName}
              </span>
              <span className="flex items-center gap-1 text-[10.5px] leading-tight" style={{ color: MUTED }}>
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: GREEN, boxShadow: "0 0 6px rgba(127,191,142,0.6)" }}
                />
                AI Legal Assistant Online
              </span>
            </div>
          </div>

          <div className="relative flex items-center gap-2.5">
            {/* ---------------- Language switcher ---------------- */}
            <div className="relative">
              <motion.button
                onClick={() => setLangMenuOpen((o) => !o)}
                whileTap={{ scale: 0.95 }}
                className="flex h-8 items-center gap-1 rounded-full border px-2.5"
                style={{ backgroundColor: CARD, borderColor: langMenuOpen ? BORDER_PILL_ACTIVE : BORDER_CARD }}
                aria-label="Change language"
              >
                <Globe size={13} color={GOLD} strokeWidth={2} />
                <span className="text-[10.5px] font-semibold" style={{ color: TEXT }}>
                  {LANGUAGES.find((l) => l.code === appLanguage)?.short}
                </span>
                <ChevronDown
                  size={11}
                  color={MUTED}
                  strokeWidth={2}
                  style={{ transform: langMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
                />
              </motion.button>

              <AnimatePresence>
                {langMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLangMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="card-shadow absolute right-0 top-[calc(100%+6px)] z-20 flex w-[148px] flex-col overflow-hidden rounded-[14px] border"
                      style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
                    >
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => handleLanguageChange(l.code)}
                          className="flex items-center justify-between px-3 py-2.5 text-left text-[12px] font-medium"
                          style={{
                            color: l.code === appLanguage ? GOLD : TEXT,
                            backgroundColor: l.code === appLanguage ? "rgba(242,184,87,0.08)" : "transparent",
                          }}
                        >
                          {l.label}
                          {l.code === appLanguage && <Check size={12} color={GOLD} strokeWidth={2.5} />}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              className="flex h-8 w-8 items-center justify-center rounded-full border"
              style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
              aria-label="Notifications"
            >
              <Bell size={14} color={MUTED} strokeWidth={2} />
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border"
              style={{ backgroundColor: "rgba(242,184,87,0.10)", borderColor: BORDER_PILL_ACTIVE }}
              aria-label="Open profile"
            >
              <span className="font-display text-[11px] font-bold" style={{ color: GOLD }}>
                {displayName.charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </div>

        {/* ---------------- Conversation area ---------------- */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-3 pt-4">
          <div className="flex flex-col gap-3.5">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  {m.type === "text" && (
                    <div className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      {m.role === "ai" && <AiAvatar />}
                      <div
                        className={`card-shadow max-w-[86%] whitespace-pre-line rounded-[16px] border px-4 py-3 text-[13px] leading-[1.6] ${
                          m.role === "user" ? "rounded-tr-[4px]" : "rounded-tl-[4px]"
                        }`}
                        style={
                          m.role === "user"
                            ? { backgroundColor: GOLD, borderColor: GOLD_SOFT, color: INK_ON_GOLD }
                            : { backgroundColor: CARD, borderColor: BORDER_CARD, color: TEXT }
                        }
                      >
                        {m.text}
                      </div>
                    </div>
                  )}

                  {m.type === "system" && (
                    <div className="flex w-full justify-center py-1">
                      <span
                        className="rounded-full border px-3 py-1.5 text-[10.5px] font-medium"
                        style={{ backgroundColor: "rgba(242,184,87,0.08)", borderColor: BORDER_PILL_ACTIVE, color: GOLD }}
                      >
                        {m.text}
                      </span>
                    </div>
                  )}

                  {m.type === "upload" && (
                    <div className="flex items-start gap-2 justify-end">
                      <div
                        className="card-shadow w-[240px] rounded-[16px] rounded-tr-[4px] border px-3.5 py-3"
                        style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                            style={{ backgroundColor: "rgba(242,184,87,0.10)", border: `1px solid ${BORDER_PILL_ACTIVE}` }}
                          >
                            <FileTypeIcon category={m.category} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold leading-tight" style={{ color: TEXT }}>
                              {m.fileName}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-tight" style={{ color: MUTED }}>
                              {m.category} · {m.fileSize}
                            </p>
                          </div>
                        </div>

                        <div
                          className="mt-2.5 h-1 w-full overflow-hidden rounded-full"
                          style={{ backgroundColor: "rgba(233,229,216,0.08)" }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: GOLD }}
                            animate={{ width: `${m.progress}%` }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5">
                          <AnimatePresence mode="wait" initial={false}>
                            {m.status === "uploading" ? (
                              <motion.div
                                key="uploading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-1.5"
                              >
                                <Loader2 size={11} color={GOLD} strokeWidth={2.25} className="spin-slow" />
                                <span className="text-[10px] font-medium" style={{ color: MUTED }}>
                                  Uploading… {Math.round(m.progress)}%
                                </span>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="done"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-1.5"
                              >
                                <span
                                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                                  style={{ backgroundColor: "rgba(127,191,142,0.15)" }}
                                >
                                  <Check size={9} color={GREEN} strokeWidth={3} />
                                </span>
                                <span className="text-[10px] font-semibold" style={{ color: GREEN }}>
                                  Uploaded successfully
                                </span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  )}

                  {m.type === "analysis" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <div
                        className="card-shadow max-w-[92%] rounded-[16px] rounded-tl-[4px] border px-4 py-3.5"
                        style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
                      >
                        <p className="text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
                          📄 Document Summary
                        </p>
                        <p className="mt-1.5 text-[12.5px] leading-[1.6]" style={{ color: TEXT }}>
                          {m.data.summary}
                        </p>

                        <div className="my-3 h-px w-full" style={{ backgroundColor: ROW_DIVIDER }} />

                        <p className="text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
                          📌 Important Information
                        </p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {m.data.info.map((row) => (
                            <div key={row.label} className="flex items-start gap-2 text-[12px] leading-[1.5]">
                              <span className="w-[104px] flex-shrink-0 font-medium" style={{ color: MUTED }}>
                                {row.label}
                              </span>
                              <span style={{ color: TEXT }}>{row.value}</span>
                            </div>
                          ))}
                        </div>

                        <div className="my-3 h-px w-full" style={{ backgroundColor: ROW_DIVIDER }} />

                        <p className="text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
                          ⚠ Key Observations
                        </p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {m.data.observations.map((o, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[12px] leading-[1.55]" style={{ color: TEXT }}>
                              <span className="mt-[6px] h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: GOLD_SOFT }} />
                              {o}
                            </li>
                          ))}
                        </ul>

                        <div className="my-3 h-px w-full" style={{ backgroundColor: ROW_DIVIDER }} />

                        <p className="text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
                          💡 Recommended Next Steps
                        </p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {m.data.nextSteps.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] leading-[1.55]" style={{ color: TEXT }}>
                              <span
                                className="mt-[1px] flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold"
                                style={{ backgroundColor: "rgba(242,184,87,0.15)", color: GOLD }}
                              >
                                {i + 1}
                              </span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {m.type === "analysis" && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                      {[
                        { icon: Languages, label: "Explain in Hindi", onClick: handleExplainHindi },
                        { icon: Languages, label: "Explain in Hadoti", onClick: handleExplainHadoti },
                        { icon: FileSignature, label: "Generate Legal Notice", onClick: startNoticeFlow },
                        { icon: MessageCircleQuestion, label: "Ask Follow-up Question", onClick: handleAskFollowUp },
                        { icon: Download, label: "Download Summary", onClick: handleDownloadSummary },
                      ].map((a) => (
                        <motion.button
                          key={a.label}
                          onClick={a.onClick}
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-medium whitespace-nowrap"
                          style={{ backgroundColor: "rgba(233,229,216,0.03)", borderColor: BORDER_PILL, color: TEXT }}
                        >
                          <a.icon size={11} color={GOLD} strokeWidth={2} />
                          {a.label}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {m.type === "voice" && (
                    <div className="flex items-start gap-2 justify-end">
                      <div
                        className="card-shadow w-[220px] rounded-[16px] rounded-tr-[4px] border px-3.5 py-3"
                        style={{ backgroundColor: GOLD, borderColor: GOLD_SOFT }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: "rgba(26,20,8,0.15)" }}
                          >
                            <Mic size={13} color={INK_ON_GOLD} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <Waveform bars={16} active={false} color={INK_ON_GOLD} height={18} />
                          </div>
                          <span className="text-[10px] font-semibold" style={{ color: INK_ON_GOLD }}>
                            {formatTimer(m.duration)}
                          </span>
                        </div>
                        <p className="mt-2 text-[11.5px] font-medium leading-tight" style={{ color: INK_ON_GOLD, opacity: 0.85 }}>
                          {m.text}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: INK_ON_GOLD, opacity: 0.6 }}>
                            {m.lang}
                          </span>
                          <span className="text-[9px]" style={{ color: INK_ON_GOLD, opacity: 0.6 }}>
                            {m.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {m.type === "spoken" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <div
                        className="card-shadow max-w-[86%] rounded-[16px] rounded-tl-[4px] border px-4 py-3"
                        style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Volume2
                            size={12}
                            color={speakingMessageId === m.id && !speakingPaused ? GOLD : MUTED}
                            strokeWidth={2}
                          />
                          <span className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                            {speakingMessageId === m.id && !speakingPaused ? "Speaking" : "Voice reply"} · {m.lang}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: TEXT }}>
                          {m.text}
                        </p>

                        <div className="mt-2.5 flex items-center gap-2">
                          {speakingMessageId === m.id && !speakingPaused && <Waveform bars={14} active height={14} />}
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={() => togglePlayback(m.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full"
                              style={{ backgroundColor: "rgba(242,184,87,0.10)", border: `1px solid ${BORDER_PILL_ACTIVE}` }}
                              aria-label={speakingMessageId === m.id && !speakingPaused ? "Pause" : "Play"}
                            >
                              {speakingMessageId === m.id && !speakingPaused ? (
                                <Pause size={11} color={GOLD} strokeWidth={2.25} />
                              ) : (
                                <Play size={11} color={GOLD} strokeWidth={2.25} />
                              )}
                            </button>
                            <button
                              onClick={() => replayMessage(m.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full"
                              style={{ backgroundColor: "rgba(233,229,216,0.04)", border: `1px solid ${BORDER_CARD}` }}
                              aria-label="Replay"
                            >
                              <RotateCcw size={10.5} color={MUTED} strokeWidth={2} />
                            </button>
                            {speakingMessageId === m.id && (
                              <button
                                onClick={stopSpeaking}
                                className="flex h-6 w-6 items-center justify-center rounded-full"
                                style={{ backgroundColor: "rgba(233,229,216,0.04)", border: `1px solid ${BORDER_CARD}` }}
                                aria-label="Stop"
                              >
                                <Square size={9.5} color={MUTED} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {m.type === "spoken" && speakingMessageId !== m.id && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                      {[
                        { icon: RotateCcw, label: "Repeat Response", onClick: () => handleRepeatResponse(m.id) },
                        { icon: Languages, label: "Translate", onClick: handleTranslateSpoken },
                        { icon: FileSignature, label: "Generate Legal Notice", onClick: startNoticeFlow },
                        { icon: MessageCircleQuestion, label: "Ask Follow-up", onClick: handleAskFollowUp },
                        { icon: Copy, label: "Copy", onClick: () => handleCopySpoken(m.text) },
                      ].map((a) => (
                        <motion.button
                          key={a.label}
                          onClick={a.onClick}
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-medium whitespace-nowrap"
                          style={{ backgroundColor: "rgba(233,229,216,0.03)", borderColor: BORDER_PILL, color: TEXT }}
                        >
                          <a.icon size={11} color={GOLD} strokeWidth={2} />
                          {a.label}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* ---- Legal Notice document preview card ---- */}
                  {m.type === "notice" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="card-shadow max-w-[92%] overflow-hidden rounded-[16px] border"
                        style={{ backgroundColor: PAPER, borderColor: BORDER_PILL_ACTIVE }}
                      >
                        {m.variant !== "original" && (
                          <div className="flex justify-end px-4 pt-2.5">
                            <span
                              className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                              style={{ borderColor: BORDER_PILL_ACTIVE, color: GOLD, backgroundColor: "rgba(242,184,87,0.08)" }}
                            >
                              {m.variant === "improved" ? "Improved by AI" : "हिन्दी अनुवाद"}
                            </span>
                          </div>
                        )}

                        <div className="px-5 pb-5 pt-3">
                          <div className="flex flex-col items-center text-center">
                            <NyayaDeep size={26} />
                            <h3
                              className="font-display mt-2 text-[16px] font-black uppercase tracking-[0.12em]"
                              style={{ color: GOLD }}
                            >
                              {m.data.heading}
                            </h3>
                            <div className="mt-1.5 h-[1.5px] w-14 rounded-full" style={{ backgroundColor: GOLD_SOFT }} />
                          </div>

                          <div className="mt-4 flex items-start justify-between gap-3 text-[11px]">
                            <div className="min-w-0">
                              <p className="font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                                {m.data.lang === "hi" ? "प्रति" : "To"}
                              </p>
                              <p className="mt-0.5 leading-snug" style={{ color: TEXT }}>
                                {m.data.recipient}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                                {m.data.lang === "hi" ? "दिनांक" : "Date"}
                              </p>
                              <p className="mt-0.5" style={{ color: TEXT }}>
                                {m.data.date}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                              {m.data.lang === "hi" ? "विषय" : "Subject"}
                            </p>
                            <p className="mt-0.5 text-[12px] font-medium leading-snug" style={{ color: TEXT }}>
                              {m.data.subject}
                            </p>
                          </div>

                          <div className="my-3.5 h-px w-full" style={{ backgroundColor: ROW_DIVIDER }} />

                          {m.editing ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={m.draftBody}
                                onChange={(e) => handleNoticeDraftChange(m.id, e.target.value)}
                                rows={9}
                                className="w-full resize-none rounded-[10px] border bg-transparent p-2.5 text-[12px] leading-[1.6] outline-none"
                                style={{ color: TEXT, borderColor: BORDER_PILL, backgroundColor: "rgba(233,229,216,0.03)" }}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleToggleEditNotice(m.id)}
                                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium"
                                  style={{ borderColor: BORDER_PILL, color: MUTED }}
                                >
                                  <X size={10} strokeWidth={2} /> Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveNoticeEdit(m.id)}
                                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                                  style={{ backgroundColor: GOLD, color: INK_ON_GOLD }}
                                >
                                  <Check size={10} strokeWidth={2.5} /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p
                              className={`whitespace-pre-line text-[12.5px] leading-[1.7] ${m.data.lang === "hi" ? "" : "font-display"}`}
                              style={{ color: TEXT }}
                            >
                              {m.data.body}
                            </p>
                          )}

                          <div className="mt-6 flex flex-col items-end text-right">
                            <p className="text-[11.5px]" style={{ color: MUTED }}>
                              {m.data.signOff}
                            </p>
                            <div className="mt-5 h-[1px] w-24" style={{ backgroundColor: BORDER_PILL }} />
                            <p className="mt-1 text-[11px] italic" style={{ color: MUTED }}>
                              Sd/-
                            </p>
                            <p className="font-display text-[12.5px] font-bold" style={{ color: TEXT }}>
                              {m.data.signature}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {m.type === "notice" && !m.editing && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                      {[
                        { icon: Download, label: "Download PDF", onClick: handleDownloadNotice },
                        { icon: Copy, label: "Copy", onClick: () => handleCopyNotice(m) },
                        { icon: Pencil, label: "Edit", onClick: () => handleToggleEditNotice(m.id) },
                        { icon: Languages, label: "Translate", onClick: () => handleTranslateNotice(m) },
                        { icon: Wand2, label: "Ask AI to Improve", onClick: () => handleImproveNotice(m) },
                      ].map((a) => (
                        <motion.button
                          key={a.label}
                          onClick={a.onClick}
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-medium whitespace-nowrap"
                          style={{ backgroundColor: "rgba(233,229,216,0.03)", borderColor: BORDER_PILL, color: TEXT }}
                        >
                          <a.icon size={11} color={GOLD} strokeWidth={2} />
                          {a.label}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* ---- Location-permission card ---- */}
                  {m.type === "permission" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <div
                        className="card-shadow max-w-[86%] rounded-[16px] rounded-tl-[4px] border px-4 py-3.5"
                        style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
                      >
                        <p className="text-[13px] leading-[1.6]" style={{ color: TEXT }}>
                          {
                            {
                              en: "I can help you locate nearby legal services.",
                              hi: "मैं आपको आस-पास की कानूनी सेवाएं खोजने में मदद कर सकता हूं।",
                              hd: "म्है थनै लाग्गे री कानूनी सेवावां खोजण में मदद करी सकूं।",
                            }[appLanguage]
                          }
                          <br />
                          {
                            {
                              en: "Please allow location access.",
                              hi: "कृपया लोकेशन एक्सेस की अनुमति दें।",
                              hd: "मेहरबानी करी लोकेशन री मंजूरी देओ।",
                            }[appLanguage]
                          }
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          <motion.button
                            onClick={handleAllowLocation}
                            whileTap={{ scale: 0.97 }}
                            className="btn-shadow flex items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[12px] font-semibold"
                            style={{ backgroundColor: GOLD, color: INK_ON_GOLD }}
                          >
                            <LocateFixed size={13} strokeWidth={2.25} />
                            {{ en: "Allow Location Access", hi: "लोकेशन एक्सेस की अनुमति दें", hd: "लोकेशन री मंजूरी देओ" }[appLanguage]}
                          </motion.button>
                          <button
                            onClick={handleEnterCityManually}
                            className="flex items-center justify-center gap-1.5 rounded-[12px] border py-2.5 text-[12px] font-medium"
                            style={{ borderColor: BORDER_PILL, color: MUTED }}
                          >
                            <Search size={13} strokeWidth={2} />
                            {{ en: "Enter City Manually", hi: "शहर मैन्युअल रूप से दर्ज करें", hd: "अपणे-आप शहर लिखो" }[appLanguage]}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---- Manual city search card ---- */}
                  {m.type === "city-input" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <div
                        className="card-shadow flex w-[240px] items-center gap-1.5 rounded-[14px] border px-2.5 py-2"
                        style={{
                          backgroundColor: CARD,
                          borderColor: m.submitted ? BORDER_CARD : BORDER_PILL_ACTIVE,
                          opacity: m.submitted ? 0.5 : 1,
                        }}
                      >
                        <Search size={13} color={GOLD} strokeWidth={2} />
                        <input
                          type="text"
                          value={m.value}
                          disabled={m.submitted}
                          onChange={(e) => handleCityDraftChange(m.id, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleManualCitySubmit(m.id, m.value)}
                          placeholder={t.cityPlaceholder}
                          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:opacity-60"
                          style={{ color: TEXT }}
                        />
                        {!m.submitted && (
                          <button
                            onClick={() => handleManualCitySubmit(m.id, m.value)}
                            disabled={!m.value?.trim()}
                            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: GOLD, opacity: m.value?.trim() ? 1 : 0.4 }}
                            aria-label="Search"
                          >
                            <ArrowUp size={12} color={INK_ON_GOLD} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ---- Map + location cards ---- */}
                  {m.type === "places" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex max-w-[92%] flex-col gap-2.5"
                      >
                        {/* Compact embedded map — feels like a message attachment */}
                        <div
                          className="card-shadow dark-map overflow-hidden rounded-[16px] border"
                          style={{ borderColor: BORDER_CARD, height: 168, width: 272 }}
                        >
                          <MapContainer
                            key={m.id}
                            center={[m.center.lat, m.center.lng]}
                            zoom={13}
                            scrollWheelZoom={false}
                            style={{ height: "100%", width: "100%", backgroundColor: CARD }}
                          >
                            <TileLayer
                              attribution='&copy; OpenStreetMap contributors'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <FitBounds places={m.places} />
                            {m.places.map((p) => (
                              <Marker key={p.id} position={[p.lat, p.lng]} icon={categoryDivIcon(p.emoji)}>
                                <Popup>
                                  <strong>{p.name}</strong>
                                  <br />
                                  {p.category}
                                </Popup>
                              </Marker>
                            ))}
                          </MapContainer>
                        </div>

                        {/* Location cards */}
                        <div className="flex flex-col gap-2">
                          {m.places.map((p, i) => (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, ease: "easeOut", delay: 0.08 + i * 0.06 }}
                              className="card-shadow rounded-[14px] border px-3.5 py-3"
                              style={{ backgroundColor: CARD, borderColor: BORDER_CARD, width: 272 }}
                            >
                              <div className="flex items-start gap-2.5">
                                <div
                                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px]"
                                  style={{ backgroundColor: "rgba(242,184,87,0.10)", border: `1px solid ${BORDER_PILL_ACTIVE}` }}
                                >
                                  {p.emoji}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>
                                    {p.category}
                                  </p>
                                  <p className="mt-0.5 text-[12.5px] font-semibold leading-tight" style={{ color: TEXT }}>
                                    {p.name}
                                  </p>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-0.5">
                                  <Star size={11} color={GOLD} strokeWidth={0} fill={GOLD} />
                                  <span className="text-[11px] font-semibold" style={{ color: TEXT }}>
                                    {p.rating}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: MUTED }}>
                                <MapPin size={11} className="mt-[1.5px] flex-shrink-0" color={MUTED} strokeWidth={2} />
                                {p.address} · {p.distanceKm} km away
                              </div>

                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: p.isOpen ? GREEN : MUTED }}
                                />
                                <span className="text-[10.5px] font-medium" style={{ color: p.isOpen ? GREEN : MUTED }}>
                                  {p.isOpen ? "Open Now" : "Closed"}
                                </span>
                                <Clock size={10} color={MUTED} strokeWidth={2} className="ml-1" />
                                <span className="text-[10px]" style={{ color: MUTED }}>
                                  {p.hours}
                                </span>
                              </div>

                              <div className="mt-2.5 flex items-center gap-1.5">
                                <a
                                  href={`tel:${p.phone}`}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border py-1.5 text-[10.5px] font-medium"
                                  style={{ borderColor: BORDER_PILL, color: TEXT }}
                                >
                                  <Phone size={11} color={GOLD} strokeWidth={2} />
                                  Call
                                </a>
                                <button
                                  onClick={() => handleNavigatePlace(p)}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[10.5px] font-semibold"
                                  style={{ backgroundColor: GOLD, color: INK_ON_GOLD }}
                                >
                                  <Navigation size={11} strokeWidth={2.25} />
                                  Navigate
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* ---- AI guidance + follow-up chips ---- */}
                  {m.type === "courts-guidance" && (
                    <div className="flex items-start gap-2 justify-start">
                      <AiAvatar />
                      <div
                        className="card-shadow max-w-[86%] whitespace-pre-line rounded-[16px] rounded-tl-[4px] border px-4 py-3 text-[13px] leading-[1.6]"
                        style={{ backgroundColor: CARD, borderColor: BORDER_CARD, color: TEXT }}
                      >
                        {m.text}
                      </div>
                    </div>
                  )}

                  {m.type === "courts-guidance" && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                      {[
                        { icon: Navigation, label: { en: "Navigate", hi: "दिशा-निर्देश", hd: "रस्तो" }[appLanguage], onClick: () => handleNavigatePlace(m.recommended) },
                        { icon: Phone, label: { en: "Call", hi: "कॉल करें", hd: "कॉल करो" }[appLanguage], onClick: () => handleCallPlace(m.recommended) },
                        { icon: MapPin, label: { en: "View Details", hi: "विवरण देखें", hd: "जाणकारी देखो" }[appLanguage], onClick: () => handleViewDetails(m.recommended) },
                        { icon: Landmark, label: ASK_PROCESS_LABEL[appLanguage], onClick: handleAskAboutProcess },
                        { icon: HeartHandshake, label: LEGAL_AID_LABEL[appLanguage], onClick: handleLegalAidEligibility },
                      ].map((a) => (
                        <motion.button
                          key={a.label}
                          onClick={a.onClick}
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-medium whitespace-nowrap"
                          style={{ backgroundColor: "rgba(233,229,216,0.03)", borderColor: BORDER_PILL, color: TEXT }}
                        >
                          <a.icon size={11} color={GOLD} strokeWidth={2} />
                          {a.label}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {typing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2"
              >
                <AiAvatar />
                <div
                  className="card-shadow rounded-[16px] rounded-tl-[4px] border px-3.5 py-2.5"
                  style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
                >
                  {typing === "analyzing" ? (
                    <WorkingIndicator label={t.analyzing} />
                  ) : typing === "notice-generating" ? (
                    <WorkingIndicator label={t.generatingNotice} />
                  ) : typing === "locating" ? (
                    <WorkingIndicator label={t.locating} />
                  ) : typing === "voice-processing" ? (
                    <VoiceProcessingIndicator />
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </motion.div>
            )}

            {!hasUserSentMessage && (
              <motion.div
                key={`quick-actions-${appLanguage}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 pl-[38px]"
              >
                {QUICK_ACTIONS.map((a) => (
                  <motion.button
                    key={a.key}
                    onClick={() => handleQuickAction(a)}
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-medium whitespace-nowrap"
                    style={{ backgroundColor: CARD, borderColor: BORDER_PILL, color: TEXT }}
                  >
                    <a.icon size={12} color={GOLD} strokeWidth={2} />
                    {a.label[appLanguage]}
                  </motion.button>
                ))}
              </motion.div>
            )}

            {!hasUserSentMessage && (
              <motion.div
                key={`suggestions-${appLanguage}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
                className="flex flex-col gap-2 pl-8"
              >
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s.key}
                    onClick={() => handleSuggestion(s)}
                    whileTap={{ scale: 0.985 }}
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="card-shadow rounded-[13px] border px-3.5 py-2.5 text-left text-[12px] font-medium leading-tight"
                    style={{ backgroundColor: "rgba(233,229,216,0.03)", borderColor: BORDER_CARD, color: TEXT }}
                  >
                    {s.text[appLanguage]}
                  </motion.button>
                ))}
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ---------------- Chat input / Listening mode ---------------- */}
        <div className="px-5 pt-1">
          {awaitingUpload && !voiceMode && (
            <div className="mb-1.5 flex items-center gap-1.5 pl-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              <span className="text-[10.5px] font-medium" style={{ color: GOLD }}>
                {t.uploadHint}
              </span>
            </div>
          )}
          {noticeFlow && !voiceMode && (
            <div className="mb-1.5 flex items-center gap-1.5 pl-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              <span className="text-[10.5px] font-medium" style={{ color: GOLD }}>
                {t.questionOf(noticeFlow.step + 1, NOTICE_QUESTIONS.length)}
              </span>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {voiceMode ? (
              <motion.div
                key="listening"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="card-shadow rounded-[18px] border px-4 py-3"
                style={{ backgroundColor: CARD, borderColor: BORDER_PILL_ACTIVE }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-semibold" style={{ color: GOLD }}>
                      {t.listeningTitle}
                    </span>
                    <span className="text-[10px]" style={{ color: MUTED }}>
                      {t.listeningHint}
                    </span>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: TEXT }}>
                    {formatTimer(recordSeconds)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-center">
                  <Waveform bars={30} active height={26} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button onClick={cancelVoiceMode} className="text-[11px] font-medium" style={{ color: MUTED }}>
                    Cancel
                  </button>
                  <motion.button
                    onClick={stopVoiceMode}
                    whileTap={{ scale: 0.93 }}
                    className="btn-shadow flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: GOLD }}
                    aria-label="Stop recording"
                  >
                    <Square size={13} color={INK_ON_GOLD} strokeWidth={2.5} fill={INK_ON_GOLD} />
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="card-shadow flex items-center gap-2 rounded-[18px] border px-2 py-2"
                style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <button
                  onClick={openFilePicker}
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    awaitingUpload ? "attach-pulse" : ""
                  }`}
                  style={awaitingUpload ? { backgroundColor: "rgba(242,184,87,0.12)" } : {}}
                  aria-label="Attach file"
                >
                  <Paperclip size={15} color={awaitingUpload ? GOLD : MUTED} strokeWidth={2} />
                </button>

                <input
                  id="justice-ai-chat-input"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={noticeFlow ? t.noticePlaceholder : t.placeholder}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:opacity-70"
                  style={{ color: TEXT }}
                />

                <motion.button
                  onClick={handleMicTap}
                  whileTap={{ scale: 0.9 }}
                  className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full mic-ripple"
                  style={{ backgroundColor: "rgba(242,184,87,0.10)" }}
                  aria-label="Voice input"
                >
                  <Mic size={15} color={GOLD} strokeWidth={2} />
                </motion.button>

                <motion.button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  whileTap={inputValue.trim() ? { scale: 0.93 } : {}}
                  className="btn-shadow flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-opacity duration-200"
                  style={{
                    backgroundColor: GOLD,
                    opacity: inputValue.trim() ? 1 : 0.4,
                  }}
                  aria-label="Send message"
                >
                  <ArrowUp size={15} color={INK_ON_GOLD} strokeWidth={2.5} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---------------- Bottom navigation ---------------- */}
        <div
          className="mt-2 flex items-center justify-around px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2"
          style={{ borderTop: `1px solid ${BORDER_CARD}` }}
        >
          {NAV.map((n) => {
            const isActive =
              (n.label === "Chat" && !profileOpen && !documentsOpen && !historyOpen) ||
              (n.label === "Documents" && documentsOpen) ||
              (n.label === "History" && historyOpen) ||
              (n.label === "Profile" && profileOpen);
            return (
              <button
                key={n.label}
                onClick={() => {
                  if (n.label === "Profile") setProfileOpen(true);
                  if (n.label === "Documents") setDocumentsOpen(true);
                  if (n.label === "History") setHistoryOpen(true);
                }}
                className="flex flex-col items-center gap-1 px-3 py-1"
              >
                <n.icon size={18} color={isActive ? GOLD : MUTED} strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="text-[9.5px] font-medium" style={{ color: isActive ? GOLD : MUTED }}>
                  {n.label}
                </span>
                {isActive && (
                  <span className="mt-0.5 h-[3px] w-[3px] rounded-full" style={{ backgroundColor: GOLD }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- Profile — memory indicator lives here, same screen, no new page ---------------- */}
      <AnimatePresence>
        {profileOpen && (
          <>
            <motion.div
              key="profile-backdrop"
              className="absolute inset-0 z-30"
              style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setProfileOpen(false)}
            />
            <motion.div
              key="profile-sheet"
              className="no-scrollbar card-shadow absolute inset-x-0 bottom-0 z-40 max-h-[88%] overflow-y-auto rounded-t-[24px] border-t px-5 pt-3"
              style={{
                backgroundColor: CARD,
                borderColor: BORDER_CARD,
                paddingBottom: "max(20px, env(safe-area-inset-bottom))",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: BORDER_PILL }} />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border"
                    style={{ backgroundColor: "rgba(242,184,87,0.10)", borderColor: BORDER_PILL_ACTIVE }}
                  >
                    <span className="font-display text-[14px] font-bold" style={{ color: GOLD }}>
                      {profileData.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-display text-[15px] font-bold leading-tight" style={{ color: TEXT }}>
                        {profileData.name}
                      </p>
                      <Check size={12} color={GOLD} strokeWidth={3} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-tight" style={{ color: MUTED }}>
                      {profileData.role} • {profileData.verification}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: BORDER_CARD }}
                  aria-label="Close profile"
                >
                  <X size={14} color={MUTED} strokeWidth={2} />
                </button>
              </div>

              {/* ---- status badge ---- */}
              <div
                className="mt-4 flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5"
                style={{ backgroundColor: "rgba(127,191,142,0.08)", borderColor: "rgba(127,191,142,0.35)" }}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: GREEN, boxShadow: "0 0 6px rgba(127,191,142,0.6)" }}
                />
                <span className="text-[12px] font-semibold" style={{ color: GREEN }}>
                  {profileData.status}
                </span>
                <span className="ml-auto text-[9.5px]" style={{ color: MUTED }}>
                  {profileData.location}
                </span>
              </div>

              {/* ---- profile details ---- */}
              <div className="mt-4 flex flex-col gap-2.5">
                {[
                  { label: "Location", value: profileData.location },
                  { label: "Languages", value: profileData.languages },
                  { label: "Member Since", value: profileData.memberSince },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-3 border-b pb-2.5"
                    style={{ borderColor: ROW_DIVIDER }}
                  >
                    <span className="flex-shrink-0 text-[11.5px] font-medium" style={{ color: MUTED }}>
                      {row.label}
                    </span>
                    <span className="max-w-[60%] text-right text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* ---- statistics grid ---- */}
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                Statistics
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                {profileData.statistics.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[14px] border px-3 py-2.5"
                    style={{ backgroundColor: PAPER, borderColor: BORDER_CARD }}
                  >
                    <p className="font-display text-[18px] font-bold leading-none" style={{ color: GOLD }}>
                      {s.value}
                    </p>
                    <p className="mt-1 text-[10px] leading-tight" style={{ color: MUTED }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* ---- preferences ---- */}
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                Preferences
              </p>
              <div className="mt-2 flex flex-col gap-2.5">
                {[
                  { label: "Preferred Language", value: profileData.preferences.preferredLanguage },
                  { label: "Voice Assistant", value: profileData.preferences.voiceAssistant },
                  { label: "Notifications", value: profileData.preferences.notifications },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-3 border-b pb-2.5"
                    style={{ borderColor: ROW_DIVIDER }}
                  >
                    <span className="flex-shrink-0 text-[11.5px] font-medium" style={{ color: MUTED }}>
                      {row.label}
                    </span>
                    <span className="max-w-[60%] text-right text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* ---- recent activity ---- */}
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                Recent Activity
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {profileData.recentActivity.map((activity) => (
                  <div
                    key={activity}
                    className="flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5"
                    style={{ backgroundColor: PAPER, borderColor: BORDER_CARD }}
                  >
                    <Clock size={13} color={GOLD} strokeWidth={1.9} />
                    <span className="text-[12px] font-medium" style={{ color: TEXT }}>
                      {activity}
                    </span>
                  </div>
                ))}
              </div>

              {/* ---- live session memory (this conversation) ---- */}
              <p className="mt-5 text-[11px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                This Conversation
              </p>
              <div
                className="mt-2 flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5"
                style={{ backgroundColor: "rgba(127,191,142,0.08)", borderColor: "rgba(127,191,142,0.35)" }}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: GREEN, boxShadow: "0 0 6px rgba(127,191,142,0.6)" }}
                />
                <span className="text-[12px] font-semibold" style={{ color: GREEN }}>
                  Conversation Active
                </span>
                <span className="ml-auto text-[9.5px]" style={{ color: MUTED }}>
                  Memory synced to this chat
                </span>
              </div>

              {/* ---- memory card contents ---- */}
              <div className="mt-3 flex flex-col gap-2.5">
                {[
                  { label: "Name", value: memory.userName || "Not shared yet" },
                  {
                    label: "Preferred Language",
                    value: LANGUAGES.find((l) => l.code === memory.preferredLanguage)?.label || "English",
                  },
                  {
                    label: "Documents Remembered",
                    value: memory.uploadedDocuments.length
                      ? memory.uploadedDocuments.map((d) => d.fileName).join(", ")
                      : "None yet",
                  },
                  {
                    label: "Notices Generated",
                    value: memory.generatedNotices.length ? `${memory.generatedNotices.length} notice(s)` : "None yet",
                  },
                  { label: "Selected Court", value: memory.selectedCourt?.name || "None yet" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-3 border-b pb-2.5"
                    style={{ borderColor: ROW_DIVIDER }}
                  >
                    <span className="flex-shrink-0 text-[11.5px] font-medium" style={{ color: MUTED }}>
                      {row.label}
                    </span>
                    <span className="max-w-[60%] text-right text-[12px] font-semibold leading-snug" style={{ color: TEXT }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {memory.conversationSummary && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                    Conversation Summary
                  </p>
                  <p className="mt-1.5 text-[12px] leading-[1.6]" style={{ color: TEXT }}>
                    {memory.conversationSummary}
                  </p>
                </div>
              )}

              <motion.button
                onClick={handleClearChat}
                whileTap={{ scale: 0.97 }}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-[14px] border py-3 text-[12.5px] font-semibold"
                style={{ borderColor: "rgba(233,229,216,0.18)", color: TEXT }}
              >
                <RotateCcw size={13} strokeWidth={2} />
                Clear Conversation &amp; Memory
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------------- Documents — populated from documentsData, same sheet pattern ---------------- */}
      <AnimatePresence>
        {documentsOpen && (
          <>
            <motion.div
              key="documents-backdrop"
              className="absolute inset-0 z-30"
              style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDocumentsOpen(false)}
            />
            <motion.div
              key="documents-sheet"
              className="no-scrollbar card-shadow absolute inset-x-0 bottom-0 z-40 max-h-[88%] overflow-y-auto rounded-t-[24px] border-t px-5 pt-3"
              style={{
                backgroundColor: CARD,
                borderColor: BORDER_CARD,
                paddingBottom: "max(20px, env(safe-area-inset-bottom))",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: BORDER_PILL }} />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-[15px] font-bold leading-tight" style={{ color: TEXT }}>
                    Documents
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-tight" style={{ color: MUTED }}>
                    {documentsData.length} documents analyzed by Justice AI
                  </p>
                </div>
                <button
                  onClick={() => setDocumentsOpen(false)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: BORDER_CARD }}
                  aria-label="Close documents"
                >
                  <X size={14} color={MUTED} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {documentsData.map((doc) => {
                  const risk = DOC_RISK_STYLE[doc.risk];
                  return (
                    <div
                      key={doc.id}
                      className="card-shadow rounded-[16px] border px-3.5 py-3"
                      style={{ backgroundColor: PAPER, borderColor: BORDER_CARD }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                          style={{ backgroundColor: "rgba(242,184,87,0.10)" }}
                        >
                          <FileTypeIcon category={doc.fileType} size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: TEXT }}>
                            {doc.name}
                          </p>
                          <p className="mt-0.5 text-[10.5px] leading-tight" style={{ color: MUTED }}>
                            {doc.category} · {doc.uploaded}
                          </p>
                        </div>
                        <span
                          className="flex-shrink-0 rounded-full border px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide"
                          style={{ color: risk.color, backgroundColor: risk.bg, borderColor: risk.border }}
                        >
                          {doc.risk}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10.5px] font-medium" style={{ color: GREEN }}>
                          <Check size={11} strokeWidth={2.5} />
                          {doc.status}
                        </span>
                        <button
                          onClick={() => {
                            setDocumentsOpen(false);
                            pushMessage({
                              role: "ai",
                              type: "text",
                              text: `Here's the saved analysis for "${doc.name}" — reopening it from your Documents library.`,
                            });
                          }}
                          className="rounded-full border px-3 py-1 text-[10.5px] font-semibold"
                          style={{ borderColor: BORDER_PILL_ACTIVE, color: GOLD }}
                        >
                          View Analysis
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ---------------- History — populated from historyData, grouped by date ---------------- */}
      <AnimatePresence>
        {historyOpen && (
          <>
            <motion.div
              key="history-backdrop"
              className="absolute inset-0 z-30"
              style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setHistoryOpen(false)}
            />
            <motion.div
              key="history-sheet"
              className="no-scrollbar card-shadow absolute inset-x-0 bottom-0 z-40 max-h-[88%] overflow-y-auto rounded-t-[24px] border-t px-5 pt-3"
              style={{
                backgroundColor: CARD,
                borderColor: BORDER_CARD,
                paddingBottom: "max(20px, env(safe-area-inset-bottom))",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: "easeOut" }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: BORDER_PILL }} />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-[15px] font-bold leading-tight" style={{ color: TEXT }}>
                    History
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-tight" style={{ color: MUTED }}>
                    Your recent conversations with Justice AI
                  </p>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: BORDER_CARD }}
                  aria-label="Close history"
                >
                  <X size={14} color={MUTED} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-5">
                {historyData.map((group) => (
                  <div key={group.date}>
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                      {group.date}
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      {group.items.map((item) => (
                        <div
                          key={item.title}
                          className="rounded-[14px] border px-3.5 py-2.5"
                          style={{ backgroundColor: PAPER, borderColor: BORDER_CARD }}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex-shrink-0 text-[14px] leading-none">{item.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: TEXT }}>
                                  {item.title}
                                </p>
                                <span className="flex-shrink-0 text-[9.5px]" style={{ color: MUTED }}>
                                  {item.time}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] leading-snug" style={{ color: MUTED }}>
                                {item.preview}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span
                                  className="rounded-full border px-2 py-[2px] text-[9px] font-semibold"
                                  style={{ borderColor: BORDER_PILL, color: MUTED }}
                                >
                                  {item.language}
                                </span>
                                <span
                                  className="rounded-full border px-2 py-[2px] text-[9px] font-semibold"
                                  style={{ borderColor: BORDER_PILL_ACTIVE, color: GOLD }}
                                >
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
