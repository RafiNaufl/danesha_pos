import Link from "next/link"
import { Plus, Users, Package, FileText, Tag, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function QuickActions() {
  const actions = [
    { 
      label: "Transaksi Baru", 
      href: "/dashboard/pos", 
      icon: Plus, 
      color: "text-blue-600", 
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-100 dark:border-blue-900/30"
    },
    { 
      label: "Tambah Produk", 
      href: "/dashboard/products", 
      icon: Package, 
      color: "text-indigo-600", 
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      border: "border-indigo-100 dark:border-indigo-900/30"
    },
    { 
      label: "Kelola User", 
      href: "/dashboard/users", 
      icon: Users, 
      color: "text-violet-600", 
      bg: "bg-violet-50 dark:bg-violet-900/20",
      border: "border-violet-100 dark:border-violet-900/30"
    },
    { 
      label: "Laporan", 
      href: "/dashboard/reports", 
      icon: FileText, 
      color: "text-amber-600", 
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-100 dark:border-amber-900/30"
    },
    { 
      label: "Diskon", 
      href: "/dashboard/discounts", 
      icon: Tag, 
      color: "text-emerald-600", 
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-100 dark:border-emerald-900/30"
    },
    { 
      label: "Pengaturan", 
      href: "/dashboard/settings", 
      icon: Settings, 
      color: "text-slate-600", 
      bg: "bg-slate-50 dark:bg-slate-900/20",
      border: "border-slate-100 dark:border-slate-900/30"
    },
  ]

  return (
    <Card className="col-span-1 border-none shadow-md">
      <CardHeader>
        <CardTitle>Aksi Cepat</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link 
            key={action.href} 
            href={action.href}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all hover:scale-105 active:scale-95",
              action.bg,
              action.border
            )}
          >
            <div className={cn("p-2 rounded-full bg-white dark:bg-neutral-800 shadow-sm", action.color)}>
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-center">{action.label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
