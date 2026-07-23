import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../../api/chat'
import Icon from '../ui/Icon'
import Spinner from '../ui/Spinner'

const STARTER_MESSAGE =
  "Hi! I'm the HackNIAT Assistant. Ask me anything about submitting your project or reading your evaluation report."

const QUICK_REPLIES = [
  'How do I submit my project?',
  'What does my evaluation score mean?',
  'How do I add my GitHub link?',
]

const FALLBACK_MESSAGE = 'AI assistant coming soon.'

let nextId = 1
function makeMessage(role, text) {
  return { id: nextId++, role, text }
}

/** Floating AI chatbot widget, persistent across the authenticated app shell. */
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => [makeMessage('bot', STARTER_MESSAGE)])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  const submitMessage = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setMessages((m) => [...m, makeMessage('user', trimmed)])
    setInput('')
    setSending(true)

    try {
      const { reply } = await sendChatMessage(trimmed)
      setMessages((m) => [...m, makeMessage('bot', reply || FALLBACK_MESSAGE)])
    } catch {
      setMessages((m) => [...m, makeMessage('bot', FALLBACK_MESSAGE)])
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submitMessage(input)
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel" role="dialog" aria-label="HackNIAT Assistant">
          <div className="chat-panel__header">
            <div className="row" style={{ gap: 10 }}>
              <span className="chat-panel__avatar">
                <Icon name="chat" size={16} />
              </span>
              <span>HackNIAT Assistant</span>
            </div>
            <button
              type="button"
              className="icon-btn chat-panel__close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="chat-panel__messages" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="chat-bubble chat-bubble--bot chat-bubble--pending">
                <Spinner size="sm" />
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="chat-panel__suggestions">
              {QUICK_REPLIES.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="chat-chip"
                  onClick={() => submitMessage(text)}
                  disabled={sending}
                >
                  {text}
                </button>
              ))}
            </div>
          )}

          <form className="chat-panel__input" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chat-panel__field"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              aria-label="Message"
            />
            <button
              type="submit"
              className="chat-panel__send"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chat-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat assistant' : 'Open chat assistant'}
        aria-expanded={open}
      >
        <Icon name={open ? 'x' : 'chat'} size={24} />
      </button>
    </div>
  )
}
