import { UserPlus } from "lucide-react"

interface CourseInvitationBadgeProps {
  invitationCount: number
  onClick: () => void
}

export const CourseInvitationBadge: React.FC<CourseInvitationBadgeProps> = ({
  invitationCount,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className="absolute -top-3 md:top-0 right-0 md:-right-24 z-10 w-10 h-10 md:w-12 md:h-12 rounded-lg border-2 border-primary bg-card flex items-center justify-center hover:scale-105 transition-transform duration-200 shadow-sm"
    >
      <UserPlus className="h-5 w-5 md:h-6 md:w-6 text-primary" />
      {invitationCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
          {invitationCount > 9 ? '9+' : invitationCount}
        </span>
      )}
    </button>
  )
}
