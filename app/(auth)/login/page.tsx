'use client'

import React, { useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { authenticate } from '@/app/actions/auth'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

function LoginButton() {
  const { pending } = useFormStatus()
 
  return (
    <button 
      className="w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium disabled:opacity-70" 
      aria-disabled={pending}
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin h-5 w-5" /> : 'Sign In'}
    </button>
  )
}

export default function LoginPage() {
  // Use null as initial state to prevent immediate redirect
  const [errorMessage, dispatch] = useFormState(authenticate, null)
  const router = useRouter()

  useEffect(() => {
    if (errorMessage === undefined) {
      // Success - no error message returned (undefined means success)
      router.push('/dashboard')
      router.refresh()
    }
  }, [errorMessage, router])
 
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border w-full max-w-sm">
        <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Login POS</h1>
            <p className="text-sm text-gray-500 mt-1">Danesha Beauty Clinic</p>
        </div>
        
        <form action={dispatch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
            <input 
              name="email" 
              type="email" 
              required
              placeholder="admin@danesha.com"
              className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Password</label>
            <input 
              name="password" 
              type="password" 
              required
              placeholder="••••••"
              className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition" 
            />
          </div>
          
          {errorMessage && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2" role="alert">
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="pt-2">
            <LoginButton />
          </div>
        </form>
      </div>
    </div>
  )
}
