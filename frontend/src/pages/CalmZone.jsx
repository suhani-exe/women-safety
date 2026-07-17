import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Affirmation messages ────────────────────────────── */
const AFFIRMATIONS = [
  "You're safe 💗",
  "You're doing great 🌸",
  "You are loved and protected 🤍",
  "This feeling will pass 🌊",
  "You are stronger than you know ✨",
  "Take it one breath at a time 🍃",
  "You are not alone 💜",
  "You've got through hard moments before 🌙",
  "It's okay to feel what you're feeling 🌷",
  "You are worthy of peace and calm 🕊️",
  "Your feelings are valid 💫",
  "You are safe right here, right now 🌿",
  "Be gentle with yourself 🌼",
  "You are braver than you believe 💖",
  "Every breath is a fresh start 🌬️",
  "You matter. You are enough 🌟",
  "Let go of what you can't control 🍂",
  "You deserve kindness — including from yourself 💝",
  "Right now, this moment, you are okay 🌈",
  "Breathe. You've got this 💓",
]

/* ── Breathing phases ────────────────────────────────── */
const PHASES = [
  { label: 'Breathe in',  duration: 4000, scale: 1.3 },
  { label: 'Hold',        duration: 1800, scale: 1.3 },
  { label: 'Breathe out', duration: 4000, scale: 0.72 },
  { label: 'Rest',        duration: 1200, scale: 0.72 },
]

export default function CalmZone() {
  const navigate = useNavigate()

  /* breathing state */
  const [phaseIndex, setPhaseIndex]   = useState(0)
  const [circleScale, setCircleScale] = useState(1.0)
  const phaseRef = useRef(0)
  const timerRef = useRef(null)

  /* affirmation state */
  const [msgIndex, setMsgIndex]     = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)
  const msgTimer = useRef(null)

  /* enter animation */
  const [entered, setEntered] = useState(false)

  /* ── Run breathing cycle ─────────────────────────── */
  const runPhase = useCallback(() => {
    const idx   = phaseRef.current
    const phase = PHASES[idx]
    setPhaseIndex(idx)
    setCircleScale(phase.scale)

    timerRef.current = setTimeout(() => {
      phaseRef.current = (idx + 1) % PHASES.length
      runPhase()
    }, phase.duration)
  }, [])

  useEffect(() => {
    const enterTimer = setTimeout(() => setEntered(true), 80)
    runPhase()
    return () => {
      clearTimeout(enterTimer)
      clearTimeout(timerRef.current)
      clearTimeout(msgTimer.current)
    }
  }, [runPhase])

  /* ── Rotate affirmation every 6 s ───────────────── */
  useEffect(() => {
    const cycle = () => {
      setMsgVisible(false)
      msgTimer.current = setTimeout(() => {
        setMsgIndex(i => (i + 1) % AFFIRMATIONS.length)
        setMsgVisible(true)
      }, 600)
    }
    const interval = setInterval(cycle, 6000)
    return () => clearInterval(interval)
  }, [])

  const phase = PHASES[phaseIndex]

  const circleDuration =
    phaseIndex === 0 ? '4s' :
    phaseIndex === 1 ? '0.4s' :
    phaseIndex === 2 ? '4s' : '0.4s'

  return (
    <div className={`calm-zone-screen ${entered ? 'calm-entered' : ''}`}>

      {/* Ambient background */}
      <div className="calm-ambient-bg" aria-hidden="true">
        <div className="calm-orb calm-orb-1" />
        <div className="calm-orb calm-orb-2" />
        <div className="calm-orb calm-orb-3" />
        <div className="calm-star-field" />
      </div>

      {/* Exit button */}
      <button
        className="calm-exit-btn"
        onClick={() => navigate('/dashboard')}
        aria-label="Leave Calm Zone"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>Leave</span>
      </button>

      {/* Main content */}
      <div className="calm-content">

        {/* Eyebrow */}
        <p className="calm-eyebrow">CalmZone</p>

        {/* Breathing circle */}
        <div className="calm-circle-wrapper" aria-label={`Breathing guide: ${phase.label}`}>

          {/* Ripple rings */}
          <div className="calm-ring calm-ring-1" style={{ transform: `scale(${circleScale * 1.16})`, transition: `transform ${circleDuration} ease-in-out` }} />
          <div className="calm-ring calm-ring-2" style={{ transform: `scale(${circleScale * 1.34})`, transition: `transform ${circleDuration} ease-in-out` }} />
          <div className="calm-ring calm-ring-3" style={{ transform: `scale(${circleScale * 1.55})`, transition: `transform ${circleDuration} ease-in-out` }} />

          {/* Main circle */}
          <div
            className="calm-circle"
            style={{
              transform: `scale(${circleScale})`,
              transition: `transform ${circleDuration} ease-in-out`,
            }}
          >
            <div className="calm-circle-inner">
              <span className="calm-phase-label">{phase.label}</span>
            </div>
          </div>
        </div>

        {/* Affirmation capsule */}
        <div className="calm-affirmations">
          <div className="calm-affirmations-inner">
            <div className={`calm-affirmation-msg ${msgVisible ? 'calm-msg-visible' : 'calm-msg-hidden'}`}>
              {AFFIRMATIONS[msgIndex]}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
