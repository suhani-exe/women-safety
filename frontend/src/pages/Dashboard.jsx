import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, useAuth, useEmergency } from '../App'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { triggerEmergency } = useEmergency()
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState([])
  const [shieldActive, setShieldActive] = useState(false)

  useEffect(() => {
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    try {
      const data = await apiFetch('/api/audio/history')
      setIncidents(data.incidents || [])
    } catch (err) {
      console.log('Could not load incidents:', err)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="page-content page-enter">
      {/* Header */}
      <div className="dashboard-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="greeting">{getGreeting()},</p>
            <h1>{user?.name?.split(' ')[0]} 👋</h1>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Logout">
            🚪
          </button>
        </div>
        <div className={`status-badge ${shieldActive ? 'active-status' : 'safe'}`}>
          <span className="status-dot"></span>
          {shieldActive ? 'Shield Active' : 'All Clear'}
        </div>
      </div>

      {/* Shield Button */}
      <div className="shield-btn-container">
        <button
          className={`shield-btn ${shieldActive ? 'active' : ''}`}
          onClick={() => navigate('/shield')}
        >
          <span className="shield-icon">🛡️</span>
          {shieldActive ? 'ACTIVE' : 'SHIELD'}
        </button>
      </div>

      <p className="text-secondary" style={{ textAlign: 'center', marginBottom: '24px', fontSize: '0.85rem' }}>
        Tap to activate AI-powered protection
      </p>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/shield" className="action-card">
          <span className="action-icon">🎙️</span>
          <span className="action-title">Shield Mode</span>
          <span className="action-desc">AI audio monitoring</span>
        </Link>

        <Link to="/map" className="action-card">
          <span className="action-icon">🗺️</span>
          <span className="action-title">Safety Map</span>
          <span className="action-desc">Nearby safe zones</span>
        </Link>

        <Link to="/safewalk" className="action-card">
          <span className="action-icon">🚶‍♀️</span>
          <span className="action-title">SafeWalk</span>
          <span className="action-desc">Virtual companion</span>
        </Link>

        <button
          className="action-card"
          onClick={() => triggerEmergency('manual')}
          style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          <span className="action-icon">🚨</span>
          <span className="action-title" style={{ color: '#EF4444' }}>SOS</span>
          <span className="action-desc">Emergency alert</span>
        </button>
      </div>

      {/* Recent Incidents */}
      <div className="recent-section">
        <h3>📋 Recent Activity</h3>

        {incidents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <p>No incidents recorded — you're safe!</p>
          </div>
        ) : (
          incidents.slice(0, 5).map((incident) => (
            <div key={incident.id} className="incident-item">
              <div className="incident-icon">
                {incident.type === 'audio' ? '🎙️' : incident.type === 'shake' ? '📳' : '🚨'}
              </div>
              <div className="incident-info">
                <div className="incident-type">
                  {incident.type === 'audio' ? 'Audio Alert' : incident.type === 'shake' ? 'Motion Alert' : 'Manual SOS'}
                </div>
                <div className="incident-time">{formatTime(incident.created_at)}</div>
              </div>
              <span className={`incident-level ${incident.threat_level?.toLowerCase()}`}>
                {incident.threat_level}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
