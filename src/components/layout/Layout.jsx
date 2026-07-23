import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import ChatWidget from '../chat/ChatWidget'

/** App chrome for authenticated / main pages: navbar + content + footer. */
export default function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="grow">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
