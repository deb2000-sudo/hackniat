import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

/** App chrome for authenticated / main pages: navbar + content + footer. */
export default function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-content">
        <main className="grow">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
