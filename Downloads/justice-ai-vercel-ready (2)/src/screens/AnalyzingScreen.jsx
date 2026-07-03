import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Check, Loader2 } from "lucide-react";

/**
 * Justice AI — Analyzing / Workspace-Preparation Screen
 * Theme: "Nyaya Deep" (न्याय दीप) — continues the Landing Screen exactly.
 *
 * NATIVE APP SCREEN — no scroll, no navbar, no website footer.
 * Same background, same lamp mark, same type system, same tokens.
 */

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut", delay } },
});

const STEPS = [
  "Loading Legal Knowledge Base",
  "Setting Preferred Language",
  "Initializing AI Assistant",
  "Securing Session",
  "Preparing Workspace",
];

const GOLD = "#F2B857";
const GOLD_SOFT = "#D9A24E";
const INK = "#0F1613";
const CARD = "#161F1B";
const TEXT = "#E9E5D8";
const MUTED = "#9A9686";
const BORDER_CARD = "rgba(233,229,216,0.08)";
const ROW_DIVIDER = "rgba(233,229,216,0.06)";

/** Identical signature element from the Landing Screen. */
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

export default function JusticeAIAnalyzingScreen({ onComplete }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const navigatedRef = useRef(false);

  // Advance checklist every 500–700ms
  useEffect(() => {
    if (activeIndex >= STEPS.length - 1) return;
    const delay = 500 + Math.random() * 200;
    const t = setTimeout(() => setActiveIndex((i) => i + 1), delay);
    return () => clearTimeout(t);
  }, [activeIndex]);

  // Progress bar 0 -> 100 over 3s
  useEffect(() => {
    const raf = requestAnimationFrame(() => setProgress(100));
  }, []);

  // Auto-navigate 300ms after bar completes (3s fill + 300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        onComplete && onComplete();
      }
    }, 3300);
    return () => clearTimeout(t);
  }, [onComplete]);

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
        .spin-slow { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Ambient background — identical to Landing */}
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
        {/* ---------------- Center content ---------------- */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp(0)}>
            <NyayaDeep />
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp(0.08)}
            className="font-display mt-5 text-[30px] font-black leading-[1.05] tracking-[-0.02em] text-center"
            style={{ color: TEXT }}
          >
            Justice AI
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp(0.14)}
            className="mt-2 text-center text-[12.5px] leading-[1.5]"
            style={{ color: MUTED }}
          >
            Preparing your legal workspace...
          </motion.p>

          {/* ---------------- Progress card ---------------- */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp(0.22)}
            className="card-shadow mt-7 w-full rounded-[16px] border px-4 py-3.5"
            style={{ backgroundColor: CARD, borderColor: BORDER_CARD }}
          >
            <ul>
              {STEPS.map((label, i) => {
                const isDone = i < activeIndex;
                const isActive = i === activeIndex;
                return (
                  <motion.li
                    key={label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut", delay: 0.28 + i * 0.05 }}
                    className="flex items-center gap-2.5 py-2"
                    style={{
                      borderBottom: i !== STEPS.length - 1 ? `1px solid ${ROW_DIVIDER}` : "none",
                    }}
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      <AnimatePresence mode="wait" initial={false}>
                        {isDone ? (
                          <motion.span
                            key="done"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="flex h-5 w-5 items-center justify-center rounded-full"
                            style={{ backgroundColor: "rgba(242,184,87,0.12)", border: `1px solid ${GOLD_SOFT}` }}
                          >
                            <Check size={11} color={GOLD} strokeWidth={2.5} />
                          </motion.span>
                        ) : isActive ? (
                          <motion.span
                            key="active"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="flex h-5 w-5 items-center justify-center"
                          >
                            <Loader2 size={14} color={GOLD} strokeWidth={2.25} className="spin-slow" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="pending"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "rgba(233,229,216,0.18)" }}
                          />
                        )}
                      </AnimatePresence>
                    </span>
                    <span
                      className="text-[12.5px] font-medium leading-tight transition-colors duration-300"
                      style={{ color: isDone ? TEXT : isActive ? TEXT : MUTED }}
                    >
                      {label}
                    </span>
                  </motion.li>
                );
              })}
            </ul>

            {/* ---------------- Progress bar ---------------- */}
            <div
              className="mt-3.5 h-1 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "rgba(233,229,216,0.08)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: GOLD }}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 3, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </div>

        {/* ---------------- Bottom status block ---------------- */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp(0.3)}
          className="flex flex-col items-center gap-1 pt-2 text-center"
        >
          <span className="text-[11px] font-medium leading-tight" style={{ color: TEXT }}>
            Please wait...
          </span>
          <span className="text-[9.5px] leading-tight" style={{ color: MUTED }}>
            This usually takes a few seconds.
          </span>
        </motion.div>
      </div>
    </div>
  );
}
