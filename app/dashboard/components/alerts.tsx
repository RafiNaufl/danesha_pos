import { AlertTriangle, Info, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AlertItem {
  id: string
  title: string
  description: string
  type: 'info' | 'warning' | 'error'
}

interface AlertsProps {
  alerts: AlertItem[]
}

export function Alerts({ alerts }: AlertsProps) {
  if (alerts.length === 0) return null

  return (
    <Card className="col-span-1 border-none shadow-md bg-amber-50 dark:bg-amber-900/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-amber-800 dark:text-amber-500 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Perlu Perhatian
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex gap-3 items-start">
             <div className="bg-amber-100 p-2 rounded-full shrink-0 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
             </div>
             <div>
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">{alert.title}</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{alert.description}</p>
             </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
