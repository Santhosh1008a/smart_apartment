import { useState, useEffect } from "react"
import { Card, CardContent } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Badge } from "../../components/ui/Badge"
import { listUsers, updateUserRole } from "../../api/admin"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table"
import { Loader2, UserCog, ShieldCheck, Wrench, Home, Lock, Crown } from "lucide-react"
import toast from "react-hot-toast"

const ROLES = [
  { value: "resident",  label: "Resident",       icon: Home,       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "security",  label: "Security Guard",  icon: ShieldCheck, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "vendor",    label: "Vendor",          icon: Wrench,     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "admin",     label: "Admin",           icon: Crown,      color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
]

const VENDOR_CATEGORIES = [
  { value: "plumber",      label: "🔧 Plumbing" },
  { value: "electrician",  label: "⚡ Electrical" },
  { value: "carpenter",    label: "🪚 Carpentry" },
  { value: "cleaner",      label: "🧹 Cleaning / Pest Control" },
  { value: "security",     label: "🔒 Security Services" },
  { value: "other",        label: "📋 Other" },
]

const getRoleConfig = (role) => ROLES.find(r => r.value === role) || ROLES[0]

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal state
  const [editModal, setEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [form, setForm] = useState({ role: "resident", vendor_category: "" })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const res = await listUsers()
      if (res.success) setUsers(res.data)
    } catch {
      toast.error("Failed to fetch users")
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (user) => {
    setSelectedUser(user)
    setForm({
      role: user.role,
      vendor_category: user.vendor_category || "",
    })
    setEditModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (form.role === "vendor" && !form.vendor_category) {
      toast.error("Please select a vendor specialization")
      return
    }

    setIsSaving(true)
    try {
      const payload = { role: form.role }
      if (form.role === "vendor") {
        payload.vendor_category = form.vendor_category
      }

      const res = await updateUserRole(selectedUser.id, payload)
      if (res.success) {
        toast.success(`Role updated to ${form.role}${form.role === "vendor" ? ` (${form.vendor_category})` : ""}`)
        setEditModal(false)
        fetchUsers()
      }
    } catch (err) {
      const data = err.response?.data
      if (data?.errors?.length) {
        data.errors.forEach(e => toast.error(`${e.field}: ${e.message}`))
      } else {
        toast.error(data?.message || "Failed to update role")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const selectedRoleConfig = getRoleConfig(form.role)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Manage Users</h2>
        <p className="text-gray-500 text-sm mt-1">Assign roles and manage access for all users in your society.</p>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => {
                    const roleConf = getRoleConfig(u.role)
                    const RoleIcon = roleConf.icon
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-gray-500 text-sm">{u.email}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1.5 capitalize ${roleConf.color}`}>
                            <RoleIcon className="w-3 h-3" />
                            {roleConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.vendor_category ? (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full capitalize">
                              {VENDOR_CATEGORIES.find(c => c.value === u.vendor_category)?.label || u.vendor_category}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(u)}
                            className="gap-1.5 text-violet-600 border-violet-300 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-700"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            Edit Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Modal */}
      <Modal
        isOpen={editModal}
        onClose={() => !isSaving && setEditModal(false)}
        title="Edit User Role"
      >
        {selectedUser && (
          <form onSubmit={handleSave} className="space-y-5 pt-2 overflow-y-auto max-h-[70vh] pr-1">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-bold text-violet-600 text-lg">
                {selectedUser.full_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{selectedUser.full_name}</p>
                <p className="text-xs text-gray-500">{selectedUser.email}</p>
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Assign Role *</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => {
                  const Icon = r.icon
                  const isSelected = form.role === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={isSaving}
                      onClick={() => setForm({ role: r.value, vendor_category: r.value === "vendor" ? form.vendor_category : "" })}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all text-left
                        ${isSelected
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                          : "border-border bg-card hover:bg-secondary/50 text-gray-600 dark:text-gray-400"
                        }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Vendor Category — only shown when role is vendor */}
            {form.role === "vendor" && (
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Vendor Specialization *
                  <span className="text-xs font-normal text-gray-500 ml-1">(Required for vendor role)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {VENDOR_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      disabled={isSaving}
                      onClick={() => setForm(f => ({ ...f, vendor_category: cat.value }))}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md border text-sm font-medium transition-all text-left
                        ${form.vendor_category === cat.value
                          ? "border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                          : "border-border bg-card hover:bg-secondary/50 text-gray-600 dark:text-gray-400"
                        }`}
                    >
                      <span className="truncate">{cat.label}</span>
                      {form.vendor_category === cat.value && (
                        <span className="ml-auto text-amber-600 text-xs font-bold flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                {!form.vendor_category && (
                  <p className="text-xs text-amber-600 mt-1">⚠ Please select a specialization to continue.</p>
                )}
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button type="button" variant="ghost" onClick={() => setEditModal(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || (form.role === "vendor" && !form.vendor_category)}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><UserCog className="w-4 h-4 mr-2" /> Save Role</>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
