import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGymSettings } from "@/contexts/GymSettingsContext"

export const EmailButton = () => {
  const { settings } = useGymSettings()
  
  // Don't render if no email is set
  if (!settings?.contact_email) {
    return null
  }

  const handleEmailClick = () => {
    window.location.href = `mailto:${settings.contact_email}`
  }

  return (
    <Button
      onClick={handleEmailClick}
      className="w-14 h-14 rounded-full bg-gray-600 hover:bg-gray-700 text-white shadow-lg p-0"
      aria-label="Contact via email"
    >
      <Mail className="h-7 w-7" />
    </Button>
  )
}