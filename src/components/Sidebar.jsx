import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { to: '/',         label: 'Ares',     Icon: LayoutDashboard },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`flex flex-col bg-surface border-r border-border transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      {/* Logo / title */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <span className="text-accent font-bold text-lg leading-none">A</span>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary tracking-wide">
            Ares
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 flex flex-col gap-1 px-2">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'text-text-primary bg-accent/10 font-medium'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-center py-3 border-t border-border text-text-muted hover:text-text-primary transition-colors"
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
