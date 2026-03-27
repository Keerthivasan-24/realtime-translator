import React, { useState, useRef, useEffect } from 'react'
import LangSelect from '../components/LangSelect'
import { getLang } from '../config/languages'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export default function ConversationScreen() {
  const [langA, setLangA]       = useState('en')
  const [langB, setLangB]       = useState('es')
  const [speakingA, setSpeakingA] = useState(false)
  const [speakingB, setSpeakingB] = useState(false)
  const [messages, setMessages] = useState([])
  const [roomId]                = useState(() => 'conv-' + Math.random().toString(36).slice(2, 7))

  const wsRef       = useRef(null)
  const audioRef    = useRef({}) // { A: {proc,source,stream,interval}, B: ... }
  const bufferRef   = useRef({ A: [], B: [] })
  const msgEnd      = useRef(null)

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${roomId}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'subtitle') {
        setMessages(prev => [...prev, {
          speaker: msg.speaker,
          original: msg.original,
          translated: msg.translated,
          ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }].slice(-100))
      }
    }
    return () => ws.close()
  }, [roomId])

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startSpeaker = async (who) => {
    const srcLang = who === 'A' ? langA : langB
    const tgtLang = who === 'A' ? langB : langA
    const stream  = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx     = new AudioContext({ sampleRate: 16000 })
    const source  = ctx.createMediaStreamSource(stream)
    const proc    = ctx.createScriptProcessor(4096, 1, 1)

    bufferRef.current[who] = []
    proc.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0)
      const i16 = new Int16Array(f32.length)
      for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768))
      bufferRef.current[who].push(i16)
    }
    source.connect(proc); proc.connect(ctx.destination)

    const interval = setInterval(() => {
      const buf = bufferRef.current[who]
      if (!buf?.length || wsRef.current?.readyState !== WebSocket.OPEN) return
      const total  = buf.reduce((s, c) => s + c.length, 0)
      const merged = new Int16Array(total)
      let off = 0
      for (const c of buf) { merged.set(c, off); off += c.length }
      bufferRef.current[who] = []

      const pair   = `${srcLang}-${tgtLang}`.slice(0, 5).padEnd(5, ' ')
      const header = new TextEncoder().encode(pair)
      const pcm    = new Uint8Array(merged.buffer)
      const pkt    = new Uint8Array(header.length + pcm.length)
      pkt.set(header, 0); pkt.set(pcm, header.length)
      wsRef.current.send(pkt.buffer)
    }, 500)

    audioRef.current[who] = { proc, source, stream, ctx, interval }
    if (who === 'A') setSpeakingA(true)
    else setSpeakingB(true)
  }

  const stopSpeaker = (who) => {
    const r = audioRef.current[who]
    if (!r) return
    clearInterval(r.interval)
    r.proc.disconnect(); r.source.disconnect()
    r.stream.getTracks().forEach(t => t.stop())
    r.ctx.close()
    delete audioRef.current[who]
    if (who === 'A') setSpeakingA(false)
    else setSpeakingB(false)
  }

  const toggleSpeaker = (who) => {
    const speaking = who === 'A' ? speakingA : speakingB
    // Only one speaker at a time
    if (!speaking) {
      stopSpeaker(who === 'A' ? 'B' : 'A')
      startSpeaker(who)
    } else {
      stopSpeaker(who)
    }
  }

  const swapLangs = () => { setLangA(langB); setLangB(langA) }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}><span style={styles.grad}>Conversation</span> Mode</h1>
        <p style={styles.sub}>Two-person real-time translated conversation</p>
      </div>

      {/* Language selectors */}
      <div style={styles.langRow}>
        <div style={styles.langCol}>
          <p style={styles.langLabel}>Speaker A</p>
          <LangSelect value={langA} onChange={setLangA} />
        </div>
        <button style={styles.swapBtn} onClick={swapLangs} title="Swap languages">⇄</button>
        <div style={styles.langCol}>
          <p style={styles.langLabel}>Speaker B</p>
          <LangSelect value={langB} onChange={setLangB} />
        </div>
      </div>

      {/* Mic buttons */}
      <div style={styles.micRow}>
        <MicCard
          label="Speaker A"
          lang={getLang(langA).value.toUpperCase()}
          speaking={speakingA}
          onToggle={() => toggleSpeaker('A')}
          align="left"
        />
        <MicCard
          label="Speaker B"
          lang={getLang(langB).value.toUpperCase()}
          speaking={speakingB}
          onToggle={() => toggleSpeaker('B')}
          align="right"
        />
      </div>

      {!speakingA && !speakingB && messages.length === 0 && (
        <p style={styles.hint}>Tap a speaker's microphone to start the conversation</p>
      )}

      {/* Chat-style messages */}
      {messages.length > 0 && (
        <div style={styles.chatBox}>
          {messages.map((m, i) => (
            <div key={i} style={{ ...styles.bubble, alignSelf: m.speaker === 'A' ? 'flex-start' : 'flex-end' }}>
              <span style={styles.bubbleMeta}>{m.speaker} · {m.ts}</span>
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

function MicCard({ label, lang, speaking, onToggle, align }) {
  return (
    <button
      onClick={onToggle}
      style={{
        ...cardStyles.card,
        border: speaking ? '1.5px solid #2dd4bf' : '1px solid rgba(255,255,255,0.08)',
        background: speaking ? 'rgba(45,212,191,0.08)' : '#13131f',
      }}
    >
      <div style={{
        ...cardStyles.micCircle,
        background: speaking ? 'rgba(45,212,191,0.18)' : 'rgba(255,255,255,0.06)',
        boxShadow: speaking ? '0 0 0 8px rgba(45,212,191,0.08)' : 'none',
        transition: 'box-shadow 0.4s ease',
      }}>
        <span style={{ fontSize: 28 }}>{speaking ? '🎙️' : '🔇'}</span>
      </div>
      <p style={cardStyles.label}>{label}</p>
      <p style={cardStyles.lang}>{lang}</p>
    </button>
  )
}

const cardStyles = {
  card: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '24px 12px', borderRadius: 16, cursor: 'pointer',
    transition: 'background 0.2s, border 0.2s',
  },
  micCircle: {
    width: 72, height: 72, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.2s',
  },
  label: { fontWeight: 700, fontSize: 14, color: '#e5e7eb' },
  lang: { fontSize: 12, color: '#6b7280' },
}

const styles = {
  screen: { flex: 1, overflowY: 'auto', padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 20 },
  header: { textAlign: 'center' },
  title: { fontSize: 26, fontWeight: 800, marginBottom: 6 },
  grad: { background: 'linear-gradient(90deg,#2dd4bf,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b7280', fontSize: 13 },
  langRow: { display: 'flex', alignItems: 'flex-end', gap: 10 },
  langCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  langLabel: { fontSize: 12, color: '#6b7280' },
  swapBtn: {
    background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)',
    color: '#2dd4bf', borderRadius: 10, padding: '10px 12px',
    cursor: 'pointer', fontSize: 16, marginBottom: 2,
  },
  micRow: { display: 'flex', gap: 12 },
  hint: { textAlign: 'center', color: '#4b5563', fontSize: 13, marginTop: 8 },
  chatBox: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: '#0d0d1a', borderRadius: 14, padding: 14,
    maxHeight: 260, overflowY: 'auto',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  bubble: {
    maxWidth: '80%', background: '#13131f', borderRadius: 12,
    padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  bubbleMeta: { fontSize: 10, color: '#4b5563' },
  bubbleTranslated: { fontSize: 14, color: '#e5e7eb' },
  bubbleOriginal: { fontSize: 11, color: '#6b7280' },
}
