import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Users, User as UserIcon, Check, Weight, X, ChevronRight, MapPin, Calendar } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { User } from "@supabase/supabase-js"
import { OpenGymCheckin } from "./OpenGymCheckin"
import { useGymSettings } from "@/contexts/GymSettingsContext"
import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"
import { ProfileImageViewer } from "@/components/ProfileImageViewer"
import { getDisplayName } from "@/lib/nameUtils"
import { format, parseISO } from "date-fns"
import { enUS } from "date-fns/locale"

interface Course {
  id: string
  title: string
  trainer: string
  start_time: string
  end_time: string
  max_participants: number
  course_date: string
  is_cancelled: boolean
  strength_exercise: string | null
  wod_content?: string
  registration_count: number
  registration_deadline_minutes: number
  cancellation_deadline_minutes: number
  user_registered: boolean
  registered_count: number
  waitlist_count: number
  is_registered: boolean
  is_waitlisted: boolean
  duration_minutes: number
  color?: string
}

interface DayCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  user: User
  userRole?: string
}

export const DayCourseDialog: React.FC<DayCourseDialogProps> = ({
  open,
  onOpenChange,
  date,
  user,
  userRole
}) => {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [userMembershipType, setUserMembershipType] = useState<string>('')
  const [includesOpenGym, setIncludesOpenGym] = useState<boolean>(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<{ imageUrl: string | null; displayName: string } | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'trainer' | 'member' | null>(null)
  const { toast } = useToast()
  const { settings } = useGymSettings()
  
  const isOpenGym = userRole === 'open_gym' || userMembershipType === 'open_gym_only'
  const primaryColor = settings?.primary_color || '#B81243'

  useEffect(() => {
    if (open) {
      loadCoursesForDay()
      loadUserMembershipType()
      checkUserRoles()
    }
  }, [open, date])

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

  const loadUserMembershipType = async () => {
    try {
      // First, try V2 membership system
      const { data: membershipV2Data } = await supabase
        .from('user_memberships_v2')
        .select(`
          status,
          membership_data,
          membership_plans_v2(
            name,
            booking_rules,
            includes_open_gym
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      let membershipType = '';
      let hasOpenGymAccess = false;

      if (membershipV2Data && membershipV2Data.length > 0) {
        // Use V2 system with prioritization
        const prioritizedMembership = getPriorizedMembership(membershipV2Data);
        const bookingType = prioritizedMembership?.membership_plans_v2?.booking_rules?.type;
        const membershipPlan = prioritizedMembership?.membership_plans_v2 as any;
        
        membershipType = getMembershipTypeName(prioritizedMembership, null);
        // Check the actual includes_open_gym field from the database
        hasOpenGymAccess = membershipPlan?.includes_open_gym === true;
      } else {
        // V1 system has been deprecated, using fallback to legacy profile system
        const { data: profileData } = await supabase
          .from('profiles')
          .select('membership_type')
          .eq('user_id', user.id)
          .single();
        membershipType = profileData?.membership_type || '';
        hasOpenGymAccess = membershipType !== 'Credits';
      }

      console.log('User membership loaded in DayCourseDialog:', { membershipType, hasOpenGymAccess });
      setUserMembershipType(membershipType);
      setIncludesOpenGym(hasOpenGymAccess);
      
      return { membershipType, hasOpenGymAccess };
    } catch (error) {
      console.error('Error loading user membership type:', error)
      setUserMembershipType('')
      setIncludesOpenGym(false)
      return { membershipType: '', hasOpenGymAccess: false };
    }
  }

  const loadCoursesForDay = async () => {
    setLoading(true)
    try {

      const now = new Date()
      const currentDateTime = now.toISOString()

      let query = supabase
        .from('courses')
        .select('*')
        .eq('is_cancelled', false)

      if (date) {
        const dateString = date
        const nowTime = now.toTimeString().slice(0, 8)
        const nowDate = now.toISOString().split('T')[0]
        
        if (dateString === nowDate) {
          query = query.eq('course_date', dateString).gt('end_time', nowTime)
        } else {
          query = query.eq('course_date', dateString)
        }
      } else {
        const nowTime = now.toTimeString().slice(0, 8)
        const nowDate = now.toISOString().split('T')[0]
        
        query = query
          .or(`course_date.gt.${nowDate},and(course_date.eq.${nowDate},end_time.gt.${nowTime})`)
          .order('course_date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(10)
      }

      const { data: coursesData, error: coursesError } = await query

      if (coursesError) throw coursesError

      const filteredCourses = (coursesData || []).filter(course => {
        const courseDateTime = new Date(`${course.course_date}T${course.end_time}`)
        return courseDateTime > now
      }).slice(0, 10)

      const coursesWithCounts = await Promise.all(
        filteredCourses.map(async (course) => {
          const [registrationsResult, userRegistrationResult] = await Promise.all([
            supabase
              .from('course_registrations')
              .select('user_id')
              .eq('course_id', course.id)
              .eq('status', 'registered'),
            supabase
              .from('course_registrations')
              .select('status')
              .eq('course_id', course.id)
              .eq('user_id', user.id)
              .in('status', ['registered', 'waitlist'])
              .maybeSingle()
          ])

          const userReg = userRegistrationResult.data
          return {
            ...course,
            registration_count: registrationsResult.data?.length || 0,
            registered_count: registrationsResult.data?.length || 0,
            waitlist_count: 0, // Add waitlist logic if needed
            user_registered: (userReg?.status === 'registered' || userReg?.status === 'waitlist') || false,
            is_registered: userReg?.status === 'registered' || false,
            is_waitlisted: userReg?.status === 'waitlist' || false
          }
        })
      )

      // Sort courses by start_time (earliest first)
      const sortedCourses = coursesWithCounts.sort((a, b) => 
        a.start_time.localeCompare(b.start_time)
      )

      setCourses(sortedCourses)
    } catch (error) {
      console.error('Error loading courses:', error)
      toast({
        title: "Error",
        description: "Courses could not be loaded.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadParticipants = async (courseId: string) => {
    try {
      console.log('Loading participants for course:', courseId)
      
      // First get the registrations
      const { data: registrations, error: regError } = await supabase
        .from('course_registrations')
        .select('status, user_id, registered_at')
        .eq('course_id', courseId)
        .order('registered_at', { ascending: true })

      if (regError) {
        console.error('Error loading registrations:', regError)
        throw regError
      }

      // Then get the profiles for these users
      const userIds = registrations?.map(r => r.user_id) || []
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, nickname, avatar_url')
        .in('user_id', userIds)

      if (profileError) {
        console.error('Error loading profiles:', profileError)
        throw profileError
      }

      // Combine the data
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

      console.log('Loaded participants:', participantsWithNames)
      setParticipants(participantsWithNames)
    } catch (error) {
      console.error('Error loading participants:', error)
      toast({
        title: "Error",
        description: "Error loading participants",
        variant: "destructive"
      })
      setParticipants([]) // Set empty array on error
    }
  }

  const handleCourseClick = async (course: Course) => {
    setSelectedCourse(course)
    await loadParticipants(course.id)
    setDialogOpen(true)
  }

  const canCancelCourse = (course: Course) => {
    const now = new Date()
    const courseDateTime = new Date(`${course.course_date}T${course.start_time}`)
    const cancellationDeadline = new Date(courseDateTime.getTime() - (course.cancellation_deadline_minutes * 60 * 1000))
    return now < cancellationDeadline
  }

  const handleRegistration = async (courseId: string) => {
    try {
      const course = courses.find(c => c.id === courseId) || selectedCourse
      if (!course) return

      if (course.is_registered || course.is_waitlisted) {
        // Check cancellation deadline before unregistering
        if (!canCancelCourse(course)) {
          toast({
            title: "Abmeldung nicht möglich",
            description: `Die Abmeldefrist ist bereits ${course.cancellation_deadline_minutes} Minuten vor Kursbeginn abgelaufen.`,
            variant: "destructive"
          })
          return
        }

        // Unregister
        const { error } = await supabase
          .from('course_registrations')
          .update({ status: 'cancelled' })
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .in('status', ['registered', 'waitlist'])

        if (error) throw error

        // Refund credit for credits and limited memberships (only for actual registrations, not waitlist)
        if (course.is_registered) {
          const { data: creditResult } = await supabase
            .rpc('handle_course_registration_credits', {
              p_user_id: user.id,
              p_course_id: courseId,
              p_action: 'refund'
            })

          // Log credit refund result (don't fail the cancellation if this fails)
          if (creditResult && typeof creditResult === 'object' && 'success' in creditResult && creditResult.success) {
            console.log('Credit refunded:', creditResult.message)
          }
        }

        // Immediately update local state
        setCourses(prev => prev.map(c => 
          c.id === courseId 
            ? { 
                ...c, 
                user_registered: false, 
                is_registered: false,
                is_waitlisted: false,
                registration_count: Math.max(0, c.registration_count - 1),
                registered_count: Math.max(0, c.registered_count - 1)
              }
            : c
        ))

        // Update selected course state
        if (selectedCourse?.id === courseId) {
          setSelectedCourse(prev => prev ? {
            ...prev,
            user_registered: false,
            is_registered: false,
            is_waitlisted: false,
            registration_count: Math.max(0, prev.registration_count - 1),
            registered_count: Math.max(0, prev.registered_count - 1)
          } : null)
        }

        toast({
          title: "Abgemeldet",
          description: "You have been successfully unregistered from the course."
        })
      } else {
        // Check if user can register (limits and credits)
        const { data: registrationCheck, error: checkError } = await supabase
          .rpc('can_user_register_for_course_enhanced', {
            p_user_id: user.id,
            p_course_id: courseId
          })

        const response = registrationCheck as any
        const canRegister = response?.canRegister || false
        const canWaitlist = response?.canWaitlist || false

        if (checkError || (!canRegister && !canWaitlist)) {
          if (userMembershipType === 'Basic Member') {
            toast({
              title: "Wöchentliches Limit erreicht",
              description: "Du hast dein wöchentliches Limit von 2 Anmeldungen erreicht",
              variant: "destructive",
            })
          } else if (userMembershipType === 'Credits') {
            toast({
              title: "No Credits Available",
              description: "You have no credits left. Please top up your credits at the reception",
              variant: "destructive",
            })
          } else if (userMembershipType === 'open_gym_only') {
            toast({
              title: "Anmeldung nicht möglich",
              description: "Deine Mitgliedschaft beinhaltet nur Open Gym. Für Kurse benötigst du eine erweiterte Mitgliedschaft.",
              variant: "destructive"
            })
          } else {
            toast({
              title: "Anmeldung nicht möglich",
              description: "Anmeldung nicht möglich",
              variant: "destructive"
            })
          }
          return
        }

        // Check registration deadline before registering
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('registration_deadline_minutes, course_date, start_time')
          .eq('id', courseId)
          .single()

        if (courseError) throw courseError

        const now = new Date()
        const courseStart = new Date(`${courseData.course_date}T${courseData.start_time}`)
        const deadlineTime = new Date(courseStart.getTime() - (courseData.registration_deadline_minutes * 60 * 1000))

        if (now > deadlineTime) {
          toast({
            title: "Registration not possible",
            description: `The registration deadline has already passed ${courseData.registration_deadline_minutes} minutes before course start.`,
            variant: "destructive"
          })
          return
        }

        // Check if user already has a registration (including cancelled ones)
        const { data: existingReg, error: regCheckError } = await supabase
          .from('course_registrations')
          .select('id, status')
          .eq('course_id', courseId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (regCheckError && regCheckError.code !== 'PGRST116') throw regCheckError

        const isWaitlist = course.registered_count >= course.max_participants
        const newStatus = isWaitlist ? 'waitlist' : 'registered'

        // Handle credit management before registration (only for non-waitlist registrations)
        if (!isWaitlist) {
          const { data: creditDeductResult } = await supabase
            .rpc('handle_course_registration_credits', {
              p_user_id: user.id,
              p_course_id: courseId,
              p_action: 'deduct'
            })
          
          const creditData = creditDeductResult as { success: boolean; message: string; credits: number } | null
          if (creditData && !creditData.success) {
            toast({
              title: "Registration not possible",
              description: creditData.message,
              variant: "destructive"
            })
            return
          }

          if (existingReg) {
            // Update existing registration (reactivate if cancelled)
            const { error } = await supabase
              .from('course_registrations')
              .update({ 
                status: newStatus,
                registered_at: new Date().toISOString()
              })
              .eq('id', existingReg.id)

            if (error) {
              // Rollback credit deduction if registration fails
              await supabase.rpc('handle_course_registration_credits', {
                p_user_id: user.id,
                p_course_id: courseId,
                p_action: 'refund'
              })
              throw error
            }
          } else {
            // Create new registration
            const { error } = await supabase
              .from('course_registrations')
              .insert({
                course_id: courseId,
                user_id: user.id,
                status: newStatus
              })

            if (error) {
              // Rollback credit deduction if registration fails
              await supabase.rpc('handle_course_registration_credits', {
                p_user_id: user.id,
                p_course_id: courseId,
                p_action: 'refund'
              })
              throw error
            }
          }
        } else {
          // For waitlist, just create/update the registration without credit deduction
          if (existingReg) {
            // Update existing registration (reactivate if cancelled)
            const { error } = await supabase
              .from('course_registrations')
              .update({ 
                status: newStatus,
                registered_at: new Date().toISOString()
              })
              .eq('id', existingReg.id)

            if (error) throw error
          } else {
            // Create new registration
            const { error } = await supabase
              .from('course_registrations')
              .insert({
                course_id: courseId,
                user_id: user.id,
                status: newStatus
              })

            if (error) throw error
          }
        }

        // Immediately update local state
        setCourses(prev => prev.map(c => 
          c.id === courseId 
            ? { 
                ...c, 
                user_registered: true,
                is_registered: newStatus === 'registered',
                is_waitlisted: newStatus === 'waitlist',
                registration_count: c.registration_count + 1,
                registered_count: newStatus === 'registered' ? c.registered_count + 1 : c.registered_count,
                waitlist_count: newStatus === 'waitlist' ? c.waitlist_count + 1 : c.waitlist_count
              }
            : c
        ))

        // Update selected course state
        if (selectedCourse?.id === courseId) {
          setSelectedCourse(prev => prev ? {
            ...prev,
            user_registered: true,
            is_registered: newStatus === 'registered',
            is_waitlisted: newStatus === 'waitlist',
            registration_count: prev.registration_count + 1,
            registered_count: newStatus === 'registered' ? prev.registered_count + 1 : prev.registered_count,
            waitlist_count: newStatus === 'waitlist' ? prev.waitlist_count + 1 : prev.waitlist_count
          } : null)
        }

        // Mark user as active on course registration (real activity)
        if (!isWaitlist) {
          await supabase.rpc('mark_user_as_active', { user_id_param: user.id })
        }

        toast({
          title: isWaitlist ? "On Waitlist" : "Registered",
          description: isWaitlist ? "You have been added to the waitlist" : "You have been successfully registered for the course."
        })
      }

      // Reload data as fallback to ensure consistency
      await loadCoursesForDay()
      if (selectedCourse?.id === courseId) {
        await loadParticipants(courseId)
      }
      
      window.dispatchEvent(new CustomEvent('courseRegistrationChanged'))
      window.dispatchEvent(new CustomEvent('creditsUpdated'))
    } catch (error) {
      console.error('Error with registration:', error)
      toast({
        title: "Error",
        description: "Error with registration",
        variant: "destructive"
      })
    }
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5) // HH:MM format ohne Sekunden
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit'
    })
  }

  const handleQRCheckinComplete = async () => {
    try {
      // Prüfe zuerst, ob bereits ein Training für heute existiert
      const { data: existingSession, error: checkError } = await supabase
        .from('training_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', date)
        .maybeSingle()

      if (checkError) throw checkError

      if (existingSession) {
        toast({
          title: "Training bereits registriert",
          description: "Du hast bereits ein Training für heute registriert."
        })
        setShowQRScanner(false)
        return
      }

      // Erstelle ein Training für Open Gym
      const { error } = await supabase
        .from('training_sessions')
        .insert({
          user_id: user.id,
          session_date: date,
          session_type: 'free_training',
          status: 'completed',
          completed_at: new Date().toISOString()
        })

      if (error) throw error

      toast({
        title: "Open Gym Check-In Successful",
        description: "Dein freies Training wurde registriert."
      })

      setShowQRScanner(false)
      
      // Dispatch events to update other components immediately
      window.dispatchEvent(
        new CustomEvent('open-gym-checkin-success', {
          detail: { date, type: 'free_training' }
        })
      )
    } catch (error) {
      console.error('Error creating training session:', error)
      toast({
        title: "Error",
        description: "Training konnte nicht registriert werden.",
        variant: "destructive"
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              Courses on {formatDate(date)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground">Loading Courses...</p>
              </div>
            ) : isOpenGym ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-center">
                <h3 className="font-medium mb-3 text-foreground">Open Gym Training</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Scanne den QR-Code um dich für dein Open Gym Training einzuchecken
                </p>
                <Button 
                  onClick={() => setShowQRScanner(true)}
                  className="w-full"
                >
                  Scan QR Code
                </Button>
              </div>
            ) : courses.length === 0 ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
                <p className="text-muted-foreground">No courses on this day</p>
              </div>
            ) : (
              courses.map((course) => {
                const percentage = (course.registered_count / course.max_participants) * 100;
                let badgeColor = "bg-green-500";
                if (percentage >= 100) badgeColor = "bg-red-500";
                else if (percentage >= 75) badgeColor = "bg-[#edb408]";

                 return (
                    <div 
                     key={course.id} 
                     className={`rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-all duration-200 border-2`}
                     style={{
                       backgroundColor: `${course.color || '#f3f4f6'}15`,
                       borderColor: course.color || '#f3f4f6'
                     }}
                     onClick={() => handleCourseClick(course)}
                   >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 whitespace-nowrap overflow-hidden">
                            <h4 className="font-medium truncate text-foreground">{course.title}</h4>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(course.start_time)} - {formatTime(course.end_time)}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {course.trainer}
                            </div>
                          </div>
                          {course.strength_exercise && (
                            <Badge variant="outline" className="text-xs mt-1 w-fit bg-primary/10 text-primary border-primary/20">
                              {course.strength_exercise}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`text-white ${badgeColor} shadow-sm`}>
                            {course.registered_count}/{course.max_participants}
                          </Badge>
                          {course.waitlist_count > 0 && (
                            <Badge className="text-white bg-yellow-500 shadow-sm">
                              WL: {course.waitlist_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                  </div>
                )
              })
            )}

            {/* Open Gym Section */}
            {includesOpenGym && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-2">Open Gym</h3>
                <Button 
                  onClick={() => setShowQRScanner(true)}
                  className="w-full"
                  variant="outline"
                >
                  Scan QR Code for Open Gym
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedCourse?.title}</DialogTitle>
          </DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(selectedCourse.course_date), 'EEEE, dd.MM.yyyy', { locale: enUS })}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {selectedCourse.start_time.slice(0, 5)} - {selectedCourse.end_time.slice(0, 5)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  Trainer: {selectedCourse.trainer}
                </div>
                {selectedCourse.strength_exercise && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">
                      Kraftteil: {selectedCourse.strength_exercise}
                    </Badge>
                  </div>
                )}
                {selectedCourse.wod_content && (
                  <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                    <h5 className="font-medium text-sm mb-2">WOD (Workout of the Day)</h5>
                    <p className="text-sm whitespace-pre-wrap">{selectedCourse.wod_content}</p>
                  </div>
                )}
              </div>

              {/* Participants */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Participants ({selectedCourse.registered_count}/{selectedCourse.max_participants})
                </h4>
                <div className="max-h-64 overflow-y-auto">
                  {participants.filter(p => p.status === 'registered').length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No registrations</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {participants
                        .filter(p => p.status === 'registered')
                        .map((participant, index) => {
                          const position = index + 1
                           return (
                             <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                               <div className="flex items-center gap-3">
                                  <div 
                                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => participant.profiles?.avatar_url && setSelectedProfile({ 
                                      imageUrl: participant.profiles.avatar_url, 
                                      displayName: participant.profiles?.nickname || participant.profiles?.display_name || 'Unbekannt' 
                                    })}
                                  >
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
                          )
                        })}
                    </div>
                  )}
                </div>
                
                {participants.filter(p => p.status === 'waitlist').length > 0 && (
                  <div className="space-y-3">
                     <h5 className="font-medium text-sm text-muted-foreground">
                       Waitlist ({selectedCourse.waitlist_count})
                     </h5>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                       <p className="text-sm text-yellow-800">
                         {selectedCourse.waitlist_count} person(s) on the waitlist
                       </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedCourse.is_registered ? (
                  <Button 
                    onClick={() => handleRegistration(selectedCourse.id)}
                    disabled={!canCancelCourse(selectedCourse)}
                    className="flex-1 text-white hover:opacity-80"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {canCancelCourse(selectedCourse) ? 'Cancel Registration' : 'Cancellation deadline expired'}
                  </Button>
                ) : selectedCourse.is_waitlisted ? (
                  <Button 
                    onClick={() => handleRegistration(selectedCourse.id)}
                    disabled={!canCancelCourse(selectedCourse)}
                    className="flex-1 text-white hover:opacity-80"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {canCancelCourse(selectedCourse) ? 'Remove from Waitlist' : 'Cancellation deadline expired'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleRegistration(selectedCourse.id)}
                    className="flex-1 text-white hover:opacity-80"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {selectedCourse.registered_count >= selectedCourse.max_participants ? 'Join Waitlist' : 'Register'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Image Viewer */}
      {selectedProfile && (
        <ProfileImageViewer
          imageUrl={selectedProfile.imageUrl}
          displayName={selectedProfile.displayName}
          isOpen={!!selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}

      {/* QR Scanner */}
      {showQRScanner && (
        <OpenGymCheckin
          open={showQRScanner}
          onOpenChange={setShowQRScanner}
          onCheckinComplete={handleQRCheckinComplete}
        />
      )}
    </>
  )
}