import { getTreatments } from "@/app/actions/admin/treatments"
import { TreatmentsClient } from "./client"

export default async function Page() {
  const treatments = await getTreatments()
  return <TreatmentsClient initialTreatments={treatments} />
}
