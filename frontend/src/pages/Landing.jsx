import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth, useToast } from '../App'

// Animated cycling words (adapted from COMPUTE hero spec)
const WORDS = ['protecting', 'watching', 'alerting', 'guarding']

function AnimatedWord({ word }) {
  const [letters, setLetters] = useState([])

  useEffect(() => {
    const chars = word.split('')
    // Immediately mark all as entering
    setLetters(chars.map(ch => ({ ch, state: 'entering' })))

    // Stagger each letter in
    const timers = chars.map((ch, i) =>
      setTimeout(() => {
        setLetters(prev =>
          prev.map((l, j) => j === i ? { ...l, state: 'visible' } : l)
        )
      }, i * 48)
    )
    return () => timers.forEach(clearTimeout)
  }, [word])

  return (
    <span className="word-animated" aria-label={word}>
      {letters.map((l, i) => (
        <span key={`${word}-${i}`} className={l.state}>
          {l.ch}
        </span>
      ))}
    </span>
  )
}

export default function Landing() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Form fields
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone]     = useState('')

  // Animated word cycling
  const [wordIndex, setWordIndex] = useState(0)
  const wordRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % WORDS.length)
    }, 2600)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        const data = await apiFetch('/api/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, phone: phone || null }),
        })
        login(data.token, data.user)
        showToast('Welcome to ShieldHer!', 'success')
      } else {
        const data = await apiFetch('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        login(data.token, data.user)
        showToast('Welcome back!', 'success')
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="landing-page">
      <div className="landing-inner">
        {/* Eyebrow */}
        <span className="landing-eyebrow">
          AI-powered women&apos;s safety
        </span>

        {/* Editorial headline */}
        <h1 className="landing-headline">
          Your safety,
        </h1>
        <p className="landing-headline-muted" aria-live="polite">
          always&nbsp;
          <AnimatedWord key={wordIndex} word={WORDS[wordIndex]} />
          .
        </p>

        <p className="landing-subtitle">
          Real-time AI threat detection, instant SOS alerts, and live location sharing — always in your pocket.
        </p>

        {/* Feature tags */}
        <div className="landing-features" aria-label="Key features">
          <span className="landing-feature-tag">AI Detection</span>
          <span className="landing-feature-tag">Motion Sensing</span>
          <span className="landing-feature-tag">Live Tracking</span>
          <span className="landing-feature-tag">Instant SOS</span>
        </div>

        {/* Auth card */}
        <div className="auth-card">
          {/* Toggle */}
          <div className="auth-toggle" role="group" aria-label="Auth mode">
            <button
              id="auth-login-btn"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setError('') }}
            >
              Login
            </button>
            <button
              id="auth-register-btn"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setError('') }}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="reg-phone">Phone <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                <input
                  id="reg-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            )}

            {error && (
              <p className="form-error" role="alert" style={{ marginBottom: '14px' }}>
                {error}
              </p>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading
                ? 'Please wait…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
