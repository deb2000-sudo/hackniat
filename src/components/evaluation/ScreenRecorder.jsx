import { useEffect, useRef } from 'react'
import { useScreenRecorder } from '../../hooks/useScreenRecorder'
import { formatDuration, formatFileSize } from '../../utils/format'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Alert from '../ui/Alert'
import NetworkIndicator from './NetworkIndicator'

/**
 * Records the user's screen (max `maxDuration` seconds) and hands the resulting
 * File to the parent via `onChange`. Passing `onChange(null)` resets it.
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
    start,
    stop,
    reset,
  } = useScreenRecorder()

  const liveVideoRef = useRef(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Bubble the recorded file (or null) up to the parent.
  useEffect(() => {
    onChangeRef.current?.(recordedFile)
  }, [recordedFile])

  // Attach the live screen-share stream to the preview element.
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
        <p className="text-sm text-muted" style={{ maxWidth: '48ch' }}>
          Share your screen and walk through your project. Recording stops automatically at{' '}
          <strong>{formatDuration(maxDuration)}</strong>.
        </p>
        <NetworkIndicator active={isRecording || status === 'idle'} />
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
              Full recording preview
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
              Click start, choose the screen or window to share, and present your project.
            </p>
          </div>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="row-between wrap" style={{ gap: 12 }}>
        <div className="text-sm text-muted">
          {isStopped && recordedFile ? (
            <div>
              <span className="row" style={{ gap: 8 }}>
                <Icon name="checkCircle" size={16} style={{ color: 'var(--success-500)' }} />
                Recorded {formatDuration(elapsed)} · {formatFileSize(recordedFile.size)}
              </span>
              <span className="text-xs">Play or seek through the preview before uploading.</span>
            </div>
          ) : isRecording ? (
            <span>{formatDuration(remaining)} remaining</span>
          ) : (
            <span>Max duration {formatDuration(maxDuration)}</span>
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
              leftIcon={<Icon name="monitor" size={18} />}
            >
              Start screen recording
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
