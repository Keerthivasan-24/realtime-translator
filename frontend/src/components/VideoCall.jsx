import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useWebRTC } from '../hooks/useWebRTC'
import { useAudioStream } from '../hooks/useAudioStream'
import Subtitles from './Subtitles'
import PostCallSummary from './PostCallSummary'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export default function VideoCall({ roomId, srcLang, tgtLang, onLeave }) {
  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const wsRef          = useRef(null)

  const [subtitle,      setSubtitle]      = useState(null)
  const [status,        setStatus]        = useState('Connecting...')
  const [muted,         setMuted]         = useState(false)
  const [showSummary,   setShowSummary]   = useState(false)
  const [showBilingual, setShowBilingual] = useState(true)
  const [walkie,        setWalkie]        = useState(false)
  const [controlsVis,   setControlsVis]  = useState(true)
  const [hasRemote,     setHasRemote]     = useState(false)

  const hideTimer = useRef(null)

  const resetHideTimer = useCallback(() => {
    setControlsVis(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVis(false), 3000)
  }, [])

  useEffect(() => {
    resetHideTimer()
    return () => clearTimeout(hideTimer.current)
  }, [resetHideTimer])

  const onRemoteStream = useCallback((stream) => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
    setHasRemote(true)
    setStatus('Connected')
  }, [])

  const { createOffer, handleOffer, handleAnswer, handleIceCandidate, hangup } =
    useWebRTC({ wsRef, localStreamRef, onRemoteStream })

  const { start: startAudio, stop: stopAudio } =
    useAudioStream({ wsRef, srcLang, tgtLang })

  useEffect(() => {
    let ws
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      await startAudio(stream)

      ws = new WebSocket(`${WS_URL}/ws/${roomId}`)
      wsRef.current = ws
      ws.onopen = () => setStatus('Waiting for peer...')

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'joined':
            if (msg.shouldInitiate) { setStatus('Peer found, connecting...'); await createOffer() }
            break
          case 'peer_joined':
            setStatus('Peer joined, waiting for offer...')
            break
          case 'offer':   await handleOffer(msg.sdp);         break
          case 'answer':  await handleAnswer(msg.sdp);        break
          case 'ice-candidate': await handleIceCandidate(msg.candidate); break
          case 'subtitle':
            setSubtitle({ original: msg.original, translated: msg.translated })
            break
          case 'peer_left':
            setStatus('Peer disconnected')
            setHasRemote(false)
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
            break
          case 'error':
            setStatus(`Error: ${msg.message}`); break
        }
      }
      ws.onclose = () => setStatus('Disconnected')
    }

    init().catch(err => setStatus(`Error: ${err.message}`))
    return () => {
      stopAudio(); hangup()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      ws?.close()
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled) }
  }

  const startWalkie = useCallback(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.volume = 0.08
    setWalkie(true)
  }, [])

  const stopWalkie = useCallback(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.volume = 1
    setWalkie(false)
  }, [])

  const leave = () => {
    stopAudio(); hangup()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    wsRef.current?.close()
    setShowSummary(true)
  }

  const dotColor = status === 'Connected' ? '#4ade80'
    : status.startsWith('Error') ? '#f87171' : '#facc15'

  return (
    <div style={styles.container} onMouseMove={resetHideTimer} onMouseDown={resetHideTimer}>
      {showSummary && <PostCallSummary roomId={roomId} onClose={onLeave} />}

      {/* Status bar */}
      <div style={{
        ...styles.statusBar,
        opacity: controlsVis ? 1 : 0,
        transform: controlsVis ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}>
        <span style={styles.roomLabel}>⬡ {roomId}</span>
        <span style={styles.statusPill}>
          <span style={{ ...styles.dot, background: dotColor }} />
          {status}
        </span>
        <span style={styles.langs}>{srcLang.toUpperCase()} → {tgtLang.toUpperCase()}</span>
      </div>

      {/* Video area */}
      <div style={styles.videoGrid}>
        <div style={styles.remoteWrapper}>
          <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />

          {!hasRemote && (
            <div style={styles.placeholder}>
              <div style={styles.spinnerRing} />
              <span style={{ marginTop: 16, color: '#555' }}>Waiting for peer…</span>
            </div>
          )}

          <Subtitles subtitle={subtitle} showBilingual={showBilingual} />
        </div>

        {/* Local PiP */}
        <video
          ref={localVideoRef}
          autoPlay playsInline muted
          style={{ ...styles.localVideo, opacity: muted ? 0.45 : 1, transition: 'opacity 0.3s ease' }}
        />
      </div>

      {/* Controls bar */}
      <div style={{
        ...styles.controls,
        opacity: controlsVis ? 1 : 0,
        transform: controlsVis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: controlsVis ? 'auto' : 'none',
      }}>
        <CtrlBtn active={muted} activeColor="#dc2626" onClick={toggleMute} title={muted ? 'Unmute mic' : 'Mute mic'}>
          {muted ? '🔇' : '🎤'}<Label>{muted ? 'Unmute' : 'Mute'}</Label>
        </CtrlBtn>

        <CtrlBtn active={showBilingual} activeColor="#4f46e5"
          onClick={() => setShowBilingual(v => !v)} title="Toggle bilingual subtitles">
          🌐<Label>Bilingual</Label>
        </CtrlBtn>

        <CtrlBtn active={walkie} activeColor="#d97706"
          onMouseDown={startWalkie} onMouseUp={stopWalkie} onMouseLeave={stopWalkie}
          onTouchStart={startWalkie} onTouchEnd={stopWalkie}
          title="Hold to duck original audio (hear AI voice)">
          {walkie ? '🔉' : '🔊'}<Label>Hold</Label>
        </CtrlBtn>

        <CtrlBtn forceActive activeColor="#dc2626" onClick={leave} title="Leave call">
          📵<Label>Leave</Label>
        </CtrlBtn>
      </div>
    </div>
  )
}

function CtrlBtn({ children, active, activeColor = '#374151', forceActive, onClick,
                   onMouseDown, onMouseUp, onMouseLeave, onTouchStart, onTouchEnd, title }) {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      title={title}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '10px 20px', borderRadius: 10, border: 'none',
        background: (active || forceActive) ? activeColor : '#1f2937',
        color: '#fff', fontSize: 20, cursor: 'pointer', fontWeight: 600, minWidth: 68,
        transition: 'background 0.2s ease, transform 0.1s ease',
        transform: active ? 'scale(0.95)' : 'scale(1)',
        userSelect: 'none',
      }}
    >
      {children}
    </button>
  )
}

function Label({ children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 }}>
      {children}
    </span>
  )
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#0a0a0a', overflow: 'hidden',
  },
  statusBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 20px', background: 'rgba(15,15,15,0.9)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    fontSize: 13, position: 'relative', zIndex: 10,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  roomLabel: { color: '#6b7280', fontFamily: 'monospace', fontSize: 12 },
  statusPill: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  langs: { color: '#818cf8', fontWeight: 700, fontSize: 13 },
  videoGrid: { flex: 1, position: 'relative', overflow: 'hidden' },
  remoteWrapper: { position: 'relative', width: '100%', height: '100%' },
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover', background: '#0a0a0a' },
  placeholder: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  },
  spinnerRing: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.08)',
    borderTopColor: '#4f46e5',
    animation: 'spin 0.9s linear infinite',
  },
  localVideo: {
    position: 'absolute', bottom: 88, right: 16,
    width: 176, height: 118, borderRadius: 12,
    objectFit: 'cover', border: '2px solid rgba(255,255,255,0.12)',
    background: '#111', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  },
  controls: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
    padding: '14px 20px', background: 'rgba(15,15,15,0.9)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
}
