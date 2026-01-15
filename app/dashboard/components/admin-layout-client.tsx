'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Menu, X, PanelLeftClose, PanelLeftOpen, PanelLeft } from 'lucide-react'
import { Session } from 'next-auth'

interface AdminLayoutClientProps {
  children: React.ReactNode
  session: Session | null
}

export function AdminLayoutClient({ children, session }: AdminLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true)

  // Close sidebar on route change (mobile)
  // We can add a listener for pathname if needed, or Sidebar can handle it.
  
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      {/* Mobile Header / Toggle */}
      <div className="min-[769px]:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 z-40 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <Menu className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
          </button>
          <span className="font-bold text-lg text-neutral-900 dark:text-white">Admin Panel</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
          {session?.user?.name?.[0] || 'A'}
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        isDesktopOpen={isDesktopSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        onDesktopToggle={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
        session={session}
      />

      {/* Main Content */}
      <main className={`
        transition-all duration-300 ease-in-out
        pt-16 min-[769px]:pt-0
        ml-0 ${isDesktopSidebarOpen ? 'min-[769px]:ml-64' : 'min-[769px]:ml-20'}
      `}>
        <div className="p-4 sm:p-6 lg:p-8 relative">
          <div className="flex items-center mb-4 min-[769px]:hidden">
             {/* Spacer for mobile if needed, but pt-16 handles it */}
          </div>
          
          {children}
        </div>
      </main>

      {/* Overlay for Mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 min-[769px]:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
    </div>
  )
}
