import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth, useToast } from '../App'

export default function Landing() {
  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')

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
        showToast('Welcome to ShieldHer! 🛡️', 'success')
      } else {
        const data = await apiFetch('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        login(data.token, data.user)
        showToast('Welcome back! 💜', 'success')
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-page">
      <div className="landing-logo">🛡️</div>
      <h1 className="landing-title">
        <span className="gradient-text">ShieldHer</span>
      </h1>
      <p className="landing-subtitle">
        Your AI-powered safety companion. Always watching, always protecting.
      </p>

      <div className="landing-features">
        <span className="landing-feature-tag">🎙️ AI Threat Detection</span>
        <span className="landing-feature-tag">📳 Motion Sensing</span>
        <span className="landing-feature-tag">🗺️ Live Tracking</span>
        <span className="landing-feature-tag">🚨 Instant SOS</span>
      </div>

      <div className="auth-toggle">
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => { setMode('login'); setError(''); }}
        >
          Login
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => { setMode('register'); setError(''); }}
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {mode === 'register' && (
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
        )}

        {error && <p className="form-error" style={{ marginBottom: '16px' }}>❌ {error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading}
        >
          {loading ? '⏳ Please wait...' : mode === 'login' ? '🔐 Login' : '🚀 Create Account'}
        </button>
      </form>
    </div>
  )
}
