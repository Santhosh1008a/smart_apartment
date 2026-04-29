import { useState, useEffect } from "react"
import { Card, CardContent } from "../../components/ui/Card"
import { listUsers, updateUserRole } from "../../api/admin"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table"
import { Loader2 } from "lucide-react"
import toast from "react-hot-toast"

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const res = await listUsers()
      if(res.success) setUsers(res.data)
    } catch(err) {
      toast.error("Failed to fetch users")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, { role: newRole })
      toast.success("Role updated successfully")
      fetchUsers()
    } catch(err) {
      toast.error(err.response?.data?.message || "Failed to update role")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Manage Users</h2>
        <p className="text-gray-500 text-sm mt-1">Assign roles and manage access for all users.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
             <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-gray-500">{u.email}</TableCell>
                    <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <select 
                        className="p-1.5 border rounded-md text-sm bg-card"
                        value={u.role} 
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="resident">Resident</option>
                        <option value="vendor">Vendor</option>
                        <option value="security">Security Guard</option>
                        <option value="admin">Admin</option>
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
