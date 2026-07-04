import { useNavigate } from 'react-router-dom'

export default function Hub() {
  const navigate = useNavigate()

  const resources = {
    helplines: [
      { icon: '🚔', title: 'Police Emergency', desc: 'Dial 100 for immediate police assistance', link: 'tel:100' },
      { icon: '👩', title: 'Women Helpline', desc: 'National Commission for Women — 1091', link: 'tel:1091' },
      { icon: '🚑', title: 'Ambulance', desc: 'Emergency medical services — 102', link: 'tel:102' },
      { icon: '👧', title: 'Child Helpline', desc: 'For children in distress — 1098', link: 'tel:1098' },
      { icon: '🆘', title: 'National Emergency', desc: 'Single emergency number — 112', link: 'tel:112' },
    ],
    selfDefense: [
      { icon: '🥋', title: 'Basic Self-Defense Moves', desc: 'Simple techniques everyone should know', link: 'https://www.youtube.com/results?search_query=basic+self+defense+for+women' },
      { icon: '🦵', title: 'Escape from Grabs', desc: 'How to break free from common holds', link: 'https://www.youtube.com/results?search_query=self+defense+escape+grabs' },
      { icon: '💪', title: 'Situational Awareness', desc: 'How to stay alert and avoid danger', link: 'https://www.youtube.com/results?search_query=situational+awareness+women+safety' },
    ],
    legalRights: [
      { icon: '⚖️', title: 'Protection of Women from Domestic Violence Act', desc: 'Know your rights under DV Act 2005', link: 'https://wcd.nic.in/act/protection-women-domestic-violence-act-2005' },
      { icon: '📋', title: 'Sexual Harassment at Workplace Act', desc: 'POSH Act 2013 — workplace safety', link: 'https://wcd.nic.in/act/sexual-harassment-women-workplace-prevention-prohibition-and-redressal-act-2013' },
      { icon: '🏛️', title: 'How to File an FIR', desc: 'Step-by-step guide to filing a police complaint', link: 'https://www.google.com/search?q=how+to+file+FIR+in+India+women' },
      { icon: '📱', title: 'Cyber Crime Reporting', desc: 'Report online harassment at cybercrime.gov.in', link: 'https://cybercrime.gov.in/' },
    ],
    financial: [
      { icon: '💰', title: 'Pradhan Mantri Jan Dhan Yojana', desc: 'Free bank accounts & financial inclusion', link: 'https://pmjdy.gov.in/' },
      { icon: '📊', title: 'Mudra Loan Scheme', desc: 'Loans up to ₹10 lakh for women entrepreneurs', link: 'https://www.mudra.org.in/' },
      { icon: '🎓', title: 'Stand Up India', desc: 'Bank loans for SC/ST and women entrepreneurs', link: 'https://www.standupmitra.in/' },
      { icon: '👩‍💼', title: 'Skill India', desc: 'Free skill development programs', link: 'https://www.skillindia.gov.in/' },
    ],
  }

  return (
    <div className="page-content page-enter">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>←</button>
        <h2>Empowerment Hub</h2>
      </div>

      <p className="text-secondary" style={{ marginBottom: '24px', fontSize: '0.85rem' }}>
        Resources for safety, legal rights, financial inclusion, and skill development.
      </p>

      {/* Helplines */}
      <div className="hub-category">
        <h3>📞 Emergency Helplines</h3>
        {resources.helplines.map((item, i) => (
          <a key={i} href={item.link} className="resource-card">
            <span className="resource-icon">{item.icon}</span>
            <div>
              <div className="resource-title">{item.title}</div>
              <div className="resource-desc">{item.desc}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Self Defense */}
      <div className="hub-category">
        <h3>🥋 Self-Defense</h3>
        {resources.selfDefense.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="resource-card">
            <span className="resource-icon">{item.icon}</span>
            <div>
              <div className="resource-title">{item.title}</div>
              <div className="resource-desc">{item.desc}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Legal Rights */}
      <div className="hub-category">
        <h3>⚖️ Know Your Legal Rights</h3>
        {resources.legalRights.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="resource-card">
            <span className="resource-icon">{item.icon}</span>
            <div>
              <div className="resource-title">{item.title}</div>
              <div className="resource-desc">{item.desc}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Financial Empowerment */}
      <div className="hub-category">
        <h3>💰 Financial Empowerment</h3>
        {resources.financial.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="resource-card">
            <span className="resource-icon">{item.icon}</span>
            <div>
              <div className="resource-title">{item.title}</div>
              <div className="resource-desc">{item.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
