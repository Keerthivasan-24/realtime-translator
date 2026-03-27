import React, { useState } from 'react'
import LangSelect from '../components/LangSelect'

export default function VideoScreen({ onStartCall }) {
  const [roomId,  setRoomId]  = useState('')
  const [srcLang, setSrcLang] = useState('en')
  const [tgtLang, setTgtLang] = useState('es')

  const join = () => { if (roomId.trim()) onStartCall(roomId.trim(), srcLang, tgtLang) }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}><span style={styles.grad}>Video</span> Call</h1>
        <p style={styles.sub}>Peer-to-peer video with live translated subtitles</p>
      </div>

      <div style={styles.form}>
        <div style={styles.field}>
          <p style={styles.label}>Room ID</p>
          <input
            style={styles.input}
            placeholder="Enter or share a room ID..."
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && join()}
          />
        </div>

        <div style={styles.field}>
          <p style={styles.label}>I speak</p>
          <LangSelect value={srcLang} onChange={setSrcLang} />
        </div>

        <div style={styles.field}>
          <p style={styles.label}>Translate to</p>
          <LangSelect value={tgtLang} onChange={setTgtLang} />
        </div>

        <button style={styles.joinBtn} onClick={join}>
          🎥 Join Video Call
        </button>
      </div>

      <div style={styles.tips}>
        <p style={styles.tipsTitle}>Tips</p>
        <p style={styles.tip}>• Share the same Room ID with your peer</p>
        <p style={styles.tip}>• Both peers pick their own language pair</p>
        <p style={styles.tip}>• Subtitles appear on the other person's screen</p>
        <p style={styles.tip}>• Click Leave to get the AI meeting summary</p>
      </div>
    </div>
  )
}

const styles = {
  screen: { flex: 1, overflowY: 'auto', padding: '32px 20px 16px', display: 'flex', flexDirection: 'column', gap: 24 },
  header: { textAlign: 'center' },
  title: { fontSize: 26, fontWeight: 800, marginBottom: 6 },
  grad: { background: 'linear-gradient(90deg,#f472b6,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b7280', fontSize: 13 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#6b7280' },
  input: { padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#13131f', color: '#fff', fontSize: 14 },
  joinBtn: {
    padding: '14px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    marginTop: 4,
  },
  tips: { background: '#13131f', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  tipsTitle: { fontSize: 12, color: '#2dd4bf', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 },
  tip: { fontSize: 13, color: '#6b7280' },
}
