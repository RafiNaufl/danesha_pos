import { requireAdmin } from "@/app/lib/admin-auth"
import { UsersClient } from "./client"
import { getUsers } from "@/app/actions/admin/users"

export default async function UsersPage() {
  await requireAdmin()
  const users = await getUsers()
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage system users (Admins & Cashiers)</p>
      </div>
      
      <UsersClient initialUsers={users} />
    </div>
  )
}
