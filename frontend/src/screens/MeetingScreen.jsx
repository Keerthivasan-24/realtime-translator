import React, { useState, useRef, useEffect } from 'react'
import LangSelect from '../components/LangSelect'

const WS_URL   = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000'
const CHUNK_MS = 2500
const MAX_SPEAKERS = 6

const initSpeaker = (n) => ({ id: n, label: `Speaker ${n}`, lang: n === 1 ? 'en' : 'ta', speaking: false })

export default function MeetingScreen() {
  const [targetLang, setTargetLang] = useState('en')
  const [speakers, setSpeakers]     = useState([initSpeaker(1), initSpeaker(2)])
  const [subtitles, setSubtitles]   = useState([])
  const [wsStatus, setWsStatus]     = useState('connecting')

  const roomId      = useRef('meeting-' + Math.random().toString(36).slice(2, 7)).current
  const wsRef       = useRef(null)
  const procRef     = useRef({})
  const intervalRef = useRef({})
  const bufRef      = useRef({})
  const bottomRef   = useRef(null)

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${roomId}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('connected')
    ws.onclose = () => setWsStatus('disconnected')
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'subtitle') {
          setSubtitles(prev => [...prev, {
            speaker: msg.speaker,
            original: msg.original,
            translated: msg.translated,
            ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }].slice(-60))
        }
      } catch {}
    }
    return () => ws.close()
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [subtitles])

  // ── Audio ──────────────────────────────────────────────────────────────────
  const sendChunk = (speakerId, srcLang) => {
    const buf = bufRef.current[speakerId]
    if (!buf?.length || wsRef.current?.readyState !== WebSocket.OPEN) return
    const total  = buf.reduce((s, c) => s + c.length, 0)
    const merged = new Int16Array(total)
    let off = 0
    for (const c of buf) { merged.set(c, off); off += c.length }
    bufRef.current[speakerId] = []

    const pair   = `${srcLang}-${targetLang}`.slice(0, 5).padEnd(5, ' ')
    const header = new TextEncoder().encode(pair)
    const pcm    = new Uint8Array(merged.buffer)
    const pkt    = new Uint8Array(header.length + pcm.length)
    pkt.set(header, 0); pkt.set(pcm, header.length)
    wsRef.current.send(pkt.buffer)
  }

  const startSpeaking = async (speakerId, srcLang) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx    = new AudioContext({ sampleRate: 16000 })
    const source = ctx.createMediaStreamSource(stream)
    const proc   = ctx.createScriptProcessor(4096, 1, 1)

    bufRef.current[speakerId] = []
    proc.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0)
      const i16 = new Int16Array(f32.length)
      for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768))
      bufRef.current[speakerId].push(i16)
    }
    source.connect(proc); proc.connect(ctx.destination)
    procRef.current[speakerId] = { proc, source, stream, ctx }
    intervalRef.current[speakerId] = setInterval(() => sendChunk(speakerId, srcLang), CHUNK_MS)
    setSpeakers(prev => prev.map(s => s.id === speakerId ? { ...s, speaking: true } : s))
  }

  const stopSpeaking = (speakerId) => {
    clearInterval(intervalRef.current[speakerId])
    const p = procRef.current[speakerId]
    if (p) {
      p.proc.disconnect(); p.source.disconnect()
      p.stream.getTracks().forEach(t => t.stop())
      p.ctx.close()
    }
    delete procRef.current[speakerId]
    setSpeakers(prev => prev.map(s => s.id === speakerId ? { ...s, speaking: false } : s))
  }

  const toggleSpeak = (sp) => {
    if (sp.speaking) stopSpeaking(sp.id)
    else startSpeaking(sp.id, sp.lang)
  }

  const addSpeaker = () => {
    if (speakers.length >= MAX_SPEAKERS) return
    setSpeakers(prev => [...prev, initSpeaker(prev.length + 1)])
  }

  const removeSpeaker = (id) => { stopSpeaking(id); setSpeakers(prev => prev.filter(s => s.id !== id)) }
  const setLang = (id, lang) => setSpeakers(prev => prev.map(s => s.id === id ? { ...s, lang } : s))

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}><span style={styles.grad}>Meeting</span> Interpreter</h1>
        <p style={styles.sub}>Multi-speaker detection with live subtitles</p>
        <span style={{ ...styles.badge, background: wsStatus === 'connected' ? '#14532d' : '#1c1917' }}>
          <span style={{ ...styles.dot, background: wsStatus === 'connected' ? '#4ade80' : '#6b7280' }} />
          {wsStatus}
        </span>
      </div>

      {/* Target language */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>Translate all to</p>
        <LangSelect value={targetLang} onChange={setTargetLang} style={{ width: 200 }} />
      </div>

      {/* Speaker cards */}
      <div style={styles.speakerList}>
        {speakers.map(sp => (
          <div key={sp.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>{sp.label}</span>
              {speakers.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeSpeaker(sp.id)}>✕</button>
              )}
            </div>
            <p style={styles.sectionLabel}>Language</p>
            <LangSelect value={sp.lang} onChange={(v) => setLang(sp.id, v)} />
            <button
              style={{
                ...styles.speakBtn,
                background: sp.speaking ? 'rgba(45,212,191,0.12)' : '#1e1e2e',
                border: sp.speaking ? '1px solid #2dd4bf' : '1px solid rgba(255,255,255,0.08)',
              }}
              onClick={() => toggleSpeak(sp)}
            >
              <span style={{ fontSize: 18 }}>{sp.speaking ? '🎙️' : '🔇'}</span>
              {sp.speaking ? 'Speaking — tap to stop' : 'Tap to Speak'}
            </button>
          </div>
        ))}

        {speakers.length < MAX_SPEAKERS && (
          <button style={styles.addBtn} onClick={addSpeaker}>
            <span style={{ fontSize: 22 }}>+</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Add Speaker</span>
          </button>
        )}
      </div>

      {/* Live subtitles */}
      <div style={styles.subtitleBox}>
        {subtitles.length === 0
          ? <p style={styles.hint}>Translated speech will appear here</p>
          : subtitles.map((s, i) => (
            <div key={i} style={styles.entry}>
              <span style={styles.entryMeta}>{s.ts} · {s.speaker}</span>
              <p style={styles.entryTranslated}>{s.translated}</p>
              <p style={styles.entryOriginal}>{s.original}</p>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

const styles = {
  screen: { flex: 1, overflowY: 'auto', padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  title: { fontSize: 24, fontWeight: 800, marginBottom: 2 },
  grad: { background: 'linear-gradient(90deg,#2dd4bf,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b7280', fontSize: 13 },
  badge: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: '50%' },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: { fontSize: 11, color: '#6b7280' },
  speakerList: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#13131f', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid rgba(255,255,255,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: 700, fontSize: 14 },
  removeBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13 },
  speakBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 10, cursor: 'pointer', color: '#e5e7eb', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' },
  addBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px', borderRadius: 14, cursor: 'pointer', background: 'transparent', border: '1px dashed rgba(255,255,255,0.12)', color: '#6b7280' },
  subtitleBox: { background: '#0d0d1a', borderRadius: 12, padding: 12, minHeight: 100, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid rgba(255,255,255,0.06)' },
  hint: { color: '#4b5563', fontSize: 13, textAlign: 'center', marginTop: 16 },
  entry: { borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 },
  entryMeta: { fontSize: 10, color: '#4b5563' },
  entryTranslated: { fontSize: 14, color: '#e5e7eb', marginTop: 2 },
  entryOriginal: { fontSize: 11, color: '#6b7280', marginTop: 2 },
}
