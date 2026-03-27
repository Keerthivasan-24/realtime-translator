import React from 'react'

const TABS = [
  { id: 'home',         icon: '⌂',  label: 'Home'     },
  { id: 'conversation', icon: '💬', label: 'Convo'    },
  { id: 'meeting',      icon: '👥', label: 'Meeting'  },
  { id: 'video',        icon: '🎥', label: 'Video'    },
  { id: 'transcript',   icon: '📖', label: 'Logs'     },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav style={styles.nav}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            ...styles.btn,
            color: active === tab.id ? '#2dd4bf' : '#6b7280',
          }}
        >
          <span style={{
            ...styles.iconWrap,
            background: active === tab.id ? 'rgba(45,212,191,0.12)' : 'transparent',
            borderRadius: 10,
          }}>
            {tab.icon}
          </span>
          <span style={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    padding: '8px 0 12px',
    background: '#0d0d1a',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  btn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 12px', transition: 'color 0.2s',
  },
  iconWrap: { fontSize: 18, padding: '6px 8px', transition: 'background 0.2s' },
  label: { fontSize: 10, fontWeight: 500 },
}
