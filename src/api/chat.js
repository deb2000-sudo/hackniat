import { api } from './client'

// TODO(backend): this endpoint does not exist yet. Whoever wires up the real
// AI assistant should implement POST /chat on the backend (accepting at least
// { message: string } and returning { reply: string }). The caller
// (ChatWidget) already catches failures and shows a friendly fallback
// message, so nothing else needs to change here once the backend exists.
export async function sendChatMessage(message) {
  const response = await api.post('/chat', { message })
  return { reply: response?.reply || response?.message || '' }
}
