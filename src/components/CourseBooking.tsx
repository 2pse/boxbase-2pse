import { useState, useEffect } from "react"
import { User } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, MapPin, List } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { MembershipBadge } from "@/components/MembershipBadge"
import { MembershipLimitDisplay } from "@/components/MembershipLimitDisplay"
import { ProfileImageViewer } from "@/components/ProfileImageViewer"
import { CourseCalendar } from "@/components/CourseCalendar"
import { toast } from "sonner"
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns"
import { enUS } from "date-fns/locale"
import { useGymSettings } from "@/contexts/GymSettingsContext"
import { getDisplayName } from "@/lib/nameUtils"
import { Database } from "@/integrations/supabase/types"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"

interface Course {
  id: string
  title: string
  trainer: string
  strength_exercise?: string
  wod_content?: string
  max_participants: number
  course_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  registration_deadline_minutes: number
  cancellation_deadline_minutes: number
  registered_count: number
  waitlist_count: number
  is_registered: boolean
  is_waitlisted: boolean
  color?: string
}

interface CourseBookingProps {
  user: User
}

export const CourseBooking = ({ user }: CourseBookingProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isTrainer, setIsTrainer] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userMembershipType, setUserMembershipType] = useState<string>('')
  const [selectedProfile, setSelectedProfile] = useState<{ imageUrl: string | null; displayName: string } | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'trainer' | 'member' | null>(null)
  const { settings } = useGymSettings()

  const primaryColor = settings?.primary_color || '#B81243'

  // Setup real-time sync
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => loadCourses(),
    onCourseChange: () => loadCourses()
  })

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout
    
    const loadData = async () => {
      if (!mounted) return
      
      // Debounce to prevent rapid calls
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (mounted) {
          await Promise.all([loadCourses(), checkUserRoles()])
        }
      }, 100)
    }
    
    loadData()
    
    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [currentWeek, viewMode])

  const checkUserRoles = async () => {
    try {
      const [rolesResult, membershipResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id),
        supabase
          .from('user_memberships_v2')
          .select(`
            status,
            membership_plans_v2(
              name,
              booking_rules
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()
      ])
      
      if (rolesResult.data) {
        const roles = rolesResult.data.map(r => r.role)
        setIsTrainer(roles.includes('trainer'))
        setIsAdmin(roles.includes('admin'))
      }
      
      // Set membership type from V2 system
      let membershipType = '';
      if (membershipResult.data?.membership_plans_v2?.booking_rules) {
        const bookingRules = membershipResult.data.membership_plans_v2.booking_rules as any;
        membershipType = bookingRules.type || '';
      } else {
        // Fallback to user roles for admin/trainer
        if (rolesResult.data?.some(r => ['admin', 'trainer'].includes(r.role))) {
          membershipType = 'unlimited';
        }
      }
      
      console.log('User membership type loaded:', membershipType);
      setUserMembershipType(membershipType);

      // Set current user role for name display
      const roles = rolesResult.data?.map(r => r.role) || []
      setCurrentUserRole(roles.includes('admin') ? 'admin' : roles.includes('trainer') ? 'trainer' : 'member');
    } catch (error) {
      console.error('Error checking user roles:', error);
      setIsTrainer(false)
      setIsAdmin(false)
      setUserMembershipType('')
    }
  }

  const loadCourses = async () => {
    try {
      setLoading(true)

      // Get upcoming courses and limit to next 10 unique course days
      const now = new Date()
      const nowDate = now.toISOString().split('T')[0]
      const nowTime = now.toTimeString().slice(0, 8)

      const [coursesResult, userRegistrationsResult] = await Promise.all([
        supabase
          .from('courses')
          .select(`
            *,
            course_registrations(status)
          `)
          .eq('is_cancelled', false)
          // Only future courses by date and time
          .or(`course_date.gt.${nowDate},and(course_date.eq.${nowDate},end_time.gt.${nowTime})`)
          .order('course_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('course_registrations')
          .select('course_id, status')
          .eq('user_id', user.id)
      ])

      if (coursesResult.error) throw coursesResult.error
      if (userRegistrationsResult.error) throw userRegistrationsResult.error

      // Process courses data
      const processedCourses = (coursesResult.data || []).map(course => {
        const registrations = course.course_registrations || []
        const registered_count = registrations.filter(r => r.status === 'registered').length
        const waitlist_count = registrations.filter(r => r.status === 'waitlist').length
        
        const userReg = userRegistrationsResult.data?.find(r => r.course_id === course.id)
        const is_registered = userReg?.status === 'registered'
        const is_waitlisted = userReg?.status === 'waitlist'

        return {
          ...course,
          registered_count,
          waitlist_count,
          is_registered,
          is_waitlisted
        }
      })

      // Filter courses based on view mode
      // List view: limit to next 10 unique course days
      // Calendar view: show all future courses
      let filteredCourses = processedCourses
      
      if (viewMode === 'list') {
        const uniqueDates = new Set<string>()
        filteredCourses = processedCourses.filter(course => {
          if (uniqueDates.size >= 10) return false
          if (!uniqueDates.has(course.course_date)) {
            uniqueDates.add(course.course_date)
            return true
          }
          return uniqueDates.has(course.course_date)
        })
      }

      setCourses(filteredCourses)
    } catch (error) {
      console.error('Error loading courses:', error)
      toast.error('Error loading courses')
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
      toast.error('Error loading participants')
      setParticipants([]) // Set empty array on error
    }
  }

  const handleCourseClick = async (course: Course) => {
    setSelectedCourse(course)
    await loadParticipants(course.id)
    setDialogOpen(true)
  }

  const handleRegistration = async (courseId: string) => {
    try {
      const course = courses.find(c => c.id === courseId)
      if (!course) return

      // Check if user can register (limits and credits)
      const { data: registrationCheck, error: checkError } = await supabase
        .rpc('can_user_register_for_course_enhanced', {
          p_user_id: user.id,
          p_course_id: courseId
        })

      console.log('🔍 Registration Check Result:', {
        checkError,
        registrationCheck,
        userMembershipType,
        courseId,
        courseDate: course?.course_date
      });

      const response = registrationCheck as any
      const canRegister = response?.canRegister || false
      const canWaitlist = response?.canWaitlist || false

      console.log('🔍 Parsed Result:', { canRegister, canWaitlist });

      if (checkError || (!canRegister && !canWaitlist)) {
        console.error('🚫 Registration blocked:', { checkError, canRegister, canWaitlist });
        
        const membershipTypeLower = userMembershipType.toLowerCase()
        
        if (membershipTypeLower.includes('basic') || membershipTypeLower.includes('weekly_limit')) {
          toast.error("You have reached your monthly limit of registrations")
        } else if (membershipTypeLower.includes('limited')) {
          toast.error("You have reached your monthly limit for this period. You can book for next month now!")
        } else if (membershipTypeLower.includes('credit')) {
          toast.error("You have no credits left. Please top up your credits at the reception")
        } else if (membershipTypeLower.includes('open gym') || membershipTypeLower === 'open_gym_only') {
          toast.error("Your membership only includes Open Gym. For courses you need an extended membership.")
        } else {
          toast.error(`Your current membership (${userMembershipType}) does not allow this registration. Please contact us for details.`)
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
        toast.error(`The registration deadline has already passed ${courseData.registration_deadline_minutes} minutes before course start.`)
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

      // Aktuelle Teilnehmerzahl direkt aus DB abrufen (Race-Condition-Prävention)
      const { data: currentRegistrations, error: countError } = await supabase
        .from('course_registrations')
        .select('id', { count: 'exact' })
        .eq('course_id', courseId)
        .eq('status', 'registered')

      if (countError) {
        console.error('Error checking current registrations:', countError)
        toast.error('Fehler beim Prüfen der verfügbaren Plätze')
        return
      }

      const currentCount = currentRegistrations?.length || 0
      const isWaitlist = currentCount >= course.max_participants
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
          toast.error(creditData.message)
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
              is_registered: newStatus === 'registered',
              is_waitlisted: newStatus === 'waitlist',
              registered_count: newStatus === 'registered' ? c.registered_count + 1 : c.registered_count,
              waitlist_count: newStatus === 'waitlist' ? c.waitlist_count + 1 : c.waitlist_count
            }
          : c
      ))

      // Update selected course state
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(prev => prev ? {
          ...prev,
          is_registered: newStatus === 'registered',
          is_waitlisted: newStatus === 'waitlist',
          registered_count: newStatus === 'registered' ? prev.registered_count + 1 : prev.registered_count,
          waitlist_count: newStatus === 'waitlist' ? prev.waitlist_count + 1 : prev.waitlist_count
        } : null)
      }

      // Mark user as active on course registration (real activity)
      if (!isWaitlist) {
        await supabase.rpc('mark_user_as_active', { user_id_param: user.id })
      }

      toast.success(isWaitlist ? 'You have been added to the waitlist' : 'Registered for course')
      
      // Dispatch events for instant UI updates
      window.dispatchEvent(new CustomEvent('courseRegistrationChanged'))
      window.dispatchEvent(new CustomEvent('creditsUpdated'))
      
      await loadCourses()
      if (selectedCourse?.id === courseId) {
        await loadParticipants(courseId)
      }
    } catch (error) {
      console.error('Error registering for course:', error)
      toast.error('Error during registration')
    }
  }

  const canCancelCourse = (course: Course) => {
    const now = new Date()
    const courseDateTime = new Date(`${course.course_date}T${course.start_time}`)
    const cancellationDeadline = new Date(courseDateTime.getTime() - (course.cancellation_deadline_minutes * 60 * 1000))
    return now < cancellationDeadline
  }

  const handleCancellation = async (courseId: string, course?: Course) => {
    const targetCourse = course || selectedCourse
    if (!targetCourse) return

    if (!canCancelCourse(targetCourse)) {
      toast.error(`The cancellation deadline has already passed ${targetCourse.cancellation_deadline_minutes} minutes before course start.`)
      return
    }

    try {
      const { error } = await supabase
        .from('course_registrations')
        .update({ status: 'cancelled' })
        .eq('course_id', courseId)
        .eq('user_id', user.id)

      if (error) throw error

      // Handle credit refund after successful cancellation (only for registered courses, not waitlist)
      if (targetCourse.is_registered) {
        const { data: creditResult, error: creditError } = await supabase
          .rpc('handle_course_registration_credits', {
            p_user_id: user.id,
            p_course_id: courseId,
            p_action: 'refund'
          })

        if (creditError) {
          console.error('Error refunding credit:', creditError)
          // Don't fail the cancellation if credit refund fails
        }
      }

      // Immediately update local state
      setCourses(prev => prev.map(c => 
        c.id === courseId 
          ? { 
              ...c, 
              is_registered: false,
              is_waitlisted: false,
              registered_count: c.is_registered ? Math.max(0, c.registered_count - 1) : c.registered_count,
              waitlist_count: c.is_waitlisted ? Math.max(0, c.waitlist_count - 1) : c.waitlist_count
            }
          : c
      ))

      // Update selected course state
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(prev => prev ? {
          ...prev,
          is_registered: false,
          is_waitlisted: false,
          registered_count: prev.is_registered ? Math.max(0, prev.registered_count - 1) : prev.registered_count,
          waitlist_count: prev.is_waitlisted ? Math.max(0, prev.waitlist_count - 1) : prev.waitlist_count
        } : null)
      }

      toast.success('Registration successfully cancelled')
      
      // Dispatch events for instant UI updates
      window.dispatchEvent(new CustomEvent('courseRegistrationChanged'))
      window.dispatchEvent(new CustomEvent('creditsUpdated'))
      
      await loadCourses()
      if (selectedCourse?.id === courseId) {
        await loadParticipants(courseId)
      }
    } catch (error) {
      console.error('Error cancelling registration:', error)
      toast.error('Error cancelling registration')
    }
  }

  // Remove week navigation - we only show next 10 courses

  // Group courses by date for display
  const groupedCourses = courses.reduce((acc, course) => {
    const date = course.course_date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(course)
    return acc
  }, {} as Record<string, Course[]>)

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const courseDate = new Date(date)
    courseDate.setHours(0, 0, 0, 0)
    return courseDate < today
  }

  const getStatusColor = (course: Course) => {
    if (course.is_registered) return "bg-green-500"
    if (course.is_waitlisted) return "bg-yellow-500"
    if (course.registered_count >= course.max_participants) return "bg-red-500"
    return "bg-primary"
  }

  const getBorderColor = (course: Course) => {
    if (course.is_registered) return `border-green-500 border-2`
    if (course.is_waitlisted) return "border-yellow-500 border-2"
    return "border"
  }

  const getBorderStyle = (course: Course) => {
    return {} // Border color now handled in getBorderColor class
  }

  const getStatusText = (course: Course) => {
    if (course.is_registered) return "Registered"
    if (course.is_waitlisted) return "Waitlist"
    if (course.registered_count >= course.max_participants) return "Full"
    return "Available"
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading Courses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Membership limits display for Basic Member and Credits */}
      {(userMembershipType === 'Basic Member' || userMembershipType === 'Credits') && (
        <MembershipLimitDisplay 
          userId={user.id} 
          membershipType={userMembershipType} 
        />
      )}
      
      {/* Header with View Toggle */}
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="font-semibold text-foreground">Courses</h2>
        </div>
        
        <div className="flex justify-center gap-8">
          <button
            onClick={() => setViewMode('list')}
            className={`
              text-sm font-medium transition-all pb-1 border-b-2
              ${viewMode === 'list' 
                ? 'text-primary border-primary' 
                : 'text-muted-foreground border-transparent hover:text-foreground'
              }
            `}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`
              text-sm font-medium transition-all pb-1 border-b-2
              ${viewMode === 'calendar' 
                ? 'text-primary border-primary' 
                : 'text-muted-foreground border-transparent hover:text-foreground'
              }
            `}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <div className="grid grid-cols-1 gap-4 pb-24">
          {Object.entries(groupedCourses).map(([date, dayCourses]) => (
            <div key={date} className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">
                  {format(parseISO(date), 'EEEE, dd.MM.yyyy', { locale: enUS })}
              </h3>
              <div className="space-y-2">
                 {dayCourses.map(course => (
                   <div
                      key={course.id} 
                      className={`rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-sm bg-card ${
                        course.is_registered ? 'border-2 border-green-500' : 
                        course.is_waitlisted ? 'border-2 border-yellow-500' : 'border'
                      }`}
                      style={{
                        borderLeft: `6px solid ${course.color || '#f3f4f6'}`
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
                              {course.start_time.slice(0, 5)} - {course.end_time.slice(0, 5)}
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
                          {(() => {
                            const percentage = (course.registered_count / course.max_participants) * 100;
                            let badgeColor = "bg-green-500";
                            if (percentage >= 100) badgeColor = "bg-red-500";
                            else if (percentage >= 75) badgeColor = "bg-[#edb408]";
                            
                            return (
                              <Badge className={`text-white ${badgeColor} shadow-sm`}>
                                {course.registered_count}/{course.max_participants}
                              </Badge>
                            );
                          })()}
                           {course.waitlist_count > 0 && (
                             <Badge className="text-white bg-yellow-500 shadow-sm">
                               WL: {course.waitlist_count}
                             </Badge>
                           )}
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">No upcoming courses available</p>
            </div>
          )}
        </div>
      ) : (
        <CourseCalendar 
          courses={courses}
          onCourseClick={handleCourseClick}
          onRegister={handleRegistration}
          onCancel={handleCancellation}
          canCancelCourse={canCancelCourse}
          userMembershipType={userMembershipType}
          primaryColor={primaryColor}
        />
      )}

      {/* Course Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selectedCourse?.title}</DialogTitle>
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
                      Strength: {selectedCourse.strength_exercise}
                    </Badge>
                  </div>
                )}
                {selectedCourse.wod_content && (
                  <div className="mt-3 p-3 bg-gray-200 dark:bg-gray-700 rounded-2xl">
                    <h5 className="font-medium text-sm mb-2 text-foreground">WOD (Workout of the Day)</h5>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{selectedCourse.wod_content}</p>
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
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl p-6 text-center">
                      <p className="text-muted-foreground">No registrations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {participants
                        .filter(p => p.status === 'registered')
                        .map((participant, index) => {
                          const position = index + 1
                             return (
                               <div key={index} className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-700 rounded-2xl">
                                 <div className="flex items-center gap-3">
                                    <div 
                                      className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
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
                                        <span className="text-xs font-medium text-foreground">
                                          {participant.profiles?.display_name?.charAt(0) || '?'}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-medium text-foreground">
                                      {(isTrainer || isAdmin) 
                                        ? participant.profiles?.display_name || 'Unbekannt'
                                        : participant.profiles?.nickname || participant.profiles?.display_name || 'Unbekannt'
                                      }
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Registered
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   {(isTrainer || isAdmin) && (
                                     <MembershipBadge type="Member" forceBlack />
                                   )}
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
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-2xl">
                       <p className="text-sm text-yellow-800 dark:text-yellow-200">
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
                    onClick={() => handleCancellation(selectedCourse.id)}
                    disabled={!canCancelCourse(selectedCourse)}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02]"
                  >
                    {canCancelCourse(selectedCourse) ? 'Cancel Registration' : 'Cancellation deadline expired'}
                  </Button>
                ) : selectedCourse.is_waitlisted ? (
                  <Button 
                    onClick={() => handleCancellation(selectedCourse.id)}
                    disabled={!canCancelCourse(selectedCourse)}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02]"
                  >
                    {canCancelCourse(selectedCourse) ? 'Remove from Waitlist' : 'Cancellation deadline expired'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleRegistration(selectedCourse.id)}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02]"
                  >
                    {selectedCourse.registered_count >= selectedCourse.max_participants 
                      ? 'Join Waitlist' 
                      : 'Register'
                    }
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <ProfileImageViewer
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        imageUrl={selectedProfile?.imageUrl || null}
        displayName={selectedProfile?.displayName || ''}
      />
    </div>
  )
}