import { useState } from "react"
import { Outlet, NavLink, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/useAuthStore"
import { 
  Building2, 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Car, 
  Wrench, 
  AlertTriangle, 
  LogOut, 
  Menu,
  Settings,
  Bell
} from "lucide-react"
import { cn } from "../utils/cn"
import NotificationBell from "../components/layout/NotificationBell"

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user, complex, building, unit, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Visitors & QR", href: "/visitors", icon: Users },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Parking", href: "/parking", icon: Car },
    { name: "Vendor Services", href: "/vendors", icon: Wrench },
    { name: "Emergency", href: "/emergency", icon: AlertTriangle },
  ]

  return (
    <div className="flex bg-background min-h-screen font-sans">
      {/* Mobile Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-center h-16 border-b border-border px-4 shrinks-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">SmartApt</span>
          </div>
        </div>

        {/* Complex & Unit Context */}
        {complex && (
          <div className="px-4 py-3 border-b border-border/50 bg-secondary/20">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Society</p>
            <p className="text-sm font-semibold text-foreground truncate">{complex.name}</p>
            {(building || unit) && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {building ? building.name : ''}{building && unit ? ' • ' : ''}{unit ? `Unit ${unit.unit_number}` : ''}
              </p>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => cn(
                "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-gray-600 hover:bg-secondary hover:text-foreground dark:text-gray-400 dark:hover:bg-secondary"
              )}
            >
              <item.icon className={cn("mr-3 h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110", 
                 window.location.pathname === item.href ? "text-primary" : "text-gray-400 group-hover:text-gray-500"
              )} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center mb-4 px-2">
            <img 
              src={user?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border border-border shadow-sm" 
            />
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.role}{unit ? ` • ${unit.unit_number}` : ''}</p>
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

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-0 relative">
        {/* Top Header */}
        <header className="flex items-center justify-between h-16 px-4 bg-card/80 backdrop-blur-md border-b border-border shadow-sm z-30 sticky top-0">
          <div className="flex items-center">
            <button
              className="focus:outline-none lg:hidden text-gray-500 hover:text-foreground mr-4 p-1 rounded-md"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-foreground hidden sm:block">Dashboard</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <NotificationBell />
            <button className="text-gray-400 hover:text-foreground p-2 rounded-full hover:bg-secondary transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-secondary/20 relative">
          <div className="p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
