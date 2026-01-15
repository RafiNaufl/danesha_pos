'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getStockReportSummary, getStockMovements, StockReportFilter } from '@/app/actions/stock'
import { formatMoney } from '@/lib/utils'
import { format } from 'date-fns'
import { Loader2, Package, RefreshCw, History, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, ShoppingCart, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function StockReportView() {
  const [activeTab, setActiveTab] = useState<'summary' | 'history'>('summary')
  const [summaryData, setSummaryData] = useState<any>(null)
  const [movementsData, setMovementsData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  // Summary Filters
  const [productSearch, setProductSearch] = useState('')

  // History Filters
  const [historyPage, setHistoryPage] = useState(1)
  const [historyFilter, setHistoryFilter] = useState<{
    type: string
    productId: string
    startDate: string
    endDate: string
  }>({
    type: 'all',
    productId: 'all',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchSummary()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, historyPage, historyFilter]) // Re-fetch when filters change

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const data = await getStockReportSummary()
      setSummaryData(data)
    } catch (error) {
      console.error(error)
      alert('Gagal memuat ringkasan stok')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const data = await getStockMovements(historyPage, 20, {
        type: historyFilter.type === 'all' ? undefined : (historyFilter.type as any),
        productId: historyFilter.productId === 'all' ? undefined : historyFilter.productId,
        startDate: historyFilter.startDate ? new Date(historyFilter.startDate) : undefined,
        endDate: historyFilter.endDate ? new Date(new Date(historyFilter.endDate).setHours(23, 59, 59, 999)) : undefined
      })
      setMovementsData(data)
    } catch (error) {
      console.error(error)
      alert('Gagal memuat riwayat stok')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = summaryData?.products.filter((p: any) => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b overflow-x-auto">
        <button
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap min-h-[48px] ${activeTab === 'summary' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('summary')}
        >
          Ringkasan & Status
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap min-h-[48px] ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          Riwayat Pergerakan
        </button>
      </div>

      {loading && !summaryData && !movementsData && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

      {activeTab === 'summary' && summaryData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-600">Total SKU</div>
                  <div className="text-2xl font-bold text-blue-900">{summaryData.summary.totalSKU}</div>
                </div>
                <Package className="text-blue-400" size={24} />
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-100">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-green-600">Total Item Tersedia</div>
                  <div className="text-2xl font-bold text-green-900">{summaryData.summary.totalItems}</div>
                </div>
                <ShoppingCart className="text-green-400" size={24} />
              </CardContent>
            </Card>
            <Card className="bg-indigo-50 border-indigo-100">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-indigo-600">Nilai Stok (Estimasi)</div>
                  <div className="text-2xl font-bold text-indigo-900">{formatMoney(summaryData.summary.totalValue)}</div>
                </div>
                <div className="text-xs text-indigo-400 font-mono bg-white/50 px-2 py-1 rounded">Qty × Cost</div>
              </CardContent>
            </Card>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="font-semibold text-lg">Status Stok Produk</h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari produk..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-8 min-h-[44px]"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Nilai Aset</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right font-bold">{p.stock}</TableCell>
                      <TableCell className="text-right text-slate-500">{formatMoney(Number(p.costPrice))}</TableCell>
                      <TableCell className="text-right">{formatMoney(p.value)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.status === 'Aman' ? 'outline' : p.status === 'Menipis' ? 'secondary' : 'destructive'} 
                               className={
                                 p.status === 'Aman' ? 'bg-green-100 text-green-700 border-green-200' : 
                                 p.status === 'Menipis' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 
                                 'bg-red-100 text-red-700 border-red-200'
                               }>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Tidak ada produk ditemukan
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
           {/* Filters */}
           <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
              <div className="flex-1 min-w-[200px]">
                <Select value={historyFilter.productId} onValueChange={(v) => setHistoryFilter({...historyFilter, productId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Produk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Produk</SelectItem>
                    {summaryData?.products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  value={historyFilter.startDate} 
                  onChange={(e) => setHistoryFilter({...historyFilter, startDate: e.target.value})}
                  className="w-auto"
                />
                <span className="text-slate-400">-</span>
                <Input 
                  type="date" 
                  value={historyFilter.endDate} 
                  onChange={(e) => setHistoryFilter({...historyFilter, endDate: e.target.value})}
                  className="w-auto"
                />
              </div>

              <Select value={historyFilter.type} onValueChange={(v) => setHistoryFilter({...historyFilter, type: v})}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semua Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="IN">IN (Masuk)</SelectItem>
                  <SelectItem value="OUT">OUT (Keluar)</SelectItem>
                  <SelectItem value="SALE">SALE (Penjualan)</SelectItem>
                  <SelectItem value="ADJUST">ADJUST (Penyesuaian)</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon" onClick={fetchHistory} title="Refresh">
                <RefreshCw size={16} />
              </Button>
           </div>

           {/* History Table */}
           <div className="bg-white rounded-lg border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>User / Transaksi</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsData?.data.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        m.type === 'IN' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        m.type === 'OUT' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        m.type === 'SALE' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-purple-50 text-purple-700 border-purple-200'
                      }>
                        {m.type === 'IN' && <ArrowDownLeft size={12} className="mr-1" />}
                        {m.type === 'OUT' && <ArrowUpRight size={12} className="mr-1" />}
                        {m.type === 'SALE' && <ShoppingCart size={12} className="mr-1" />}
                        {m.type === 'ADJUST' && <ArrowRightLeft size={12} className="mr-1" />}
                        {m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{m.product.name}</div>
                      <div className="text-xs text-slate-400">{m.product.sku}</div>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${
                      (m.type === 'OUT' || m.type === 'SALE') ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(m.type === 'OUT' || m.type === 'SALE') ? '-' : '+'}{m.quantity}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-500">
                      {formatMoney(Number(m.unitCost))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.user?.name ? (
                        <div className="flex items-center gap-1 text-slate-700">
                          <span className="font-medium">{m.user.name}</span>
                        </div>
                      ) : m.transaction?.number ? (
                        <div className="text-blue-600 font-mono text-xs">{m.transaction.number}</div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 truncate max-w-[200px]" title={m.note || ''}>
                      {m.note || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {movementsData?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Belum ada data pergerakan stok
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {movementsData?.meta && (
              <div className="p-4 border-t flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  Halaman {movementsData.meta.page} dari {movementsData.meta.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setHistoryPage(p => p + 1)}
                    disabled={historyPage >= movementsData.meta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
           </div>
        </div>
      )}
    </div>
  )
}
