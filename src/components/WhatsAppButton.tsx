import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGymSettings } from "@/contexts/GymSettingsContext"

export const WhatsAppButton = () => {
  const { settings } = useGymSettings()
  
  // Don't render if no WhatsApp number is set
  if (!settings?.whatsapp_number) {
    return null
  }

  const handleWhatsAppClick = () => {
    window.open(`https://wa.me/${settings.whatsapp_number}`, '_blank')
  }

  return (
    <Button
      onClick={handleWhatsAppClick}
      className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg p-0"
      aria-label="WhatsApp kontaktieren"
    >
      <Phone className="h-7 w-7" />
    </Button>
  )
}