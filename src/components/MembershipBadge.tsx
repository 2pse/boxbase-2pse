import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MembershipType = 'Unlimited' | 'Limited' | 'Credits' | 'Open Gym' | 'Trainer' | 'Administrator' | 'Basic Member' | 'Premium Member' | 'Wellpass'

interface MembershipBadgeProps {
  type: MembershipType | string | null | undefined
  className?: string
  forceBlack?: boolean
  noShadow?: boolean
}

const getMembershipColor = (type: MembershipType | string | null | undefined) => {
  // All membership types now use gray color
  return 'hsl(0, 0%, 65%)' // Gray for all membership types
}

const getTextColor = (type: MembershipType | string | null | undefined, forceBlack?: boolean) => {
  if (forceBlack) return 'hsl(0, 0%, 100%)'
  // Use white text for all badges consistently
  return 'hsl(0, 0%, 100%)'
}

const getDisplayText = (type: MembershipType | string | null | undefined): string => {
  if (!type || type === null || type === undefined) {
    return 'No Membership'
  }
  return type
}

export const MembershipBadge: React.FC<MembershipBadgeProps> = ({ type, className, forceBlack, noShadow }) => {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border-0 transition-shadow duration-300",
        !noShadow && "shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.15)] dark:hover:shadow-[0_6px_20px_rgba(255,255,255,0.25)]",
        className
      )}
      style={{
        backgroundColor: forceBlack ? 'hsl(0, 0%, 0%)' : getMembershipColor(type),
        color: getTextColor(type, forceBlack)
      }}
    >
      {getDisplayText(type)}
    </Badge>
  )
}