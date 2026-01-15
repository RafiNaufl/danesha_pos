import { requireAdmin } from "@/app/lib/admin-auth"
import { auth } from "@/app/lib/auth"
import { AdminLayoutClient } from "../components/admin-layout-client"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  const session = await auth()

  return (
    <AdminLayoutClient session={session}>
      {children}
    </AdminLayoutClient>
  )
}
