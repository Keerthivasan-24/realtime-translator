import React, { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function PostCallSummary({ roomId, onClose }) {
  const [data, setData] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(null)

  // Notion/Slack modal state
  const [notionToken, setNotionToken] = useState('')
  const [notionDbId, setNotionDbId] = useState('')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [showNotion, setShowNotion] = useState(false)
  const [showSlack, setShowSlack] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/summary/${roomId}`).then(r => r.json()),
      fetch(`${API}/transcript/${roomId}`).then(r => r.json()),
    ])
      .then(([summaryData, transcriptData]) => {
        setData(summaryData)
        setTranscript(transcriptData.entries || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [roomId])

  const downloadFile = async (format) => {
    setExporting(format)
    try {
      const resp = await fetch(`${API}/export/${roomId}/${format}`)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transcript-${roomId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Export failed: ${e.message}`)
    } finally {
      setExporting(null)
    }
  }

  const exportNotion = async () => {
    setExporting('notion')
    try {
      const resp = await fetch(`${API}/export/${roomId}/notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_token: notionToken, database_id: notionDbId }),
      })
      const { url } = await resp.json()
      window.open(url, '_blank')
      setShowNotion(false)
    } catch (e) {
      alert(`Notion export failed: ${e.message}`)
    } finally {
      setExporting(null)
    }
  }

  const exportSlack = async () => {
    setExporting('slack')
    try {
      await fetch(`${API}/export/${roomId}/slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: slackWebhook }),
      })
      alert('Posted to Slack.')
      setShowSlack(false)
    } catch (e) {
      alert(`Slack export failed: ${e.message}`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Call Summary</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && <p style={styles.muted}>Generating summary...</p>}
        {error && <p style={{ color: '#f87171' }}>Error: {error}</p>}

        {data && (
          <>
            {/* Summary */}
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Summary</h3>
              <p style={styles.summaryText}>{data.summary}</p>
            </section>

            {/* Action Items */}
            {data.action_items?.length > 0 && (
              <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Action Items</h3>
                <ul style={styles.list}>
                  {data.action_items.map((item, i) => (
                    <li key={i} style={styles.listItem}>
                      <span style={styles.bullet}>✓</span> {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Transcript */}
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Transcript ({transcript.length} entries)</h3>
              <div style={styles.transcriptBox}>
                {transcript.map((entry, i) => (
                  <div key={i} style={styles.entry}>
                    <span style={styles.entryMeta}>[{entry.timestamp}] {entry.speaker}</span>
                    <p style={styles.entryText}>{entry.text}</p>
                    {entry.translated && entry.translated !== entry.text && (
                      <p style={styles.entryTranslated}>→ {entry.translated}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Export buttons */}
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Export</h3>
              <div style={styles.exportRow}>
                <button style={styles.exportBtn} onClick={() => downloadFile('txt')} disabled={!!exporting}>
                  {exporting === 'txt' ? '...' : '⬇ TXT'}
                </button>
                <button style={styles.exportBtn} onClick={() => downloadFile('pdf')} disabled={!!exporting}>
                  {exporting === 'pdf' ? '...' : '⬇ PDF'}
                </button>
                <button style={styles.exportBtn} onClick={() => setShowNotion(true)} disabled={!!exporting}>
                  {exporting === 'notion' ? '...' : '📄 Notion'}
                </button>
                <button style={styles.exportBtn} onClick={() => setShowSlack(true)} disabled={!!exporting}>
                  {exporting === 'slack' ? '...' : '💬 Slack'}
                </button>
              </div>
            </section>
          </>
        )}

        {/* Notion modal */}
        {showNotion && (
          <div style={styles.subModal}>
            <h4 style={{ marginBottom: 8 }}>Export to Notion</h4>
            <input style={styles.input} placeholder="Integration Token (secret_...)"
              value={notionToken} onChange={e => setNotionToken(e.target.value)} />
            <input style={styles.input} placeholder="Database ID"
              value={notionDbId} onChange={e => setNotionDbId(e.target.value)} />
            <div style={styles.exportRow}>
              <button style={styles.exportBtn} onClick={exportNotion}>Export</button>
              <button style={{ ...styles.exportBtn, background: '#374151' }} onClick={() => setShowNotion(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Slack modal */}
        {showSlack && (
          <div style={styles.subModal}>
            <h4 style={{ marginBottom: 8 }}>Post to Slack</h4>
            <input style={styles.input} placeholder="Incoming Webhook URL"
              value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} />
            <div style={styles.exportRow}>
              <button style={styles.exportBtn} onClick={exportSlack}>Send</button>
              <button style={{ ...styles.exportBtn, background: '#374151' }} onClick={() => setShowSlack(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#1a1a1a', borderRadius: 12, padding: 24,
    width: '90%', maxWidth: 680, maxHeight: '90vh',
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: 8 },
  summaryText: { color: '#e5e7eb', lineHeight: 1.6, fontSize: 14 },
  list: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  listItem: { display: 'flex', gap: 8, fontSize: 14, color: '#e5e7eb' },
  bullet: { color: '#4ade80', flexShrink: 0 },
  transcriptBox: {
    background: '#111', borderRadius: 8, padding: 12,
    maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
  },
  entry: { borderBottom: '1px solid #222', paddingBottom: 8 },
  entryMeta: { fontSize: 11, color: '#6b7280', fontWeight: 600 },
  entryText: { fontSize: 13, color: '#e5e7eb', marginTop: 2 },
  entryTranslated: { fontSize: 12, color: '#818cf8', marginTop: 2 },
  exportRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  exportBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#4f46e5', color: '#fff', fontSize: 13,
    cursor: 'pointer', fontWeight: 600,
  },
  subModal: {
    background: '#111', borderRadius: 8, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12,
  },
  input: {
    padding: '8px 12px', borderRadius: 6, border: '1px solid #333',
    background: '#1a1a1a', color: '#fff', fontSize: 13, width: '100%',
  },
  muted: { color: '#6b7280', fontSize: 14 },
}
