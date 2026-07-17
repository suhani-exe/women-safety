import { useState, useEffect, useRef, useCallback } from 'react'

/* ── Affirmation messages ─────────────────────────────────────── */
const AFFIRMATIONS = [
  "You're safe 💗",
  "You're doing so well 🌸",
  "This moment will pass 🕊️",
  "You are loved & protected 💜",
  "Breathe — you've got this ✨",
  "You are stronger than you know 🌷",
  "It's okay to take your time 🍃",
  "You are not alone 💫",
  "Every breath brings you peace 🌊",
  "You deserve to feel calm 🌙",
  "You are enough, just as you are 🌺",
  "This too shall pass — hang in there 🌻",
  "You are held, you are safe 🤍",
  "Take it one breath at a time 🌬️",
  "Your feelings are valid 💖",
  "You are resilient and brave 🦋",
  "Calm is coming back to you 🌅",
  "You have overcome this before 💪",
  "Rest here for as long as you need 🏡",
  "You are wrapped in warmth & safety 🌟",
]

/* ── Breathing phases ─────────────────────────────────────────── */
const PHASES = [
  { label: 'Breathe In',  duration: 4000, scale: 1.45 },
  { label: 'Hold',        duration: 2000, scale: 1.45 },
  { label: 'Breathe Out', duration: 5000, scale: 0.72 },
  { label: 'Rest',        duration: 1500, scale: 0.72 },
]

/* ── Close icon ───────────────────────────────────────────────── */
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/* ── Main CalmZone component ──────────────────────────────────── */
export default function CalmZone({ onClose }) {
  const [phaseIdx, setPhaseIdx]           = useState(0)
  const [progress, setProgress]           = useState(0)    // 0 → 1 within phase
  const [msgIdx, setMsgIdx]               = useState(0)
  const [msgVisible, setMsgVisible]       = useState(true)
  const [entered, setEntered]             = useState(false)

  const phaseTimerRef  = useRef(null)
  const rafRef         = useRef(null)
  const startTimeRef   = useRef(null)
  const msgTimerRef    = useRef(null)
  const msgFadeRef     = useRef(null)

  const phase = PHASES[phaseIdx]

  /* ── Breathing loop ─────────── */
  const tick = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current
    const p = Math.min(elapsed / phase.duration, 1)
    setProgress(p)
    if (p < 1) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [phase.duration])

  const nextPhase = useCallback(() => {
    setPhaseIdx(prev => (prev + 1) % PHASES.length)
  }, [])

  useEffect(() => {
    if (!entered) return
    // start animation frame for smooth progress
    startTimeRef.current = Date.now()
    setProgress(0)
    rafRef.current = requestAnimationFrame(tick)
    phaseTimerRef.current = setTimeout(nextPhase, phase.duration)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(phaseTimerRef.current)
    }
  }, [phaseIdx, entered, tick, nextPhase, phase.duration])

  /* ── Affirmation rotation ───── */
  const rotateMsgs = useCallback(() => {
    setMsgVisible(false)
    msgFadeRef.current = setTimeout(() => {
      setMsgIdx(prev => (prev + 1) % AFFIRMATIONS.length)
      setMsgVisible(true)
    }, 700)
  }, [])

  useEffect(() => {
    if (!entered) return
    msgTimerRef.current = setInterval(rotateMsgs, 6000)
    return () => {
      clearInterval(msgTimerRef.current)
      clearTimeout(msgFadeRef.current)
    }
  }, [entered, rotateMsgs])

  /* ── Entry animation ────────── */
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80)
    return () => clearTimeout(t)
  }, [])

  /* ── Derived visual values ──── */
  const currentPhase = PHASES[phaseIdx]
  const nextScale = PHASES[(phaseIdx + 1) % PHASES.length].scale
  const interpolatedScale = currentPhase.scale + (nextScale - currentPhase.scale) * progress

  /* Hue shift: breathe in = warm pink, breathe out = cool lavender */
  const hue = phaseIdx === 0 ? `rgba(236,168,214,${0.28 + progress * 0.22})`
             : phaseIdx === 2 ? `rgba(160,130,240,${0.5 - progress * 0.22})`
             : phaseIdx === 1 ? 'rgba(236,168,214,0.50)'
             : 'rgba(160,130,240,0.28)'

  const ringGlow = phaseIdx === 0 ? `0 0 ${60 + progress * 50}px rgba(236,168,214,0.45), 0 0 ${20 + progress * 30}px rgba(236,168,214,0.30)`
                 : phaseIdx === 2 ? `0 0 ${110 - progress * 50}px rgba(160,130,240,0.40), 0 0 ${50 - progress * 30}px rgba(160,130,240,0.25)`
                 : phaseIdx === 1 ? '0 0 110px rgba(236,168,214,0.45), 0 0 50px rgba(236,168,214,0.30)'
                 : '0 0 60px rgba(160,130,240,0.28), 0 0 20px rgba(160,130,240,0.15)'

  return (
    <div
      className={`calm-zone-overlay ${entered ? 'calm-entered' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Calm Safe Zone"
    >
      {/* Exit button */}
      <button
        className="calm-exit-btn"
        onClick={onClose}
        aria-label="Exit calm zone"
      >
        <CloseIcon />
        <span>Leave</span>
      </button>

      {/* Eyebrow label */}
      <div className="calm-eyebrow">
        <span>✦</span> Safe Zone <span>✦</span>
      </div>

      {/* ── Breathing orb section ── */}
      <div className="calm-orb-section">
        {/* Outer atmosphere rings */}
        <div
          className="calm-ring calm-ring-3"
          style={{
            transform: `scale(${interpolatedScale * 1.55})`,
            opacity: 0.12 + progress * 0.08,
            background: hue,
          }}
        />
        <div
          className="calm-ring calm-ring-2"
          style={{
            transform: `scale(${interpolatedScale * 1.28})`,
            opacity: 0.22 + progress * 0.12,
            background: hue,
          }}
        />
        <div
          className="calm-ring calm-ring-1"
          style={{
            transform: `scale(${interpolatedScale * 1.12})`,
            opacity: 0.40,
            background: hue,
          }}
        />

        {/* Core breathing circle */}
        <div
          className="calm-orb"
          style={{
            transform: `scale(${interpolatedScale})`,
            boxShadow: ringGlow,
          }}
        >
          {/* Inner glow pulse */}
          <div className="calm-orb-inner" />
        </div>

        {/* Progress arc */}
        <svg className="calm-progress-ring" viewBox="0 0 200 200" aria-hidden="true">
          <circle
            cx="100" cy="100" r="88"
            fill="none"
            stroke="rgba(236,168,214,0.12)"
            strokeWidth="1.5"
          />
          <circle
            cx="100" cy="100" r="88"
            fill="none"
            stroke="rgba(236,168,214,0.55)"
            strokeWidth="1.5"
            strokeDasharray={`${2 * Math.PI * 88}`}
            strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress)}`}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: '100px 100px',
              transition: 'stroke-dashoffset 0.05s linear',
            }}
          />
        </svg>
      </div>

      {/* Phase label — sits between orb and affirmations, in normal flow */}
      <div
        className={`calm-phase-label ${entered ? 'calm-label-visible' : ''}`}
        aria-live="polite"
        key={phaseIdx}
      >
        {currentPhase.label}
      </div>

      {/* ── Affirmation messages section ── */}
      <div className="calm-affirmations-section">
        <div
          className={`calm-affirmation-msg ${msgVisible ? 'calm-msg-in' : 'calm-msg-out'}`}
          aria-live="polite"
        >
          {AFFIRMATIONS[msgIdx]}
        </div>
      </div>

      {/* Ambient particle sparks */}
      <div className="calm-particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="calm-particle"
            style={{
              '--i': i,
              '--delay': `${(i * 0.37) % 5}s`,
              '--x': `${10 + (i * 17 + 13) % 80}%`,
              '--dur': `${4 + (i * 0.6) % 5}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
