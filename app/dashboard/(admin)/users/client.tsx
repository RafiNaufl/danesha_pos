'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import { Plus, Search, Edit, X, Trash2, Shield, User as UserIcon, Lock } from 'lucide-react'
import { upsertUser, deleteUser } from '@/app/actions/admin/users'
import { cn } from '@/lib/utils'

type User = {
  id: string
  name: string | null
  email: string
  role: Role
  createdAt: Date
  updatedAt: Date
}

type Props = {
  initialUsers: User[]
}

export function UsersClient({ initialUsers }: Props) {
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  
  const filteredUsers = initialUsers.filter(u => 
    (u.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setIsSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingUser(null)
    setIsSheetOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manajemen User</h1>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari user (nama, email)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-start">
             <div className="flex gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  user.role === 'ADMIN' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                )}>
                  {user.role === 'ADMIN' ? <Shield size={20} /> : <UserIcon size={20} />}
                </div>
                <div>
                   <h3 className="font-semibold">{user.name || 'Unnamed'}</h3>
                   <div className="text-sm text-gray-600">{user.email}</div>
                   <span className={cn(
                     "text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium",
                     user.role === 'ADMIN' ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                   )}>
                     {user.role}
                   </span>
                </div>
             </div>
             <button onClick={() => handleEdit(user)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center">
               <Edit className="h-4 w-4" />
             </button>
          </div>
        ))}
      </div>

      {/* Edit Sheet */}
      {isSheetOpen && (
        <UserForm 
           user={editingUser} 
           onClose={() => setIsSheetOpen(false)}
        />
      )}
    </div>
  )
}

function UserForm({ user, onClose }: { user: User | null, onClose: () => void }) {
  const [formData, setFormData] = useState({
     name: user?.name || '',
     email: user?.email || '',
     password: '',
     role: user?.role || 'KASIR'
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await upsertUser({
        id: user?.id,
        name: formData.name,
        email: formData.email,
        password: formData.password || undefined,
        role: formData.role as Role
      })
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
     if (!user?.id) return
     if (!confirm('Hapus user ini?')) return
     setLoading(true)
     try {
       await deleteUser(user.id)
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
      
      <div className="relative bg-white w-full max-w-lg h-auto overflow-y-auto rounded-t-xl sm:rounded-xl p-6 animate-in slide-in-from-bottom-full duration-300">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{user ? 'Edit User' : 'Tambah User'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-5 w-5" />
            </button>
         </div>

         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
              <input 
                required
                className="w-full p-2 border rounded-lg"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                type="email"
                required
                className="w-full p-2 border rounded-lg"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {user ? 'Password (Kosongkan jika tidak ingin mengubah)' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="password"
                  required={!user}
                  className="w-full pl-10 pr-4 p-2 border rounded-lg"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                className="w-full p-2 border rounded-lg"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as Role})}
              >
                <option value="KASIR">Kasir</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="flex gap-3 pt-6">
               {user && (
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
