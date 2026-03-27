import React, { useState } from 'react'

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
]

export default function RoomJoin({ onJoin }) {
  const [roomId, setRoomId] = useState('')
  const [srcLang, setSrcLang] = useState('en')
  const [tgtLang, setTgtLang] = useState('es')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (roomId.trim()) onJoin(roomId.trim(), srcLang, tgtLang)
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Realtime Translator</h1>
      <p style={styles.sub}>Live video call with AI-powered subtitles</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          placeholder="Room ID (share with your peer)"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          required
        />
        <div style={styles.row}>
          <label style={styles.label}>
            I speak
            <select style={styles.select} value={srcLang} onChange={e => setSrcLang(e.target.value)}>
              {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          <span style={{ color: '#888' }}>→</span>
          <label style={styles.label}>
            Translate to
            <select style={styles.select} value={tgtLang} onChange={e => setTgtLang(e.target.value)}>
              {LANG_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <button style={styles.btn} type="submit">Join Call</button>
      </form>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100vh', gap: 16,
  },
  title: { fontSize: 32, fontWeight: 700 },
  sub: { color: '#888', marginBottom: 8 },
  form: { display: 'flex', flexDirection: 'column', gap: 12, width: 340 },
  input: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #333',
    background: '#1a1a1a', color: '#fff', fontSize: 15,
  },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#aaa', flex: 1 },
  select: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #333',
    background: '#1a1a1a', color: '#fff', fontSize: 14,
  },
  btn: {
    padding: '12px', borderRadius: 8, border: 'none',
    background: '#4f46e5', color: '#fff', fontSize: 16,
    cursor: 'pointer', fontWeight: 600,
  },
}
