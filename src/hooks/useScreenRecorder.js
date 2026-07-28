import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORDING_SECONDS = 5 * 60

// Prefer containers that include an Opus audio track for mic narration.
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
 * Build one MediaStream for MediaRecorder.
 * - Video always comes from the screen share.
 * - Voice comes from the microphone (required for narration).
 * - Optional system/tab audio from getDisplayMedia is mixed with the mic when both exist,
 *   because MediaRecorder typically only encodes a single audio track.
 */
async function buildRecordingStream(displayStream, micStream) {
  const mixed = new MediaStream()
  displayStream.getVideoTracks().forEach((track) => mixed.addTrack(track))

  const systemTracks = displayStream.getAudioTracks()
  const micTracks = micStream?.getAudioTracks() || []

  if (!systemTracks.length && !micTracks.length) {
    return { stream: mixed, audioMode: 'none', audioContext: null }
  }

  // Single source — attach directly (cheapest path).
  if (systemTracks.length && !micTracks.length) {
    systemTracks.forEach((track) => mixed.addTrack(track))
    return { stream: mixed, audioMode: 'system', audioContext: null }
  }
  if (micTracks.length && !systemTracks.length) {
    micTracks.forEach((track) => mixed.addTrack(track))
    return { stream: mixed, audioMode: 'mic', audioContext: null }
  }

  // Both present — mix into one track so the recorder keeps voice + tab audio.
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    micTracks.forEach((track) => mixed.addTrack(track))
    return { stream: mixed, audioMode: 'mic', audioContext: null }
  }

  const audioContext = new AudioCtx()
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
    } catch {
      // continue; some browsers resume on user gesture already
    }
  }

  const destination = audioContext.createMediaStreamDestination()
  ;[...systemTracks, ...micTracks].forEach((track) => {
    const source = audioContext.createMediaStreamSource(new MediaStream([track]))
    source.connect(destination)
  })

  destination.stream.getAudioTracks().forEach((track) => mixed.addTrack(track))
  return { stream: mixed, audioMode: 'mixed', audioContext }
}

/**
 * Records the user's screen + microphone narration (hard duration cap).
 */
export function useScreenRecorder({ maxDuration = MAX_RECORDING_SECONDS } = {}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [stream, setStream] = useState(null)
  const [recordedFile, setRecordedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  // 'idle' | 'requesting' | 'mic' | 'system' | 'mixed' | 'none' | 'denied'
  const [audioMode, setAudioMode] = useState('idle')

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const ownedStreamsRef = useRef([])
  const audioContextRef = useRef(null)
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

  const releaseMedia = useCallback(() => {
    clearTimer()
    ownedStreamsRef.current.forEach((s) => {
      s.getTracks().forEach((t) => t.stop())
    })
    ownedStreamsRef.current = []
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {
          // already stopped
        }
      })
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    setStream(null)
  }, [])

  const stop = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const start = useCallback(async () => {
    setError('')
    setAudioMode('requesting')
    if (!supported) {
      setError('Screen recording is not supported in this browser. Try the latest Chrome, Edge or Firefox.')
      setStatus('error')
      setAudioMode('idle')
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
      setPreviewUrl('')
    }
    setRecordedFile(null)
    setElapsed(0)
    chunksRef.current = []

    // 1) Screen share first (browser picker). Include audio so tab audio is available when offered.
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
      setAudioMode('idle')
      return
    }
    ownedStreamsRef.current.push(displayStream)

    // 2) Microphone for voice narration — getDisplayMedia does not capture the mic.
    let micStream = null
    let micDenied = false
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      ownedStreamsRef.current.push(micStream)
    } catch (err) {
      micDenied = true
      // Continue without mic so a screen-only recording is still possible.
      if (err?.name !== 'NotAllowedError' && err?.name !== 'NotFoundError') {
        console.warn('Microphone capture failed:', err)
      }
    }

    // If the user cancels screen share while we were prompting for mic, bail out.
    if (!displayStream.getVideoTracks().some((t) => t.readyState === 'live')) {
      releaseMedia()
      setError('Screen sharing ended before recording could start.')
      setStatus('idle')
      setAudioMode('idle')
      return
    }

    let recordingStream
    let mode
    try {
      const built = await buildRecordingStream(displayStream, micStream)
      recordingStream = built.stream
      mode = built.audioMode
      audioContextRef.current = built.audioContext
    } catch (err) {
      releaseMedia()
      setError(err?.message || 'Could not prepare the recording stream.')
      setStatus('error')
      setAudioMode('idle')
      return
    }

    if (micDenied && mode === 'none') {
      setAudioMode('denied')
    } else if (micDenied) {
      setAudioMode(mode === 'system' ? 'system' : 'denied')
    } else {
      setAudioMode(mode)
    }

    streamRef.current = recordingStream
    setStream(recordingStream)

    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined)
    } catch {
      releaseMedia()
      setError('Recording is not supported for the selected screen source.')
      setStatus('error')
      setAudioMode('idle')
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
      releaseMedia()
    }

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

    // Surface a soft warning when voice is missing so the user can re-record.
    if (micDenied && mode !== 'mic' && mode !== 'mixed') {
      setError(
        mode === 'system'
          ? 'Microphone access was denied. Only shared-tab audio is being recorded — allow the microphone to include your voice.'
          : 'Microphone access was denied, so this recording has no voice. Allow the microphone and re-record to include narration.',
      )
    }
  }, [supported, maxDuration, stop, releaseMedia])

  const reset = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    releaseMedia()
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
    setAudioMode('idle')
  }, [releaseMedia])

  useEffect(
    () => () => {
      clearTimer()
      ownedStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
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
    audioMode,
    start,
    stop,
    reset,
  }
}
