import { useState } from "react"
import { AlertTriangle, Flame, HeartPulse, ShieldAlert, PhoneCall, Loader2 } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"

export default function Emergency() {
  const [isTriggering, setIsTriggering] = useState(false)
  const [activeAlert, setActiveAlert] = useState(null)

  const handleSOS = (type) => {
    setIsTriggering(true)
    setTimeout(() => {
      setActiveAlert({
        id: "EMG-8992",
        type: type,
        status: "Active - Security Dispatched",
        time: new Date().toLocaleTimeString(),
      })
      setIsTriggering(false)
    }, 1500)
  }

  const sosTypes = [
    { id: "medical", name: "Medical Emergency", icon: HeartPulse, color: "bg-red-500 hover:bg-red-600", text: "text-red-500" },
    { id: "fire", name: "Fire Alarm", icon: Flame, color: "bg-orange-500 hover:bg-orange-600", text: "text-orange-500" },
    { id: "security", name: "Security Threat", icon: ShieldAlert, color: "bg-purple-500 hover:bg-purple-600", text: "text-purple-500" },
  ]

  const emergencyContacts = [
    { name: "Building Security (Main Gate)", phone: "+91 98765 43210" },
    { name: "City Police Station", phone: "100" },
    { name: "City Hospital Ambulance", phone: "108" },
    { name: "Fire Department", phone: "101" },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center sm:justify-start">
          <AlertTriangle className="w-6 h-6 mr-2 text-danger" /> 
          Emergency Center
        </h2>
        <p className="text-sm text-gray-500 mt-1">Trigger SOS alerts and find emergency contacts</p>
      </div>

      {activeAlert && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-6 shadow-sm animate-in zoom-in duration-300">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 dark:text-red-400">SOS Alert Active</h3>
              <p className="text-red-700 dark:text-red-300/80 text-sm mt-0.5">
                {activeAlert.type} • Triggered at {activeAlert.time}
              </p>
            </div>
            <Badge variant="destructive" className="bg-red-600 animate-pulse hidden sm:flex border-transparent">
              {activeAlert.status}
            </Badge>
          </div>
          <p className="mt-4 text-sm text-red-800 dark:text-red-200 bg-red-100/50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200/50 dark:border-red-800/50">
            Security and emergency contacts have been notified. Please stay calm and remain in a safe location. Help is on the way.
          </p>
          <div className="mt-4 flex justify-end">
             <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 bg-background" onClick={() => setActiveAlert(null)}>
               False Alarm / Cancel
             </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sosTypes.map((type) => (
          <button
            key={type.id}
            disabled={isTriggering || activeAlert}
            onClick={() => handleSOS(type.name)}
            className={`relative overflow-hidden group flex flex-col items-center justify-center p-8 rounded-2xl border-none shadow-lg transition-all transform hover:-translate-y-1 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${activeAlert ? 'bg-secondary blur-[2px]' : 'bg-card'}`}
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${type.color} bg-opacity-10`} />
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-inner bg-background ${type.text}`}>
              {isTriggering ? <Loader2 className="w-10 h-10 animate-spin" /> : <type.icon className="w-10 h-10" />}
            </div>
            <h3 className="text-lg font-bold text-foreground relative z-10">{type.name}</h3>
            <p className="text-xs text-gray-500 mt-2 text-center uppercase tracking-widest font-semibold relative z-10">Tap to trigger</p>
          </button>
        ))}
      </div>

      <Card className="mt-8 shadow-md border-none">
        <CardHeader className="bg-secondary/30 border-b border-border/50 pb-4">
          <CardTitle className="text-lg flex items-center">
            <PhoneCall className="w-5 h-5 mr-2 text-primary" />
            Important Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {emergencyContacts.map((contact, i) => (
              <div key={i} className={`p-5 flex justify-between items-center hover:bg-secondary/20 transition-colors ${i > 1 ? 'border-t border-border' : ''}`}>
                <div>
                  <p className="font-semibold text-foreground text-sm">{contact.name}</p>
                  <p className="text-xl font-mono font-bold text-gray-700 dark:text-gray-300 mt-1">{contact.phone}</p>
                </div>
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                  <PhoneCall className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
