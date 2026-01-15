import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"

interface ActivityItem {
  id: string
  description: string
  user: string
  amount: number
  date: Date
  status: string
}

interface RecentActivityProps {
  activities: ActivityItem[]
}

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-red-100 text-red-600",
    "bg-orange-100 text-orange-600",
    "bg-amber-100 text-amber-600",
    "bg-green-100 text-green-600",
    "bg-emerald-100 text-emerald-600",
    "bg-teal-100 text-teal-600",
    "bg-cyan-100 text-cyan-600",
    "bg-blue-100 text-blue-600",
    "bg-indigo-100 text-indigo-600",
    "bg-violet-100 text-violet-600",
    "bg-purple-100 text-purple-600",
    "bg-fuchsia-100 text-fuchsia-600",
    "bg-pink-100 text-pink-600",
    "bg-rose-100 text-rose-600",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="border-none shadow-md">
      <CardHeader>
        <CardTitle>Aktivitas Terbaru</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada aktivitas</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-center group transition-colors p-2 -mx-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <div className={cn("h-9 w-9 rounded-full flex items-center justify-center border font-bold shadow-sm transition-transform group-hover:scale-105", getAvatarColor(activity.user))}>
                  <span className="text-xs">
                    {activity.user[0]}
                  </span>
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none group-hover:text-blue-600 transition-colors">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user} • {formatDistanceToNow(activity.date, { addSuffix: true, locale: id })}
                  </p>
                </div>
                <div className={cn(
                  "ml-auto font-medium text-sm",
                  activity.status === 'PAID' ? "text-green-600" : "text-neutral-900 dark:text-neutral-100"
                )}>
                  {activity.status === 'PAID' ? '+' : ''}{formatMoney(activity.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
