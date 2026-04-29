import { useState, useRef, useEffect } from "react"
import { useAuthStore } from "../../store/useAuthStore"
import { updateProfile, changePassword, uploadAvatar } from "../../api/auth"
import {
  User, Mail, Phone, Shield, Lock, Eye, EyeOff, Camera,
  Building2, Home, Car, Wrench, CheckCircle, AlertCircle,
  Save, KeyRound, X, BadgeCheck, Globe
} from "lucide-react"

const ROLE_LABELS = {
  resident: "Resident",
  admin: "Administrator",
  super_admin: "Super Admin",
  security: "Security Guard",
  vendor: "Vendor",
}

const ROLE_COLORS = {
  resident: { bg: "from-indigo-500 to-purple-600", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  admin: { bg: "from-violet-500 to-purple-700", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  super_admin: { bg: "from-indigo-600 to-blue-700", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  security: { bg: "from-emerald-500 to-teal-600", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  vendor: { bg: "from-amber-500 to-orange-600", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-top-2 duration-300 ${
      type === "success"
        ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300"
        : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
    }`}>
      {type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export default function ProfileSettings() {
  const { user, complex, building, unit, parking, roleContext, updateUser } = useAuthStore()
  const role = user?.role || "resident"
  const colors = ROLE_COLORS[role] || ROLE_COLORS.resident

  // Toast state
  const [toast, setToast] = useState(null)
  const showToast = (message, type = "success") => setToast({ message, type })

  // Avatar
  const fileRef = useRef(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)

  // Profile form
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    emergency_contact: user?.emergency_contact || "",
  })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password form
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" })
  const [pwLoading, setPwLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState("profile")

  const avatarUrl = avatarPreview || user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || "user"}`

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarLoading(true)
    try {
      const res = await uploadAvatar(file)
      if (res.success) {
        updateUser({ avatar_url: res.data.avatar_url })
        showToast("Avatar updated successfully!")
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to upload avatar", "error")
      setAvatarPreview(null)
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const res = await updateProfile(profileForm)
      if (res.success) {
        updateUser(res.data)
        showToast("Profile updated successfully!")
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update profile", "error")
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm_password) {
      showToast("New passwords do not match", "error")
      return
    }
    if (pwForm.new_password.length < 6) {
      showToast("Password must be at least 6 characters", "error")
      return
    }
    setPwLoading(true)
    try {
      const res = await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password })
      if (res.success) {
        showToast("Password changed successfully!")
        setPwForm({ current_password: "", new_password: "", confirm_password: "" })
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to change password", "error")
    } finally {
      setPwLoading(false)
    }
  }

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Manage your account information and preferences</p>
      </div>

      {/* Hero Avatar Card */}
      <div className={`relative rounded-2xl bg-gradient-to-br ${colors.bg} p-6 sm:p-8 mb-6 overflow-hidden shadow-lg`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white transform translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white transform -translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl bg-white/20">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}` }}
              />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarLoading}
              className="absolute -bottom-2 -right-2 w-9 h-9 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-60"
              title="Change avatar"
            >
              {avatarLoading
                ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                : <Camera className="w-4 h-4 text-gray-700" />
              }
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* User Info */}
          <div className="text-center sm:text-left text-white">
            <h2 className="text-xl sm:text-2xl font-bold">{user?.full_name}</h2>
            <p className="text-white/80 text-sm mt-0.5">{user?.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <BadgeCheck className="w-3.5 h-3.5" />
                {ROLE_LABELS[role]}
              </span>
              {complex?.name && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" />
                  {complex.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific Info Card */}
      {role === "resident" && (unit || parking) && (
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Home className="w-4 h-4" /> Apartment Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {complex?.name && (
              <InfoField label="Society" value={complex.name} icon={<Globe className="w-4 h-4 text-indigo-500" />} />
            )}
            {building?.name && (
              <InfoField label="Building / Block" value={building.name} icon={<Building2 className="w-4 h-4 text-indigo-500" />} />
            )}
            {unit?.unit_number && (
              <InfoField label="Unit Number" value={`Unit ${unit.unit_number}`} icon={<Home className="w-4 h-4 text-indigo-500" />} />
            )}
            {parking?.slot_number && (
              <InfoField label="Parking Slot" value={`${parking.slot_number} (${parking.type || "car"})`} icon={<Car className="w-4 h-4 text-indigo-500" />} />
            )}
          </div>
        </div>
      )}

      {role === "vendor" && (
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Vendor Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {complex?.name && (
              <InfoField label="Assigned Society" value={complex.name} icon={<Building2 className="w-4 h-4 text-amber-500" />} />
            )}
            {roleContext?.category && (
              <InfoField label="Specialization" value={roleContext.category.charAt(0).toUpperCase() + roleContext.category.slice(1)} icon={<Wrench className="w-4 h-4 text-amber-500" />} />
            )}
            <InfoField label="Total Jobs" value={roleContext?.total_jobs ?? 0} icon={<CheckCircle className="w-4 h-4 text-amber-500" />} />
          </div>
        </div>
      )}

      {role === "security" && (
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Security Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {complex?.name && (
              <InfoField label="Assigned Society" value={complex.name} icon={<Building2 className="w-4 h-4 text-emerald-500" />} />
            )}
            <InfoField label="Duty Role" value={roleContext?.duty || "Security Guard"} icon={<Shield className="w-4 h-4 text-emerald-500" />} />
            <InfoField label="Shift" value={roleContext?.shift || "General"} icon={<CheckCircle className="w-4 h-4 text-emerald-500" />} />
          </div>
        </div>
      )}

      {(role === "admin" || role === "super_admin") && (
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BadgeCheck className="w-4 h-4" /> Administration Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {complex?.name && (
              <InfoField label={role === "super_admin" ? "Platform" : "Managed Society"} value={complex.name || "All Societies"} icon={<Building2 className="w-4 h-4 text-violet-500" />} />
            )}
            <InfoField label="Platform Role" value={ROLE_LABELS[role]} icon={<BadgeCheck className="w-4 h-4 text-violet-500" />} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 sm:px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-gray-500 hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSave} className="p-5 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {/* Full Name */}
              <FormField
                label="Full Name"
                icon={<User className="w-4 h-4" />}
                required
              >
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="Your full name"
                  required
                />
              </FormField>

              {/* Phone */}
              <FormField label="Phone Number" icon={<Phone className="w-4 h-4" />} required>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="Phone number"
                  required
                />
              </FormField>

              {/* Email (read-only) */}
              <FormField label="Email Address" icon={<Mail className="w-4 h-4" />} readOnly>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/40 text-gray-500 text-sm cursor-not-allowed"
                />
              </FormField>

              {/* Role (read-only) */}
              <FormField label="Account Role" icon={<Shield className="w-4 h-4" />} readOnly>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary/40">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.badge}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
              </FormField>

              {/* Emergency Contact */}
              <FormField label="Emergency Contact" icon={<Phone className="w-4 h-4 text-red-400" />} hint="Optional – name and number">
                <input
                  type="text"
                  value={profileForm.emergency_contact}
                  onChange={e => setProfileForm(p => ({ ...p, emergency_contact: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="e.g. Jane Doe – 9876543210"
                />
              </FormField>
            </div>

            <div className="mt-6 sm:mt-8 flex justify-end">
              <button
                type="submit"
                disabled={profileLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {profileLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4" />Save Changes</>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <form onSubmit={handlePasswordChange} className="p-5 sm:p-8">
            <p className="text-sm text-gray-500 mb-6">Keep your account safe by using a strong, unique password.</p>
            <div className="max-w-md space-y-5">
              <PasswordField
                label="Current Password"
                value={pwForm.current_password}
                show={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
                onChange={v => setPwForm(p => ({ ...p, current_password: v }))}
                placeholder="Enter current password"
                required
              />
              <PasswordField
                label="New Password"
                value={pwForm.new_password}
                show={showNew}
                onToggle={() => setShowNew(v => !v)}
                onChange={v => setPwForm(p => ({ ...p, new_password: v }))}
                placeholder="Min. 6 characters"
                required
              />
              <PasswordField
                label="Confirm New Password"
                value={pwForm.confirm_password}
                show={showConfirm}
                onToggle={() => setShowConfirm(v => !v)}
                onChange={v => setPwForm(p => ({ ...p, confirm_password: v }))}
                placeholder="Repeat new password"
                required
              />

              {/* Strength hints */}
              {pwForm.new_password && (
                <div className="text-xs text-gray-400 space-y-1">
                  <p className={pwForm.new_password.length >= 6 ? "text-emerald-500" : "text-red-400"}>
                    {pwForm.new_password.length >= 6 ? "✓" : "✗"} At least 6 characters
                  </p>
                  <p className={pwForm.new_password === pwForm.confirm_password && pwForm.confirm_password ? "text-emerald-500" : "text-gray-400"}>
                    {pwForm.new_password === pwForm.confirm_password && pwForm.confirm_password ? "✓" : "–"} Passwords match
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 sm:mt-8 flex justify-start">
              <button
                type="submit"
                disabled={pwLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pwLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Changing...</>
                ) : (
                  <><KeyRound className="w-4 h-4" />Change Password</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Sub-components
function FormField({ label, icon, children, readOnly, hint, required }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <span className="text-gray-400">{icon}</span>
        {label}
        {required && <span className="text-red-400">*</span>}
        {readOnly && <span className="text-xs text-gray-400 font-normal ml-1">(read-only)</span>}
        {hint && <span className="text-xs text-gray-400 font-normal ml-1">– {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function InfoField({ label, value, icon }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{value ?? "—"}</p>
      </div>
    </div>
  )
}

function PasswordField({ label, value, show, onToggle, onChange, placeholder, required }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-foreground"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
