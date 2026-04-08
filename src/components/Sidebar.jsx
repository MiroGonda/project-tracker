import { NavLink } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import {
  Settings, ShieldCheck, ChevronLeft, ChevronRight,
  LayoutDashboard,
} from 'lucide-react'
import { useAccess } from '../context/AccessContext'
import { listBoards } from '../api/ares'
import Spinner from './Spinner'

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const [collapsed,     setCollapsed]     = useState(false)
  const [apiBoards,     setApiBoards]     = useState([])
  const [boardsLoading, setBoardsLoading] = useState(false)

  const { admin, canAdmin, accessibleIds, loading: configLoading } = useAccess()

  useEffect(() => {
    const host   = localStorage.getItem('ares_host')
    const apiKey = localStorage.getItem('ares_api_key')
    if (!host || !apiKey) return
    setBoardsLoading(true)
    listBoards().then(setApiBoards).catch(() => {}).finally(() => setBoardsLoading(false))
  }, [])

  const hiddenIds = useMemo(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hidden_board_ids') || '[]')) }
    catch { return new Set() }
  }, [])

  const visibleBoards = useMemo(() => {
    const seen = new Set()
    return apiBoards.filter(b => {
      const id = b.id || b.boardId
      if (!id || seen.has(id)) return false
      seen.add(id)
      if (hiddenIds.has(id)) return false
      return admin || accessibleIds.has(id)
    })
  }, [apiBoards, admin, accessibleIds, hiddenIds])

  const STATIC_NAV = [
    { to: '/settings', label: 'Settings', Icon: Settings   },
    ...(canAdmin ? [{ to: '/admin', label: 'Admin', Icon: ShieldCheck }] : []),
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

        {!collapsed && (
          <p className="px-2.5 pb-1 text-[10px] text-text-muted font-medium uppercase tracking-wider">
            Projects
          </p>
        )}

        {(boardsLoading || configLoading)
          ? <div className="flex justify-center py-2"><Spinner size={13} className="text-text-muted" /></div>
          : visibleBoards.length === 0
            ? (!collapsed && (
                <p className="px-2.5 text-xs text-text-muted/60 italic">
                  No boards — visit Admin to configure
                </p>
              ))
            : visibleBoards.map(b => {
                const id = b.id || b.boardId
                return (
                      <NavLink
                    key={id}
                    to={`/board/${id}`}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg text-sm transition-colors px-2.5 py-2
                       ${isActive
                         ? 'text-text-primary bg-accent/10 font-medium'
                         : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                       }`
                    }
                  >
                    <LayoutDashboard size={13} className="shrink-0" />
                    {!collapsed && <span className="truncate">{b.name}</span>}
                  </NavLink>
                )
              })
        }

        <div className="border-t border-border my-2" />

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

      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-center py-3 border-t border-border text-text-muted hover:text-text-primary transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
