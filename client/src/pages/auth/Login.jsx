import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useAuthStore } from "../../store/useAuthStore"
import { loginUser } from "../../api/auth"
import { getRoleBasedPath } from "../../utils/rolePath"
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Info } from "lucide-react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const login = useAuthStore((state) => state.login)
  const isAuthReady = useAuthStore((state) => state.isAuthReady)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    
    try {
      const res = await loginUser(email, password)
      login(res.user, res.accessToken)
      navigate(getRoleBasedPath(res.user.role))
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed. Please try again."
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Email address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Mail className="h-4 w-4" />
            </div>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Lock className="h-4 w-4" />
            </div>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-11"
              placeholder="••••••••"
            />
          </div>
        </div>
        
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Password recovery is not available because no verified email delivery service is configured. Contact your apartment administrator for help.</p>
        </div>
      </div>

      {!isAuthReady && <p role="status" className="text-center text-xs text-gray-500">Checking existing session…</p>}
      <Button
        type="submit"
        disabled={isLoading || !isAuthReady}
        className="w-full h-11 text-base group"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            Sign in
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </Button>
      
      <p className="mt-6 text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-primary hover:text-primary-hover">
          Register here
        </Link>
      </p>
    </form>
  )
}
