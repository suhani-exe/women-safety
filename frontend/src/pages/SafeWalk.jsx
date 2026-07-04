import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useToast, useEmergency } from '../App'

export default function SafeWalk() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { triggerEmergency } = useEmergency()

  const [activeWalk, setActiveWalk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(null)

  // Form fields
  const [destName, setDestName] = useState('')
  const [etaMinutes, setEtaMinutes] = useState(15)

  useEffect(() => {
    checkActiveWalk()
  }, [])

  // Countdown timer for active walk
  useEffect(() => {
    if (!activeWalk || !activeWalk.eta) return

    const timer = setInterval(() => {
      const eta = new Date(activeWalk.eta)
      const now = new Date()
      const diff = eta - now

      if (diff <= 0) {
        setTimeRemaining('OVERDUE')
        clearInterval(timer)
        // Trigger check
        triggerEmergency('safewalk')
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [activeWalk, triggerEmergency])

  const checkActiveWalk = async () => {
    try {
      const data = await apiFetch('/api/safewalk/active')
      if (data.safewalk) {
        setActiveWalk(data.safewalk)
      }
    } catch (err) {
      console.log('No active walk')
    } finally {
      setLoading(false)
    }
  }

  const startWalk = async (e) => {
    e.preventDefault()

    try {
      // Get current location as start point
      let lat = 0, lng = 0
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (e) { /* ok */ }

      const data = await apiFetch('/api/safewalk/start', {
        method: 'POST',
        body: JSON.stringify({
          dest_name: destName,
          dest_lat: lat,
          dest_lng: lng,
          eta_minutes: etaMinutes,
        }),
      })

      setActiveWalk(data.safewalk)
      showToast('🚶‍♀️ SafeWalk started! Stay safe!', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const endWalk = async () => {
    if (!activeWalk) return
    try {
      await apiFetch(`/api/safewalk/${activeWalk.id}/end`, { method: 'POST' })
      showToast('🎉 Glad you reached safely!', 'success')
      setActiveWalk(null)
      setTimeRemaining(null)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="page-content page-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spin" style={{ fontSize: '2rem' }}>🚶‍♀️</div>
      </div>
    )
  }

  return (
    <div className="page-content page-enter">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
        <h2>SafeWalk</h2>
      </div>

      {/* Active Walk */}
      {activeWalk ? (
        <div className="safewalk-active slide-up">
          <div style={{ fontSize: '4rem', marginBottom: '12px' }}>🚶‍♀️</div>
          <h3>Walking to</h3>
          <p className="safewalk-dest" style={{ fontSize: '1.1rem' }}>
            {activeWalk.dest_name}
          </p>

          <p className="text-muted" style={{ marginBottom: '8px' }}>Time Remaining</p>
          <div className={`safewalk-timer ${timeRemaining === 'OVERDUE' ? 'text-red' : ''}`}>
            {timeRemaining || '--:--'}
          </div>

          {timeRemaining === 'OVERDUE' && (
            <div className="threat-indicator danger" style={{ marginBottom: '20px' }}>
              ⚠️ You haven't checked in! Are you okay?
            </div>
          )}

          <div className="safewalk-progress">
            <div className="safewalk-progress-fill" style={{ width: '40%' }} />
          </div>

          <button className="btn btn-safe btn-full btn-lg" onClick={endWalk} style={{ marginBottom: '12px' }}>
            ✅ I Reached Safely!
          </button>

          <button className="btn btn-danger btn-full" onClick={() => triggerEmergency('safewalk')}>
            🚨 I Need Help
          </button>
        </div>
      ) : (
        /* Start Walk Form */
        <div className="slide-up">
          <div className="glass-card-static" style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🚶‍♀️</div>
            <h3>Virtual Walking Companion</h3>
            <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '8px' }}>
              Set your destination and expected arrival time. If you don't check in by then,
              your emergency contacts will be alerted.
            </p>
          </div>

          <form onSubmit={startWalk}>
            <div className="form-group">
              <label className="form-label">Where are you going?</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Home, Office, Friend's house"
                value={destName}
                onChange={e => setDestName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected time to reach (minutes)</label>
              <input
                type="number"
                className="form-input"
                placeholder="15"
                value={etaMinutes}
                onChange={e => setEtaMinutes(parseInt(e.target.value) || 15)}
                min={1}
                max={180}
                required
              />
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                You'll need to check in by {new Date(Date.now() + etaMinutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg">
              🚶‍♀️ Start SafeWalk
            </button>
          </form>

          {/* How it works */}
          <div className="glass-card-static" style={{ marginTop: '24px' }}>
            <h4 style={{ marginBottom: '8px' }}>💡 How SafeWalk works</h4>
            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.8' }}>
              <li>Enter your destination and how long it should take</li>
              <li>A timer starts counting down</li>
              <li>When you arrive, tap "I Reached Safely"</li>
              <li>If the timer runs out without check-in, your contacts are alerted</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
