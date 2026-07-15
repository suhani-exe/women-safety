import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEmergency, useToast } from '../App'

const API_BASE = 'http://localhost:8000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

export default function ShieldMode() {
  const navigate = useNavigate()
  const { triggerEmergency } = useEmergency()
  const { showToast } = useToast()

  const [active, setActive] = useState(false)
  const [threatLevel, setThreatLevel] = useState('SAFE')
  const [analysisLog, setAnalysisLog] = useState([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [wsStatus, setWsStatus] = useState('disconnected')
  const [alarm, setAlarm] = useState(null)
  const [sosResult, setSosResult] = useState(null)
  const [sessionStats, setSessionStats] = useState({
    sessionId: null,
    chunks: 0,
    bytes: 0,
    lastLocationAt: null,
    state: 'LISTENING',
    score: 0,
    transcripts: 0,
  })

  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const websocketRef = useRef(null)
  const locationIntervalRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const activeRef = useRef(false)

  const sendWsJson = useCallback((payload) => {
    const ws = websocketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(payload))
    return true
  }, [])

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendWsJson({
          type: 'location',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
    )
  }, [sendWsJson])

  const addLogEntry = useCallback((entry) => {
    setAnalysisLog(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'SAFE',
        transcript: '',
        ...entry,
      },
      ...prev.slice(0, 19),
    ])
  }, [])

  const connectRealtimeSession = useCallback(() => {
    const token = localStorage.getItem('shieldher_token')
    if (!token) {
      showToast('Please login again to start Shield Mode', 'error')
      return null
    }

    const ws = new WebSocket(`${WS_BASE}/api/ws/audio?token=${encodeURIComponent(token)}`)
    websocketRef.current = ws
    setWsStatus('connecting')

    ws.onopen = () => {
      setWsStatus('connected')
      showToast('Realtime monitoring connected', 'success')
      getCurrentLocation()
      locationIntervalRef.current = setInterval(getCurrentLocation, 5000)
      pingIntervalRef.current = setInterval(() => sendWsJson({ type: 'ping' }), 15000)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'session_started') {
          setSessionStats(prev => ({
            ...prev,
            sessionId: message.session?.session_id || null,
          }))
          addLogEntry({ reason: 'Realtime session started' })
        }

        if (message.type === 'audio_ack') {
          setSessionStats(prev => ({
            ...prev,
            sessionId: message.session_id || prev.sessionId,
            chunks: message.audio_chunks_received || prev.chunks,
            bytes: message.audio_bytes_received || prev.bytes,
          }))
        }

        if (message.type === 'location_ack') {
          setSessionStats(prev => ({
            ...prev,
            sessionId: message.session_id || prev.sessionId,
            lastLocationAt: new Date().toLocaleTimeString(),
          }))
        }

        if (message.type === 'transcript_ack') {
          setSessionStats(prev => ({
            ...prev,
            transcripts: prev.transcripts + 1,
          }))
          addLogEntry({
            reason: 'Transcript received by realtime session',
            transcript: (message.transcript || '').substring(0, 100),
          })
        }

        if (message.type === 'threat_update') {
          const threat = message.threat || {}
          setThreatLevel(threat.level || 'SAFE')
          setSessionStats(prev => ({
            ...prev,
            sessionId: message.session_id || prev.sessionId,
            state: message.session_state || threat.state || prev.state,
            score: threat.score ?? prev.score,
          }))
          addLogEntry({
            level: threat.level || 'SAFE',
            reason: `${threat.summary || 'Threat update'} Score: ${threat.score ?? 0}. ${threat.reason || ''}`,
            transcript: (threat.signals || [])
              .map(signal => `${signal.name}+${signal.score}`)
              .join(', '),
          })

          if (threat.level === 'DANGER') {
            showToast('Danger detected. Alarm countdown started.', 'error')
          }
        }

        if (message.type === 'alarm_started') {
          setAlarm({
            active: true,
            remaining: message.countdown_seconds || 15,
            threat: message.threat,
          })
          setSosResult(null)
          addLogEntry({
            level: 'DANGER',
            reason: `Alarm started. SOS will send in ${message.countdown_seconds || 15} seconds unless cancelled.`,
            transcript: '',
          })
        }

        if (message.type === 'alarm_tick') {
          setAlarm(prev => prev ? { ...prev, remaining: message.remaining_seconds } : prev)
        }

        if (message.type === 'alarm_cancelled') {
          setAlarm(null)
          setThreatLevel('SAFE')
          setSessionStats(prev => ({
            ...prev,
            state: 'LISTENING',
            score: 0,
          }))
          addLogEntry({
            level: 'SAFE',
            reason: 'Alarm cancelled by user.',
            transcript: message.reason || '',
          })
          showToast('SOS cancelled', 'warning')
        }

        if (message.type === 'sos_sent') {
          setAlarm(null)
          setSosResult(message.notification)
          setSessionStats(prev => ({
            ...prev,
            state: 'SOS_SENT',
          }))
          addLogEntry({
            level: message.notification?.success ? 'DANGER' : 'SUSPICIOUS',
            reason: message.notification?.success
              ? 'SOS sent to emergency contacts.'
              : 'SOS attempted, but SMS delivery did not succeed.',
            transcript: '',
          })
          showToast(
            message.notification?.success ? 'SOS sent to emergency contacts' : 'SOS attempted, SMS failed',
            message.notification?.success ? 'success' : 'error'
          )
        }

        if (message.type === 'sos_error') {
          setAlarm(null)
          showToast(message.message || 'SOS failed', 'error')
        }

        if (message.type === 'error') {
          showToast(message.message || 'Realtime session error', 'error')
        }
      } catch (err) {
        console.log('WebSocket message parse error:', err)
      }
    }

    ws.onerror = () => {
      setWsStatus('error')
      showToast('Realtime connection failed', 'error')
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      locationIntervalRef.current = null
      pingIntervalRef.current = null
    }

    return ws
  }, [addLogEntry, getCurrentLocation, sendWsJson, showToast])

  const setupVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      mediaStreamRef.current = stream

      const canvas = canvasRef.current
      if (!canvas) return stream

      const ctx = canvas.getContext('2d')
      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2

      const draw = () => {
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyser.getByteFrequencyData(dataArray)

        ctx.fillStyle = 'rgba(10, 10, 26, 0.3)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const barWidth = (canvas.width / bufferLength) * 2.5
        let x = 0
        const colors = {
          SAFE: 'rgba(16, 185, 129, 0.65)',
          SUSPICIOUS: 'rgba(245, 158, 11, 0.65)',
          DANGER: 'rgba(239, 68, 68, 0.65)',
        }

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.8
          ctx.fillStyle = colors[threatLevel] || colors.SAFE
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
          x += barWidth + 1
        }

        animationRef.current = requestAnimationFrame(draw)
      }

      draw()
      return stream
    } catch (err) {
      console.error('Microphone access error:', err)
      showToast('Microphone access required for Shield Mode', 'error')
      return null
    }
  }, [threatLevel, showToast])

  const startAudioStreaming = useCallback((stream) => {
    if (!stream || !window.MediaRecorder) {
      showToast('Audio streaming not supported in this browser', 'warning')
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = async (event) => {
      const ws = websocketRef.current
      if (!event.data.size || !ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(await event.data.arrayBuffer())
    }
    recorder.onerror = () => showToast('Audio stream error', 'error')
    recorder.start(1000)
    mediaRecorderRef.current = recorder
  }, [showToast])

  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser', 'warning')
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let transcript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }

      setCurrentTranscript(transcript)

      const text = (finalTranscript || transcript).trim()
      if (text) {
        sendWsJson({
          type: 'transcript',
          text,
          is_final: Boolean(finalTranscript),
        })
      }
    }

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error)
      if ((event.error === 'no-speech' || event.error === 'aborted') && activeRef.current) {
        try { recognition.start() } catch (e) { /* ignore restart races */ }
      }
    }

    recognition.onend = () => {
      if (activeRef.current) {
        try { recognition.start() } catch (e) { /* ignore restart races */ }
      }
    }

    recognitionRef.current = recognition
    return recognition
  }, [sendWsJson, showToast])

  const cleanupRealtime = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch (e) { /* ignore */ }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch (e) { /* ignore */ }
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) { /* ignore */ }
    }
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
    if (websocketRef.current) websocketRef.current.close()

    animationRef.current = null
    mediaRecorderRef.current = null
    mediaStreamRef.current = null
    audioContextRef.current = null
    recognitionRef.current = null
    websocketRef.current = null
    locationIntervalRef.current = null
    pingIntervalRef.current = null
  }, [])

  const activateShield = async () => {
    activeRef.current = true
    setActive(true)
    setThreatLevel('SAFE')
    setSessionStats({ sessionId: null, chunks: 0, bytes: 0, lastLocationAt: null, state: 'LISTENING', score: 0, transcripts: 0 })
    showToast('Shield Mode activated', 'success')

    connectRealtimeSession()

    const stream = await setupVisualizer()
    if (stream) {
      startAudioStreaming(stream)
    }

    const recognition = setupSpeechRecognition()
    if (recognition) {
      recognition.start()
      setListening(true)
    }
  }

  const deactivateShield = () => {
    if (alarm?.active) {
      sendWsJson({
        type: 'cancel_sos',
        reason: 'Shield Mode stopped by user',
      })
    }
    activeRef.current = false
    setActive(false)
    setListening(false)
    setThreatLevel('SAFE')
    setCurrentTranscript('')
    setAlarm(null)
    cleanupRealtime()
    showToast('Shield Mode deactivated', 'warning')
  }

  const cancelSos = () => {
    sendWsJson({
      type: 'cancel_sos',
      reason: 'User marked safe from Shield Mode',
    })
  }

  useEffect(() => cleanupRealtime, [cleanupRealtime])

  useEffect(() => {
    let lastMagnitude = 0
    const SHAKE_THRESHOLD = 25

    const handleMotion = (event) => {
      const { x, y, z } = event.accelerationIncludingGravity || {}
      if (x == null) return

      const magnitude = Math.sqrt(x * x + y * y + z * z)
      const delta = Math.abs(magnitude - lastMagnitude)
      lastMagnitude = magnitude

      if (delta > SHAKE_THRESHOLD) {
        triggerEmergency('shake')
      }
    }

    if (!(typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function')) {
      window.addEventListener('devicemotion', handleMotion)
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [triggerEmergency])

  return (
    <div className="page-content page-enter shield-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>Back</button>
        <h2>Shield Mode</h2>
      </div>

      <div className="shield-btn-container">
        <button
          className={`shield-btn ${active ? 'active' : ''}`}
          onClick={active ? deactivateShield : activateShield}
        >
          <span className="shield-icon">{active ? 'REC' : 'SHIELD'}</span>
          {active ? 'STOP' : 'ACTIVATE'}
        </button>
      </div>

      <p className="text-secondary" style={{ marginBottom: '20px' }}>
        {active
          ? `Listening via realtime session (${wsStatus})`
          : 'Tap to start audio monitoring'}
      </p>

      {active && (
        <>
          <div className="waveform-container">
            <canvas ref={canvasRef} />
          </div>

          <div className={`threat-indicator ${threatLevel.toLowerCase()}`}>
            {threatLevel === 'SAFE' && 'Environment is SAFE'}
            {threatLevel === 'SUSPICIOUS' && 'SUSPICIOUS activity detected'}
            {threatLevel === 'DANGER' && 'DANGER detected'}
          </div>

          {alarm?.active && (
            <div className="glass-card-static" style={{ marginBottom: '16px', textAlign: 'center', borderColor: 'rgba(239, 68, 68, 0.5)' }}>
              <h3 style={{ color: '#EF4444', marginBottom: '8px' }}>Emergency Detected</h3>
              <p style={{ marginBottom: '12px' }}>
                SOS will be sent in <strong>{alarm.remaining}</strong> seconds.
              </p>
              <button className="btn btn-primary" onClick={cancelSos}>
                I am safe - Cancel SOS
              </button>
            </div>
          )}

          {sosResult && (
            <div className="glass-card-static" style={{ marginBottom: '16px', textAlign: 'left' }}>
              <p style={{ fontWeight: 700, marginBottom: '6px' }}>
                {sosResult.success ? 'SOS sent' : 'SOS attempted'}
              </p>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                SMS success: {sosResult.success ? 'yes' : 'no'}
              </p>
              {sosResult.maps_link && (
                <a href={sosResult.maps_link} target="_blank" rel="noreferrer">
                  Open location
                </a>
              )}
            </div>
          )}

          <div className="glass-card-static" style={{ marginBottom: '16px', textAlign: 'left' }}>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>
              Realtime Session
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
              <span>Status: {wsStatus}</span>
              <span>Chunks: {sessionStats.chunks}</span>
              <span>Bytes: {sessionStats.bytes}</span>
              <span>GPS: {sessionStats.lastLocationAt || 'pending'}</span>
              <span>State: {sessionStats.state}</span>
              <span>Score: {sessionStats.score}</span>
              <span>Texts: {sessionStats.transcripts}</span>
            </div>
          </div>

          {currentTranscript && (
            <div className="glass-card-static" style={{ marginBottom: '16px', textAlign: 'left' }}>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                Live Transcript
              </p>
              <p style={{ fontSize: '0.85rem' }}>{currentTranscript}</p>
            </div>
          )}

          <div className="analysis-log">
            <h4 style={{ marginBottom: '8px', textAlign: 'left' }}>Realtime Log</h4>
            {analysisLog.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                Waiting for realtime events...
              </p>
            ) : (
              analysisLog.map((entry, i) => (
                <div key={i} className={`analysis-entry ${entry.level.toLowerCase()}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{entry.level}</span>
                    <span className="text-muted">{entry.timestamp}</span>
                  </div>
                  <p>{entry.reason}</p>
                  {entry.transcript && (
                    <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      "{entry.transcript}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!active && (
        <div style={{ marginTop: '20px' }}>
          <div className="glass-card-static" style={{ marginBottom: '12px' }}>
            <h4>How it works</h4>
            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.8' }}>
              <li>Tap ACTIVATE to start listening</li>
              <li>Audio, transcript, and GPS stream to the backend</li>
              <li>Keywords are fast path signals, and context still goes to the LLM</li>
              <li>Emergency contacts are alerted after confirmation</li>
            </ol>
          </div>

          <div className="glass-card-static">
            <h4>Shake Detection</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              Motion detection is always active. If your phone is shaken violently,
              an emergency check will trigger automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
