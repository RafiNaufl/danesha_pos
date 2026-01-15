import { requireAdmin } from "@/app/lib/admin-auth"
import { auth } from "@/app/lib/auth"
import { getDashboardSummary } from "@/app/actions/admin/dashboard"
import { MetricsCard } from "../components/metrics-card"
import { TrendGraph } from "../components/trend-graph"
import { RecentActivity } from "../components/recent-activity"
import { Alerts } from "../components/alerts"
import { QuickActions } from "../components/quick-actions"
import { Users, CreditCard, Banknote, TrendingUp } from "lucide-react"
import { formatMoney } from "@/lib/utils"

export default async function AdminDashboardPage() {
  await requireAdmin()
  const session = await auth()
  const data = await getDashboardSummary()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Selamat datang kembali, {session?.user?.name}</p>
        </div>
        <div className="text-sm text-muted-foreground bg-white dark:bg-neutral-900 px-3 py-1 rounded-full border shadow-sm">
           {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 min-[769px]:grid-cols-4">
        <MetricsCard 
          title="Total Pendapatan" 
          value={formatMoney(data.metrics.revenue.value)} 
          icon={Banknote}
          trend={{ value: data.metrics.revenue.growth, label: "vs bulan lalu" }}
          variant="blue"
        />
        <MetricsCard 
          title="Total Transaksi" 
          value={data.metrics.transactions.value.toString()} 
          icon={CreditCard}
          trend={{ value: data.metrics.transactions.growth, label: "vs bulan lalu" }}
          variant="indigo"
        />
        <MetricsCard 
          title="Total Member" 
          value={data.metrics.members.value.toString()} 
          icon={Users}
          description={`+${data.metrics.members.newThisMonth} bulan ini`}
          variant="violet"
        />
        <MetricsCard 
          title="Rata-rata Transaksi" 
          value={formatMoney(data.metrics.transactions.value ? data.metrics.revenue.value / data.metrics.transactions.value : 0)} 
          icon={TrendingUp}
          description="Per transaksi"
          variant="emerald"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 min-[769px]:grid-cols-7">
        <TrendGraph data={data.graph} />
        <div className="col-span-3 flex flex-col gap-4">
            <Alerts alerts={data.alerts} />
            <QuickActions />
            <RecentActivity activities={data.recentActivity} />
        </div>
      </div>
    </div>
  )
}
