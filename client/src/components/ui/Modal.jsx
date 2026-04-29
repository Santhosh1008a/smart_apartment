import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../utils/cn"

export function Modal({ isOpen, onClose, title, children, className }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-200 p-0 sm:p-4">
      <div className={cn(
        "bg-card text-card-foreground w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl border animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 p-5 sm:p-6 relative flex flex-col max-h-[92vh] sm:max-h-[85vh]",
        className
      )}>
        {/* Drag handle for mobile */}
        <div className="sm:hidden w-12 h-1.5 bg-border rounded-full mx-auto mb-4 -mt-1" />
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-gray-500 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  )
}
