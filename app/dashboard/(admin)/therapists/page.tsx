import { getTherapists } from "@/app/actions/admin/therapists"
import { TherapistsClient } from "./client"

export default async function Page() {
  const therapists = await getTherapists()
  return <TherapistsClient initialTherapists={therapists} />
}
