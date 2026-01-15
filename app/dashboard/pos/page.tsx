import React from 'react'
import { getPosData } from '@/app/actions/pos-data'
import { auth } from '@/app/lib/auth'
import PosClient from './pos-client'

export const metadata = {
  title: 'POS Dashboard - Danesha Clinic',
  description: 'Point of Sale System',
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [data, session] = await Promise.all([
    getPosData(),
    auth()
  ])

  return (
    <PosClient data={data} session={session} />
  )
}
