import { Outlet } from "react-router-dom"
import { Building2 } from "lucide-react"

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center animate-in zoom-in duration-500">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg shadow-primary/30">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
          Sign in to your Smart Apartment account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[440px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
        <div className="bg-card/80 py-8 px-6 shadow-2xl shadow-black/5 sm:rounded-2xl sm:px-10 border border-border/50 backdrop-blur-xl">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
