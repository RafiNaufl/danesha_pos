import { getMembers, getCustomerCategories } from "@/app/actions/admin/members"
import { MembersClient } from "./client"

export default async function Page() {
  const [members, categories] = await Promise.all([
    getMembers(),
    getCustomerCategories()
  ])

  return <MembersClient initialMembers={members} categories={categories} />
}
