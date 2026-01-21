
'use client'

import { useState, useEffect } from 'react'
import { Settings } from '@prisma/client'
import { Save, Store, UserCog, Lock, Tablet } from 'lucide-react'
import { updateSettings } from '@/app/actions/admin/settings'
import { updateTherapistLevel } from '@/app/actions/admin/therapist-levels'
import { cn } from '@/lib/utils'
import { Capacitor, registerPlugin } from '@capacitor/core'

interface KioskPlugin {
  startLockTask(): Promise<void>;
  stopLockTask(): Promise<void>;
  isInLockTaskMode(): Promise<void>;
}

const KioskMode = registerPlugin<KioskPlugin>('KioskMode');

type Level = {
  id: string
  name: string
  defaultCommission: number
  minCommission: number
  maxCommission: number
}

type Props = {
  initialSettings: Omit<Settings, 'commissionDefaultPercent'> & { commissionDefaultPercent: number }
  initialLevels: Level[]
}

export function SettingsClient({ initialSettings, initialLevels }: Props) {
  const [formData, setFormData] = useState({
     storeName: initialSettings.storeName,
     storeAddress: initialSettings.storeAddress || '',
     storePhone: initialSettings.storePhone || '',
     footerMessage: initialSettings.footerMessage || '',
     commissionDefaultPercent: initialSettings.commissionDefaultPercent.toString()
  })
  const [loading, setLoading] = useState(false)
  const [levels, setLevels] = useState(initialLevels)
  const [isKioskMode, setIsKioskMode] = useState(false)

  const toggleKioskMode = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert('Kiosk Mode hanya tersedia di aplikasi Android/iOS native')
      return
    }

    try {
      if (isKioskMode) {
        await KioskMode.stopLockTask()
        setIsKioskMode(false)
      } else {
        await KioskMode.startLockTask()
        setIsKioskMode(true)
      }
    } catch (e: any) {
      console.error('Kiosk toggle failed', e)
      alert('Gagal mengubah mode kiosk: ' + e.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault()
     setLoading(true)
     try {
       await updateSettings({
          storeName: formData.storeName,
          storeAddress: formData.storeAddress,
          storePhone: formData.storePhone,
          footerMessage: formData.footerMessage,
          commissionDefaultPercent: Number(formData.commissionDefaultPercent)
       })
       alert('Pengaturan berhasil disimpan')
     } catch (e: any) {
       alert(e.message)
     } finally {
       setLoading(false)
     }
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Pengaturan Toko</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
         <div>
           <label className="block text-sm font-medium mb-1">Nama Klinik/Toko</label>
           <input 
             required
             className="w-full p-2 border rounded-lg min-h-[48px]"
             value={formData.storeName}
             onChange={e => setFormData({...formData, storeName: e.target.value})}
           />
         </div>

         <div>
           <label className="block text-sm font-medium mb-1">Alamat</label>
           <textarea 
             className="w-full p-2 border rounded-lg"
             rows={3}
             value={formData.storeAddress}
             onChange={e => setFormData({...formData, storeAddress: e.target.value})}
           />
         </div>

         <div>
           <label className="block text-sm font-medium mb-1">No Telepon</label>
           <input 
             className="w-full p-2 border rounded-lg min-h-[48px]"
             value={formData.storePhone}
             onChange={e => setFormData({...formData, storePhone: e.target.value})}
           />
         </div>

         <div>
           <label className="block text-sm font-medium mb-1">Pesan Akhir Struk</label>
           <textarea 
             className="w-full p-2 border rounded-lg"
             rows={2}
             value={formData.footerMessage}
             onChange={e => setFormData({...formData, footerMessage: e.target.value})}
             placeholder="Terima kasih atas kunjungan Anda"
           />
         </div>

         <div className="pt-4 border-t hidden">
           <h3 className="font-semibold mb-4">Global Default</h3>
           <div>
             <label className="block text-sm font-medium mb-1">Default Komisi Therapist (%)</label>
             <div className="relative w-32">
                <input 
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="w-full p-2 pr-8 border rounded-lg"
                  value={formData.commissionDefaultPercent}
                  onChange={e => setFormData({...formData, commissionDefaultPercent: e.target.value})}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
             </div>
             <p className="text-xs text-gray-500 mt-1">Digunakan sebagai fallback terakhir.</p>
           </div>
         </div>

         <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[48px]"
            >
               <Save className="h-5 w-5" />
               {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
         </div>
      </form>

      {/* Device Settings */}
      <div className="mt-10 mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-orange-100 p-3 rounded-full text-orange-600">
            <Tablet className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Pengaturan Perangkat</h2>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Kiosk Mode (App Pinning)</h3>
                <p className="text-sm text-gray-500 mt-1">Mengunci aplikasi agar tidak bisa keluar (Android Only).</p>
              </div>
              <button
                type="button"
                onClick={toggleKioskMode}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition",
                  isKioskMode 
                    ? "bg-red-100 text-red-700 hover:bg-red-200" 
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                )}
              >
                <Lock size={16} />
                {isKioskMode ? 'Nonaktifkan Kiosk' : 'Aktifkan Kiosk'}
              </button>
           </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-purple-100 p-3 rounded-full text-purple-600">
            <UserCog className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">Level & Komisi Therapist</h2>
        </div>
        
        <div className="grid gap-6">
          {levels.map((level) => (
            <LevelForm key={level.id} level={level} />
          ))}
        </div>
      </div>
    </div>
  )
}

function LevelForm({ level }: { level: Level }) {
  const [data, setData] = useState(level)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateTherapistLevel(data)
      alert(`Level ${level.name} berhasil disimpan`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
       <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-gray-800">{level.name}</h3>
          <span className="px-2 py-1 bg-gray-100 text-xs font-semibold rounded text-gray-500">ID: {level.id.slice(-4)}</span>
       </div>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
             <label className="block text-xs font-medium text-gray-500 mb-1">Default Komisi</label>
             <div className="relative">
               <input 
                 type="number" 
                 className="w-full p-2 pr-8 border rounded-lg font-medium"
                 value={data.defaultCommission}
                 onChange={e => setData({...data, defaultCommission: Number(e.target.value)})}
               />
               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
             </div>
          </div>
          <div>
             <label className="block text-xs font-medium text-gray-500 mb-1">Min. Komisi</label>
             <div className="relative">
               <input 
                 type="number" 
                 className="w-full p-2 pr-8 border rounded-lg"
                 value={data.minCommission}
                 onChange={e => setData({...data, minCommission: Number(e.target.value)})}
               />
               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
             </div>
          </div>
          <div>
             <label className="block text-xs font-medium text-gray-500 mb-1">Max. Komisi</label>
             <div className="relative">
               <input 
                 type="number" 
                 className="w-full p-2 pr-8 border rounded-lg"
                 value={data.maxCommission}
                 onChange={e => setData({...data, maxCommission: Number(e.target.value)})}
               />
               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
             </div>
          </div>
       </div>

       <div className="flex justify-end">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
       </div>
    </div>
  )
}
