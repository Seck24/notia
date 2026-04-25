import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FolderOpen, Settings, Menu, X } from 'lucide-react'
import { useState } from 'react'
import Logo from './Logo'
import useAuthStore from '../../stores/authStore'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/configuration', icon: Settings, label: 'Config', adminOnly: true },
]

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const { user } = useAuthStore()
  const role = user?.role || 'limite'

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-navy">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo size="sm" dark />
        <button onClick={() => setOpen(!open)} className="text-white">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-white/10 pb-2">
          {NAV.filter(n => !n.adminOnly || role === 'admin').map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm ${isActive ? 'text-gold bg-white/10' : 'text-white/70'}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
