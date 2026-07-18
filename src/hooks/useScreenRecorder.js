import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORDING_SECONDS = 5 * 60

// Preferred container/codec combos, most-preferred first.
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
]

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

/**
 * Records the user's screen (via getDisplayMedia) with a hard duration cap.
 * Produces a File once stopped. Handles user-initiated "Stop sharing", the
 * duration limit, and cleanup.
 *
 * Returns:
 *  - supported: whether the browser supports screen recording
 *  - status: 'idle' | 'recording' | 'stopped' | 'error'
 *  - error, elapsed (s), maxDuration (s)
 *  - stream (live MediaStream while recording), recordedFile, previewUrl
 *  - start(), stop(), reset()
 */
export function useScreenRecorder({ maxDuration = MAX_RECORDING_SECONDS } = {}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [stream, setStream] = useState(null)
  const [recordedFile, setRecordedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const startedAtRef = useRef(0)
  const previewUrlRef = useRef('')

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined'

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopStreamTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setStream(null)
  }

  const stop = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop() // triggers onstop which builds the file
    }
  }, [])

  const start = useCallback(async () => {
    setError('')
    if (!supported) {
      setError('Screen recording is not supported in this browser. Try the latest Chrome, Edge or Firefox.')
      setStatus('error')
      return
    }

    // Clear any previous recording.
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
      setPreviewUrl('')
    }
    setRecordedFile(null)
    setElapsed(0)
    chunksRef.current = []

    let displayStream
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      })
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setError('Screen sharing was cancelled or denied. Please allow screen sharing to record.')
      } else {
        setError(err?.message || 'Could not start screen sharing.')
      }
      setStatus('idle')
      return
    }

    streamRef.current = displayStream
    setStream(displayStream)

    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = new MediaRecorder(displayStream, mimeType ? { mimeType } : undefined)
    } catch {
      setError('Recording is not supported for the selected screen source.')
      stopStreamTracks()
      setStatus('error')
      return
    }
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const type = mimeType || 'video/webm'
      const blob = new Blob(chunksRef.current, { type })
      const ext = type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([blob], `submission-${Date.now()}.${ext}`, { type })
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreviewUrl(url)
      setRecordedFile(file)
      setStatus('stopped')
      stopStreamTracks()
    }

    // If the user stops sharing from the browser's own control, end recording.
    const [videoTrack] = displayStream.getVideoTracks()
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => stop())
    }

    recorder.start(1000)
    startedAtRef.current = Date.now()
    setStatus('recording')

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsed(secs)
      if (secs >= maxDuration) stop()
    }, 250)
  }, [supported, maxDuration, stop])

  const reset = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    recorderRef.current = null
    stopStreamTracks()
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }
    chunksRef.current = []
    setPreviewUrl('')
    setRecordedFile(null)
    setElapsed(0)
    setError('')
    setStatus('idle')
  }, [])

  // Cleanup on unmount.
  useEffect(
    () => () => {
      clearTimer()
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    },
    [],
  )

  return {
    supported,
    status,
    error,
    elapsed,
    maxDuration,
    stream,
    recordedFile,
    previewUrl,
    start,
    stop,
    reset,
  }
}
