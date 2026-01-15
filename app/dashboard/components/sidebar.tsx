'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Package, 
  Stethoscope, 
  Users, 
  UserCog, 
  Settings, 
  Store, 
  LogOut, 
  ChevronDown, 
  ChevronRight, 
  LayoutDashboard,
  Database,
  X,
  Tag,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/app/actions/logout"
import { Session } from "next-auth"

interface NavItem {
  label: string
  href?: string
  icon: any
  children?: NavItem[]
}

const navItems: NavItem[] = [
  { 
    label: "Dashboard", 
    href: "/dashboard", 
    icon: LayoutDashboard 
  },
  {
    label: "Master Data",
    icon: Database,
    children: [
      { label: "Products", href: "/dashboard/products", icon: Package },
      { label: "Treatments", href: "/dashboard/treatments", icon: Stethoscope },
      { label: "Discounts", href: "/dashboard/discounts", icon: Tag },
    ]
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: Database
  },
  {
    label: "User Management",
    icon: Users,
    children: [
      { label: "Members", href: "/dashboard/members", icon: Users },
      { label: "Therapists", href: "/dashboard/therapists", icon: UserCog },
      { label: "Users", href: "/dashboard/users", icon: UserCog },
    ]
  },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

interface SidebarProps {
  isOpen?: boolean
  isDesktopOpen?: boolean
  onClose?: () => void
  onDesktopToggle?: () => void
  session?: Session | null
}

export function Sidebar({ isOpen, isDesktopOpen = true, onClose, onDesktopToggle, session }: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(["Master Data", "User Management"])

  const toggleExpand = (label: string) => {
    // If sidebar is collapsed (mini) and user clicks a parent item, expand the sidebar first
    if (!isDesktopOpen && onDesktopToggle) {
      onDesktopToggle()
      // Ensure the item is expanded
      if (!expandedItems.includes(label)) {
        setExpandedItems(prev => [...prev, label])
      }
      return
    }

    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    )
  }

  const isExpanded = (label: string) => expandedItems.includes(label)
  
  const isActive = (href?: string) => {
    if (!href) return false
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isChildActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => isActive(child.href))
    }
    return isActive(item.href)
  }

  return (
    <>
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-[width,transform] duration-300 ease-in-out flex flex-col",
          // Mobile: standard slide in/out
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: Always visible (translate-x-0), but width changes
          "min-[769px]:translate-x-0",
          isDesktopOpen ? "w-64 min-[769px]:w-64" : "w-64 min-[769px]:w-20"
        )}
      >
        {/* Header */}
        <div className={cn(
          "h-16 flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 overflow-hidden",
          isDesktopOpen ? "justify-between" : "min-[769px]:justify-center justify-between"
        )}>
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div className={cn(
              "flex flex-col min-w-0 transition-opacity duration-300",
              !isDesktopOpen && "min-[769px]:opacity-0 min-[769px]:hidden"
            )}>
              <span className="font-bold text-lg truncate">Danesha</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">POS System</span>
            </div>
          </div>
          
          {/* Mobile Close Button (Only visible on mobile) */}
          <button 
            onClick={onClose}
            className="min-[769px]:hidden p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 scrollbar-hide">
          {navItems.map((item) => {
            const active = isChildActive(item)
            const expanded = isExpanded(item.label)
            const hasChildren = item.children && item.children.length > 0

            return (
              <div key={item.label}>
                {hasChildren ? (
                  // Collapsible Parent
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={cn(
                      "w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all group min-h-[48px]",
                      active ? "text-blue-600 dark:text-blue-400" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                      !isDesktopOpen && "min-[769px]:justify-center min-[769px]:px-2",
                      isDesktopOpen && "justify-between"
                    )}
                    title={!isDesktopOpen ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <item.icon className={cn("w-5 h-5 shrink-0", active && "text-blue-600 dark:text-blue-400")} />
                      <span className={cn("truncate transition-opacity duration-300", !isDesktopOpen && "min-[769px]:hidden")}>{item.label}</span>
                    </div>
                    <div className={cn(!isDesktopOpen && "min-[769px]:hidden")}>
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>
                ) : (
                  // Single Link
                  <Link
                    href={item.href!}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative min-h-[48px]",
                      active 
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" 
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                      !isDesktopOpen && "min-[769px]:justify-center min-[769px]:px-2"
                    )}
                    title={!isDesktopOpen ? item.label : undefined}
                  >
                    {active && isDesktopOpen && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                    )}
                    <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", active && "text-blue-600")} />
                    <span className={cn("truncate transition-opacity duration-300", !isDesktopOpen && "min-[769px]:hidden")}>{item.label}</span>
                  </Link>
                )}

                {/* Children */}
                {hasChildren && (
                  <div 
                    id={`submenu-${item.label}`}
                    className={cn(
                      "mt-1 space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
                      (expanded && isDesktopOpen) ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    {item.children!.map((child) => {
                      const childActive = isActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href!}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all justify-start relative pl-11",
                            childActive 
                              ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 font-medium" 
                              : "text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300"
                          )}
                        >
                          {childActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full opacity-50" />
                          )}
                          <child.icon className={cn("w-4 h-4 shrink-0 sm:w-5 sm:h-5 lg:w-4 lg:h-4 transition-transform hover:scale-110", childActive && "text-blue-600")} />
                          <span className="truncate">{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
          
          {/* Toggle Button (Desktop Only) */}
          <button
            onClick={onDesktopToggle}
            className={cn(
              "hidden min-[992px]:flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all w-full",
              !isDesktopOpen && "justify-center px-2"
            )}
            title={isDesktopOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isDesktopOpen ? (
              <>
                <PanelLeftClose className="w-5 h-5 shrink-0" />
                <span className="truncate">Collapse Sidebar</span>
              </>
            ) : (
              <PanelLeftOpen className="w-5 h-5 shrink-0" />
            )}
          </button>

          <div className="mb-4 space-y-1 border-t border-neutral-100 dark:border-neutral-800 pt-2">
             <Link
              href="/dashboard/pos"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-all",
                !isDesktopOpen && "justify-center px-2"
              )}
              title="POS System"
            >
              <Store className="w-5 h-5 shrink-0" />
              <span className={cn("truncate", !isDesktopOpen && "min-[992px]:hidden")}>POS System</span>
            </Link>
            
            <button
              onClick={() => logout()}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-all",
                !isDesktopOpen && "justify-center px-2"
              )}
              title="Logout"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className={cn("truncate", !isDesktopOpen && "min-[992px]:hidden")}>Logout</span>
            </button>
          </div>

          <div className={cn(
            "flex items-center gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800",
            !isDesktopOpen && "justify-center"
          )}>
            <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <span className="font-bold text-sm text-neutral-700 dark:text-neutral-300">
                {session?.user?.name?.[0] || 'A'}
              </span>
            </div>
            <div className={cn("flex flex-col min-w-0", !isDesktopOpen && "min-[992px]:hidden")}>
              <span className="text-sm font-medium truncate text-neutral-900 dark:text-white">
                {session?.user?.name || 'Admin'}
              </span>
              <span className="text-xs text-neutral-500 truncate">
                {session?.user?.email || 'admin@danesha.com'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
