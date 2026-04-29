import { useState } from "react"
import { Outlet, NavLink, useNavigate, Link, useLocation } from "react-router-dom"
import { useAuthStore } from "../store/useAuthStore"
import {
  Building2,
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Home,
  UserCog,
  LogOut,
  Menu,
  Settings,
  ChevronRight,
  DoorOpen,
  Wrench,
  X
} from "lucide-react"
import { cn } from "../utils/cn"
import NotificationBell from "../components/layout/NotificationBell"

const PAGE_TITLES = {
  "/admin": "Admin Control Center",
  "/admin/users": "Manage Users",
  "/admin/invoices": "Invoices & Billing",
  "/admin/buildings": "Buildings",
  "/admin/units": "Units",
  "/admin/vendor-requests": "Vendor Requests",
  "/admin/profile": "Profile & Settings",
}

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Manage Users", href: "/admin/users", icon: UserCog },
    { name: "Invoices & Billing", href: "/admin/invoices", icon: FileText },
    { type: "separator", label: "Property Management" },
    { name: "Buildings", href: "/admin/buildings", icon: Building2 },
    { name: "Units", href: "/admin/units", icon: DoorOpen },
    { type: "separator", label: "Services" },
    { name: "Vendor Requests", href: "/admin/vendor-requests", icon: Wrench },
  ]

  const pageTitle = PAGE_TITLES[location.pathname] || "Admin Control Center"

  return (
    <div className="flex bg-background min-h-screen font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 border-b border-border px-4 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-purple-700 rounded-lg flex items-center justify-center shadow-md shadow-violet-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">SmartApt</span>
              <span className="ml-1.5 text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Admin</span>
            </div>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-foreground p-1" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {navigation.map((item, idx) =>
            item.type === "separator" ? (
              <div key={idx} className="pt-5 pb-2 px-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {item.label}
                </p>
              </div>
            ) : (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/admin"}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => cn(
                "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                isActive
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "text-gray-600 hover:bg-secondary hover:text-foreground dark:text-gray-400 dark:hover:bg-secondary"
              )}
            >
              <item.icon className={cn("mr-3 h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110")} />
              {item.name}
            </NavLink>
            )
          )}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <Link
            to="/admin/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center mb-3 px-2 py-2 rounded-lg hover:bg-secondary transition-colors group"
          >
            <img
              src={user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || "admin"}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-border shadow-sm flex-shrink-0"
            />
            <div className="ml-3 truncate flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-violet-600 transition-colors">{user?.full_name}</p>
              <p className="text-xs text-violet-600 dark:text-violet-400 truncate capitalize font-medium">{user?.role}</p>
            </div>
            <Settings className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1 group-hover:text-violet-600 transition-colors" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0 relative">
        <header className="flex items-center justify-between h-16 px-4 bg-card/80 backdrop-blur-md border-b border-border shadow-sm z-30 sticky top-0">
          <div className="flex items-center min-w-0">
            <button
              className="focus:outline-none lg:hidden text-gray-500 hover:text-foreground mr-4 p-1 rounded-md flex-shrink-0"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-base sm:text-xl font-semibold text-foreground truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <NotificationBell />
            <Link
              to="/admin/profile"
              className="text-gray-400 hover:text-violet-600 p-2 rounded-full hover:bg-secondary transition-colors"
              title="Profile & Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
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
