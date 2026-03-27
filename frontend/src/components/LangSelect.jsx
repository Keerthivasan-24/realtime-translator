import React from 'react'
import { LANGUAGES, getLang } from '../config/languages'

/** Reusable flag + language dropdown */
export default function LangSelect({ value, onChange, style }) {
  const lang = getLang(value)
  return (
    <div style={{ position: 'relative', ...style }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={styles.select}
      >
        {LANGUAGES.map(l => (
          <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
        ))}
      </select>
      {/* overlay label so we can show flag nicely */}
      <div style={styles.overlay} aria-hidden>
        <span style={styles.flag}>{lang.flag}</span>
        <span style={styles.label}>{lang.label}</span>
        <span style={styles.chevron}>▾</span>
      </div>
    </div>
  )
}

const styles = {
  select: {
    position: 'absolute', inset: 0, opacity: 0,
    width: '100%', height: '100%', cursor: 'pointer', zIndex: 2,
  },
  overlay: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: 10,
    background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', userSelect: 'none', pointerEvents: 'none',
  },
  flag: { fontSize: 18 },
  label: { flex: 1, fontSize: 14, fontWeight: 500, color: '#e5e7eb' },
  chevron: { fontSize: 11, color: '#6b7280' },
}
