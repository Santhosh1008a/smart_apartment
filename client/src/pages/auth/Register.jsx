import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { registerUser, getComplexes } from "../../api/auth"
import { Mail, Lock, User, Phone, Loader2, AlertCircle, CheckCircle2, Building } from "lucide-react"
import { useEffect } from "react"

export default function Register() {
  const [formData, setFormData] = useState({ full_name: "", email: "", phone: "", password: "", complex_id: "" })
  const [complexes, setComplexes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    const fetchComplexes = async () => {
      try {
        const res = await getComplexes()
        if (res.success) setComplexes(res.data)
      } catch (err) {
        console.error("Failed to fetch complexes", err)
      }
    }
    fetchComplexes()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      await registerUser(formData)
      setSuccess("Account created successfully! Redirecting to login...")
      setTimeout(() => navigate("/login"), 1500)
    } catch (err) {
      const msg = err.response?.data?.message || "Registration failed. Please try again."
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="text-center mb-6 mt-[-1rem]">
        <h3 className="text-xl font-bold">Create an account</h3>
        <p className="text-sm text-gray-500 mt-1">Join your apartment community</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <User className="h-4 w-4" />
          </div>
          <Input required type="text" name="name" autoComplete="name" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="pl-10 h-11" placeholder="John Doe" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Society / Complex</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Building className="h-4 w-4" />
          </div>
          <select 
            required 
            value={formData.complex_id} 
            onChange={e => setFormData({...formData, complex_id: e.target.value})} 
            className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-10"
          >
            <option value="" disabled>Select your society</option>
            {complexes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Email address</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Mail className="h-4 w-4" />
          </div>
          <Input required type="email" name="email" autoComplete="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-10 h-11" placeholder="you@example.com" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Phone Number</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Phone className="h-4 w-4" />
          </div>
          <Input 
            required 
            type="tel" 
            name="phone"
            autoComplete="tel"
            pattern="[6-9][0-9]{9}"
            title="Please enter a valid 10-digit Indian phone number starting with 6-9"
            maxLength={10}
            value={formData.phone} 
            onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} 
            className="pl-10 h-11" 
            placeholder="9876543210" 
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Must be a 10-digit number starting with 6-9</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Password</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Lock className="h-4 w-4" />
          </div>
          <Input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="pl-10 h-11" placeholder="••••••••" />
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full h-11 mt-4">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Register"}
      </Button>

      <p className="text-center text-sm text-gray-500 pt-2">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </form>
  )
}
