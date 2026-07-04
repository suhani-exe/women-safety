import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { apiFetch } from '../App'

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom police station icon
const policeIcon = new L.DivIcon({
  html: '<div style="font-size:24px;text-align:center">🚔</div>',
  iconSize: [30, 30],
  className: '',
})

// Custom user icon
const userIcon = new L.DivIcon({
  html: '<div style="font-size:24px;text-align:center">📍</div>',
  iconSize: [30, 30],
  className: '',
})

// Component to fly to user location
function FlyToUser({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.5 })
    }
  }, [position, map])
  return null
}

export default function MapView() {
  const navigate = useNavigate()
  const [userPosition, setUserPosition] = useState(null)
  const [policeStations, setPoliceStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setUserPosition([latitude, longitude])
          setLoading(false)
          findPoliceStations(latitude, longitude)
        },
        (err) => {
          console.error('Geolocation error:', err)
          // Default to Delhi
          setUserPosition([28.6139, 77.2090])
          setLoading(false)
          setError('Could not get your location. Showing default location.')
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      setUserPosition([28.6139, 77.2090])
      setLoading(false)
    }
  }, [])

  // Find nearest police stations
  const findPoliceStations = async (lat, lng) => {
    try {
      const data = await apiFetch('/api/location/police', {
        method: 'POST',
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      })
      setPoliceStations(data.stations || [])
    } catch (err) {
      console.error('Police station fetch error:', err)
    }
  }

  // Refresh location
  const refreshLocation = () => {
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserPosition([latitude, longitude])
        setLoading(false)
        findPoliceStations(latitude, longitude)
      },
      () => setLoading(false),
      { enableHighAccuracy: true }
    )
  }

  if (loading) {
    return (
      <div className="page-content page-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spin" style={{ fontSize: '2rem', marginBottom: '16px' }}>🗺️</div>
          <p className="text-secondary">Getting your location...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content page-enter">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
        <h2>Safety Map</h2>
      </div>

      {error && (
        <div className="glass-card-static" style={{ marginBottom: '12px', padding: '10px 16px' }}>
          <p className="text-amber" style={{ fontSize: '0.82rem' }}>⚠️ {error}</p>
        </div>
      )}

      {/* Map Controls */}
      <div className="map-controls">
        <button className="btn btn-outline btn-sm" onClick={refreshLocation}>
          📍 My Location
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => userPosition && findPoliceStations(userPosition[0], userPosition[1])}>
          🚔 Find Police
        </button>
      </div>

      {/* Map */}
      <div className="map-container">
        {userPosition && (
          <MapContainer
            center={userPosition}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            <FlyToUser position={userPosition} />

            {/* User marker */}
            <Marker position={userPosition} icon={userIcon}>
              <Popup>
                <strong>📍 You are here</strong>
              </Popup>
            </Marker>

            {/* Police station markers */}
            {policeStations.map((station, i) => (
              <Marker
                key={i}
                position={[station.latitude, station.longitude]}
                icon={policeIcon}
              >
                <Popup>
                  <strong>🚔 {station.name}</strong>
                  {station.phone && <br />}
                  {station.phone && <span>📞 {station.phone}</span>}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Police Station List */}
      {policeStations.length > 0 && (
        <div className="police-list">
          <h4 style={{ marginBottom: '8px', marginTop: '16px' }}>🚔 Nearby Police Stations</h4>
          {policeStations.slice(0, 5).map((station, i) => (
            <div key={i} className="police-item">
              <span className="police-icon">🏛️</span>
              <div style={{ flex: 1 }}>
                <div className="police-name">{station.name}</div>
                {station.phone && (
                  <a href={`tel:${station.phone}`} style={{ fontSize: '0.8rem' }}>
                    📞 {station.phone}
                  </a>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                🧭
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
