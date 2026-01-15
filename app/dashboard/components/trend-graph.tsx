'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { formatMoney } from "@/lib/utils"

interface TrendGraphProps {
  data: {
    date: string
    revenue: number
  }[]
}

export function TrendGraph({ data }: TrendGraphProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card className="col-span-1 min-[769px]:col-span-4 min-w-0 border-none shadow-md">
        <CardHeader>
          <CardTitle>Trend Pendapatan (30 Hari Terakhir)</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px] w-full bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-1 min-[769px]:col-span-4 min-w-0 border-none shadow-md">
      <CardHeader>
        <CardTitle>Trend Pendapatan (30 Hari Terakhir)</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                minTickGap={32}
              />
              <YAxis 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `Rp${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: any) => [formatMoney(Number(value)), "Pendapatan"]}
                labelStyle={{ color: "black" }}
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#2563eb" 
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: "#2563eb" }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
