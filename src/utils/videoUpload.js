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
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`The video upload was rejected by storage (${xhr.status}). Please retry.`))
    }
    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(
        new Error(
          'Direct video upload failed. Please retry. If it continues, verify the storage CORS configuration.',
        ),
      )
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
      await putWithProgress(
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

  await putWithProgress(
    plan.upload_url,
    file,
    headers,
    (bytes) => report(bytes, file.size),
    signal,
  )
  onProgress?.(100)
}
