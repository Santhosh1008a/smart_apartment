import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Badge } from "../../components/ui/Badge"
import { listBuildings, createBuilding } from "../../api/admin"
import { Building2, Plus, Loader2, MapPin } from "lucide-react"
import toast from "react-hot-toast"

export default function AdminBuildings() {
  const [buildings, setBuildings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", total_floors: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchBuildings = async () => {
    try {
      setIsLoading(true)
      const res = await listBuildings()
      if (res.success) setBuildings(res.data)
    } catch (err) {
      toast.error("Failed to load buildings")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBuildings()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        name: form.name,
        total_floors: parseInt(form.total_floors) || 1
      }
      const res = await createBuilding(payload)
      if (res.success) {
        toast.success("Building created successfully")
        setForm({ name: "", total_floors: "" })
        setShowForm(false)
        fetchBuildings()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create building")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p>Loading buildings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Buildings Management</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage buildings in your society.</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="w-4 h-4" /> Add Building
        </Button>
      </div>

      {showForm && (
        <Card className="animate-in fade-in slide-in-from-top-2 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Create New Building</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <Input
                required
                placeholder="Building Name (e.g., Block A)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="flex-1"
              />
              <Input
                type="number"
                min="1"
                placeholder="Total Floors (default: 1)"
                value={form.total_floors}
                onChange={(e) => setForm({ ...form, total_floors: e.target.value })}
                className="w-full sm:w-48"
              />
              <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.length === 0 ? (
          <div className="col-span-full py-8 text-center text-gray-500 text-sm">
            No buildings created yet.
          </div>
        ) : (
          buildings.map((building) => (
            <Card key={building.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{building.name}</h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {building.total_floors} Floors
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-border/40 flex justify-between items-center">
                  <Badge variant="outline" className="text-xs">
                    {new Date(building.created_at).toLocaleDateString()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
