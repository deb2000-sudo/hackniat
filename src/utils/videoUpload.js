const NETWORK_FAILURE_MESSAGE =
  'The video upload lost its connection. Check your internet and retry. If it keeps failing, ' +
  'try another network (mobile hotspot instead of campus Wi-Fi), or turn off any VPN or ad blocker.'

/** Tries per PUT, the first included. */
const UPLOAD_ATTEMPTS = 4
/** Wait before each retry, in ms. */
const RETRY_DELAYS = [1500, 4000, 8000]
/** How long a retry waits for the browser to come back online. */
const OFFLINE_WAIT_MS = 60_000

/** Worth trying again: a dropped connection, a timeout, rate limiting, or a storage-side error. */
function isRetryable(error) {
  if (error?.name === 'AbortError') return false
  const status = Number(error?.status)
  return error?.network || status === 408 || status === 429 || status >= 500
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms)
    function done() {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Upload aborted', 'AbortError'))
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Resolve once the browser reports a connection again, or after `timeout`. */
function waitForOnline(timeout, signal) {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      window.removeEventListener('online', finish)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, timeout)
    window.addEventListener('online', finish)
    signal?.addEventListener('abort', finish, { once: true })
  })
}

/**
 * {@link putWithProgress} with retries. A signed PUT overwrites the same object
 * (or part), so sending it again is safe. Without this, one dropped part of a
 * chunked upload failed the whole video and the student started over from 0%,
 * which on a weak connection meant failing again and again.
 */
export async function putWithRetry(url, blob, headers, onPartProgress, signal) {
  let attempt = 0
  for (;;) {
    attempt += 1
    try {
      await putWithProgress(url, blob, headers, onPartProgress, signal)
      return
    } catch (error) {
      if (attempt >= UPLOAD_ATTEMPTS || !isRetryable(error)) {
        error.attempts = attempt
        throw error
      }
      // This attempt's bytes are discarded, so its progress starts again.
      onPartProgress?.(0)
      await waitForOnline(OFFLINE_WAIT_MS, signal)
      await wait(RETRY_DELAYS[attempt - 1] ?? 8000, signal)
    }
  }
}

/** PUT a blob to GCS with upload progress (XHR — fetch upload progress is unreliable). */
export function putWithProgress(url, blob, headers, onPartProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value != null) xhr.setRequestHeader(key, value)
    })

    const onAbort = () => {
      xhr.abort()
      reject(new DOMException('Upload aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onPartProgress(event.loaded)
    }
    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      const error = new Error(`The video upload was rejected by storage (${xhr.status}). Please retry.`)
      error.status = xhr.status
      // GCS explains itself in an XML body (SignatureDoesNotMatch, ExpiredToken, …).
      error.storageCode = String(xhr.responseText || '').match(/<Code>([^<]+)<\/Code>/)?.[1] || ''
      reject(error)
    }
    // No readable response at all: the connection dropped, something on the
    // student's network blocked storage.googleapis.com, or the reply had no
    // CORS headers. The browser does not say which.
    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      const error = new Error(NETWORK_FAILURE_MESSAGE)
      error.status = 0
      error.network = true
      reject(error)
    }
    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new DOMException('Upload aborted', 'AbortError'))
    }
    xhr.send(blob)
  })
}

/** Run async workers over items with a fixed concurrency pool. */
export async function runPool(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return
  const limit = Math.max(1, Number(concurrency) || 1)
  let nextIndex = 0

  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (nextIndex < list.length) {
      const current = nextIndex
      nextIndex += 1
      await worker(list[current], current)
    }
  })

  await Promise.all(runners)
}

/**
 * Upload a video file using the plan from POST /submissions/upload-url.
 * Supports parallel_compose (chunked) and single signed/resumable PUT.
 */
export async function uploadVideoToStorage(file, plan, { onProgress, signal } = {}) {
  if (!file?.size) {
    throw new Error('The selected video is empty. Choose another recording.')
  }

  const headers =
    plan?.required_headers ||
    (plan?.content_type ? { 'Content-Type': plan.content_type } : {})

  const report = (loaded, total) => {
    if (!onProgress || !total) return
    onProgress(Math.min(100, Math.round((loaded / total) * 100)))
  }

  if (plan?.upload_protocol === 'parallel_compose') {
    const parts = plan.parts || []
    if (!parts.length || !plan.video_path) {
      throw new Error('The server did not return valid parallel upload instructions.')
    }

    const loaded = new Array(parts.length).fill(0)
    const total = file.size
    const syncProgress = () => report(loaded.reduce((sum, n) => sum + n, 0), total)

    await runPool(parts, plan.recommended_concurrency || 4, async (part, partIndex) => {
      const idx = part.index ?? partIndex
      const slice = file.slice(part.offset_start, part.offset_end)
      await putWithRetry(
        part.upload_url,
        slice,
        headers,
        (bytes) => {
          loaded[idx] = bytes
          syncProgress()
        },
        signal,
      )
      loaded[idx] = part.content_length
      syncProgress()
    })

    onProgress?.(100)
    return
  }

  if (!plan?.upload_url || !plan?.video_path) {
    throw new Error('The server did not return a valid secure video upload URL.')
  }

  await putWithRetry(
    plan.upload_url,
    file,
    headers,
    (bytes) => report(bytes, file.size),
    signal,
  )
  onProgress?.(100)
}
