import { useState, useEffect, useCallback } from 'react'
import { apiFetch, useToast } from '../App'

export default function EmergencyPopup({ type, onOk }) {
  const [countdown, setCountdown] = useState(15)
  const [triggered, setTriggered] = useState(false)
  const [emergencyData, setEmergencyData] = useState(null)
  const [alarmAudio, setAlarmAudio] = useState(null)
  const [notifyPolice, setNotifyPolice] = useState(false)  // User's choice — optional
  const { showToast } = useToast()

  // Play alarm sound (disguised as phone alarm)
  useEffect(() => {
    // Create a simple alarm tone using Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime)
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)

    // Make it sound like a phone alarm (beep pattern)
    const interval = setInterval(() => {
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
      setTimeout(() => {
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
      }, 400)
    }, 800)

    oscillator.start()

    setAlarmAudio({ audioCtx, oscillator, interval })

    return () => {
      clearInterval(interval)
      oscillator.stop()
      audioCtx.close()
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0 && !triggered) {
      handleNotOk()
      return
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, triggered])

  // Stop alarm
  const stopAlarm = useCallback(() => {
    if (alarmAudio) {
      clearInterval(alarmAudio.interval)
      alarmAudio.oscillator.stop()
      alarmAudio.audioCtx.close()
    }
  }, [alarmAudio])

  // User pressed "I'm OK"
  const handleOk = () => {
    stopAlarm()
    showToast("Glad you're safe! 💚", 'success')
    onOk()
  }

  // User pressed "Not OK" or countdown expired
  const handleNotOk = async () => {
    if (triggered) return
    setTriggered(true)
    stopAlarm()

    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        })
      })

      const { latitude, longitude } = position.coords

      // Trigger emergency protocol — SMS contacts is done server-side.
      // notify_police is the user's explicit choice.
      const data = await apiFetch('/api/emergency/trigger', {
        method: 'POST',
        body: JSON.stringify({
          latitude,
          longitude,
          type,
          notify_police: notifyPolice,
        }),
      })

      setEmergencyData(data)

      // Count how many SMS were actually delivered
      const sent = (data.sms_results || []).filter(r => r.sms_sent).length
      const total = (data.sms_results || []).length

      if (total === 0) {
        showToast('🚨 Emergency logged! Add contacts to auto-notify.', 'error')
      } else if (sent === total) {
        showToast(`🚨 SOS! SMS sent to all ${total} contacts!`, 'error')
      } else {
        showToast(`🚨 SOS! SMS sent to ${sent}/${total} contacts.`, 'error')
      }

      // Try to vibrate the phone
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500])
      }
    } catch (err) {
      console.error('Emergency trigger error:', err)
      // Even if API fails, show emergency UI with manual options
      setEmergencyData({
        contacts: [],
        sms_results: [],
        emergency_numbers: [
          { name: 'Police (India)', phone: '100', tel_link: 'tel:100' },
          { name: 'Women Helpline', phone: '1091', tel_link: 'tel:1091' },
          { name: 'Emergency (US)', phone: '911', tel_link: 'tel:911' },
        ],
        sos_message: 'EMERGENCY! I need help!',
      })
      showToast('⚠️ API error — use manual contacts below!', 'error')
    }
  }

  // Emergency triggered - show contact list
  if (triggered && emergencyData) {
    // Build a map of sms_results by phone for quick lookup
    const smsMap = {}
    for (const r of (emergencyData.sms_results || [])) {
      smsMap[r.phone] = r
    }

    return (
      <div className="emergency-overlay">
        <div className="emergency-modal" style={{ maxWidth: '420px' }}>
          <div className="emergency-icon">🚨</div>
          <h2>Emergency Activated</h2>
          <p className="text-secondary" style={{ marginBottom: '20px' }}>
            Alerting your contacts and emergency services
          </p>

          {/* Emergency Numbers */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px', textAlign: 'left' }}>🚔 Emergency Services</h4>
            {emergencyData.emergency_numbers?.map((num, i) => (
              <a
                key={i}
                href={num.tel_link}
                className="emergency-contact-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="contact-info">
                  <div className="contact-name">{num.name}</div>
                  <div className="contact-phone">{num.phone}</div>
                </div>
                <div className="contact-actions">
                  <span className="call-btn">📞</span>
                </div>
              </a>
            ))}
          </div>

          {/* Personal Contacts */}
          {emergencyData.contacts?.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px', textAlign: 'left' }}>👥 Your Contacts</h4>
              {emergencyData.contacts.map((contact, i) => {
                const sms = smsMap[contact.phone]
                return (
                  <div key={i} className="emergency-contact-card">
                    <div className="contact-info">
                      <div className="contact-name">{contact.name}</div>
                      <div className="contact-phone">{contact.phone}</div>
                      {/* SMS delivery status */}
                      {sms && (
                        <div style={{ fontSize: '0.72rem', marginTop: '2px', color: sms.sms_sent ? '#10B981' : '#F59E0B' }}>
                          {sms.sms_sent ? '✅ SMS delivered' : `⚠️ SMS failed — ${sms.sms_error || 'configure Twilio'}`}
                        </div>
                      )}
                    </div>
                    <div className="contact-actions">
                      <a href={contact.tel_link} className="call-btn" title="Call">📞</a>
                      <a href={contact.whatsapp_link} target="_blank" rel="noopener" className="whatsapp-btn" title="WhatsApp">💬</a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {emergencyData.contacts?.length === 0 && (
            <div className="glass-card-static" style={{ marginBottom: '16px', padding: '10px 16px' }}>
              <p style={{ fontSize: '0.82rem', color: '#F59E0B' }}>
                ⚠️ No emergency contacts saved. Go to Contacts to add them.
              </p>
            </div>
          )}

          <button className="btn btn-safe btn-full" onClick={onOk} style={{ marginTop: '12px' }}>
            ✅ I'm Safe Now — Cancel Emergency
          </button>
        </div>
      </div>
    )
  }

  // Countdown phase
  const progress = (countdown / 15) * 100

  return (
    <div className="emergency-overlay">
      <div className="emergency-modal">
        <div className="emergency-icon">⚠️</div>
        <h2>Are You Okay?</h2>
        <p className="text-secondary">
          {type === 'shake' ? 'Sudden motion detected!' :
           type === 'audio' ? 'Potential threat detected in audio!' :
           'Safety check triggered'}
        </p>

        <div className="countdown">{countdown}</div>

        <div className="countdown-bar">
          <div
            className="countdown-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.8rem' }}>
          Emergency will be triggered automatically if no response
        </p>

        {/* Optional police notification toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            marginBottom: '20px',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            justifyContent: 'center',
          }}
        >
          <input
            type="checkbox"
            id="notify-police-toggle"
            checked={notifyPolice}
            onChange={e => setNotifyPolice(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Also notify police (optional)
        </label>

        <button className="btn btn-safe btn-ok" onClick={handleOk}>
          ✅ I'm Okay!
        </button>

        <button className="btn btn-danger btn-not-ok" onClick={handleNotOk}>
          🚨 I Need Help!
        </button>
      </div>
    </div>
  )
}

