import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin } from "lucide-react"
import { format, parseISO, isSameDay } from "date-fns"
import { enUS } from "date-fns/locale"
import { timezone } from "@/lib/timezone"
import { cn } from "@/lib/utils"

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

interface CourseCalendarProps {
  courses: Course[]
  onCourseClick: (course: Course) => void
  onRegister: (courseId: string) => void
  onCancel: (courseId: string, course?: Course) => void
  canCancelCourse: (course: Course) => boolean
  userMembershipType: string
  primaryColor: string
}

export const CourseCalendar = ({ 
  courses, 
  onCourseClick, 
  onRegister, 
  onCancel, 
  canCancelCourse,
  userMembershipType,
  primaryColor
}: CourseCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // Get courses for selected date
  const coursesForSelectedDate = selectedDate 
    ? courses.filter(course => {
        const courseDate = parseISO(course.course_date)
        return isSameDay(courseDate, selectedDate)
      })
    : []

  // Get all dates that have courses for highlighting in calendar
  const courseDates = courses.map(course => parseISO(course.course_date))
  
  // Get dates where user is registered or waitlisted
  const registeredDates = courses
    .filter(course => course.is_registered)
    .map(course => parseISO(course.course_date))
    
  const waitlistedDates = courses
    .filter(course => course.is_waitlisted)
    .map(course => parseISO(course.course_date))

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Calendar */}
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
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
          modifiers={{
            registered: registeredDates,
            waitlisted: waitlistedDates
          }}
          modifiersStyles={{
            registered: {
              border: '2px solid #22c55e',
              borderRadius: '6px',
              fontWeight: 'bold'
            },
            waitlisted: {
              border: '2px solid #eab308',
              borderRadius: '6px',
              fontWeight: 'bold'
            }
          }}
        />
      </div>

      {/* Courses for selected date */}
      {selectedDate && (
        <div className="space-y-4">
          <h3 className="font-semibold text-left px-4">
            Courses on {format(selectedDate, 'EEEE, dd.MM.yyyy', { locale: enUS })}
          </h3>
          
          {coursesForSelectedDate.length === 0 ? (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">No courses on this day</p>
            </div>
          ) : (
            <div className="space-y-3 px-4">
              {coursesForSelectedDate.map(course => (
                   <div 
                     key={course.id}
                     className={`rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-sm hover:shadow-md ${
                       course.is_registered 
                         ? 'border-2 border-green-500' 
                         : course.is_waitlisted 
                         ? 'border-2 border-yellow-500'
                         : 'border-0'
                     }`}
                      style={{
                        backgroundColor: course.color ? `${course.color}80` : '#f3f4f680'
                      }}
                    onClick={() => onCourseClick(course)}
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
          )}
        </div>
      )}

      {/* Instruction text when no date selected */}
      {!selectedDate && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">Select a day in the calendar to see the courses</p>
        </div>
      )}
    </div>
  )
}