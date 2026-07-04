import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useEmergency, useToast } from '../App'

export default function ShieldMode() {
  const navigate = useNavigate()
  const { triggerEmergency } = useEmergency()
  const { showToast } = useToast()

  const [active, setActive] = useState(false)
  const [threatLevel, setThreatLevel] = useState('SAFE')
  const [analysisLog, setAnalysisLog] = useState([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [listening, setListening] = useState(false)

  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptBufferRef = useRef('')
  const analysisIntervalRef = useRef(null)

  // Setup audio visualizer
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

      // Draw waveform
      const canvas = canvasRef.current
      if (!canvas) return
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

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.8

          // Color based on threat level
          const colors = {
            SAFE: `rgba(16, 185, 129, ${0.4 + dataArray[i] / 400})`,
            SUSPICIOUS: `rgba(245, 158, 11, ${0.4 + dataArray[i] / 400})`,
            DANGER: `rgba(239, 68, 68, ${0.4 + dataArray[i] / 400})`,
          }

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

  // Setup Web Speech API for transcription
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
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setCurrentTranscript(transcript)
      transcriptBufferRef.current = transcript
    }

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error)
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Restart recognition
        try { recognition.start() } catch (e) { /* ignore */ }
      }
    }

    recognition.onend = () => {
      // Auto-restart if still active
      if (active) {
        try { recognition.start() } catch (e) { /* ignore */ }
      }
    }

    recognitionRef.current = recognition
    return recognition
  }, [active, showToast])

  // Analyze transcript with AI every 5 seconds
  const startAnalysis = useCallback(() => {
    analysisIntervalRef.current = setInterval(async () => {
      const transcript = transcriptBufferRef.current
      if (!transcript || transcript.trim() === '') return

      try {
        // Get location for context
        let lat = null, lng = null
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
          )
          lat = pos.coords.latitude
          lng = pos.coords.longitude
        } catch (e) { /* location optional */ }

        const data = await apiFetch('/api/audio/analyze', {
          method: 'POST',
          body: JSON.stringify({
            transcript,
            latitude: lat,
            longitude: lng,
          }),
        })

        const analysis = data.analysis
        setThreatLevel(analysis.threat_level)

        setAnalysisLog(prev => [
          {
            timestamp: new Date().toLocaleTimeString(),
            level: analysis.threat_level,
            reason: analysis.reason,
            transcript: transcript.substring(0, 100),
          },
          ...prev.slice(0, 19), // Keep last 20
        ])

        // If DANGER, trigger emergency
        if (analysis.threat_level === 'DANGER') {
          triggerEmergency('audio')
        }

        // Clear buffer for next analysis
        transcriptBufferRef.current = ''
      } catch (err) {
        console.error('Analysis error:', err)
      }
    }, 5000) // Every 5 seconds
  }, [triggerEmergency])

  // Activate Shield Mode
  const activateShield = async () => {
    setActive(true)
    setThreatLevel('SAFE')
    showToast('🛡️ Shield Mode activated!', 'success')

    // Setup audio visualizer
    await setupVisualizer()

    // Setup speech recognition
    const recognition = setupSpeechRecognition()
    if (recognition) {
      recognition.start()
      setListening(true)
    }

    // Start AI analysis
    startAnalysis()
  }

  // Deactivate Shield Mode
  const deactivateShield = () => {
    setActive(false)
    setListening(false)
    setThreatLevel('SAFE')
    setCurrentTranscript('')

    // Cleanup
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (audioContextRef.current) audioContextRef.current.close()
    if (recognitionRef.current) recognitionRef.current.stop()
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current)

    showToast('Shield Mode deactivated', 'warning')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (audioContextRef.current) {
        try { audioContextRef.current.close() } catch(e) {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch(e) {}
      }
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current)
    }
  }, [])

  // Setup shake detection
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

    // Request permission on iOS
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      // Will need user gesture to request permission
    } else {
      window.addEventListener('devicemotion', handleMotion)
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [triggerEmergency])

  return (
    <div className="page-content page-enter shield-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
        <h2>Shield Mode</h2>
      </div>

      {/* Shield Button */}
      <div className="shield-btn-container">
        <button
          className={`shield-btn ${active ? 'active' : ''}`}
          onClick={active ? deactivateShield : activateShield}
        >
          <span className="shield-icon">{active ? '🔴' : '🛡️'}</span>
          {active ? 'STOP' : 'ACTIVATE'}
        </button>
      </div>

      <p className="text-secondary" style={{ marginBottom: '20px' }}>
        {active
          ? '🟢 Listening and analyzing for threats...'
          : 'Tap to start AI-powered audio monitoring'}
      </p>

      {/* Audio Waveform Visualization */}
      {active && (
        <>
          <div className="waveform-container">
            <canvas ref={canvasRef} />
          </div>

          {/* Threat Level Indicator */}
          <div className={`threat-indicator ${threatLevel.toLowerCase()}`}>
            {threatLevel === 'SAFE' && '✅ Environment is SAFE'}
            {threatLevel === 'SUSPICIOUS' && '⚠️ SUSPICIOUS activity detected'}
            {threatLevel === 'DANGER' && '🚨 DANGER detected!'}
          </div>

          {/* Current Transcript */}
          {currentTranscript && (
            <div className="glass-card-static" style={{ marginBottom: '16px', textAlign: 'left' }}>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                🎤 Live Transcript
              </p>
              <p style={{ fontSize: '0.85rem' }}>{currentTranscript}</p>
            </div>
          )}

          {/* Analysis Log */}
          <div className="analysis-log">
            <h4 style={{ marginBottom: '8px', textAlign: 'left' }}>📊 Analysis Log</h4>
            {analysisLog.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                Waiting for speech to analyze...
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

      {/* Instructions when inactive */}
      {!active && (
        <div style={{ marginTop: '20px' }}>
          <div className="glass-card-static" style={{ marginBottom: '12px' }}>
            <h4>🎙️ How it works</h4>
            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.8' }}>
              <li>Tap <strong>ACTIVATE</strong> to start listening</li>
              <li>Audio is transcribed and analyzed every 5 seconds</li>
              <li>AI detects threats in real-time</li>
              <li>Alarm sounds if danger is detected</li>
              <li>Emergency contacts are alerted automatically</li>
            </ol>
          </div>

          <div className="glass-card-static">
            <h4>📳 Shake Detection</h4>
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
