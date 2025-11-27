import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MembershipType = 'Unlimited' | 'Limited' | 'Credits' | 'Open Gym' | 'Trainer' | 'Administrator' | 'Basic Member' | 'Premium Member' | 'Wellpass'

interface MembershipBadgeProps {
  type: MembershipType | string | null | undefined
  className?: string
  forceBlack?: boolean
  forceRed?: boolean
  noShadow?: boolean
  color?: string // Hex color from membership plan
}

const getMembershipColor = (type: MembershipType | string | null | undefined, providedColor?: string) => {
  // Special Cases: "No Membership" and "Administrator" ALWAYS light gray
  if (!type || type === 'No Membership' || type === 'Administrator') {
    return 'hsl(0, 0%, 85%)'
  }
  // If color provided from plan, use it
  if (providedColor) return providedColor
  // Fallback to gray
  return 'hsl(0, 0%, 65%)'
}

const getTextColor = (type: MembershipType | string | null | undefined, forceBlack?: boolean, forceRed?: boolean) => {
  // Special cases get dark gray text
  if (!type || type === 'No Membership' || type === 'Administrator') {
    return 'hsl(0, 0%, 40%)'
  }
  // All other cases use white text
  return 'hsl(0, 0%, 100%)'
}

const getDisplayText = (type: MembershipType | string | null | undefined): string => {
  if (!type || type === null || type === undefined) {
    return 'No Membership'
  }
  return type
}

export const MembershipBadge: React.FC<MembershipBadgeProps> = ({ 
  type, 
  className, 
  forceBlack, 
  forceRed,
  noShadow,
  color 
}) => {
  // Determine background color based on hierarchy
  const getBackgroundColor = () => {
    // Special cases always light gray
    if (!type || type === 'No Membership' || type === 'Administrator') {
      return 'hsl(0, 0%, 85%)'
    }
    // forceRed for inactive status
    if (forceRed) {
      return 'hsl(0, 84%, 60%)'
    }
    // forceBlack
    if (forceBlack) {
      return 'hsl(0, 0%, 0%)'
    }
    // Use provided color or fallback
    return getMembershipColor(type, color)
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border-0 transition-shadow duration-300",
        !noShadow && "shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.15)] dark:hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)]",
        className
      )}
      style={{
        backgroundColor: getBackgroundColor(),
        color: getTextColor(type, forceBlack, forceRed)
      }}
    >
      {getDisplayText(type)}
    </Badge>
  )
}
