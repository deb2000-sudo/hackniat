import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { resolveApiUrl } from '../../api/client'
import { useAsync } from '../../hooks/useAsync'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'
import { formatDuration } from '../../utils/format'

function detectDuration(video) {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration
  if (video.seekable?.length) {
    const seekableEnd = video.seekable.end(video.seekable.length - 1)
    if (Number.isFinite(seekableEnd) && seekableEnd > 0) return seekableEnd
  }
  return 0
}

export default function SubmissionVideoPage() {
  const { sessionId } = useParams()
  const videoRef = useRef(null)
  const durationProbeActiveRef = useRef(false)
  const durationProbeCleanupRef = useRef(() => {})
  const [playbackError, setPlaybackError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const { data: session, loading, error } = useAsync(() =>
    evaluationApi.getSubmission(sessionId),
  )
  const usesSignedUrl = !!session?.video_url
  const videoUrl = session
    ? resolveApiUrl(
        session.video_url ||
          `/submissions/${encodeURIComponent(sessionId)}/video`,
      )
    : ''

  useEffect(() => () => durationProbeCleanupRef.current(), [])

  const updateKnownDuration = (video) => {
    const knownDuration = detectDuration(video)
    if (knownDuration) setDuration(knownDuration)
    return knownDuration
  }

  // MediaRecorder WebM files can report Infinity because they have no duration
  // metadata. Seeking far past the end makes Chromium discover the real end.
  const probeWebmDuration = (video) => {
    if (durationProbeActiveRef.current) return
    durationProbeActiveRef.current = true

    const restoreTime = video.currentTime || 0
    let timeoutId

    const cleanup = () => {
      video.removeEventListener('timeupdate', finishProbe)
      if (timeoutId) clearTimeout(timeoutId)
      durationProbeActiveRef.current = false
    }

    const finishProbe = () => {
      const discoveredDuration = detectDuration(video) || video.currentTime
      if (Number.isFinite(discoveredDuration) && discoveredDuration > 0) {
        setDuration(discoveredDuration)
        video.currentTime = Math.min(restoreTime, discoveredDuration)
      }
      cleanup()
    }

    durationProbeCleanupRef.current = cleanup
    video.addEventListener('timeupdate', finishProbe)
    timeoutId = setTimeout(() => {
      updateKnownDuration(video)
      cleanup()
    }, 3000)

    try {
      video.currentTime = Number.MAX_SAFE_INTEGER
    } catch {
      cleanup()
    }
  }

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      try {
        await video.play()
      } catch {
        setPlaybackError('Your browser could not start video playback.')
      }
    } else {
      video.pause()
    }
  }

  const seek = (event) => {
    const nextTime = Number(event.target.value)
    if (videoRef.current) videoRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const changeVolume = (event) => {
    const nextVolume = Number(event.target.value)
    const video = videoRef.current
    if (video) {
      video.volume = nextVolume
      video.muted = nextVolume === 0
    }
    setVolume(nextVolume)
    setMuted(nextVolume === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const enterFullscreen = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.requestFullscreen) {
      await video.requestFullscreen()
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen()
    }
  }

  return (
    <div className={`${WRAP_APP} student-submission-video-page py-7 md:py-10`}>
      <PageHeader
        eyebrow="Submitted video"
        title={session?.team_name || session?.title || session?.source_filename || 'Submission recording'}
        description="Review the complete video returned by the submission API."
        actions={
          <Button
            as={Link}
            to="/student/evaluations"
            variant="secondary"
            leftIcon={<Icon name="arrowLeft" size={18} />}
          >
            Back to evaluations
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock label="Opening video…" />
      ) : error ? (
        <Alert variant="danger" title="Unable to load submission">
          {error.message}
        </Alert>
      ) : (
        <div className="stack-lg">
          <Alert variant={session?.report_published ? 'success' : 'warning'} title={
            session?.report_published ? 'Evaluation report published' : 'Submitted — results pending'
          }>
            {session?.report_published
              ? 'Your evaluation report is now available.'
              : 'Your video was submitted successfully. Results are pending evaluator review and admin approval.'}
            {session?.report_published && (
              <div className="submission-inline-action">
                <Button
                  as={Link}
                  to={`/student/evaluations/${session.id}`}
                  variant="ghost"
                  size="sm"
                  rightIcon={<Icon name="arrowRight" size={15} />}
                >
                  View report
                </Button>
              </div>
            )}
          </Alert>
          <Card className="student-submission-video-card">
            <CardBody className="stack-md">
            {playbackError && (
              <Alert variant="danger" title="Video playback failed">
                {playbackError}
              </Alert>
            )}
            <div className="recorder-stage">
              <video
                key={videoUrl}
                ref={videoRef}
                className="recorder-video"
                src={videoUrl}
                playsInline
                preload="metadata"
                crossOrigin={usesSignedUrl ? undefined : 'use-credentials'}
                onLoadedMetadata={(event) => {
                  setPlaybackError('')
                  if (!updateKnownDuration(event.currentTarget)) {
                    probeWebmDuration(event.currentTarget)
                  }
                }}
                onDurationChange={(event) => updateKnownDuration(event.currentTarget)}
                onProgress={(event) => updateKnownDuration(event.currentTarget)}
                onTimeUpdate={(event) => {
                  setCurrentTime(event.currentTarget.currentTime)
                  updateKnownDuration(event.currentTarget)
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onError={() =>
                  setPlaybackError(
                    'The backend could not stream this recording. Please refresh and try again; signed video links can expire.',
                  )
                }
                aria-label="Submitted video"
              />
            </div>
            <div className="video-controls" aria-label="Video controls">
              <button
                type="button"
                className="video-control-button"
                onClick={togglePlayback}
                aria-label={playing ? 'Pause video' : 'Play video'}
              >
                <Icon name={playing ? 'pause' : 'play'} size={19} />
              </button>

              <span className="video-time mono">
                {formatDuration(Math.floor(currentTime))} /{' '}
                {duration > 0 ? formatDuration(Math.floor(duration)) : '--:--'}
              </span>

              <input
                className="video-seek"
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={seek}
                aria-label="Seek video"
              />

              <button
                type="button"
                className="video-control-button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute video' : 'Mute video'}
              >
                <Icon name={muted ? 'volumeOff' : 'volume'} size={19} />
              </button>

              <input
                className="video-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={changeVolume}
                aria-label="Video volume"
              />

              <button
                type="button"
                className="video-control-button"
                onClick={enterFullscreen}
                aria-label="Enter fullscreen"
              >
                <Icon name="maximize" size={19} />
              </button>
            </div>
            <p className="text-sm text-muted">
              This video is streamed securely from backend storage and is not stored in browser
              local storage.
            </p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
