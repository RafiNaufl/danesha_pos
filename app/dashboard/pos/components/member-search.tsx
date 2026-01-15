'use client'

import React, { useState, useEffect } from 'react'
import { Search, X, User, Phone, Plus, ArrowLeft, Loader2 } from 'lucide-react'
import { searchMember, registerMember } from '@/app/actions/members'
import { usePos } from './pos-provider'
import { Member, CustomerCategory } from '@prisma/client'

export function MemberSearch({ onClose, categories }: { onClose: () => void, categories: CustomerCategory[] }) {
  const { dispatch } = usePos()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<(Member & { category: CustomerCategory | null })[]>([])
  const [loading, setLoading] = useState(false)
  
  // Creation State
  const [isCreating, setIsCreating] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', phone: '', categoryId: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isCreating) return
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const res = await searchMember(query)
        // @ts-ignore - Prisma include types can be tricky, trusting server action return
        setResults(res)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, isCreating])

  const handleSelect = (member: Member & { category: CustomerCategory | null }) => {
    dispatch({ type: 'SET_MEMBER', payload: member })
    onClose()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
       const member = await registerMember({
          name: newMember.name,
          phone: newMember.phone,
          categoryId: newMember.categoryId || categories[0]?.id
       })
       // @ts-ignore
       handleSelect(member)
    } catch (err: any) {
       alert(err.message)
    } finally {
       setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {isCreating ? (
           // Create Form
           <div className="p-4">
              <div className="flex items-center gap-3 mb-6">
                 <button onClick={() => setIsCreating(false)} className="p-2 -ml-2 hover:bg-neutral-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center">
                    <ArrowLeft size={20} />
                 </button>
                 <h2 className="text-lg font-bold">New Member</h2>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input 
                      required
                      className="w-full p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[48px]"
                      value={newMember.name}
                      onChange={e => setNewMember({...newMember, name: e.target.value})}
                      placeholder="Enter member name"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input 
                      className="w-full p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[48px]"
                      value={newMember.phone}
                      onChange={e => setNewMember({...newMember, phone: e.target.value})}
                      placeholder="Enter phone number"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <div className="grid grid-cols-2 gap-2">
                       {categories.map(cat => (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => setNewMember({...newMember, categoryId: cat.id})}
                            className={`p-3 rounded-xl text-sm font-medium border transition ${
                               (newMember.categoryId || categories[0]?.id) === cat.id 
                               ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                               : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                            }`}
                          >
                             {cat.name}
                          </button>
                       ))}
                    </div>
                 </div>

                 <button 
                   disabled={submitting}
                   type="submit" 
                   className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {submitting && <Loader2 className="animate-spin" size={18} />}
                   Register Member
                 </button>
              </form>
           </div>
        ) : (
           // Search List
           <>
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3">
              <Search className="text-gray-400" size={20} />
              <input
                autoFocus
                placeholder="Search member..."
                className="flex-1 bg-transparent outline-none text-lg"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full min-w-[48px] min-h-[48px] flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
               {/* Add New Button */}
               <button 
                 onClick={() => {
                    setNewMember({ name: query, phone: '', categoryId: '' })
                    setIsCreating(true)
                 }}
                 className="w-full flex items-center gap-3 p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition mb-2"
               >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                     <Plus size={20} />
                  </div>
                  <div className="text-left">
                     <div className="font-bold">Register New Member</div>
                     <div className="text-xs opacity-70">Add a new member to the system</div>
                  </div>
               </button>

              {loading ? (
                <div className="p-8 text-center text-gray-400">Searching...</div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map(member => (
                    <button
                      key={member.id}
                      onClick={() => handleSelect(member)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition text-left group"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg group-hover:bg-blue-100 transition">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><User size={12}/> {member.memberCode}</span>
                          <span className="flex items-center gap-1"><Phone size={12}/> {member.phone}</span>
                        </div>
                      </div>
                      <div className="ml-auto text-xs font-medium px-2 py-1 bg-neutral-100 rounded text-gray-600">
                        {member.category?.name || 'Pasien'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.length >= 2 ? (
                <div className="p-8 text-center text-gray-400">No members found</div>
              ) : null}
            </div>
           </>
        )}
      </div>
    </div>
  )
}
