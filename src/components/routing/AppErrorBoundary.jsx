import { Component } from 'react'
import { captureError } from '../../lib/logrocket'
import { BTN_VOLT } from '../drop/theme'

/**
 * Last line of defence for a render crash. Without it React unmounts the whole
 * tree and the visitor gets a blank page; with it they get a way back, and the
 * error is reported to LogRocket with the component stack.
 */
export default class AppErrorBoundary extends Component {
  static displayName = 'AppErrorBoundary'

  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    captureError(error, {
      tags: { area: 'render' },
      extra: { componentStack: String(info?.componentStack || '').slice(0, 2000) },
    })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="drop grid min-h-screen place-items-center bg-canvas p-6">
        <div className="max-w-md text-center">
          <h1 className="text-[22px] font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-[14px] text-muted">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            className={`${BTN_VOLT} mt-5 min-h-10 px-4 text-[14px]`}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
