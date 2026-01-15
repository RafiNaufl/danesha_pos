import { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricsCardProps {
  title: string
  value: string
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  className?: string
  variant?: "default" | "blue" | "indigo" | "violet" | "emerald" | "amber"
}

const variants = {
  default: "bg-card text-card-foreground",
  blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600",
  indigo: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-600",
  violet: "bg-gradient-to-br from-violet-500 to-violet-600 text-white border-violet-600",
  emerald: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-600",
  amber: "bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-600",
}

const iconVariants = {
  default: "text-muted-foreground",
  blue: "text-blue-100",
  indigo: "text-indigo-100",
  violet: "text-violet-100",
  emerald: "text-emerald-100",
  amber: "text-amber-100",
}

export function MetricsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  variant = "default",
}: MetricsCardProps) {
  const isColored = variant !== "default"

  return (
    <Card className={cn("overflow-hidden relative", variants[variant], className)}>
      <div className={cn("absolute right-0 top-0 h-24 w-24 rounded-full opacity-10 transform translate-x-8 -translate-y-8 pointer-events-none", isColored ? "bg-white" : "bg-primary")} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className={cn("text-sm font-medium", isColored ? "text-white/90" : "")}>
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", iconVariants[variant])} />
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <p className={cn("text-xs mt-1", isColored ? "text-white/80" : "text-muted-foreground")}>
            {trend && (
              <span className={cn(
                "mr-1 font-medium",
                isColored 
                  ? "text-white" 
                  : trend.value > 0 ? "text-green-600" : trend.value < 0 ? "text-red-600" : "text-gray-600"
              )}>
                {trend.value > 0 ? "+" : ""}{trend.value.toFixed(1)}%
              </span>
            )}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
