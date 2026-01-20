import { getSettings } from "@/app/actions/admin/settings"
import { getTherapistLevels } from "@/app/actions/admin/therapist-levels"
import { SettingsClient } from "./client"

export default async function Page() {
  const [settings, levels] = await Promise.all([
    getSettings(),
    getTherapistLevels()
  ])
  
  // Serialize Decimals for Client Component
  const serializedLevels = levels.map(l => ({
    ...l,
    defaultCommission: l.defaultCommission.toNumber(),
    minCommission: l.minCommission.toNumber(),
    maxCommission: l.maxCommission.toNumber(),
  }))

  return <SettingsClient initialSettings={settings} initialLevels={serializedLevels} />
}
