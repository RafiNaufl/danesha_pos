'use client'

import { useState, useEffect } from 'react'
import { Member, CustomerCategory, MemberStatus, Transaction } from '@prisma/client'
import { Plus, Search, Edit, X, User, History, Wallet, TrendingUp } from 'lucide-react'
import { upsertMember, deleteMember, getMemberTransactions } from '@/app/actions/admin/members'
import { cn, formatMoney } from '@/lib/utils'

type MemberWithCategory = Member & { category: CustomerCategory }

type Props = {
  initialMembers: MemberWithCategory[]
  categories: CustomerCategory[]
}

export function MembersClient({ initialMembers, categories }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [search, setSearch] = useState('')
  const [editingMember, setEditingMember] = useState<MemberWithCategory | null>(null)
  const [viewingMember, setViewingMember] = useState<MemberWithCategory | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const filteredMembers = initialMembers.filter(m =>  
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.memberCode.toLowerCase().includes(search.toLowerCase()) ||
    (m.phone && m.phone.includes(search))
  )

  const handleEdit = (member: MemberWithCategory) => {
    setEditingMember(member)
    setIsSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingMember(null)
    setIsSheetOpen(true)
  }

  const handleView = (member: MemberWithCategory) => {
    setViewingMember(member)
    setShowDetail(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari member (nama/kode/hp)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[48px]"
        />
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredMembers.map(member => (
          <div key={member.id} className="bg-white p-4 rounded-xl shadow-sm border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleView(member)}>
             <div className="flex items-center gap-4 flex-1">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                   <User className="h-5 w-5" />
                </div>
                <div>
                   <h3 className="font-semibold">{member.name}</h3>
                   <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <span className="font-mono bg-gray-100 px-1 rounded">{member.memberCode}</span>
                      <span>•</span>
                      <span>{member.category.name}</span>
                   </div>
                   {member.status === 'INACTIVE' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block">Inactive</span>
                   )}
                </div>
             </div>
             <button 
               onClick={(e) => {
                 e.stopPropagation()
                 handleEdit(member)
               }} 
               className="p-2 text-gray-500 hover:bg-gray-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center self-end sm:self-auto"
             >
               <Edit className="h-4 w-4" />
             </button>
          </div>
        ))}
      </div>

      {/* Edit Sheet */}
      {isSheetOpen && (
        <MemberForm 
           member={editingMember} 
           categories={categories} 
           onClose={() => setIsSheetOpen(false)}
        />
      )}

      {/* Detail Sheet */}
      {showDetail && viewingMember && (
        <MemberDetail
          member={viewingMember}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}

function MemberForm({ member, categories, onClose }: { member: MemberWithCategory | null, categories: CustomerCategory[], onClose: () => void }) {
  const [formData, setFormData] = useState({
     name: member?.name || '',
     phone: member?.phone || '',
     categoryId: member?.categoryId || categories[0]?.id || '',
     status: member?.status || MemberStatus.ACTIVE,
     notes: member?.notes || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await upsertMember({
        id: member?.id,
        ...formData
      })
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!member?.id) return
    if (!confirm('Hapus/Nonaktifkan member ini?')) return
    setLoading(true)
    try {
      await deleteMember(member.id)
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-6 animate-in slide-in-from-bottom-full duration-300">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{member ? 'Edit Member' : 'Tambah Member'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Member</label>
              <input 
                required
                className="w-full p-2 border rounded-lg"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">No HP</label>
              <input 
                className="w-full p-2 border rounded-lg"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select 
                className="w-full p-2 border rounded-lg"
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value})}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select 
                className="w-full p-2 border rounded-lg"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as MemberStatus})}
              >
                <option value={MemberStatus.ACTIVE}>Active</option>
                <option value={MemberStatus.INACTIVE}>Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Catatan</label>
              <textarea 
                className="w-full p-2 border rounded-lg"
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>

            <div className="flex gap-3 pt-6">
               {member && (
                 <button 
                   type="button"
                   onClick={handleDelete}
                   className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50"
                   disabled={loading}
                 >
                   {loading ? '...' : 'Hapus'}
                 </button>
               )}
               <button 
                 type="submit"
                 className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
                 disabled={loading}
               >
                 {loading ? 'Menyimpan...' : 'Simpan'}
               </button>
            </div>
         </form>
      </div>
    </div>
  )
}

function MemberDetail({ member, onClose }: { member: MemberWithCategory, onClose: () => void }) {
  const [data, setData] = useState<{ transactions: any[], stats: any } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMemberTransactions(member.id).then(res => {
      setData(res)
      setLoading(false)
    })
  }, [member.id])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg h-[95vh] sm:h-[80vh] overflow-hidden rounded-t-xl sm:rounded-xl flex flex-col animate-in slide-in-from-bottom-full duration-300">
         {/* Header */}
         <div className="p-6 border-b flex items-center justify-between bg-gray-50">
            <div>
               <h3 className="text-lg font-bold">{member.name}</h3>
               <p className="text-sm text-gray-500">{member.memberCode} • {member.category.name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         {/* Content */}
         <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-10 text-gray-500">Memuat data...</div>
            ) : (
              <div className="space-y-6">
                 {/* Stats Cards */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                       <div className="flex items-center gap-2 text-blue-600 mb-2">
                          <Wallet className="h-4 w-4" />
                          <span className="text-xs font-medium">Total Belanja</span>
                       </div>
                       <p className="text-lg font-bold">{formatMoney(data?.stats.totalSpent || 0)}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                       <div className="flex items-center gap-2 text-green-600 mb-2">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">Total Laba</span>
                       </div>
                       <p className="text-lg font-bold">{formatMoney(data?.stats.totalProfit || 0)}</p>
                    </div>
                 </div>

                 {/* Transaction History */}
                 <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                       <History className="h-4 w-4" />
                       Riwayat Transaksi
                    </h4>
                    
                    {data?.transactions.length === 0 ? (
                       <p className="text-gray-500 text-sm text-center py-4">Belum ada transaksi</p>
                    ) : (
                       <div className="space-y-3">
                          {data?.transactions.map(tx => (
                             <div key={tx.id} className="bg-white border rounded-xl p-3 text-sm">
                                <div className="flex justify-between mb-1">
                                   <span className="font-medium">{tx.number}</span>
                                   <span className={cn(
                                     "text-xs px-2 py-0.5 rounded-full",
                                     tx.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                   )}>{tx.status}</span>
                                </div>
                                <div className="flex justify-between text-gray-500 text-xs mb-2">
                                   <span>{new Date(tx.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                   <span>{tx.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between font-semibold border-t pt-2">
                                   <span>Total</span>
                                   <span>{formatMoney(Number(tx.total))}</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </div>
            )}
         </div>
      </div>
    </div>
  )
}
