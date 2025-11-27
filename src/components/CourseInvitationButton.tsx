import { useState } from "react"
import { UserPlus } from "lucide-react"
import { User } from "@supabase/supabase-js"
import { MemberSelectorDialog } from "./MemberSelectorDialog"

interface CourseInvitationButtonProps {
  courseId: string
  courseName: string
  courseDate: string
  courseTime: string
  user: User
}

export const CourseInvitationButton: React.FC<CourseInvitationButtonProps> = ({
  courseId,
  courseName,
  courseDate,
  courseTime,
  user
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setDialogOpen(true)
        }}
        className="w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 border-primary bg-card flex items-center justify-center hover:scale-105 transition-transform duration-200 shadow-sm"
        title="Invite members"
      >
        <UserPlus className="h-4 w-4 md:h-5 md:w-5 text-primary" />
      </button>

      <MemberSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        courseId={courseId}
        courseName={courseName}
        courseDate={courseDate}
        courseTime={courseTime}
        user={user}
      />
    </>
  )
}
