import { getTherapists } from "@/app/actions/admin/therapists"
import { getTherapistLevels } from "@/app/actions/admin/therapist-levels"
import { TherapistsClient } from "./client"

export default async function Page() {
  const [therapists, levels] = await Promise.all([
    getTherapists(),
    getTherapistLevels()
  ])
  
  // Serialize Decimals
  const serializedLevels = levels.map(l => ({
    ...l,
    defaultCommission: l.defaultCommission.toNumber(),
    minCommission: l.minCommission.toNumber(),
    maxCommission: l.maxCommission.toNumber(),
  }))

  return <TherapistsClient initialTherapists={therapists} initialLevels={serializedLevels} />
}
