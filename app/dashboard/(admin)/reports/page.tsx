import React from 'react'
import { getReportOptions } from '@/app/actions/reports'
import ReportsClient from './client'

export const metadata = {
  title: 'Laporan Keuangan - Danesha POS',
}

export default async function ReportsPage() {
  const options = await getReportOptions()

  return (
    <ReportsClient options={options} />
  )
}
