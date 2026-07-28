import { useEffect, useRef } from 'react'
import { useScreenRecorder } from '../../hooks/useScreenRecorder'
import { formatDuration, formatFileSize } from '../../utils/format'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Alert from '../ui/Alert'
import NetworkIndicator from './NetworkIndicator'

const AUDIO_STATUS = {
  idle: null,
  requesting: { icon: 'mic', label: 'Requesting microphone…', tone: 'neutral' },
  mic: { icon: 'mic', label: 'Microphone on', tone: 'success' },
  mixed: { icon: 'mic', label: 'Mic + system audio', tone: 'success' },
  system: { icon: 'volume', label: 'System audio only (no mic)', tone: 'warning' },
  denied: { icon: 'micOff', label: 'Microphone blocked', tone: 'danger' },
  none: { icon: 'micOff', label: 'No audio', tone: 'danger' },
}

/**
 * Records the user's screen + microphone (max duration) and hands the resulting
 * File to the parent via `onChange`.
 */
export default function ScreenRecorder({ onChange, disabled = false }) {
  const {
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
  } = useScreenRecorder()

  const liveVideoRef = useRef(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onChangeRef.current?.(recordedFile)
  }, [recordedFile])

  // Live preview stays muted to avoid feedback; recorded preview plays with audio.
  useEffect(() => {
    const el = liveVideoRef.current
    if (el && stream) {
      el.srcObject = stream
      el.play?.().catch(() => {})
    }
    return () => {
      if (el) el.srcObject = null
    }
  }, [stream])

  const isRecording = status === 'recording'
  const isStopped = status === 'stopped'
  const remaining = Math.max(0, maxDuration - elapsed)
  const pct = Math.min(100, (elapsed / maxDuration) * 100)
  const nearEnd = remaining <= 30
  const audioStatus = AUDIO_STATUS[audioMode]

  if (!supported) {
    return (
      <Alert variant="warning" title="Screen recording unavailable">
        Your browser doesn&apos;t support in-browser screen recording. Please use the latest version
        of Chrome, Edge or Firefox on a desktop device.
      </Alert>
    )
  }

  return (
    <div className="stack-md">
      <div className="row-between wrap" style={{ gap: 12 }}>
        <p className="text-sm text-muted" style={{ maxWidth: '52ch' }}>
          Share your screen and speak into your microphone. Your voice is recorded with the video.
          Recording stops automatically at <strong>{formatDuration(maxDuration)}</strong>.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          {audioStatus && (isRecording || audioMode === 'denied' || audioMode === 'none') && (
            <span className={`rec-audio-pill rec-audio-pill--${audioStatus.tone}`}>
              <Icon name={audioStatus.icon} size={14} />
              {audioStatus.label}
            </span>
          )}
          <NetworkIndicator active={isRecording || status === 'idle'} />
        </div>
      </div>

      <div className="recorder-stage">
        {isStopped && previewUrl ? (
          <>
            <video
              className="recorder-video"
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              aria-label="Full recording preview"
            />
            <span className="recording-preview-label">
              <Icon name="play" size={14} />
              Full recording preview — turn up volume to verify your voice
            </span>
          </>
        ) : isRecording ? (
          <>
            <video ref={liveVideoRef} className="recorder-video" autoPlay muted playsInline />
            <span className="rec-overlay">
              <span className="rec-dot" />
              REC {formatDuration(elapsed)} / {formatDuration(maxDuration)}
            </span>
            <div className="rec-timebar">
              <div
                className={`rec-timebar__fill ${nearEnd ? 'rec-timebar__fill--warn' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <div className="recorder-placeholder">
            <div className="dropzone__icon" style={{ margin: '0 auto 14px' }}>
              <Icon name="monitor" size={26} />
            </div>
            <div style={{ fontWeight: 600, color: '#fff' }}>Record your submission</div>
            <p className="text-sm" style={{ marginTop: 4, color: '#c7cbd4' }}>
              You&apos;ll be asked to share your screen, then allow the microphone so your voice is
              included.
            </p>
          </div>
        )}
      </div>

      {error && (
        <Alert variant={audioMode === 'denied' || audioMode === 'none' ? 'warning' : 'danger'}>
          {error}
        </Alert>
      )}

      <div className="row-between wrap" style={{ gap: 12 }}>
        <div className="text-sm text-muted">
          {isStopped && recordedFile ? (
            <div>
              <span className="row" style={{ gap: 8 }}>
                <Icon name="checkCircle" size={16} style={{ color: 'var(--success-500)' }} />
                Recorded {formatDuration(elapsed)} · {formatFileSize(recordedFile.size)}
              </span>
              <span className="text-xs">Play the preview (with sound) before uploading.</span>
            </div>
          ) : isRecording ? (
            <span className="row" style={{ gap: 8 }}>
              <Icon name={audioMode === 'mic' || audioMode === 'mixed' ? 'mic' : 'micOff'} size={14} />
              {formatDuration(remaining)} remaining
            </span>
          ) : (
            <span>Max duration {formatDuration(maxDuration)} · microphone required for voice</span>
          )}
        </div>

        <div className="row" style={{ gap: 10 }}>
          {isRecording && (
            <Button variant="danger" onClick={stop} leftIcon={<Icon name="square" size={16} />}>
              Stop recording
            </Button>
          )}
          {isStopped && (
            <Button
              variant="secondary"
              onClick={reset}
              disabled={disabled}
              leftIcon={<Icon name="refresh" size={16} />}
            >
              Re-record
            </Button>
          )}
          {status === 'idle' && (
            <Button
              variant="accent"
              onClick={start}
              disabled={disabled}
              leftIcon={<Icon name="mic" size={18} />}
            >
              Start screen recording
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
