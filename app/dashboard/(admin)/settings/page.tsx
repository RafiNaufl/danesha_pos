import { getSettings } from "@/app/actions/admin/settings"
import { SettingsClient } from "./client"

export default async function Page() {
  const settings = await getSettings()
  return <SettingsClient initialSettings={settings} />
}
