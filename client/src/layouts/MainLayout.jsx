import { useState } from "react"
import { Outlet, NavLink, useNavigate, Link, useLocation } from "react-router-dom"
import { useAuthStore } from "../store/useAuthStore"
import { logoutUser } from "../api/auth"
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Car, 
  Wrench, 
  AlertTriangle, 
  LogOut, 
  Menu,
  Settings,
  X,
  Megaphone,
  ChevronRight
} from "lucide-react"
import { cn } from "../utils/cn"
import NotificationBell from "../components/layout/NotificationBell"
import AIAssistant from "../components/layout/AIAssistant"
import UserAvatar from "../components/layout/UserAvatar"
import Logo from "../components/Logo"
import "./resident.css"

const PAGE_TITLES = {
  "/": "Overview",
  "/visitors": "Visitors",
  "/payments": "Payments",
  "/parking": "Parking",
  "/vendors": "Maintenance",
  "/emergency": "Emergency",
  "/notices": "Community notices",
  "/profile": "Profile",
}

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { user, complex, building, unit, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try { await logoutUser() } catch { /* Local logout still succeeds if the API is unavailable. */ }
    logout()
    navigate("/login")
  }

  const navigation = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Visitors", href: "/visitors", icon: Users },
    { name: "Maintenance", href: "/vendors", icon: Wrench },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Parking", href: "/parking", icon: Car },
    { name: "Community notices", href: "/notices", icon: Megaphone },
    { name: "Emergency", href: "/emergency", icon: AlertTriangle },
  ]

  const pageTitle = PAGE_TITLES[location.pathname] || "Dashboard"

  return (
    <div className="resident-shell flex bg-background min-h-screen font-sans">
      {/* Mobile Sidebar overlay */}
      {isSidebarOpen && (
        <div 
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "resident-sidebar fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="resident-brand flex items-center justify-between h-20 border-b border-border px-5 shrink-0">
          <Link to="/" onClick={() => setIsSidebarOpen(false)} aria-label="Go to SyncLiving dashboard" className="flex items-center gap-3">
            <Logo className="h-12 w-12 rounded-xl" />
            <span className="resident-brand-name">Sync<span>Living</span><small>RESIDENT PORTAL</small></span>
          </Link>
          <button aria-label="Close navigation" className="lg:hidden text-gray-400 hover:text-foreground p-1" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Complex & Unit Context */}
        {complex && (
          <div className="resident-community mx-3 mt-4 px-3 py-3 border border-border/50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Your community</p>
            <p className="text-sm font-semibold text-foreground truncate">{complex.name}</p>
            {(building || unit) && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {building ? building.name : ''}{building && unit ? ' • ' : ''}{unit ? `Unit ${unit.unit_number}` : ''}
              </p>
            )}
          </div>
        )}

        <nav aria-label="Resident navigation" className="resident-navigation flex-1 overflow-y-auto py-5 px-3 space-y-1 custom-scrollbar">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => cn(
                "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-gray-600 hover:bg-secondary hover:text-foreground dark:text-gray-400 dark:hover:bg-secondary"
              )}
            >
              <item.icon className="mr-3 h-[18px] w-[18px] flex-shrink-0" />
              {item.name}
              <ChevronRight aria-hidden="true" className="resident-nav-chevron ml-auto h-4 w-4 opacity-0" />
            </NavLink>
          ))}
        </nav>

        {/* Bottom User Section */}
        <div className="resident-account p-3 border-t border-border mt-auto">
          <Link
            to="/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center mb-2 px-2 py-2 rounded-lg hover:bg-secondary transition-colors group"
          >
            <UserAvatar user={user} src={user?.avatar_url} className="h-10 w-10 rounded-full border border-border shadow-sm" />
            <div className="ml-3 truncate flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{unit ? `Unit ${unit.unit_number}` : user?.role}</p>
            </div>
            <Settings className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1 group-hover:text-primary transition-colors" />
          </Link>
          <button
            aria-label="Log out of SyncLiving"
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="resident-main flex flex-col flex-1 min-w-0 relative">
        {/* Top Header */}
        <header className="resident-topbar flex items-center justify-between h-16 px-4 sm:px-7 bg-card/80 backdrop-blur-md border-b border-border z-30 sticky top-0">
          <div className="flex items-center min-w-0">
            <button
              aria-label="Open navigation"
              aria-expanded={isSidebarOpen}
              className="focus:outline-none lg:hidden text-gray-500 hover:text-foreground mr-4 p-1 rounded-md flex-shrink-0"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
              <div className="min-w-0"><p className="resident-topbar-context">{complex?.name || "Your home, in one place"}</p><h1 className="text-base sm:text-xl font-semibold text-foreground truncate">{pageTitle}</h1></div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <NotificationBell />
            <Link
              to="/profile"
              className="text-gray-400 hover:text-primary p-2 rounded-full hover:bg-secondary transition-colors"
              title="Profile"
              aria-label="Open profile"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="resident-page flex-1 overflow-y-auto bg-secondary/20 relative">
          <div className="resident-page-content p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
        <AIAssistant />
      </div>
    </div>
  )
}
