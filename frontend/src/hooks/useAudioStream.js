/**
 * useAudioStream — captures mic audio and sends PCM chunks to the backend.
 * Protocol: [5-byte lang header (e.g. "en-es")][raw PCM Int16 bytes]
 */
import { useRef, useCallback } from 'react'

const CHUNK_INTERVAL_MS = 2500  // 2.5s chunks = better sentence completion + fewer API calls
const SAMPLE_RATE = 16000       // Whisper expects 16kHz

export function useAudioStream({ wsRef, srcLang, tgtLang }) {
  const processorRef = useRef(null)
  const contextRef = useRef(null)
  const intervalRef = useRef(null)
  const bufferRef = useRef([])

  const start = useCallback(async (stream) => {
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    contextRef.current = ctx

    const source = ctx.createMediaStreamSource(stream)

    // ScriptProcessor is deprecated but has the widest support.
    // For production, swap to AudioWorklet.
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0)
      // Convert float32 → int16 PCM
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
      }
      bufferRef.current.push(int16)
    }

    source.connect(processor)
    processor.connect(ctx.destination)

    // Flush buffer to backend on interval
    intervalRef.current = setInterval(() => {
      if (!bufferRef.current.length) return
      if (wsRef.current?.readyState !== WebSocket.OPEN) return

      // Merge buffered chunks
      const totalLen = bufferRef.current.reduce((s, c) => s + c.length, 0)
      const merged = new Int16Array(totalLen)
      let offset = 0
      for (const chunk of bufferRef.current) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      bufferRef.current = []

      // Build packet: 5-byte lang header + PCM bytes
      const langHeader = `${srcLang}-${tgtLang}`.slice(0, 5).padEnd(5, ' ')
      const headerBytes = new TextEncoder().encode(langHeader)
      const pcmBytes = new Uint8Array(merged.buffer)
      const packet = new Uint8Array(headerBytes.length + pcmBytes.length)
      packet.set(headerBytes, 0)
      packet.set(pcmBytes, headerBytes.length)

      wsRef.current.send(packet.buffer)
    }, CHUNK_INTERVAL_MS)
  }, [wsRef, srcLang, tgtLang])

  const stop = useCallback(() => {
    clearInterval(intervalRef.current)
    processorRef.current?.disconnect()
    contextRef.current?.close()
    bufferRef.current = []
  }, [])

  return { start, stop }
}
