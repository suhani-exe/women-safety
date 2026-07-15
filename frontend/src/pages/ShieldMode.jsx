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

  // --- Upload / Record state ---
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptBufferRef = useRef('')
  const analysisIntervalRef = useRef(null)

  // --- Upload / Record refs ---
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const fileInputRef = useRef(null)
  const recordStreamRef = useRef(null)

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

  // ============================================
  // Audio Recording (MediaRecorder API)
  // ============================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream

      // Prefer webm (Gemini supports it), fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        setRecordedBlob(blob)
        // Stop all tracks to release mic
        stream.getTracks().forEach(t => t.stop())
        recordStreamRef.current = null
      }

      mediaRecorderRef.current = recorder
      recorder.start(250) // collect data in 250ms chunks
      setRecording(true)
      setRecordingTime(0)
      setUploadResult(null)
      setRecordedBlob(null)
      setSelectedFile(null)

      // Timer for display
      recordTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      showToast('🎙️ Recording started...', 'success')
    } catch (err) {
      console.error('Recording error:', err)
      showToast('Could not access microphone', 'error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    showToast('Recording saved! Tap "Analyze" to check for threats.', 'success')
  }

  const discardRecording = () => {
    setRecordedBlob(null)
    setUploadResult(null)
    setRecordingTime(0)
  }

  // ============================================
  // File Pick
  // ============================================

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      showToast('Please select an audio file', 'error')
      return
    }
    setSelectedFile(file)
    setRecordedBlob(null)
    setUploadResult(null)
    showToast(`Selected: ${file.name}`, 'success')
  }

  // ============================================
  // Upload & Analyze
  // ============================================

  const analyzeAudio = async () => {
    const audioSource = recordedBlob || selectedFile
    if (!audioSource) {
      showToast('No audio to analyze — record or pick a file first', 'warning')
      return
    }

    setUploadingAudio(true)
    setUploadResult(null)

    try {
      // Get location
      let lat = null, lng = null
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (e) { /* optional */ }

      const formData = new FormData()

      if (recordedBlob) {
        // Determine file extension from MIME type
        const ext = recordedBlob.type.includes('webm') ? 'webm' : recordedBlob.type.includes('mp4') ? 'mp4' : 'wav'
        formData.append('audio', recordedBlob, `recording.${ext}`)
      } else {
        formData.append('audio', selectedFile)
      }

      if (lat != null) formData.append('latitude', lat)
      if (lng != null) formData.append('longitude', lng)

      const data = await apiFetch('/api/audio/upload', {
        method: 'POST',
        body: formData,
        // Note: apiFetch already skips Content-Type for FormData
      })

      setUploadResult(data.analysis)

      if (data.analysis?.threat_level === 'DANGER') {
        triggerEmergency('audio')
      }

      showToast(
        data.analysis?.threat_level === 'SAFE'
          ? '✅ Audio analyzed — no threats detected'
          : data.analysis?.threat_level === 'DANGER'
            ? '🚨 DANGER detected in audio!'
            : '⚠️ Suspicious content detected',
        data.analysis?.threat_level === 'SAFE' ? 'success' : 'error'
      )
    } catch (err) {
      console.error('Upload analysis error:', err)
      showToast(`Analysis failed: ${err.message}`, 'error')
    } finally {
      setUploadingAudio(false)
    }
  }

  // Format recording time as MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
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
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch(e) {}
      }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach(t => t.stop())
      }
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
      {/* Page Header */}
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Go back">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '2px' }}>AI Protection</span>
          <h2 style={{ lineHeight: 1.1 }}>Shield Mode</h2>
        </div>
      </div>

      {/* Shield Button */}
      <div className="shield-btn-container">
        <button
          className={`shield-btn ${active ? 'active' : ''}`}
          onClick={active ? deactivateShield : activateShield}
          aria-label={active ? 'Deactivate Shield Mode' : 'Activate Shield Mode'}
        >
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l7 4v5c0 4.97-3.13 9.28-7 11-3.87-1.72-7-6.03-7-11V6l7-4z" />
          </svg>
          <span>{active ? 'STOP' : 'ACTIVATE'}</span>
        </button>
      </div>

      <p style={{ marginBottom: '22px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.06em', color: active ? 'var(--emerald)' : 'var(--muted-foreground)', textAlign: 'center', textTransform: 'uppercase' }}>
        {active ? '● Listening and analyzing...' : 'Tap to start AI-powered monitoring'}
      </p>

      {/* Waveform & Analysis (active only) */}
      {active && (
        <>
          <div className="waveform-container">
            <canvas ref={canvasRef} aria-hidden="true" />
          </div>

          {/* Threat Indicator */}
          <div className={`threat-indicator ${threatLevel.toLowerCase()}`} role="status">
            {threatLevel === 'SAFE' && 'Environment is SAFE'}
            {threatLevel === 'SUSPICIOUS' && 'SUSPICIOUS activity detected'}
            {threatLevel === 'DANGER' && 'DANGER detected!'}
          </div>

          {/* Current Transcript */}
          {currentTranscript && (
            <div className="glass-card-static" style={{ marginBottom: '14px', textAlign: 'left' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--muted-foreground)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Live Transcript
              </p>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{currentTranscript}</p>
            </div>
          )}

          {/* Analysis Log */}
          <div className="analysis-log">
            <span className="eyebrow" style={{ display: 'block', marginBottom: '10px', textAlign: 'left' }}>Analysis Log</span>
            {analysisLog.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                Waiting for speech...
              </p>
            ) : (
              analysisLog.map((entry, i) => (
                <div key={i} className={`analysis-entry ${entry.level.toLowerCase()}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{entry.level}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--muted-foreground)' }}>{entry.timestamp}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem' }}>{entry.reason}</p>
                  {entry.transcript && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                      &ldquo;{entry.transcript}&rdquo;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Upload & Record — always visible */}
      <div className="upload-section" style={{ marginTop: '28px' }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>Upload &amp; Analyze</span>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
          Record a clip or pick an audio file &mdash; AI will check for threats.
        </p>

        {/* Record / Stop */}
        <div className="upload-actions">
          {!recording ? (
            <button id="shield-record-btn" className="btn btn-primary" onClick={startRecording} disabled={uploadingAudio} style={{ flex: 1 }}>
              Record Audio
            </button>
          ) : (
            <button id="shield-stop-btn" className="btn btn-danger" onClick={stopRecording} style={{ flex: 1 }}>
              Stop ({formatTime(recordingTime)})
            </button>
          )}

          <button
            id="shield-pick-file-btn"
            className="btn btn-outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={recording || uploadingAudio}
            style={{ flex: 1 }}
          >
            Pick File
          </button>

          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>

        {/* Recording indicator */}
        {recording && (
          <div className="recording-indicator" role="status" aria-live="polite">
            <span className="rec-dot" aria-hidden="true" />
            Recording&hellip; {formatTime(recordingTime)}
          </div>
        )}

        {/* Audio preview */}
        {(recordedBlob || selectedFile) && !recording && (
          <div className="audio-pending glass-card-static" style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {recordedBlob ? `Recorded clip (${formatTime(recordingTime)})` : selectedFile?.name}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => { discardRecording(); setSelectedFile(null) }} aria-label="Discard recording">
                &times;
              </button>
            </div>

            {recordedBlob && <audio controls src={URL.createObjectURL(recordedBlob)} style={{ width: '100%', marginBottom: '10px' }} />}
            {selectedFile && <audio controls src={URL.createObjectURL(selectedFile)} style={{ width: '100%', marginBottom: '10px' }} />}

            <button id="shield-analyze-btn" className="btn btn-primary btn-full" onClick={analyzeAudio} disabled={uploadingAudio}>
              {uploadingAudio ? (
                <><span className="spin" aria-hidden="true">⏳</span> Analyzing with AI&hellip;</>
              ) : 'Analyze for Threats'}
            </button>
          </div>
        )}

        {/* Upload result */}
        {uploadResult && (
          <div className={`upload-result glass-card-static threat-indicator ${uploadResult.threat_level?.toLowerCase()}`} style={{ marginTop: '14px', textAlign: 'left' }} role="alert">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {uploadResult.threat_level}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>
                {Math.round((uploadResult.confidence || 0) * 100)}% confidence
              </span>
            </div>

            {uploadResult.transcript && (
              <div style={{ marginBottom: '8px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--muted-foreground)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Transcript</p>
                <p style={{ fontSize: '0.83rem', fontStyle: 'italic' }}>&ldquo;{uploadResult.transcript}&rdquo;</p>
              </div>
            )}
            <div style={{ marginBottom: '8px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--muted-foreground)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Reason</p>
              <p style={{ fontSize: '0.83rem' }}>{uploadResult.reason}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: 'var(--muted-foreground)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recommended Action</p>
              <p style={{ fontSize: '0.83rem', fontWeight: 600 }}>{uploadResult.recommended_action}</p>
            </div>
          </div>
        )}
      </div>

      {/* How it works — inactive only */}
      {!active && (
        <div style={{ marginTop: '22px' }}>
          <div className="glass-card-static" style={{ marginBottom: '10px' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '10px' }}>How it works</span>
            <ol style={{ paddingLeft: '18px', color: 'var(--muted-foreground)', fontSize: '0.82rem', lineHeight: '1.85', fontFamily: 'var(--font-sans)' }}>
              <li>Tap <strong style={{ color: 'var(--foreground)' }}>ACTIVATE</strong> to start listening</li>
              <li>Audio is transcribed and analyzed every 5 seconds</li>
              <li>AI detects threats in real-time</li>
              <li>Alarm sounds if danger is detected</li>
              <li>Emergency contacts are alerted automatically</li>
            </ol>
          </div>

          <div className="glass-card-static" style={{ marginBottom: '10px' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Upload Audio</span>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', lineHeight: 1.65 }}>
              Record a clip or select an existing audio file. The AI will listen and check for threats, harassment, or danger.
            </p>
          </div>

          <div className="glass-card-static">
            <span className="eyebrow" style={{ display: 'block', marginBottom: '8px' }}>Shake Detection</span>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', lineHeight: 1.65 }}>
              Motion detection is always active. A violent shake triggers an emergency check automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
