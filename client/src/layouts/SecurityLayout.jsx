import { useState } from "react"
import { Outlet, NavLink, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/useAuthStore"
import {
  Building2,
  Shield,
  Users,
  ScanLine,
  LogOut,
  Menu,
  Bell
} from "lucide-react"
import { cn } from "../utils/cn"
import NotificationBell from "../components/layout/NotificationBell"

export default function SecurityLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const navigation = [
    { name: "Today's Visitors", href: "/security", icon: Users },
  ]

  return (
    <div className="flex bg-background min-h-screen font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-center h-16 border-b border-border px-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">SmartApt</span>
              <span className="ml-1.5 text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Guard</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => cn(
                "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "text-gray-600 hover:bg-secondary hover:text-foreground dark:text-gray-400"
              )}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center mb-4 px-2">
            <img
              src={user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=guard"}
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-border shadow-sm"
            />
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate capitalize font-medium">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 w-0 relative">
        <header className="flex items-center justify-between h-16 px-4 bg-card/80 backdrop-blur-md border-b border-border shadow-sm z-30 sticky top-0">
          <div className="flex items-center">
            <button
              className="focus:outline-none lg:hidden text-gray-500 hover:text-foreground mr-4 p-1 rounded-md"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-foreground hidden sm:block">Security Checkpoint</h1>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-secondary/20 relative">
          <div className="p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
