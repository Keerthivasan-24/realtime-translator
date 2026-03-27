import React from 'react'

const CARDS = [
  {
    id: 'conversation',
    icon: '💬',
    title: 'Conversation Mode',
    desc: 'Two-person real-time translated conversation',
    color: '#2dd4bf',
  },
  {
    id: 'meeting',
    icon: '👥',
    title: 'Meeting Interpreter',
    desc: 'Multi-speaker detection with live subtitles',
    color: '#818cf8',
  },
  {
    id: 'video',
    icon: '🎥',
    title: 'Video Call',
    desc: 'Peer-to-peer video with translated subtitles',
    color: '#f472b6',
  },
]

export default function HomeScreen({ onNavigate }) {
  return (
    <div style={styles.screen}>
      {/* Logo */}
      <div style={styles.logoWrap}>
        <div style={styles.logoIcon}>文A</div>
      </div>

      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>
          <span style={styles.grad}>Realtime</span> Translator
        </h1>
        <p style={styles.heroSub}>AI-powered live translation for every conversation</p>
      </div>

      <div style={styles.cards}>
        {CARDS.map(card => (
          <button key={card.id} style={styles.card} onClick={() => onNavigate(card.id)}>
            <div style={{ ...styles.cardIcon, background: card.color + '22', color: card.color }}>
              {card.icon}
            </div>
            <div style={styles.cardText}>
              <p style={styles.cardTitle}>{card.title}</p>
              <p style={styles.cardDesc}>{card.desc}</p>
            </div>
            <span style={styles.arrow}>›</span>
          </button>
        ))}
      </div>

      <div style={styles.badge}>
        <span style={styles.badgeDot} />
        AI pipeline ready
      </div>
    </div>
  )
}

const styles = {
  screen: {
    flex: 1, overflowY: 'auto', padding: '32px 20px 16px',
    display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center',
  },
  logoWrap: { display: 'flex', justifyContent: 'center' },
  logoIcon: {
    width: 56, height: 56, borderRadius: 16,
    background: 'linear-gradient(135deg,#2dd4bf,#818cf8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 800, color: '#fff',
  },
  hero: { textAlign: 'center' },
  heroTitle: { fontSize: 28, fontWeight: 800, marginBottom: 8 },
  grad: { background: 'linear-gradient(90deg,#2dd4bf,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroSub: { color: '#6b7280', fontSize: 14 },
  cards: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#13131f', borderRadius: 14, padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
    textAlign: 'left', transition: 'border 0.2s',
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  cardText: { flex: 1 },
  cardTitle: { fontWeight: 700, fontSize: 14, color: '#e5e7eb', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#6b7280' },
  arrow: { color: '#4b5563', fontSize: 20 },
  badge: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: '#4b5563',
  },
  badgeDot: { width: 7, height: 7, borderRadius: '50%', background: '#4ade80' },
}
