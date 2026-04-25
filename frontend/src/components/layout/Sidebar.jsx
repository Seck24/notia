import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, FolderOpen, Settings, LogOut } from 'lucide-react'
import Logo from './Logo'
import useAuthStore from '../../stores/authStore'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/configuration', icon: Settings, label: 'Configuration', adminOnly: true },
]

export default function Sidebar() {
  const { user, cabinet, logout } = useAuthStore()
  const role = user?.role || 'limite'

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen bg-navy text-white fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-white/10">
        <Logo size="md" dark />
      </div>

      <nav className="flex-1 py-4">
        {NAV.filter(n => !n.adminOnly || role === 'admin').map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-gold border-r-2 border-gold' : 'text-white/70 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-sm font-medium text-white truncate">{user?.nom}</p>
        <p className="text-xs text-white/50 capitalize">{user?.role}</p>
        {cabinet && <p className="text-xs text-gold/70 mt-1 truncate">{cabinet.nom}</p>}
        <button onClick={logout} className="flex items-center gap-2 mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </aside>
  )
}
