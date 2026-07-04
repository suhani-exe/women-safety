import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useToast } from '../App'

export default function Contacts() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [contacts, setContacts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState('')

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      const data = await apiFetch('/api/contacts')
      setContacts(data.contacts || [])
    } catch (err) {
      console.error('Load contacts error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    try {
      await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ name, phone, relationship: relationship || null }),
      })
      showToast('Contact added! ✅', 'success')
      setName('')
      setPhone('')
      setRelationship('')
      setShowForm(false)
      loadContacts()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this emergency contact?')) return
    try {
      await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' })
      showToast('Contact removed', 'warning')
      loadContacts()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="page-content page-enter">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
        <h2>Emergency Contacts</h2>
      </div>

      <p className="text-secondary" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
        These people will be alerted during an emergency with your live location.
      </p>

      {/* Add Contact Button */}
      <button
        className="btn btn-primary btn-full"
        onClick={() => setShowForm(!showForm)}
        style={{ marginBottom: '20px' }}
      >
        {showForm ? '✕ Cancel' : '+ Add Emergency Contact'}
      </button>

      {/* Add Contact Form */}
      {showForm && (
        <form className="glass-card-static add-contact-form slide-up" onSubmit={handleAdd} style={{ marginBottom: '20px' }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contact name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Relationship (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Mother, Friend, Brother"
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-safe btn-full">
            ✅ Save Contact
          </button>
        </form>
      )}

      {/* Contacts List */}
      <div className="contacts-list">
        {loading ? (
          <div className="empty-state">
            <div className="spin" style={{ fontSize: '2rem' }}>⏳</div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>No emergency contacts yet</p>
            <p className="text-muted" style={{ marginTop: '4px', fontSize: '0.8rem' }}>
              Add trusted people who will be alerted in emergencies
            </p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="contact-card slide-up">
              <div className="contact-avatar">
                {getInitials(contact.name)}
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-phone">{contact.phone}</div>
                {contact.relationship && (
                  <div className="contact-relationship">{contact.relationship}</div>
                )}
              </div>
              <button className="contact-delete" onClick={() => handleDelete(contact.id)}>
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {/* Default Emergency Numbers Info */}
      <div className="glass-card-static" style={{ marginTop: '24px' }}>
        <h4 style={{ marginBottom: '8px' }}>📞 Default Emergency Numbers</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.8' }}>
          These are always included in emergencies:<br />
          🚔 Police: <strong>100</strong><br />
          👩 Women Helpline: <strong>1091</strong><br />
          🚑 Ambulance: <strong>102</strong>
        </p>
      </div>
    </div>
  )
}
