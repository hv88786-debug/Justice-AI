import React from "react";
import { motion } from "framer-motion";
import { Scale, FileText, Globe2, ArrowRight } from "lucide-react";

/**
 * Justice AI — Mobile App Home / Landing Screen
 * Theme: "Nyaya Deep" (न्याय दीप) — the lamp of justice.
 *
 * This is a NATIVE APP SCREEN, not a website:
 * - single fixed viewport, no scroll, no navbar, no site footer
 * - content distributed top / center / bottom like Google Wallet,
 *   GeM, BHIM, DigiLocker home screens
 * - designed for a ~390×844 Android viewport, safe-area aware
 */

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut", delay } },
});

const LANGUAGES = ["English", "हिन्दी", "हाड़ौती"];

const FEATURES = [
  { icon: Scale, label: "Legal Guidance" },
  { icon: FileText, label: "Document Generator" },
  { icon: Globe2, label: "Multilingual" },
];

const GOLD = "#F2B857";
const GOLD_SOFT = "#D9A24E";
const INK = "#0F1613";
const CARD = "#161F1B";
const TEXT = "#E9E5D8";
const MUTED = "#9A9686";
const BORDER_CARD = "rgba(233,229,216,0.08)";
const BORDER_PILL = "rgba(233,229,216,0.14)";
const BORDER_PILL_ACTIVE = "rgba(242,184,87,0.55)";

/** Signature element: a glowing "deep" (lamp). Breathes on opacity only. */
function NyayaDeep({ size = 46 }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 2.2,
          height: size * 2.2,
          background: "radial-gradient(circle, rgba(242,184,87,0.22) 0%, rgba(242,184,87,0) 70%)",
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

export default function JusticeAIMobileApp({ onContinue }) {
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
        .badge-shadow { box-shadow: 0 6px 16px -8px rgba(242,184,87,0.28); }
        .btn-shadow { box-shadow: 0 1px 1px rgba(0,0,0,0.25), 0 14px 26px -14px rgba(242,184,87,0.4); }
      `}</style>

      {/* Ambient background — subtle only, no scroll so it can stay fixed */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute left-1/2 top-[-6%] h-[360px] w-[420px] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse at center, rgba(242,184,87,0.08) 0%, rgba(242,184,87,0) 68%)" }}
        />
        <div
          className="absolute left-1/2 top-[30%] h-[380px] w-[380px] -translate-x-1/2"
          style={{ background: "radial-gradient(ellipse at center, rgba(60,80,68,0.16) 0%, rgba(60,80,68,0) 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 45%, rgba(0,0,0,0.42) 100%)" }}
        />
      </div>

      <div className="font-body relative flex h-full flex-col px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]">
        {/* ---------------- Status-bar-adjacent top row ---------------- */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp(0)}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div
              className="badge-shadow flex h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: CARD, border: `1px solid ${GOLD_SOFT}` }}
            >
              <Scale size={14} color={GOLD} strokeWidth={2} />
            </div>
            <span className="font-display text-[14.5px] font-bold tracking-tight" style={{ color: TEXT }}>
              Justice AI
            </span>
          </div>

          <div className="flex items-center gap-1">
            {LANGUAGES.map((lang, i) => (
              <span
                key={lang}
                className="rounded-full border px-2 py-[3px] text-[9.5px] font-medium tracking-wide"
                style={{
                  borderColor: i === 0 ? BORDER_PILL_ACTIVE : BORDER_PILL,
                  backgroundColor: i === 0 ? "rgba(242,184,87,0.10)" : "transparent",
                  color: i === 0 ? GOLD : MUTED,
                }}
              >
                {lang}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ---------------- Center content ---------------- */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp(0.05)}>
            <NyayaDeep />
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp(0.1)}
            className="font-display mt-5 text-[38px] font-black leading-[1.05] tracking-[-0.02em] text-center"
            style={{ color: TEXT }}
          >
            Justice AI
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp(0.16)}
            className="mt-3 max-w-[280px] text-center text-[13.5px] leading-[1.55]"
            style={{ color: MUTED }}
          >
            Know your rights. Understand legal procedures. Get AI-powered
            legal guidance in your preferred language.
          </motion.p>

          <motion.button
            initial="hidden"
            animate="show"
            variants={fadeUp(0.24)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={() => onContinue && onContinue()}
            className="btn-shadow mt-7 flex w-full items-center justify-center gap-2 rounded-[16px] py-3.5 text-[14px] font-semibold tracking-wide"
            style={{ backgroundColor: GOLD, color: "#1A1408" }}
          >
            Continue as Harish
            <ArrowRight size={16} strokeWidth={2.25} />
          </motion.button>

          {/* Compact feature row — kept minimal, icon + one-line label only */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp(0.3)}
            className="mt-4 grid w-full grid-cols-3 gap-2.5"
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="card-shadow flex flex-col items-center gap-1.5 rounded-[14px] border px-2 py-3 text-center"
                style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(242,184,87,0.08)", border: `1px solid ${BORDER_PILL_ACTIVE}` }}
                >
                  <f.icon size={13} color={GOLD} strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-medium leading-tight" style={{ color: TEXT }}>
                  {f.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ---------------- Bottom status block (not a website footer) ---------------- */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp(0.38)}
          className="flex flex-col items-center gap-1.5 pt-2 text-center"
        >
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-[3px] text-[9.5px] font-semibold tracking-wide"
            style={{
              borderColor: BORDER_PILL_ACTIVE,
              backgroundColor: "rgba(242,184,87,0.10)",
              color: GOLD,
            }}
          >
            Day 17 of 30
          </span>
          <span className="text-[9.5px] leading-tight" style={{ color: MUTED }}>
            30 Days • 30 SIH Solution Series
          </span>
          <span className="text-[9.5px] leading-tight" style={{ color: MUTED }}>
            Built for Smart India Hackathon &nbsp;•&nbsp; Version 1.0
          </span>
        </motion.div>
      </div>
    </div>
  );
}
