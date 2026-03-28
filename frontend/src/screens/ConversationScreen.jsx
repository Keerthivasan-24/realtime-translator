import React, { useState, useRef, useEffect } from 'react'
import LangSelect from '../components/LangSelect'
import { getLang } from '../config/languages'

const WS_URL  = import.meta.env.VITE_WS_URL  || 'ws://localhost:8000'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CHUNK_MS = 2500

export default function ConversationScreen() {
  const [langA, setLangA]         = useState('en')
  const [langB, setLangB]         = useState('ta')
  const [speakingA, setSpeakingA] = useState(false)
  const [speakingB, setSpeakingB] = useState(false)
  const [messages, setMessages]   = useState([])
  const [wsStatus, setWsStatus]   = useState('connecting')

  // Stable room per session
  const roomId   = useRef('conv-' + Math.random().toString(36).slice(2, 7)).current
  const wsRef    = useRef(null)
  const audioRef = useRef({})
  const bufRef   = useRef({ A: [], B: [] })
  const msgEnd   = useRef(null)

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${roomId}`)
    wsRef.current = ws
    ws.onopen  = () => setWsStatus('connected')
    ws.onclose = () => setWsStatus('disconnected')
    // In conversation mode we handle results locally, but keep WS for signaling
    return () => ws.close()
  }, [roomId])

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Audio helpers ──────────────────────────────────────────────────────────
  const addMessage = (who, original, translated) => {
    setMessages(prev => [...prev, {
      who,
      original,
      translated,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }].slice(-100))
  }

  const sendChunk = async (who, srcLang, tgtLang) => {
    const buf = bufRef.current[who]
    if (!buf?.length) return
    const total  = buf.reduce((s, c) => s + c.length, 0)
    const merged = new Int16Array(total)
    let off = 0
    for (const c of buf) { merged.set(c, off); off += c.length }
    bufRef.current[who] = []

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const pair   = `${srcLang}-${tgtLang}`.slice(0, 5).padEnd(5, ' ')
    const header = new TextEncoder().encode(pair)
    const pcm    = new Uint8Array(merged.buffer)
    const pkt    = new Uint8Array(header.length + pcm.length)
    pkt.set(header, 0); pkt.set(pcm, header.length)
    wsRef.current.send(pkt.buffer)
  }

  const startSpeaker = async (who) => {
    const srcLang = who === 'A' ? langA : langB
    const tgtLang = who === 'A' ? langB : langA

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx    = new AudioContext({ sampleRate: 16000 })
    const source = ctx.createMediaStreamSource(stream)
    const proc   = ctx.createScriptProcessor(4096, 1, 1)

    bufRef.current[who] = []
    proc.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0)
      const i16 = new Int16Array(f32.length)
      for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768))
      bufRef.current[who].push(i16)
    }
    source.connect(proc); proc.connect(ctx.destination)

    const interval = setInterval(() => sendChunk(who, srcLang, tgtLang), CHUNK_MS)
    audioRef.current[who] = { proc, source, stream, ctx, interval }

    if (who === 'A') setSpeakingA(true); else setSpeakingB(true)
  }

  const stopSpeaker = (who) => {
    const r = audioRef.current[who]
    if (!r) return
    clearInterval(r.interval)
    r.proc.disconnect(); r.source.disconnect()
    r.stream.getTracks().forEach(t => t.stop())
    r.ctx.close()
    delete audioRef.current[who]
    if (who === 'A') setSpeakingA(false); else setSpeakingB(false)
  }

  const toggleSpeaker = (who) => {
    const active = who === 'A' ? speakingA : speakingB
    if (!active) {
      stopSpeaker(who === 'A' ? 'B' : 'A') // only one at a time
      startSpeaker(who)
    } else {
      stopSpeaker(who)
    }
  }

  // Listen for subtitle events from backend (sent back to same connection)
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    const handler = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'subtitle') {
          // Determine who spoke based on speaker label
          addMessage(msg.speaker === 'A' ? 'A' : 'B', msg.original, msg.translated)
        }
      } catch {}
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [wsRef.current])

  const swapLangs = () => { setLangA(langB); setLangB(langA) }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}><span style={styles.grad}>Conversation</span> Mode</h1>
        <p style={styles.sub}>Two-person real-time translated conversation</p>
        <span style={{ ...styles.badge, background: wsStatus === 'connected' ? '#14532d' : '#1c1917' }}>
          <span style={{ ...styles.dot, background: wsStatus === 'connected' ? '#4ade80' : '#6b7280' }} />
          {wsStatus}
        </span>
      </div>

      {/* Language row */}
      <div style={styles.langRow}>
        <div style={styles.langCol}>
          <p style={styles.langLabel}>Speaker A</p>
          <LangSelect value={langA} onChange={setLangA} />
        </div>
        <button style={styles.swapBtn} onClick={swapLangs}>⇄</button>
        <div style={styles.langCol}>
          <p style={styles.langLabel}>Speaker B</p>
          <LangSelect value={langB} onChange={setLangB} />
        </div>
      </div>

      {/* Mic cards */}
      <div style={styles.micRow}>
        <MicCard label="Speaker A" lang={langA.toUpperCase()} speaking={speakingA} onToggle={() => toggleSpeaker('A')} />
        <MicCard label="Speaker B" lang={langB.toUpperCase()} speaking={speakingB} onToggle={() => toggleSpeaker('B')} />
      </div>

      {!speakingA && !speakingB && messages.length === 0 && (
        <p style={styles.hint}>Tap a microphone to start — translated text appears here</p>
      )}

      {/* Chat bubbles */}
      {messages.length > 0 && (
        <div style={styles.chatBox}>
          {messages.map((m, i) => (
            <div key={i} style={{ ...styles.bubble, alignSelf: m.who === 'A' ? 'flex-start' : 'flex-end',
              borderColor: m.who === 'A' ? 'rgba(45,212,191,0.2)' : 'rgba(129,140,248,0.2)' }}>
              <span style={styles.bubbleMeta}>{m.who === 'A' ? `A (${langA.toUpperCase()})` : `B (${langB.toUpperCase()})`} · {m.ts}</span>
              <p style={styles.bubbleTranslated}>{m.translated}</p>
              <p style={styles.bubbleOriginal}>{m.original}</p>
            </div>
          ))}
          <div ref={msgEnd} />
        </div>
      )}
    </div>
  )
}

function MicCard({ label, lang, speaking, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      ...cardStyles.card,
      border: speaking ? '1.5px solid #2dd4bf' : '1px solid rgba(255,255,255,0.08)',
      background: speaking ? 'rgba(45,212,191,0.08)' : '#13131f',
    }}>
      <div style={{
        ...cardStyles.circle,
        background: speaking ? 'rgba(45,212,191,0.18)' : 'rgba(255,255,255,0.06)',
        boxShadow: speaking ? '0 0 0 10px rgba(45,212,191,0.08), 0 0 0 20px rgba(45,212,191,0.04)' : 'none',
        transition: 'all 0.4s ease',
      }}>
        <span style={{ fontSize: 28 }}>{speaking ? '🎙️' : '🔇'}</span>
      </div>
      <p style={cardStyles.label}>{label}</p>
      <p style={cardStyles.lang}>{lang}</p>
      {speaking && <p style={cardStyles.listening}>Listening...</p>}
    </button>
  )
}

const cardStyles = {
  card: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 12px', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s' },
  circle: { width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: 700, fontSize: 14, color: '#e5e7eb' },
  lang: { fontSize: 12, color: '#6b7280' },
  listening: { fontSize: 11, color: '#2dd4bf', fontWeight: 600 },
}

const styles = {
  screen: { flex: 1, overflowY: 'auto', padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  title: { fontSize: 24, fontWeight: 800, marginBottom: 2 },
  grad: { background: 'linear-gradient(90deg,#2dd4bf,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b7280', fontSize: 13 },
  badge: { display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: '50%' },
  langRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  langCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  langLabel: { fontSize: 11, color: '#6b7280' },
  swapBtn: { background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', color: '#2dd4bf', borderRadius: 10, padding: '10px 10px', cursor: 'pointer', fontSize: 16, marginBottom: 2 },
  micRow: { display: 'flex', gap: 10 },
  hint: { textAlign: 'center', color: '#4b5563', fontSize: 13 },
  chatBox: { display: 'flex', flexDirection: 'column', gap: 8, background: '#0d0d1a', borderRadius: 14, padding: 12, flex: 1, minHeight: 120, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)' },
  bubble: { maxWidth: '82%', background: '#13131f', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3, border: '1px solid' },
  bubbleMeta: { fontSize: 10, color: '#4b5563' },
  bubbleTranslated: { fontSize: 14, color: '#e5e7eb' },
  bubbleOriginal: { fontSize: 11, color: '#6b7280' },
}
