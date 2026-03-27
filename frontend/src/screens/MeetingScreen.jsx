import React, { useState, useRef, useEffect } from 'react'
import LangSelect from '../components/LangSelect'
import { getLang } from '../config/languages'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
const MAX_SPEAKERS = 6

const initSpeaker = (n) => ({ id: n, label: `Speaker ${n}`, lang: n === 1 ? 'en' : 'es', speaking: false })

export default function MeetingScreen() {
  const [targetLang, setTargetLang]   = useState('en')
  const [speakers, setSpeakers]       = useState([initSpeaker(1), initSpeaker(2)])
  const [subtitles, setSubtitles]     = useState([]) // { speakerId, original, translated, ts }
  const [roomId]                      = useState(() => 'meeting-' + Math.random().toString(36).slice(2, 7))

  const wsRef        = useRef(null)
  const audioCtxRef  = useRef(null)
  const processorRef = useRef({})   // speakerId → ScriptProcessor
  const intervalRef  = useRef({})   // speakerId → interval
  const bufferRef    = useRef({})   // speakerId → Int16Array[]
  const subtitleEnd  = useRef(null)

  // Connect WS once
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws/${roomId}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'subtitle') {
        setSubtitles(prev => {
          const next = [...prev, {
            speakerId: msg.speaker,
            original: msg.original,
            translated: msg.translated,
            ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }]
          return next.slice(-50) // keep last 50
        })
      }
    }
    return () => ws.close()
  }, [roomId])

  // Scroll subtitles to bottom
  useEffect(() => {
    subtitleEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [subtitles])

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 })
    }
    return audioCtxRef.current
  }

  const startSpeaking = async (speakerId, srcLang) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx    = getAudioCtx()
    const source = ctx.createMediaStreamSource(stream)
    const proc   = ctx.createScriptProcessor(4096, 1, 1)

    bufferRef.current[speakerId] = []
    proc.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0)
      const i16 = new Int16Array(f32.length)
      for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768))
      bufferRef.current[speakerId].push(i16)
    }
    source.connect(proc)
    proc.connect(ctx.destination)
    processorRef.current[speakerId] = { proc, source, stream }

    // Send chunks every 500ms
    intervalRef.current[speakerId] = setInterval(() => {
      const buf = bufferRef.current[speakerId]
      if (!buf?.length || wsRef.current?.readyState !== WebSocket.OPEN) return
      const total  = buf.reduce((s, c) => s + c.length, 0)
      const merged = new Int16Array(total)
      let off = 0
      for (const c of buf) { merged.set(c, off); off += c.length }
      bufferRef.current[speakerId] = []

      const langPair   = `${srcLang}-${targetLang}`.slice(0, 5).padEnd(5, ' ')
      const header     = new TextEncoder().encode(langPair)
      const pcm        = new Uint8Array(merged.buffer)
      const packet     = new Uint8Array(header.length + pcm.length)
      packet.set(header, 0); packet.set(pcm, header.length)
      wsRef.current.send(packet.buffer)
    }, 500)

    setSpeakers(prev => prev.map(s => s.id === speakerId ? { ...s, speaking: true } : s))
  }

  const stopSpeaking = (speakerId) => {
    clearInterval(intervalRef.current[speakerId])
    const p = processorRef.current[speakerId]
    if (p) { p.proc.disconnect(); p.source.disconnect(); p.stream.getTracks().forEach(t => t.stop()) }
    delete processorRef.current[speakerId]
    setSpeakers(prev => prev.map(s => s.id === speakerId ? { ...s, speaking: false } : s))
  }

  const toggleSpeak = (speaker) => {
    if (speaker.speaking) stopSpeaking(speaker.id)
    else startSpeaking(speaker.id, speaker.lang)
  }

  const addSpeaker = () => {
    if (speakers.length >= MAX_SPEAKERS) return
    const id = speakers.length + 1
    setSpeakers(prev => [...prev, initSpeaker(id)])
  }

  const removeSpeaker = (id) => {
    stopSpeaking(id)
    setSpeakers(prev => prev.filter(s => s.id !== id))
  }

  const setLang = (id, lang) => setSpeakers(prev => prev.map(s => s.id === id ? { ...s, lang } : s))

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}><span style={styles.grad}>Meeting</span> Interpreter</h1>
        <p style={styles.sub}>Multi-speaker detection with live subtitles</p>
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
              style={{ ...styles.speakBtn, background: sp.speaking ? '#0f766e' : '#1e1e2e', border: sp.speaking ? '1px solid #2dd4bf' : '1px solid rgba(255,255,255,0.08)' }}
              onClick={() => toggleSpeak(sp)}
            >
              <span style={{ fontSize: 18 }}>{sp.speaking ? '🎙️' : '🔇'}</span>
              {sp.speaking ? 'Speaking...' : 'Speak'}
            </button>
          </div>
        ))}

        {/* Add speaker */}
        {speakers.length < MAX_SPEAKERS && (
          <button style={styles.addBtn} onClick={addSpeaker}>
            <span style={{ fontSize: 22 }}>+</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Add Speaker</span>
          </button>
        )}
      </div>

      {/* Live subtitles */}
      {subtitles.length > 0 && (
        <div style={styles.subtitleBox}>
          {subtitles.map((s, i) => (
            <div key={i} style={styles.subtitleEntry}>
              <span style={styles.subtitleMeta}>{s.ts} · {s.speakerId}</span>
              <p style={styles.subtitleTranslated}>{s.translated}</p>
              <p style={styles.subtitleOriginal}>{s.original}</p>
            </div>
          ))}
          <div ref={subtitleEnd} />
        </div>
      )}
    </div>
  )
}

const styles = {
  screen: { flex: 1, overflowY: 'auto', padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 20 },
  header: { textAlign: 'center' },
  title: { fontSize: 26, fontWeight: 800, marginBottom: 6 },
  grad: { background: 'linear-gradient(90deg,#2dd4bf,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b7280', fontSize: 13 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  speakerList: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#13131f', borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid rgba(255,255,255,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: 700, fontSize: 15 },
  removeBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14 },
  speakBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '10px', borderRadius: 10, cursor: 'pointer',
    color: '#e5e7eb', fontSize: 14, fontWeight: 600,
    transition: 'background 0.2s, border 0.2s',
  },
  addBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '16px', borderRadius: 14, cursor: 'pointer',
    background: 'transparent', border: '1px dashed rgba(255,255,255,0.12)', color: '#6b7280',
  },
  subtitleBox: {
    background: '#0d0d1a', borderRadius: 12, padding: 14,
    maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  subtitleEntry: { borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 },
  subtitleMeta: { fontSize: 10, color: '#4b5563' },
  subtitleTranslated: { fontSize: 14, color: '#e5e7eb', marginTop: 2 },
  subtitleOriginal: { fontSize: 11, color: '#6b7280', marginTop: 2 },
}
