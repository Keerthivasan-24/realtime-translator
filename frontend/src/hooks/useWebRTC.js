/**
 * useWebRTC — manages the RTCPeerConnection lifecycle.
 * The signaling channel (ws) is passed in from the parent.
 */
import { useRef, useCallback } from 'react'

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export function useWebRTC({ wsRef, localStreamRef, onRemoteStream }) {
  const pcRef = useRef(null)

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    // Add local tracks to the connection
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current)
    })

    // When we get a remote track, surface it to the UI
    pc.ontrack = (event) => {
      onRemoteStream(event.streams[0])
    }

    // Forward ICE candidates to the other peer via signaling WS
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
        }))
      }
    }

    return pc
  }, [wsRef, localStreamRef, onRemoteStream])

  const createOffer = useCallback(async () => {
    const pc = createPeer()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    wsRef.current?.send(JSON.stringify({ type: 'offer', sdp: offer }))
  }, [createPeer, wsRef])

  const handleOffer = useCallback(async (sdp) => {
    const pc = createPeer()
    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    wsRef.current?.send(JSON.stringify({ type: 'answer', sdp: answer }))
  }, [createPeer, wsRef])

  const handleAnswer = useCallback(async (sdp) => {
    await pcRef.current?.setRemoteDescription(new RTCSessionDescription(sdp))
  }, [])

  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (e) {
      console.warn('ICE candidate error', e)
    }
  }, [])

  const hangup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  return { createOffer, handleOffer, handleAnswer, handleIceCandidate, hangup }
}
