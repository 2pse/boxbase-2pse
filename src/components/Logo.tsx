import { useTheme } from "next-themes"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface LogoProps {
  className?: string
  onClick?: () => void
  alt?: string
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "h-10", 
  onClick, 
  alt 
}) => {
  const { theme } = useTheme()
  const { settings } = useGymSettings()
  
  // Use dynamic gym name for alt text
  const altText = alt || `${settings?.gym_name || ''} - Dein Gym, Deine App Logo`
  
  // Use only dynamic logos from admin settings
  const logoSrc = theme === "dark" 
    ? settings?.logo_dark_url
    : settings?.logo_light_url
  
  // If no logo is configured, show gym name as text (if available)
  if (!logoSrc) {
    if (!settings?.gym_name) {
      return null; // Show nothing if no logo and no gym name
    }
    
    return (
      <div 
        className={`${className} cursor-pointer hover:opacity-80 transition-opacity flex items-center font-bold text-primary`}
        onClick={onClick}
      >
        {settings.gym_name}
      </div>
    )
  }
  
  return (
    <img 
      src={logoSrc}
      alt={altText}
      className={`${className} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
    />
  )
}