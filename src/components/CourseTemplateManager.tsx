import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { format, addDays, startOfWeek } from "date-fns"
import { cn } from "@/lib/utils"
import { CalendarIcon, Plus, Trash2 } from "lucide-react"

interface CourseTemplate {
  id: string
  title: string
  trainer: string
  max_participants: number
  registration_deadline_minutes: number
  cancellation_deadline_minutes: number
  duration_minutes: number
  color: string
  created_at: string
}

interface ScheduleEntry {
  day: number // 0 = Monday, 6 = Sunday
  time: string
}

export const CourseTemplateManager = () => {
  const [templates, setTemplates] = useState<CourseTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('templates')

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    title: '',
    trainer: '',
    max_participants: 16,
    registration_deadline_minutes: 30,
    cancellation_deadline_minutes: 60,
    duration_minutes: 60,
    color: '#f3f4f6'
  })

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    templateId: '',
    startDate: '',
    endDate: '',
    schedule: [] as ScheduleEntry[]
  })

  // Add Termin Dialog state
  const [addTerminDialogOpen, setAddTerminDialogOpen] = useState(false)
  const [tempTime, setTempTime] = useState('09:00')
  const [tempDays, setTempDays] = useState<string[]>([])

  useEffect(() => {
    loadTemplates()
    setLoading(false)
  }, [])

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('course_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Error loading templates')
    }
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('course_templates')
        .insert(templateForm)

      if (error) throw error

      toast.success('Template created successfully')
      setTemplateForm({
        title: '',
        trainer: '',
        max_participants: 16,
        registration_deadline_minutes: 30,
        cancellation_deadline_minutes: 60,
        duration_minutes: 60,
        color: '#f3f4f6'
      })
      await loadTemplates()
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error('Error creating template')
    }
  }

  const handleGenerateCourses = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleForm.templateId || !scheduleForm.startDate || !scheduleForm.endDate || scheduleForm.schedule.length === 0) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      const template = templates.find(t => t.id === scheduleForm.templateId)
      if (!template) throw new Error('Template not found')

      const startDateObj = new Date(scheduleForm.startDate)
      const endDateObj = new Date(scheduleForm.endDate)
      const coursesToCreate: any[] = []

      // Generate courses for each week in the date range
      for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 7)) {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 })
        
        scheduleForm.schedule.forEach(entry => {
          const courseDate = addDays(weekStart, entry.day)
          
          // Only create courses within the specified range and not in the past
          const today = new Date()
          today.setHours(0, 0, 0, 0) // Reset time to midnight for date comparison
          if (courseDate >= startDateObj && courseDate <= endDateObj && courseDate >= today) {
            const [hours, minutes] = entry.time.split(':').map(Number)
            const startTime = entry.time
            const endTime = format(new Date(0, 0, 0, hours, minutes + template.duration_minutes), 'HH:mm')

            coursesToCreate.push({
              template_id: template.id,
              title: template.title,
              trainer: template.trainer,
              max_participants: template.max_participants,
              registration_deadline_minutes: template.registration_deadline_minutes,
              cancellation_deadline_minutes: template.cancellation_deadline_minutes,
              duration_minutes: template.duration_minutes,
              color: template.color,
              course_date: format(courseDate, 'yyyy-MM-dd'),
              start_time: startTime,
              end_time: endTime
            })
          }
        })
      }

      if (coursesToCreate.length === 0) {
        toast.error('No courses to create (all dates are in the past)')
        return
      }

      const { error } = await supabase
        .from('courses')
        .insert(coursesToCreate)

      if (error) throw error

      toast.success(`${coursesToCreate.length} courses created successfully`)
      setScheduleForm({
        templateId: '',
        startDate: '',
        endDate: '',
        schedule: []
      })
    } catch (error) {
      console.error('Error generating courses:', error)
      toast.error('Error creating courses')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const { error } = await supabase
        .from('course_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      toast.success('Template deleted')
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Error deleting template')
    }
  }

  const handleAddScheduleEntries = () => {
    if (tempDays.length === 0) {
      toast.error('Please select at least one weekday')
      return
    }

    // Create entry for each selected day with same time
    const newEntries: ScheduleEntry[] = tempDays.map(day => ({
      day: parseInt(day),
      time: tempTime
    }))

    setScheduleForm(prev => ({
      ...prev,
      schedule: [...prev.schedule, ...newEntries]
    }))

    // Reset and close dialog
    setTempDays([])
    setTempTime('09:00')
    setAddTerminDialogOpen(false)
    
    toast.success(`${newEntries.length} slot${newEntries.length > 1 ? 's' : ''} added`)
  }

  const updateScheduleEntry = (index: number, field: 'day' | 'time', value: string | number) => {
    setScheduleForm(prev => ({
      ...prev,
      schedule: prev.schedule.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }))
  }

  const removeScheduleEntry = (index: number) => {
    setScheduleForm(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index)
    }))
  }

  const weekDays = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' }
  ]

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-muted-foreground">Loading course management...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Templates</h2>
        <p className="text-muted-foreground">Create and manage course templates and schedules</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-10 items-center justify-start rounded-none bg-transparent p-0 border-b w-full">
          <TabsTrigger 
            value="templates"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Templates
          </TabsTrigger>
          <TabsTrigger 
            value="schedule"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Schedule Planning
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Course Template</CardTitle>
              <CardDescription>
                Create reusable templates for your courses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter course title"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="trainer">Trainer</Label>
                    <Input
                      value={templateForm.trainer}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, trainer: e.target.value }))}
                      placeholder="Trainer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_participants">Max. Participants</Label>
                    <Input
                      type="number"
                      value={templateForm.max_participants}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, max_participants: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="registration_deadline_minutes">Registration Deadline (minutes before start)</Label>
                    <Input
                      type="number"
                      max="120"
                      value={templateForm.registration_deadline_minutes}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, registration_deadline_minutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cancellation_deadline_minutes">Cancellation Deadline (minutes before start)</Label>
                    <Input
                      type="number"
                      max="480"
                      value={templateForm.cancellation_deadline_minutes}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, cancellation_deadline_minutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration_minutes">Course Duration (minutes)</Label>
                    <Input
                      type="number"
                      max="120"
                      value={templateForm.duration_minutes}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, duration_minutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="color">Course Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="color"
                        type="color"
                        value={templateForm.color}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, color: e.target.value }))}
                        className="h-10 w-20 cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground font-mono">
                        {templateForm.color.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Create Template
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="hidden sm:table-cell">Trainer</TableHead>
                      <TableHead className="hidden md:table-cell">Max. Participants</TableHead>
                      <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      <TableHead className="hidden xl:table-cell">Color</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-1 h-8 rounded" 
                              style={{ backgroundColor: template.color || '#f3f4f6' }}
                            />
                            {template.title}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{template.trainer}</TableCell>
                        <TableCell className="hidden md:table-cell">{template.max_participants}</TableCell>
                        <TableCell className="hidden lg:table-cell">{template.duration_minutes} min</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div 
                            className="w-8 h-8 rounded border border-border" 
                            style={{ backgroundColor: template.color || '#f3f4f6' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Planning</CardTitle>
              <CardDescription>
                Generate course dates from existing templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateCourses} className="space-y-4">
                <div>
                  <Label htmlFor="templateId">Select Course Template</Label>
                  <Select value={scheduleForm.templateId} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, templateId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title} - {template.trainer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduleForm.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduleForm.startDate ? format(new Date(scheduleForm.startDate), "PPP") : <span>Select date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleForm.startDate ? new Date(scheduleForm.startDate) : undefined}
                          onSelect={(date) => setScheduleForm(prev => ({ ...prev, startDate: date ? format(date, 'yyyy-MM-dd') : '' }))}
                          initialFocus
                          weekStartsOn={1}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduleForm.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduleForm.endDate ? format(new Date(scheduleForm.endDate), "PPP") : <span>Select date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduleForm.endDate ? new Date(scheduleForm.endDate) : undefined}
                          onSelect={(date) => setScheduleForm(prev => ({ ...prev, endDate: date ? format(date, 'yyyy-MM-dd') : '' }))}
                          initialFocus
                          weekStartsOn={1}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Weekly Schedule</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setAddTerminDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Slot
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {scheduleForm.schedule.map((entry, index) => (
                      <div key={index} className="flex gap-3 items-center">
                        <Select
                          value={entry.day.toString()}
                          onValueChange={(value) => updateScheduleEntry(index, 'day', parseInt(value))}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {weekDays.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          type="time"
                          value={entry.time}
                          onChange={(e) => updateScheduleEntry(index, 'time', e.target.value)}
                          className="w-32"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeScheduleEntry(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {scheduleForm.schedule.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add at least one weekly slot
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={scheduleForm.schedule.length === 0}>
                  Create Courses
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Slot Dialog */}
      <Dialog open={addTerminDialogOpen} onOpenChange={setAddTerminDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Slot</DialogTitle>
            <DialogDescription>
              Select a time and weekdays for the new slots.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Time Picker */}
            <div className="grid gap-2">
              <Label htmlFor="time">Time</Label>
              <div className="flex items-center gap-3">
                {/* Hour Select */}
                <Select
                  value={tempTime.split(':')[0]}
                  onValueChange={(hour) => {
                    const minute = tempTime.split(':')[1] || '00'
                    setTempTime(`${hour}:${minute}`)
                  }}
                >
                  <SelectTrigger className="w-[110px] text-lg font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0')
                      return (
                        <SelectItem key={hour} value={hour} className="text-lg">
                          {hour}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                
                {/* Separator */}
                <span className="text-2xl font-semibold text-foreground">:</span>
                
                {/* Minute Select */}
                <Select
                  value={tempTime.split(':')[1] || '00'}
                  onValueChange={(minute) => {
                    const hour = tempTime.split(':')[0]
                    setTempTime(`${hour}:${minute}`)
                  }}
                >
                  <SelectTrigger className="w-[110px] text-lg font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {Array.from({ length: 12 }, (_, i) => {
                      const minute = (i * 5).toString().padStart(2, '0')
                      return (
                        <SelectItem key={minute} value={minute} className="text-lg">
                          {minute}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Weekday Toggle Group */}
            <div className="grid gap-3">
              <Label>Weekdays</Label>
              <ToggleGroup 
                type="multiple" 
                value={tempDays} 
                onValueChange={setTempDays}
                className="grid grid-cols-7 gap-2"
              >
                {weekDays.map((day) => (
                  <ToggleGroupItem
                    key={day.value}
                    value={day.value.toString()}
                    aria-label={day.label}
                    className="flex-col h-auto py-3 px-2"
                  >
                    <span className="text-xs font-medium">
                      {day.label.slice(0, 2)}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {tempDays.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Select at least one day
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTerminDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddScheduleEntries} disabled={tempDays.length === 0}>
              {tempDays.length > 0 
                ? `Add ${tempDays.length} slot${tempDays.length > 1 ? 's' : ''}` 
                : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CourseTemplateManager
