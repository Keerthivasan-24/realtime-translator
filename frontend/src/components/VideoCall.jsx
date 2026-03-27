import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useWebRTC } from '../hooks/useWebRTC'
import { useAudioStream } from '../hooks/useAudioStream'
import Subtitles from './Subtitles'
import PostCallSummary from './PostCallSummary'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export default function VideoCall({ roomId, srcLang, tgtLang, onLeave }) {
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const wsRef = useRef(null)

  const [subtitle, setSubtitle] = useState(null)
  const [status, setStatus] = useState('Connecting...')
  const [muted, setMuted] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const onRemoteStream = useCallback((stream) => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
    setStatus('Connected')
  }, [])

  const { createOffer, handleOffer, handleAnswer, handleIceCandidate, hangup } =
    useWebRTC({ wsRef, localStreamRef, onRemoteStream })

  const { start: startAudio, stop: stopAudio } =
    useAudioStream({ wsRef, srcLang, tgtLang })

  useEffect(() => {
    let ws

    const init = async () => {
      // 1. Get local media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      // 2. Start streaming audio to backend for STT/translation
      await startAudio(stream)

      // 3. Connect signaling WebSocket
      ws = new WebSocket(`${WS_URL}/ws/${roomId}`)
      wsRef.current = ws

      ws.onopen = () => setStatus('Waiting for peer...')

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case 'joined':
            // Second peer to join initiates the offer
            if (msg.shouldInitiate) {
              setStatus('Peer found, connecting...')
              await createOffer()
            }
            break
          case 'peer_joined':
            setStatus('Peer joined, waiting for offer...')
            break
          case 'offer':
            await handleOffer(msg.sdp)
            break
          case 'answer':
            await handleAnswer(msg.sdp)
            break
          case 'ice-candidate':
            await handleIceCandidate(msg.candidate)
            break
          case 'subtitle':
            setSubtitle({ original: msg.original, translated: msg.translated })
            // Clear subtitle after 4 seconds
            setTimeout(() => setSubtitle(null), 4000)
            break
          case 'peer_left':
            setStatus('Peer disconnected')
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
            break
          case 'error':
            setStatus(`Error: ${msg.message}`)
            break
        }
      }

      ws.onclose = () => setStatus('Disconnected')
    }

    init().catch(err => setStatus(`Error: ${err.message}`))

    return () => {
      stopAudio()
      hangup()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      ws?.close()
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setMuted(!audioTrack.enabled)
    }
  }

  const leave = () => {
    stopAudio()
    hangup()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    wsRef.current?.close()
    setShowSummary(true)
  }

  return (
    <div style={styles.container}>
      {/* Post-call summary modal */}
      {showSummary && (
        <PostCallSummary
          roomId={roomId}
          onClose={onLeave}
        />
      )}
      {/* Status bar */}
      <div style={styles.statusBar}>
        <span style={styles.roomLabel}>Room: {roomId}</span>
        <span style={styles.status}>{status}</span>
        <span style={styles.langs}>{srcLang.toUpperCase()} → {tgtLang.toUpperCase()}</span>
      </div>

      {/* Video grid */}
      <div style={styles.videoGrid}>
        {/* Remote video (large) */}
        <div style={styles.remoteWrapper}>
          <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
          <Subtitles subtitle={subtitle} />
          {!remoteVideoRef.current?.srcObject && (
            <div style={styles.placeholder}>Waiting for peer...</div>
          )}
        </div>

        {/* Local video (PiP) */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={styles.localVideo}
        />
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.ctrlBtn} onClick={toggleMute}>
          {muted ? '🔇 Unmute' : '🎤 Mute'}
        </button>
        <button style={{ ...styles.ctrlBtn, background: '#dc2626' }} onClick={leave}>
          📵 Leave
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f' },
  statusBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 16px', background: '#1a1a1a', fontSize: 13,
  },
  roomLabel: { color: '#888' },
  status: { color: '#4ade80', fontWeight: 600 },
  langs: { color: '#818cf8', fontWeight: 600 },
  videoGrid: { flex: 1, position: 'relative', overflow: 'hidden' },
  remoteWrapper: { position: 'relative', width: '100%', height: '100%' },
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover', background: '#111' },
  placeholder: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: '#555', fontSize: 18,
  },
  localVideo: {
    position: 'absolute', bottom: 80, right: 16,
    width: 180, height: 120, borderRadius: 10,
    objectFit: 'cover', border: '2px solid #333', background: '#111',
  },
  controls: {
    display: 'flex', justifyContent: 'center', gap: 16,
    padding: '12px', background: '#1a1a1a',
  },
  ctrlBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#374151', color: '#fff', fontSize: 14,
    cursor: 'pointer', fontWeight: 600,
  },
}
