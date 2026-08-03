import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconClose, IconMenu } from './icons'
import ThemeToggle from './ThemeToggle'

const LINKS = [
  { href: '#hackathons', label: 'Hackathons' },
  { href: '#how-it-works', label: 'How it works' },
]

const WRAP = 'mx-auto w-full max-w-[1180px] px-5'
const LINK = 'text-[15px] text-muted transition-colors hover:text-ink'

export default function DropNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)

    // Stop the page scrolling underneath the open panel.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // The panel only exists below md; leaving it "open" across a resize would
  // strand the scroll lock on a viewport that has no way to close it.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 721px)')
    const onChange = (event) => {
      if (event.matches) setOpen(false)
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  const opaque = scrolled || open

  return (
    <header
      className={[
        'sticky top-0 z-50 border-b transition-colors duration-200',
        opaque
          ? 'border-hairline bg-canvas/80 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      ].join(' ')}
    >
      <div className={WRAP}>
        <div className="flex h-15 items-center justify-between">
          <a href="#top" className="text-[19px] font-semibold tracking-[-0.03em]">
            Drop
          </a>

          <nav className="hidden items-center gap-5 md:flex" aria-label="Primary">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className={LINK}>
                {link.label}
              </a>
            ))}
            <Link to="/login" className={LINK}>
              Sign in
            </Link>
            <ThemeToggle compact />
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle compact />
            <button
              type="button"
              className="-mr-2 flex size-[42px] items-center justify-center rounded-lg text-ink"
              aria-expanded={open}
              aria-controls="drop-mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>

        <nav
          id="drop-mobile-nav"
          className={`${open ? 'block' : 'hidden'} border-t border-hairline pt-2 pb-5 md:hidden`}
          aria-label="Primary mobile"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-3.5 text-[17px] text-muted hover:text-ink"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/login"
            className="block py-3.5 text-[17px] text-muted hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  )
}
