import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <MobileNav />
      <main className="md:ml-60 min-h-screen p-4 md:p-6 lg:p-8 pt-16 md:pt-6">
        <Outlet />
      </main>
    </div>
  )
}
