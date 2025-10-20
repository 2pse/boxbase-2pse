import { useState, useEffect } from "react"
import { Calendar, Clock, ChevronRight, Users, User as UserIcon, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { format } from "date-fns"
import { enUS } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { getDisplayName } from "@/lib/nameUtils"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"

interface UpcomingClassReservationProps {
  user: User
}

interface UpcomingReservation {
  id: string
  course: {
    id: string
    title: string
    course_date: string
    start_time: string
    end_time: string
    trainer?: string
    max_participants: number
  }
  registrationCount: number
}

export const UpcomingClassReservation: React.FC<UpcomingClassReservationProps> = ({ user }) => {
  const [upcomingReservation, setUpcomingReservation] = useState<UpcomingReservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'trainer' | 'member' | null>(null)
  const { toast } = useToast()

  // Add real-time sync for immediate updates
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => {
      console.log('Course registration changed - updating upcoming reservation')
      loadUpcomingReservation()
    }
  })

  useEffect(() => {
    loadUpcomingReservation()
    checkUserRoles()
  }, [user.id])

  const checkUserRoles = async () => {
    try {
      const { data: rolesResult } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
      
      if (rolesResult) {
        const roles = rolesResult.map(r => r.role)
        setCurrentUserRole(roles.includes('admin') ? 'admin' : roles.includes('trainer') ? 'trainer' : 'member')
      }
    } catch (error) {
      console.error('Error checking user roles:', error)
      setCurrentUserRole('member')
    }
  }

  const loadParticipants = async (courseId: string) => {
    try {
      const { data: registrations, error: regError } = await supabase
        .from('course_registrations')
        .select('status, user_id, registered_at')
        .eq('course_id', courseId)
        .eq('status', 'registered')
        .order('registered_at', { ascending: true })

      if (regError) throw regError

      const userIds = registrations?.map(r => r.user_id) || []
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, nickname, avatar_url')
        .in('user_id', userIds)

      if (profileError) throw profileError

      const participantsWithNames = registrations?.map(reg => {
        const profile = profiles?.find(p => p.user_id === reg.user_id)
        return {
          ...reg,
          profiles: profile ? {
            ...profile,
            display_name: getDisplayName(profile, currentUserRole)
          } : { display_name: 'Unbekannt' }
        }
      }) || []

      setParticipants(participantsWithNames)
    } catch (error) {
      console.error('Error loading participants:', error)
      setParticipants([])
    }
  }

  const canCancelCourse = (course: any) => {
    const now = new Date()
    const courseDateTime = new Date(`${course.course_date}T${course.start_time}`)
    const cancellationDeadline = new Date(courseDateTime.getTime() - (120 * 60 * 1000)) // 120 minutes default
    return now < cancellationDeadline
  }

  const handleCancelRegistration = async () => {
    if (!upcomingReservation) return

    try {
      if (!canCancelCourse(upcomingReservation.course)) {
        toast({
          title: "Cancellation not possible",
          description: "The cancellation deadline has already passed.",
          variant: "destructive"
        })
        return
      }

      const { error } = await supabase
        .from('course_registrations')
        .update({ status: 'cancelled' })
        .eq('id', upcomingReservation.id)

      if (error) throw error

      // Refund credit
      await supabase.rpc('handle_course_registration_credits', {
        p_user_id: user.id,
        p_course_id: upcomingReservation.course.id,
        p_action: 'refund'
      })

      toast({
        title: "Unregistered",
        description: "You have been successfully unregistered from the course."
      })

      setShowDialog(false)
      setUpcomingReservation(null)
      
      // Dispatch event to update other components
      window.dispatchEvent(new CustomEvent('courseRegistrationChanged'))
    } catch (error) {
      console.error('Error cancelling registration:', error)
      toast({
        title: "Error",
        description: "Error cancelling course registration.",
        variant: "destructive"
      })
    }
  }

  const handleCardClick = async () => {
    if (upcomingReservation) {
      await loadParticipants(upcomingReservation.course.id)
      setShowDialog(true)
    }
  }

  const loadUpcomingReservation = async () => {
    try {
      setLoading(true)
      
      if (!user?.id) {
        console.log('No user ID available in UpcomingClassReservation')
        setUpcomingReservation(null)
        return
      }

      console.log('Loading upcoming reservation for user:', user.id)
      
      // Get all upcoming course registrations (today and future)
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          course_date,
          start_time,
          end_time,
          trainer,
          max_participants,
          course_registrations!inner (
            id,
            user_id,
            status
          )
        `)
        .eq('course_registrations.user_id', user.id)
        .eq('course_registrations.status', 'registered')
        .gte('course_date', new Date().toISOString().split('T')[0])
        .order('course_date', { ascending: true })
        .order('start_time', { ascending: true })

      console.log('Upcoming reservation query result:', { coursesData, error })

      if (error) {
        console.error('Error loading upcoming reservation:', error)
        return
      }

      // Filter courses to only show those that haven't started yet
      const now = new Date()
      const upcomingCourses = coursesData?.filter(course => {
        const courseDateTime = new Date(`${course.course_date}T${course.start_time}`)
        return courseDateTime > now
      }) || []

      if (upcomingCourses.length > 0) {
        const course = upcomingCourses[0]
        const registration = course.course_registrations[0]
        console.log('Found upcoming registration:', { course, registration })
        
        // Get registration count for this course
        const { data: regCount, error: countError } = await supabase
          .from('course_registrations')
          .select('id')
          .eq('course_id', course.id)
          .eq('status', 'registered')

        if (countError) {
          console.error('Error loading registration count:', countError)
        }

        setUpcomingReservation({
          id: registration.id,
          course: {
            id: course.id,
            title: course.title,
            course_date: course.course_date,
            start_time: course.start_time,
            end_time: course.end_time,
            trainer: course.trainer,
            max_participants: course.max_participants
          },
          registrationCount: regCount?.length || 0
        })
      } else {
        console.log('No upcoming registrations found')
        setUpcomingReservation(null)
      }
    } catch (error) {
      console.error('Error loading upcoming reservation:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-muted rounded w-full mb-1"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!upcomingReservation) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">No upcoming course reservations</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { course, registrationCount } = upcomingReservation
  const courseDate = new Date(course.course_date)
  const formattedDate = format(courseDate, 'EEEE, dd.MM.yyyy', { locale: enUS })
  const timeRange = `${course.start_time.slice(0, 5)} - ${course.end_time.slice(0, 5)}`

  return (
    <>
      <Card 
        className="w-full cursor-pointer bg-gray-100 dark:bg-gray-800 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02] rounded-2xl relative h-24 md:h-[155px]" 
        onClick={handleCardClick}
      >
        <CardContent className="p-4 md:p-8 h-full flex items-center justify-center">
          <div className="absolute top-3 md:top-5 right-3 md:right-5">
            <Calendar className="h-4 md:h-8 w-4 md:w-8 text-gray-600 dark:text-gray-400" />
          </div>
          
          <div className="space-y-2 text-center">
            <h3 className="font-medium text-sm md:text-lg text-muted-foreground">Next Reservation</h3>
            <h4 className="font-semibold text-base md:text-3xl">{course.title}</h4>
            
            <div className="flex items-center justify-center gap-1 text-sm md:text-base text-muted-foreground">
              <Clock className="h-3 md:h-5 w-3 md:w-5" />
              <span>{formattedDate.split(',')[0]} {timeRange}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{course.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                {timeRange}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4" />
                Trainer: {course.trainer}
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                Participants ({registrationCount}/{course.max_participants})
              </h4>
              <div className="max-h-64 overflow-y-auto">
                {participants.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">No registrations</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {participants.map((participant, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {participant.profiles?.avatar_url ? (
                              <img 
                                src={participant.profiles.avatar_url} 
                                alt="Avatar" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-medium">
                                {participant.profiles?.display_name?.charAt(0) || '?'}
                              </span>
                            )}
                          </div>
                          <span className="font-medium">
                            {participant.profiles?.display_name || 'Unbekannt'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Registered
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <Button 
              onClick={handleCancelRegistration}
              disabled={!canCancelCourse(course)}
              className="w-full"
              variant="default"
            >
              {canCancelCourse(course) ? 'Cancel Registration' : 'Cancellation deadline expired'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}