import { useEffect } from 'react'

/**
 * Marks the document as a Drop surface for as long as the page is mounted.
 *
 * index.css paints <body> with the light app theme, which shows through on
 * overscroll and behind a short page. This flips the document to the dark
 * canvas and restores it on unmount, so navigating back to a legacy page
 * leaves no trace.
 *
 * Optionally sets the document title and meta description, restoring both.
 */
export function useDropSurface({ title, description } = {}) {
  useEffect(() => {
    document.body.classList.add('drop-active')

    const previousTitle = document.title
    const meta = document.querySelector('meta[name="description"]')
    const previousDescription = meta?.getAttribute('content')

    if (title) document.title = title
    if (description) meta?.setAttribute('content', description)

    return () => {
      document.body.classList.remove('drop-active')
      if (title) document.title = previousTitle
      if (description && previousDescription != null) {
        meta?.setAttribute('content', previousDescription)
      }
    }
  }, [title, description])
}

export default useDropSurface
