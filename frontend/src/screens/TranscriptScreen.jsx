import React, { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TranscriptScreen() {
  const [roomId,     setRoomId]     = useState('')
  const [entries,    setEntries]    = useState(null)
  const [summary,    setSummary]    = useState(null)
  const [actions,    setActions]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  const load = async () => {
    if (!roomId.trim()) return
    setLoading(true); setError(null)
    try {
      const [t, s] = await Promise.all([
        fetch(`${API}/transcript/${roomId}`).then(r => r.json()),
        fetch(`${API}/summary/${roomId}`).then(r => r.json()),
      ])
      setEntries(t.entries || [])
      setSummary(s.summary)
      setActions(s.action_items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const download = async (fmt) => {
    const resp = await fetch(`${API}/export/${roomId}/${fmt}`)
    const blob = await resp.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `transcript-${roomId}.${fmt}`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}><span style={styles.grad}>Transcript</span> Logs</h1>
        <p style={styles.sub}>Load any past session by room ID</p>
      </div>

      <div style={styles.searchRow}>
        <input
          style={styles.input}
          placeholder="Enter room ID..."
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <button style={styles.loadBtn} onClick={load} disabled={loading}>
          {loading ? '...' : 'Load'}
        </button>
      </div>

      {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

      {entries !== null && (
        <>
          {summary && (
            <div style={styles.card}>
              <p style={styles.cardLabel}>Summary</p>
              <p style={styles.cardText}>{summary}</p>
            </div>
          )}

          {actions.length > 0 && (
            <div style={styles.card}>
              <p style={styles.cardLabel}>Action Items</p>
              {actions.map((a, i) => (
                <p key={i} style={styles.actionItem}>✓ {a}</p>
              ))}
            </div>
          )}

          <div style={styles.card}>
            <p style={styles.cardLabel}>Transcript ({entries.length} entries)</p>
            <div style={styles.entryList}>
              {entries.map((e, i) => (
                <div key={i} style={styles.entry}>
                  <span style={styles.entryMeta}>[{e.timestamp}] {e.speaker}</span>
                  <p style={styles.entryText}>{e.text}</p>
                  {e.translated !== e.text && <p style={styles.entryTrans}>→ {e.translated}</p>}
                </div>
              ))}
            </div>
          </div>

          <div style={styles.exportRow}>
            <button style={styles.exportBtn} onClick={() => download('txt')}>⬇ TXT</button>
            <button style={styles.exportBtn} onClick={() => download('pdf')}>⬇ PDF</button>
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  screen: { flex: 1, overflowY: 'auto', padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { textAlign: 'center' },
  title: { fontSize: 26, fontWeight: 800, marginBottom: 6 },
  grad: { background: 'linear-gradient(90deg,#2dd4bf,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b7280', fontSize: 13 },
  searchRow: { display: 'flex', gap: 8 },
  input: { flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#13131f', color: '#fff', fontSize: 14 },
  loadBtn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  card: { background: '#13131f', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 },
  cardLabel: { fontSize: 11, color: '#2dd4bf', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardText: { fontSize: 14, color: '#e5e7eb', lineHeight: 1.6 },
  actionItem: { fontSize: 13, color: '#e5e7eb' },
  entryList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' },
  entry: { borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 },
  entryMeta: { fontSize: 10, color: '#4b5563' },
  entryText: { fontSize: 13, color: '#e5e7eb', marginTop: 2 },
  entryTrans: { fontSize: 12, color: '#818cf8', marginTop: 2 },
  exportRow: { display: 'flex', gap: 8 },
  exportBtn: { flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#1e1e2e', color: '#e5e7eb', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
}
