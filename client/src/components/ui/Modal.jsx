import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../utils/cn"

export function Modal({ isOpen, onClose, title, children, className }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className={cn("bg-card text-card-foreground w-full max-w-md rounded-xl shadow-2xl border animate-in zoom-in-95 duration-200 p-6 relative flex flex-col m-4", className)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-gray-500 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
