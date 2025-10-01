import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, List, Clock, MapPin, Edit, Trash2 } from "lucide-react"
import { format, parseISO, isSameDay } from "date-fns"
import { enUS } from "date-fns/locale"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { CourseParticipantsList } from "@/components/CourseParticipantsList"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Course {
  id: string
  title: string
  trainer: string
  course_date: string
  start_time: string
  end_time: string
  max_participants: number
  registered_count: number
  waitlisted_count: number
  strength_exercise?: string
  wod_content?: string
  duration_minutes: number
  registration_deadline_minutes: number
  cancellation_deadline_minutes: number
  color?: string
}

export const CourseParticipants = () => {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadCourses()
  }, [viewMode])

  const loadCourses = async () => {
    try {
      setLoading(true)
      
      // For calendar view, get all future courses; for list view, limit to 10 days
      const now = new Date()
      const nowDate = now.toISOString().split('T')[0]
      const nowTime = now.toTimeString().slice(0, 8)

      const { data, error } = await supabase
        .from('courses')
          .select(`
            id,
            title,
            trainer,
            course_date,
            start_time,
            end_time,
            max_participants,
            strength_exercise,
            wod_content,
            duration_minutes,
            registration_deadline_minutes,
            cancellation_deadline_minutes,
            color
          `)
        .eq('is_cancelled', false)
        // Only future courses by date and time
        .or(`course_date.gt.${nowDate},and(course_date.eq.${nowDate},end_time.gt.${nowTime})`)
        .order('course_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error

      // Get registration counts for all courses
      const coursesWithCounts = await Promise.all(
        (data || []).map(async (course) => {
          const { data: registrations } = await supabase
            .from('course_registrations')
            .select('status')
            .eq('course_id', course.id)
            .in('status', ['registered', 'waitlist'])

          const registered_count = registrations?.filter(r => r.status === 'registered').length || 0
          const waitlisted_count = registrations?.filter(r => r.status === 'waitlist').length || 0

          return {
            ...course,
            registered_count,
            waitlisted_count
          }
        })
      )

      // Filter courses based on view mode
      let filteredCourses = coursesWithCounts

      if (viewMode === 'list') {
        // Get only the next 10 unique course days
        const uniqueDates = new Set<string>()
        filteredCourses = coursesWithCounts.filter(course => {
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
      toast({
        title: "Error",
        description: "Courses could not be loaded",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course)
  }

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCourse) return

    try {
      const formData = new FormData(e.target as HTMLFormElement)
      const startTime = formData.get('start_time') as string
      const durationMinutes = parseInt(formData.get('duration_minutes') as string)
      
      // Calculate end time
      const [hours, minutes] = startTime.split(':').map(Number)
      const endTime = format(new Date(0, 0, 0, hours, minutes + durationMinutes), 'HH:mm')

      const updates = {
        title: formData.get('title') as string,
        trainer: formData.get('trainer') as string,
        strength_exercise: formData.get('strength_exercise') as string || null,
        wod_content: formData.get('wod_content') as string || null,
        max_participants: parseInt(formData.get('max_participants') as string),
        registration_deadline_minutes: parseInt(formData.get('registration_deadline_minutes') as string),
        cancellation_deadline_minutes: parseInt(formData.get('cancellation_deadline_minutes') as string),
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes
      }

      const { error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', editingCourse.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Course successfully updated",
      })
      setEditingCourse(null)
      await loadCourses()
    } catch (error) {
      console.error('Error updating course:', error)
      toast({
        title: "Error",
        description: "Error updating course",
        variant: "destructive"
      })
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Course successfully deleted",
      })
      await loadCourses()
    } catch (error) {
      console.error('Error deleting course:', error)
      toast({
        title: "Error",
        description: "Error deleting course",
        variant: "destructive"
      })
    }
  }

  // Group courses by date for display
  const groupedCourses = courses.reduce((acc, course) => {
    const date = course.course_date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(course)
    return acc
  }, {} as Record<string, Course[]>)

  // Get courses for selected date (calendar view)
  const coursesForSelectedDate = selectedDate 
    ? courses.filter(course => {
        const courseDate = parseISO(course.course_date)
        return isSameDay(courseDate, selectedDate)
      })
    : []

  // Get all dates that have courses for highlighting in calendar
  const courseDates = courses.map(course => parseISO(course.course_date))

  if (loading) {
    return <div className="flex justify-center p-8">Loading Courses...</div>
  }

  if (selectedCourse) {
    return (
      <CourseParticipantsList 
        course={selectedCourse}
        onClose={() => setSelectedCourse(null)}
        isAdmin={true}
      />
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with View Toggle */}
      <div className="space-y-4">
        <div className="flex justify-center gap-8">
          <button
            onClick={() => setViewMode('list')}
            className={`
              text-sm font-medium transition-all pb-1 border-b-2
              ${viewMode === 'list' 
                ? 'text-foreground border-foreground' 
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
                ? 'text-foreground border-foreground' 
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
        /* Courses List */
        <div className="grid grid-cols-1 gap-4">
          {Object.entries(groupedCourses).map(([date, dayCourses]) => (
            <div key={date} className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">
                {format(parseISO(date), 'EEEE, dd.MM.yyyy', { locale: enUS })}
              </h3>
              <div className="space-y-2">
                {dayCourses.map(course => (
                   <Card 
                     key={course.id}
                     className="cursor-pointer transition-all duration-200 hover:shadow-md border-0 shadow-sm"
                     style={{
                       backgroundColor: course.color ? `${course.color}20` : '#f3f4f615'
                     }}
                     onClick={() => setSelectedCourse(course)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{course.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {course.start_time.slice(0, 5)} - {course.end_time.slice(0, 5)} • {course.trainer}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right space-y-1">
                            {(() => {
                              const percentage = (course.registered_count / course.max_participants) * 100;
                              let badgeColor = "bg-green-500";
                              if (percentage >= 100) badgeColor = "bg-red-500";
                              else if (percentage >= 75) badgeColor = "bg-[#edb408]";
                              
                              return (
                                <Badge variant="secondary" className={`text-white ${badgeColor}`}>
                                  {course.registered_count}/{course.max_participants}
                                </Badge>
                              );
                            })()}
                            {course.waitlisted_count > 0 && (
                              <Badge variant="secondary" className="bg-yellow-500 text-white">
                                WL: {course.waitlisted_count}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditCourse(course)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCourse(course.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming courses available
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="space-y-6 pb-24">
          {/* Calendar */}
          <div className="flex justify-center">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={enUS}
              className={cn("rounded-md border w-full max-w-md text-base", "pointer-events-auto")}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4 w-full",
                caption: "flex justify-center pt-1 relative items-center text-lg",
                caption_label: "text-lg font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md w-full font-normal text-sm p-2",
                row: "flex w-full mt-2",
                cell: "h-10 w-full text-center text-sm p-0 relative first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-10 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md",
                day_selected: "border-2 border-primary text-foreground hover:border-primary hover:text-foreground focus:border-primary focus:text-foreground bg-transparent",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
              }}
              fromDate={new Date()}
              toDate={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)} // Next 3 months
              modifiers={{}}
              modifiersStyles={{}}
            />
          </div>

          {/* Courses for selected date */}
          {selectedDate && (
            <div className="space-y-4">
              <h3 className="font-semibold text-left px-4">
                Courses on {format(selectedDate, 'EEEE, dd.MM.yyyy', { locale: enUS })}
              </h3>
              
              {coursesForSelectedDate.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No courses on this day
                </div>
              ) : (
                <div className="space-y-3 px-4">
                  {coursesForSelectedDate.map(course => (
                     <div 
                       key={course.id}
                       className="cursor-pointer hover:shadow-md transition-all duration-200 border-0 rounded-lg p-4 shadow-sm"
                       style={{
                         backgroundColor: course.color ? `${course.color}20` : '#f3f4f615'
                       }}
                       onClick={() => setSelectedCourse(course)}
                    >
                      <div className="space-y-1">
                        {/* Course Title */}
                        <h4 className="font-semibold text-lg">{course.title}</h4>
                        
                        {/* Course Details */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">
                              {course.start_time.slice(0, 5)} - {course.end_time.slice(0, 5)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {course.trainer}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end gap-1">
                              {(() => {
                                const percentage = (course.registered_count / course.max_participants) * 100;
                                let badgeColor = "bg-green-500";
                                if (percentage >= 100) badgeColor = "bg-red-500";
                                else if (percentage >= 75) badgeColor = "bg-[#edb408]";
                                
                                return (
                                  <Badge variant="secondary" className={`text-white ${badgeColor}`}>
                                    {course.registered_count}/{course.max_participants}
                                  </Badge>
                                );
                              })()}
                              {course.waitlisted_count > 0 && (
                                <Badge variant="secondary" className="bg-yellow-500 text-white">
                                  WL: {course.waitlisted_count}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditCourse(course)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteCourse(course.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Instruction text when no date selected */}
          {!selectedDate && (
            <div className="text-center py-8 text-muted-foreground">
              Select a day in the calendar to see the courses
            </div>
          )}
        </div>
      )}

      {/* Edit Course Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={() => setEditingCourse(null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <div className="flex-1 overflow-y-auto pr-2">
              <form onSubmit={handleUpdateCourse} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                <Input 
                  name="title" 
                  defaultValue={editingCourse.title} 
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Course title is required')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  required 
                />
                </div>
                <div>
                  <Label htmlFor="trainer">Trainer (optional)</Label>
                  <Input name="trainer" defaultValue={editingCourse.trainer} />
                </div>
                <div>
                  <Label htmlFor="strength_exercise">Strength</Label>
                  <Input name="strength_exercise" defaultValue={editingCourse.strength_exercise || ''} />
                </div>
                <div>
                  <Label htmlFor="wod_content">WOD (Workout of the Day)</Label>
                  <textarea 
                    name="wod_content" 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={editingCourse.wod_content || ''} 
                    placeholder="WOD Description (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="max_participants">Max. Participants</Label>
                  <Input 
                    name="max_participants" 
                    type="number" 
                    defaultValue={editingCourse.max_participants} 
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Maximum participants number is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="registration_deadline_minutes">Registration Deadline (Minutes before Start)</Label>
                  <Input 
                    name="registration_deadline_minutes" 
                    type="number" 
                    max="120" 
                    defaultValue={editingCourse.registration_deadline_minutes} 
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Registration deadline is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="cancellation_deadline_minutes">Cancellation Deadline (Minutes before Start)</Label>
                  <Input 
                    name="cancellation_deadline_minutes" 
                    type="number" 
                    max="480" 
                    defaultValue={editingCourse.cancellation_deadline_minutes} 
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Cancellation deadline is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input 
                    name="start_time" 
                    type="time" 
                    defaultValue={editingCourse.start_time} 
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Start time is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="duration_minutes">Duration (Minutes)</Label>
                  <Input 
                    name="duration_minutes" 
                    type="number" 
                    max="120" 
                    defaultValue={editingCourse.duration_minutes} 
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Course duration is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required 
                  />
                </div>
                <div className="pt-4">
                  <Button type="submit" className="w-full">
                    Kurs aktualisieren
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}