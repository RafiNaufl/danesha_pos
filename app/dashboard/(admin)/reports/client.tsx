'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Filter, Printer, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wallet, Box, Percent, Scissors, Banknote, TrendingUp, AlertTriangle, AlertCircle, Download, Loader2 } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { cn, formatMoney } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getFinancialReport, getProductCategoryDetails, ReportFilters, CategoryInsightStats } from '@/app/actions/reports'
import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import StockReportView from './StockReportView'

type Option = { id: string, name: string, memberCode?: string, code?: string }

// Component for Expandable Category Row
const CategoryRow = ({ 
  category, 
  date,
  filters, 
  totalProductOmzet 
}: { 
  category: { categoryId: string, categoryName: string, categoryCode: string, omzet: number }, 
  date: DateRange | undefined,
  filters: { memberId: string, therapistId: string, paymentMethod: string }, 
  totalProductOmzet: number 
}) => {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<CategoryInsightStats | null>(null)

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)
    if (!details && date?.from && date?.to) {
      setLoading(true)
      try {
        const fromDate = new Date(date.from)
        fromDate.setHours(0, 0, 0, 0)
        const toDate = new Date(date.to)
        toDate.setHours(23, 59, 59, 999)

        const reportFilters: ReportFilters = {
            from: fromDate,
            to: toDate,
            memberId: filters.memberId !== 'all' ? filters.memberId : undefined,
            therapistId: filters.therapistId !== 'all' ? filters.therapistId : undefined,
            paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined
        }

        const data = await getProductCategoryDetails(category.categoryId, totalProductOmzet, reportFilters)
        setDetails(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="border rounded-md bg-white overflow-hidden transition-all shadow-sm">
       <div 
         className={cn(
            "flex justify-between items-center text-sm p-3 cursor-pointer hover:bg-slate-50 transition-colors min-h-[48px]",
            expanded && "bg-slate-50 border-b"
         )}
         onClick={handleExpand}
       >
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            <div>
              <span className="font-medium text-slate-900">{category.categoryName}</span>
              <span className="text-xs text-muted-foreground ml-1">({category.categoryCode})</span>
            </div>
          </div>
          <div className="font-bold text-slate-900">{formatMoney(category.omzet)}</div>
       </div>
       
       {expanded && (
         <div className="p-4 bg-slate-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
            {loading ? (
                <div className="flex justify-center py-4 text-xs text-slate-500">
                   Loading insights...
                </div>
            ) : details ? (
                <div className="space-y-4">
                   {/* 1. Key Metrics Grid */}
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white p-2 rounded border shadow-sm">
                         <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Profit</div>
                         <div className="font-bold text-green-600 text-sm">{formatMoney(details.profit)}</div>
                      </div>
                      <div className="bg-white p-2 rounded border shadow-sm">
                         <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Margin</div>
                         <div className={cn("font-bold text-sm", details.margin < 20 ? "text-orange-600" : "text-blue-600")}>
                            {details.margin}%
                         </div>
                      </div>
                      <div className="bg-white p-2 rounded border shadow-sm">
                         <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Qty Terjual</div>
                         <div className="font-bold text-slate-700 text-sm">{details.qty}</div>
                      </div>
                      <div className="bg-white p-2 rounded border shadow-sm">
                         <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Kontribusi</div>
                         <div className="font-bold text-purple-600 text-sm">{details.contribution}%</div>
                      </div>
                   </div>

                   {/* 2. Top Products */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Top 3 Sales */}
                      <div>
                         <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <TrendingUp size={12} /> Top 3 Omzet
                         </h4>
                         <div className="space-y-1">
                            {details.top3Omzet.map(p => (
                                <div key={p.productId} className="flex justify-between text-xs bg-white p-1.5 rounded border border-slate-100">
                                   <span className="truncate flex-1 pr-2">{p.productName}</span>
                                   <span className="font-medium text-slate-700">{formatMoney(p.omzet)}</span>
                                </div>
                            ))}
                         </div>
                      </div>
                      
                      {/* Top 3 Qty */}
                      <div>
                         <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                            <Box size={12} /> Top 3 Qty
                         </h4>
                         <div className="space-y-1">
                            {details.top3Qty.map(p => (
                                <div key={p.productId} className="flex justify-between text-xs bg-white p-1.5 rounded border border-slate-100">
                                   <span className="truncate flex-1 pr-2">{p.productName}</span>
                                   <span className="font-medium bg-slate-100 px-1.5 rounded text-slate-600">{p.qty}</span>
                                </div>
                            ))}
                         </div>
                      </div>
                   </div>

                   {/* 3. Warnings / Alerts */}
                   {(details.lossIndication.length > 0 || (details.lowestMargin.length > 0 && details.lowestMargin[0].margin < 15)) && (
                       <div className="space-y-2 pt-2 border-t border-slate-200">
                          {details.lossIndication.length > 0 && (
                             <div className="bg-red-50 border border-red-100 rounded p-2 text-xs text-red-700">
                                <div className="font-semibold flex items-center gap-1 mb-1">
                                   <AlertCircle size={12} /> Produk Rugi (Loss Maker)
                                </div>
                                {details.lossIndication.slice(0, 3).map(p => (
                                   <div key={p.productId} className="flex justify-between pl-4">
                                      <span>{p.productName}</span>
                                      <span className="font-mono">{formatMoney(p.profit)}</span>
                                   </div>
                                ))}
                             </div>
                          )}
                          
                          {details.lowestMargin.length > 0 && details.lowestMargin[0].margin < 15 && (
                             <div className="bg-orange-50 border border-orange-100 rounded p-2 text-xs text-orange-700">
                                <div className="font-semibold flex items-center gap-1 mb-1">
                                   <AlertTriangle size={12} /> Margin Rendah (&lt;15%)
                                </div>
                                {details.lowestMargin.filter(m => m.margin < 15).slice(0, 3).map(p => (
                                   <div key={p.productId} className="flex justify-between pl-4">
                                      <span>{p.productName}</span>
                                      <span className="font-mono">{p.margin}%</span>
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>
                   )}
                </div>
            ) : null}
         </div>
       )}
    </div>
  )
}

type Props = {
  options: {
    categories: { id: string, name: string, code: string }[]
    members: { id: string, name: string, memberCode: string }[]
    therapists: { id: string, name: string }[]
    paymentMethods: string[]
  }
}

export default function ReportsClient({ options }: Props) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })
  
  const [filters, setFilters] = useState({
    categoryCode: 'all',
    memberId: 'all',
    therapistId: 'all',
    paymentMethod: 'all'
  })

  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [mainTab, setMainTab] = useState<'financial' | 'stock'>('financial')
  const [reportData, setReportData] = useState<any>(null)

  const fetchReport = async () => {
    if (!date?.from || !date?.to) return
    setLoading(true)

    // Normalize dates to ensure full day coverage (00:00:00 to 23:59:59)
    const fromDate = new Date(date.from)
    fromDate.setHours(0, 0, 0, 0)
    
    const toDate = new Date(date.to)
    toDate.setHours(23, 59, 59, 999)

    try {
      const data = await getFinancialReport({
        from: fromDate,
        to: toDate,
        categoryCode: filters.categoryCode !== 'all' ? filters.categoryCode : undefined,
        memberId: filters.memberId !== 'all' ? filters.memberId : undefined,
        therapistId: filters.therapistId !== 'all' ? filters.therapistId : undefined,
        paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
        page,
        limit: 20
      })
      setReportData(data)
    } catch (error) {
      console.error(error)
      alert('Gagal memuat laporan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [page]) // Refetch on page change

  const handleExportExcel = async () => {
    if (!date?.from || !date?.to) return
    setExporting(true)

    try {
      // 1. Fetch ALL Data
      const fromDate = new Date(date.from)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(date.to)
      toDate.setHours(23, 59, 59, 999)

      const fullData = await getFinancialReport({
        from: fromDate,
        to: toDate,
        categoryCode: filters.categoryCode !== 'all' ? filters.categoryCode : undefined,
        memberId: filters.memberId !== 'all' ? filters.memberId : undefined,
        therapistId: filters.therapistId !== 'all' ? filters.therapistId : undefined,
        paymentMethod: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
        page: 1,
        limit: 100000 // Large limit to get all
      })

      // 2. Create Workbook
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'POS Danesha'
      workbook.created = new Date()

      // --- SHEET 1: RINGKASAN ---
      const sheetSummary = workbook.addWorksheet('Ringkasan')
      
      // Header
      sheetSummary.mergeCells('A1:E1')
      const titleCell = sheetSummary.getCell('A1')
      titleCell.value = 'LAPORAN KEUANGAN DANESHA'
      titleCell.font = { size: 16, bold: true }
      titleCell.alignment = { horizontal: 'center' }

      sheetSummary.mergeCells('A2:E2')
      const periodCell = sheetSummary.getCell('A2')
      periodCell.value = `Periode: ${format(fromDate, 'dd MMM yyyy')} - ${format(toDate, 'dd MMM yyyy')}`
      periodCell.alignment = { horizontal: 'center' }

      // Key Stats
      sheetSummary.addRow([])
      sheetSummary.addRow(['RINGKASAN UTAMA']).font = { bold: true }
      
      const stats = fullData.stats
      const statsRows = [
        ['Total Omzet', stats.omzet],
        ['Total Modal', stats.modal],
        ['Total Profit (Gross)', stats.omzet - stats.modal],
        ['Total Diskon', stats.diskon],
        ['Komisi Therapist', stats.komisi],
        ['Laba Bersih', stats.laba - stats.komisi]
      ]

      statsRows.forEach(row => {
        const r = sheetSummary.addRow(row)
        r.getCell(2).numFmt = '#,##0'
      })

      // Payment Method Stats
      sheetSummary.addRow([])
      sheetSummary.addRow(['BREAKDOWN PEMBAYARAN']).font = { bold: true }
      if (fullData.paymentMethodStats && fullData.paymentMethodStats.length > 0) {
        fullData.paymentMethodStats.forEach((p: any) => {
           const r = sheetSummary.addRow([p.method, p.total, `${p.count} tx`])
           r.getCell(2).numFmt = '#,##0'
        })
      } else {
        sheetSummary.addRow(['Tidak ada data pembayaran'])
      }

      // Product Stats
      sheetSummary.addRow([])
      sheetSummary.addRow(['PERFORMA PRODUK']).font = { bold: true }
      sheetSummary.addRow(['Total Omzet Produk', fullData.productStats.totalOmzet]).getCell(2).numFmt = '#,##0'
      sheetSummary.addRow(['Total Profit Produk', fullData.productStats.totalProfit]).getCell(2).numFmt = '#,##0'
      sheetSummary.addRow(['Total Qty Terjual', fullData.productStats.totalQty])

      sheetSummary.addRow(['Breakdown Kategori:'])
      fullData.productStats.byCategory.forEach((c: any) => {
        sheetSummary.addRow([`  - ${c.categoryName}`, c.omzet]).getCell(2).numFmt = '#,##0'
      })

      // Therapist Stats
      sheetSummary.addRow([])
      sheetSummary.addRow(['PERFORMA THERAPIST']).font = { bold: true }
      sheetSummary.addRow(['Total Omzet Treatment', fullData.therapistStats.totalTreatmentOmzet]).getCell(2).numFmt = '#,##0'
      sheetSummary.addRow(['Total Komisi', fullData.therapistStats.totalCommission]).getCell(2).numFmt = '#,##0'
      
      sheetSummary.addRow(['Breakdown Therapist:'])
      sheetSummary.addRow(['Nama Therapist', 'Omzet', 'Komisi', 'Total Tx', 'Main Tx', 'Asst Tx', 'Avg Omzet'])
      fullData.therapistStats.byTherapist.forEach((t: any) => {
        const r = sheetSummary.addRow([t.therapistName, t.omzet, t.commission, t.treatmentCount, t.mainCount || 0, t.assistantCount || 0, t.avgOmzet])
        r.getCell(2).numFmt = '#,##0'
        r.getCell(3).numFmt = '#,##0'
        r.getCell(7).numFmt = '#,##0'
      })

      // Auto width for Summary
      sheetSummary.columns = [
        { width: 30 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 15 }
      ]


      // --- SHEET 2: DETAIL TRANSAKSI ---
      const sheetDetail = workbook.addWorksheet('Detail Transaksi')
      
      sheetDetail.columns = [
        { header: 'Tanggal', key: 'date', width: 15 },
        { header: 'No. Transaksi', key: 'number', width: 20 },
        { header: 'Tipe', key: 'type', width: 12 },
        { header: 'Item', key: 'item', width: 30 },
        { header: 'Qty', key: 'qty', width: 8 },
        { header: 'Harga Total', key: 'price', width: 15 },
        { header: 'Member', key: 'member', width: 20 },
        { header: 'Kategori', key: 'category', width: 15 },
        { header: 'Therapist', key: 'therapist', width: 20 },
        { header: 'Metode Pembayaran', key: 'paymentMethod', width: 20 },
      ]

      // Style Header
      const headerRow = sheetDetail.getRow(1)
      headerRow.font = { bold: true }
      headerRow.border = { bottom: { style: 'thin' } }

      // Add Rows
      fullData.data.forEach((tx: any) => {
        if (filters.therapistId !== 'all') {
             // ITEM LEVEL
             sheetDetail.addRow({
                date: new Date(tx.date),
                number: tx.number,
                type: tx.type,
                item: tx.itemName,
                qty: tx.qty,
                price: tx.price,
                member: tx.member,
                category: tx.category,
                therapist: tx.therapists,
                paymentMethod: tx.paymentMethod
             })
        } else {
             // TRANSACTION LEVEL
             sheetDetail.addRow({
                date: new Date(tx.date),
                number: tx.number,
                type: 'TRANSACTION',
                item: tx.itemsDetail?.map((i: any) => `${i.name} (${i.qty})`).join(', ') || '-',
                qty: tx.qty,
                price: tx.price,
                member: tx.member,
                category: tx.category,
                therapist: tx.therapists,
                paymentMethod: tx.paymentMethod
             })
        }
      })
      
      // Format Date and Numbers in Detail
      sheetDetail.getColumn('price').numFmt = '#,##0'
      sheetDetail.getColumn('date').numFmt = 'dd/mm/yyyy hh:mm'

      // 3. Generate File
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const fileName = `Laporan_Keuangan_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
      
      saveAs(blob, fileName)
      alert('Laporan berhasil diekspor!')
      
    } catch (error) {
      console.error('Export Error:', error)
      alert('Gagal mengekspor laporan. Silakan coba lagi.')
    } finally {
      setExporting(false)
    }
  }

  const handleApplyFilter = () => {
    setPage(1)
    fetchReport()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Laporan</h1>
        
        {/* Main Tab Switcher */}
        <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
          <button
            onClick={() => setMainTab('financial')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              mainTab === 'financial' ? "bg-white shadow text-blue-600" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Laporan Keuangan
          </button>
          <button
            onClick={() => setMainTab('stock')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              mainTab === 'stock' ? "bg-white shadow text-blue-600" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Laporan Stok
          </button>
        </div>

        {mainTab === 'financial' && (
          <Button 
            onClick={handleExportExcel} 
            disabled={exporting}
            variant="outline" 
            className="gap-2"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export Excel
          </Button>
        )}
      </div>

      {mainTab === 'stock' ? (
        <StockReportView />
      ) : (
        <>
      {/* Stats Cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* 1. TOTAL OMZET */}
          <Card className="bg-white border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all h-full">
            <CardContent className="p-4 flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                   <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Omzet</div>
                   <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                      <Wallet size={16} />
                   </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-4">{formatMoney(reportData.stats.omzet)}</div>
              </div>
              
              <div className="space-y-2 text-xs border-t pt-3 border-slate-100">
                <div className="space-y-1">
                   <div className="flex justify-between items-center text-slate-600">
                      <span>Product</span>
                      <span className="font-medium">{formatMoney(reportData.productStats.totalOmzet)}</span>
                   </div>
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(reportData.productStats.totalOmzet / (reportData.stats.omzet || 1)) * 100}%` }}></div>
                   </div>
                </div>
                <div className="space-y-1">
                   <div className="flex justify-between items-center text-slate-600">
                      <span>Treatment</span>
                      <span className="font-medium">{formatMoney(reportData.therapistStats.totalTreatmentOmzet)}</span>
                   </div>
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-300 h-full rounded-full" style={{ width: `${(reportData.therapistStats.totalTreatmentOmzet / (reportData.stats.omzet || 1)) * 100}%` }}></div>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. TOTAL MODAL */}
          <Card className="bg-white border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all h-full">
            <CardContent className="p-4 flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                   <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Modal</div>
                   <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md">
                      <Box size={16} />
                   </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-4">{formatMoney(reportData.stats.modal)}</div>
              </div>
              
              <div className="space-y-2 text-xs border-t pt-3 border-slate-100">
                <div className="flex justify-between text-slate-600">
                   <span>Product</span>
                   <span className="font-medium">
                     {formatMoney(reportData.productStats.totalOmzet - reportData.productStats.totalProfit)}
                   </span>
                </div>
                <div className="flex justify-between text-slate-600">
                   <span>Treatment</span>
                   <span className="font-medium">
                     {formatMoney(reportData.therapistStats.totalTreatmentOmzet - (reportData.therapistStats.totalTreatmentProfit || 0))}
                   </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. TOTAL DISKON */}
          <Card className="bg-white border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-all h-full">
             <CardContent className="p-4 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                     <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Diskon</div>
                     <div className="p-1.5 bg-red-50 text-red-600 rounded-md">
                        <Percent size={16} />
                     </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mb-4">{formatMoney(reportData.stats.diskon)}</div>
                </div>
                
                <div className="space-y-2 text-xs border-t pt-3 border-slate-100">
                   <div className="flex justify-between text-slate-600">
                      <span>Product</span>
                      <span className="font-medium">{formatMoney(reportData.stats.diskonProduct || 0)}</span>
                   </div>
                   <div className="flex justify-between text-slate-600">
                      <span>Treatment</span>
                      <span className="font-medium">{formatMoney(reportData.stats.diskonTreatment || 0)}</span>
                   </div>
                </div>
             </CardContent>
          </Card>

          {/* 4. KOMISI THERAPIST */}
          <Card className="bg-white border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                   <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Komisi Therapist</div>
                   <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
                      <Scissors size={16} />
                   </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-4">{formatMoney(reportData.stats.komisi)}</div>
              </div>
              
              <div className="space-y-2 text-xs border-t pt-3 border-slate-100">
                <div className="flex justify-between items-center text-slate-600">
                   <span>Ratio vs Treatment</span>
                   <span className="font-bold text-purple-700">
                     {reportData.therapistStats.totalTreatmentOmzet > 0 
                       ? ((reportData.stats.komisi / reportData.therapistStats.totalTreatmentOmzet) * 100).toFixed(1) 
                       : 0}%
                   </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                   <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, (reportData.stats.komisi / (reportData.therapistStats.totalTreatmentOmzet || 1)) * 100)}%` }}></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. LABA BERSIH */}
          <Card className="bg-white border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all h-full">
            <CardContent className="p-4 flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                   <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Laba Bersih</div>
                   <div className="p-1.5 bg-green-50 text-green-600 rounded-md">
                      <Banknote size={16} />
                   </div>
                </div>
                <div className="text-2xl font-bold text-green-700 mb-4">
                  {formatMoney(reportData.stats.laba - reportData.stats.komisi)}
                </div>
              </div>
              
              <div className="text-[10px] sm:text-xs bg-green-50 p-2 rounded border border-green-100 text-green-800 flex items-start gap-1.5 mt-auto">
                 <div className="mt-0.5"><TrendingUp size={12} /></div>
                 <div>
                   <span className="font-semibold">Note:</span> Real profit setelah komisi.
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* 6. PAYMENT METHODS */}
          <Card className="bg-white border-l-4 border-l-slate-500 shadow-sm hover:shadow-md transition-all h-full">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex justify-between items-start mb-2">
                 <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pembayaran</div>
                 <div className="p-1.5 bg-slate-50 text-slate-600 rounded-md">
                    <Banknote size={16} />
                 </div>
              </div>
              
              <div className="space-y-3 mt-2">
                {reportData.paymentMethodStats && reportData.paymentMethodStats.map((p: any) => (
                  <div key={p.method} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-xs">{p.method}</span>
                      <span className="text-xs text-muted-foreground">x{p.count}</span>
                    </div>
                    <span className="font-bold text-slate-700">{formatMoney(p.total)}</span>
                  </div>
                ))}
                {(!reportData.paymentMethodStats || reportData.paymentMethodStats.length === 0) && (
                   <div className="text-xs text-muted-foreground italic">Belum ada data</div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Narrative Insights */}
      {reportData && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center shadow-sm">
            <div className="p-2 bg-white rounded-full text-blue-600 shadow-sm border border-blue-100">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>
            <div className="space-y-1 flex-1">
               <h3 className="text-sm font-semibold text-blue-900">Market Insights</h3>
               <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-800">
                  {/* Insight 1: Dominance */}
                  <span className="flex items-center gap-1">
                    • {((reportData.therapistStats.totalTreatmentOmzet / (reportData.stats.omzet || 1)) * 100).toFixed(0)}% omzet dari Treatment
                  </span>
                  
                  {/* Insight 2: Product Upsell Opportunity */}
                  {((reportData.productStats.totalOmzet / (reportData.stats.omzet || 1)) * 100) < 20 && (
                     <span className="flex items-center gap-1 font-medium text-orange-700">
                       • Product hanya {((reportData.productStats.totalOmzet / (reportData.stats.omzet || 1)) * 100).toFixed(1)}% — Peluang Upselling!
                     </span>
                  )}

                  {/* Insight 3: Top Therapist Dominance */}
                  {reportData.therapistStats.byTherapist.length > 0 && 
                   (reportData.therapistStats.byTherapist[0].omzet / (reportData.therapistStats.totalTreatmentOmzet || 1) * 100) > 50 && (
                     <span className="flex items-center gap-1">
                       • {reportData.therapistStats.byTherapist[0].therapistName} menyumbang {((reportData.therapistStats.byTherapist[0].omzet / (reportData.therapistStats.totalTreatmentOmzet || 1)) * 100).toFixed(0)}% omzet treatment
                     </span>
                   )}
               </div>
            </div>
        </div>
      )}

      {/* Detailed Analysis Section */}
      {reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* PRODUCT PERFORMANCE */}
          <Card className="flex flex-col">
             <CardHeader>
               <CardTitle>Laporan Product</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 flex-1">
                {/* 3. Ringkasan Product */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                   <div>
                      <div className="text-xs text-muted-foreground uppercase">Total Omzet</div>
                      <div className="text-xl font-bold">{formatMoney(reportData.productStats.totalOmzet)}</div>
                   </div>
                   <div>
                      <div className="text-xs text-muted-foreground uppercase">Total Profit</div>
                      <div className="text-xl font-bold text-green-600">{formatMoney(reportData.productStats.totalProfit || 0)}</div>
                   </div>
                   <div>
                      <div className="text-xs text-muted-foreground uppercase">Total Qty Terjual</div>
                      <div className="text-xl font-bold">{reportData.productStats.totalQty}</div>
                   </div>
                   <div>
                      <div className="text-xs text-muted-foreground uppercase">Rata-rata Margin</div>
                      <div className="text-xl font-bold text-blue-600">
                        {reportData.productStats.totalOmzet > 0 
                          ? ((reportData.productStats.totalProfit / reportData.productStats.totalOmzet) * 100).toFixed(1) 
                          : 0}%
                      </div>
                   </div>
                   <div className="col-span-2 pt-2 border-t mt-2">
                      <div className="text-xs text-muted-foreground uppercase">Kontribusi ke Total Omzet</div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold">
                          {reportData.stats.omzet > 0 
                            ? ((reportData.productStats.totalOmzet / reportData.stats.omzet) * 100).toFixed(1) 
                            : 0}%
                        </div>
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                           <div className="bg-blue-600 h-full" style={{ width: `${Math.min(100, (reportData.productStats.totalOmzet / (reportData.stats.omzet || 1)) * 100)}%` }}></div>
                        </div>
                      </div>
                   </div>
                </div>

                {/* 1. Omzet Product per Kategori Pelanggan */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 border-b pb-1">Omzet per Kategori Pelanggan</h3>
                  <div className="space-y-2">
                    {reportData.productStats.byCategory.map((c: any) => (
                      <CategoryRow 
                        key={c.categoryId} 
                        category={c} 
                        date={date}
                        filters={filters} 
                        totalProductOmzet={reportData.productStats.totalOmzet} 
                      />
                    ))}
                    {reportData.productStats.byCategory.length === 0 && (
                      <div className="text-sm text-muted-foreground italic">Tidak ada data kategori</div>
                    )}
                  </div>
                </div>

                {/* 2. Analisa Product */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-1">Analisa Product</h3>
                  
                  {/* Tabs like switcher for Top 5 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top 5 By Qty */}
                    <div className="border rounded-md p-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Top 5 Terlaris (Qty)</h4>
                      <div className="space-y-2">
                        {reportData.productStats.top5ByQty && reportData.productStats.top5ByQty.map((p: any) => (
                          <div key={p.productId} className="flex justify-between text-xs">
                             <span className="truncate max-w-[150px]">{p.productName}</span>
                             <span className="font-medium bg-slate-100 px-1.5 rounded">{p.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top 5 By Omzet */}
                    <div className="border rounded-md p-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Top 5 Omzet Terbesar</h4>
                      <div className="space-y-2">
                        {reportData.productStats.top5ByOmzet && reportData.productStats.top5ByOmzet.map((p: any) => (
                          <div key={p.productId} className="flex justify-between text-xs">
                             <span className="truncate max-w-[150px]">{p.productName}</span>
                             <span className="font-medium text-green-700">{formatMoney(p.omzet)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Lowest Margin & Negative Profit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lowest Margin */}
                    <div className="border rounded-md p-3 bg-orange-50/50 border-orange-100">
                       <h4 className="text-xs font-semibold text-orange-700 uppercase mb-2">Margin Terendah</h4>
                       <div className="space-y-2">
                          {reportData.productStats.lowestMargin && reportData.productStats.lowestMargin.map((p: any) => (
                            <div key={p.productId} className="flex justify-between text-xs">
                               <span className="truncate max-w-[150px]">{p.productName}</span>
                               <span className="font-mono text-orange-600">{p.margin}%</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Negative Profit */}
                    <div className="border rounded-md p-3 bg-red-50/50 border-red-100">
                       <h4 className="text-xs font-semibold text-red-700 uppercase mb-2">Produk Rugi (Negative Profit)</h4>
                       <div className="space-y-2">
                          {reportData.productStats.negativeProfit && reportData.productStats.negativeProfit.length > 0 ? (
                            reportData.productStats.negativeProfit.map((p: any) => (
                              <div key={p.productId} className="flex justify-between text-xs text-red-700">
                                 <span className="truncate max-w-[150px]">{p.productName}</span>
                                 <span className="font-mono">{formatMoney(p.profit)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-green-600 italic">Tidak ada produk rugi</div>
                          )}
                       </div>
                    </div>
                  </div>

                </div>
             </CardContent>
          </Card>

          {/* THERAPIST PERFORMANCE */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Performa Therapist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 flex-1">
               {/* Summary */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <div className="text-xs text-muted-foreground uppercase">Omzet Treatment</div>
                     <div className="text-xl font-bold">{formatMoney(reportData.therapistStats.totalTreatmentOmzet)}</div>
                  </div>
                  <div>
                     <div className="text-xs text-muted-foreground uppercase">Total Komisi</div>
                     <div className="text-xl font-bold text-purple-600">{formatMoney(reportData.therapistStats.totalCommission)}</div>
                  </div>
               </div>

               {/* Therapist List with Enhanced Stats */}
               <div>
                  <h3 className="text-sm font-semibold mb-2">Detail per Therapist</h3>
                  <div className="space-y-3">
                    {reportData.therapistStats.byTherapist.map((t: any) => (
                      <div key={t.therapistId} className="border rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">{t.therapistName}</span>
                          <span className="font-bold text-base">{formatMoney(t.omzet)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                           <div>
                             <span className="block opacity-70">Treatment</span>
                             <span className="font-medium text-foreground">{t.treatmentCount || 0}</span>
                             {t.assistantCount > 0 && (
                               <span className="text-[10px] block text-blue-600 mt-0.5" title={`Menjadi asisten di ${t.assistantCount} treatment`}>
                                 (Asst: {t.assistantCount})
                               </span>
                             )}
                           </div>
                           <div>
                             <span className="block opacity-70">Avg/Trt</span>
                             <span className="font-medium text-foreground">{formatMoney(t.avgOmzet || 0)}</span>
                           </div>
                           <div className="text-right">
                             <span className="block opacity-70">Komisi</span>
                             <span className="font-medium text-purple-600">{formatMoney(t.commission || 0)}</span>
                           </div>
                        </div>
                      </div>
                    ))}
                    {reportData.therapistStats.byTherapist.length === 0 && (
                      <div className="text-sm text-muted-foreground">Tidak ada data therapist</div>
                    )}
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Periode</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "dd/MM/yyyy")} -{" "}
                          {format(date.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(date.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategori</label>
              <Select
                value={filters.categoryCode}
                onValueChange={(value) =>
                  setFilters({ ...filters, categoryCode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {options.categories.map((c) => (
                    <SelectItem key={c.id} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Member */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Member</label>
              <Select
                value={filters.memberId}
                onValueChange={(value) =>
                  setFilters({ ...filters, memberId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Member</SelectItem>
                  {options.members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} - {m.memberCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Therapist */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Therapist</label>
              <Select
                value={filters.therapistId}
                onValueChange={(value) =>
                  setFilters({ ...filters, therapistId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Therapist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Therapist</SelectItem>
                  {options.therapists.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {/* Payment Method */}
             <div className="space-y-2">
              <label className="text-sm font-medium">Metode Pembayaran</label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(value) =>
                  setFilters({ ...filters, paymentMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Metode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Metode</SelectItem>
                  {options.paymentMethods.map((pm) => (
                    <SelectItem key={pm} value={pm}>
                      {pm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleApplyFilter} disabled={loading}>
              <Filter className="mr-2 h-4 w-4" />
              Terapkan Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {reportData && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Transaksi</TableHead>
                  <TableHead>Item / Detail</TableHead>
                  <TableHead>Member / Kategori</TableHead>
                  <TableHead>Therapist</TableHead>
                  <TableHead>Metode Pembayaran</TableHead>
                  <TableHead className="text-right">
                    {filters.therapistId !== 'all' ? 'Nilai (Item)' : 'Nilai (Total Invoice)'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.data.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(row.date), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {/* If itemsDetail exists (General Mode), show list */}
                        {row.itemsDetail && row.itemsDetail.length > 0 ? (
                          <div className="space-y-1">
                            {row.itemsDetail.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                {item.type === 'PRODUCT' && (
                                  <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                    P
                                  </span>
                                )}
                                {item.type === 'TREATMENT' && (
                                  <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                                    T
                                  </span>
                                )}
                                <span className="font-medium truncate max-w-[200px]" title={item.name}>
                                  {item.name}
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap">
                                  x {item.qty}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Fallback / Therapist Mode (Single Item) */
                          <>
                            <div className="flex items-center gap-2">
                              {row.type === 'PRODUCT' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Product
                                </span>
                              )}
                              {row.type === 'TREATMENT' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Treatment
                                </span>
                              )}
                              <span className="font-medium">{row.itemName}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{row.qty} qty</div>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{row.member}</div>
                      <div className="text-xs text-muted-foreground">{row.category}</div>
                    </TableCell>
                    <TableCell className="text-xs">{row.therapists || '-'}</TableCell>
                    <TableCell className="text-xs">{row.paymentMethod}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(row.price))}
                    </TableCell>
                  </TableRow>
                ))}
                {reportData.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Page {reportData.pagination.page} of {reportData.pagination.totalPages} ({reportData.pagination.total} records)
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(reportData.pagination.totalPages, p + 1))}
                disabled={page === reportData.pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
      </>
      )}
    </div>
  )
}

function StatCard({ label, value, className }: { label: string, value: any, className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-4">
        <div className="text-xs opacity-80 font-medium uppercase tracking-wider mb-1">{label}</div>
        <div className="text-xl font-bold">{formatMoney(Number(value))}</div>
      </CardContent>
    </Card>
  )
}
