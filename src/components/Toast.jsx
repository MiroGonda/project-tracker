import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const ICONS = {
  success: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
  error:   <AlertCircle  size={16} className="text-red-400 shrink-0" />,
  info:    <AlertCircle  size={16} className="text-accent shrink-0" />,
}

export default function Toast({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, dismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-surface border border-border shadow-lg text-sm text-text-primary min-w-[260px] max-w-[360px]">
      {ICONS[toast.type] ?? ICONS.info}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => dismiss(toast.id)}
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
