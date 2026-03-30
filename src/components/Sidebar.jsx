import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Settings, ShieldCheck, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react'
import { useAccess } from '../context/AccessContext'
import { listBoards } from '../api/ares'
import Spinner from './Spinner'

export default function Sidebar() {
  const [collapsed,     setCollapsed]     = useState(false)
  const [apiBoards,     setApiBoards]     = useState([])
  const [boardsLoading, setBoardsLoading] = useState(false)
  const { admin, accessibleIds, loading: configLoading } = useAccess()

  useEffect(() => {
    const host   = localStorage.getItem('ares_host')
    const apiKey = localStorage.getItem('ares_api_key')
    if (!host || !apiKey) return
    setBoardsLoading(true)
    listBoards().then(setApiBoards).catch(() => {}).finally(() => setBoardsLoading(false))
  }, [])

  const visibleBoards = apiBoards.filter(b => {
    const id = b.id || b.boardId
    return admin || accessibleIds.has(id)
  })

  const STATIC_NAV = [
    { to: '/settings', label: 'Settings', Icon: Settings },
    ...(admin ? [{ to: '/admin', label: 'Admin', Icon: ShieldCheck }] : []),
  ]

  return (
    <aside
      className={`flex flex-col bg-surface border-r border-border transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <span className="text-accent font-bold text-lg leading-none">A</span>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-primary tracking-wide">Ares</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">

        {/* Projects section label */}
        {!collapsed && (
          <p className="px-2.5 pb-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">
            Projects
          </p>
        )}

        {/* Board links */}
        {(boardsLoading || configLoading)
          ? <div className="flex justify-center py-2"><Spinner size={13} className="text-text-muted" /></div>
          : visibleBoards.length === 0
            ? (!collapsed && (
                <p className="px-2.5 text-xs text-text-muted/60 italic">
                  No boards — configure in Settings
                </p>
              ))
            : visibleBoards.map(b => {
                const id = b.id || b.boardId
                return (
                  <NavLink
                    key={id}
                    to={`/board/${id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'text-text-primary bg-accent/10 font-medium'
                          : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                      }`
                    }
                  >
                    <LayoutDashboard size={13} className="shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{b.name || b.boardName}</span>
                    )}
                  </NavLink>
                )
              })
        }

        <div className="border-t border-border my-2" />

        {/* Settings + Admin */}
        {STATIC_NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'text-text-primary bg-accent/10 font-medium'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              }`
            }
          >
            <Icon size={14} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-center py-3 border-t border-border text-text-muted hover:text-text-primary transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
