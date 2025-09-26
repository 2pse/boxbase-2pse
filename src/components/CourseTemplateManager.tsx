import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { format, addDays, startOfWeek } from "date-fns"
import { de } from "date-fns/locale"
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

  // Color palette - fitness-appropriate colors
  const colorOptions = [
    { value: '#f3f4f6', label: 'Hellgrau' },
    { value: '#6b7280', label: 'Grau' },
    { value: '#374151', label: 'Dunkelgrau' },
    { value: '#1f2937', label: 'Anthrazit' },
    { value: '#ef4444', label: 'Rot' },
    { value: '#dc2626', label: 'Dunkelrot' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Gelb' },
    { value: '#3B82F6', label: 'Blau' },
    { value: '#1d4ed8', label: 'Dunkelblau' },
    { value: '#8B5CF6', label: 'Lila' },
    { value: '#7c3aed', label: 'Dunkellila' }
  ]

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    templateId: '',
    startDate: '',
    endDate: '',
    schedule: [] as ScheduleEntry[]
  })

  // Generation state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<CourseTemplate | null>(null)
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()

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
      toast.error('Fehler beim Laden der Vorlagen')
    }
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('course_templates')
        .insert(templateForm)

      if (error) throw error

      toast.success('Vorlage erfolgreich erstellt')
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
      toast.error('Fehler beim Erstellen der Vorlage')
    }
  }

  const generateCourses = async () => {
    if (!selectedTemplate || !startDate || !endDate) return

    setLoading(true)
    try {
      const { error } = await supabase.rpc('generate_courses_from_template', {
        template_id_param: selectedTemplate.id,
        start_date_param: format(startDate, 'yyyy-MM-dd'),
        end_date_param: format(endDate, 'yyyy-MM-dd')
      })

      if (error) throw error

      toast.success('Kurse erfolgreich generiert!')
      setGenerateDialogOpen(false)
      setSelectedTemplate(null)
      setStartDate(undefined)
      setEndDate(undefined)
    } catch (error) {
      console.error('Error generating courses:', error)
      toast.error('Fehler beim Generieren der Kurse')
    } finally {
      setLoading(false)
    }
  }

  const openGenerateDialog = (template: CourseTemplate) => {
    setSelectedTemplate(template)
    setGenerateDialogOpen(true)
  }

  const handleGenerateCourses = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleForm.templateId || !scheduleForm.startDate || !scheduleForm.endDate || scheduleForm.schedule.length === 0) {
      toast.error('Bitte füllen Sie alle Felder aus')
      return
    }

    try {
      const template = templates.find(t => t.id === scheduleForm.templateId)
      if (!template) throw new Error('Template not found')

      const startDate = new Date(scheduleForm.startDate)
      const endDate = new Date(scheduleForm.endDate)
      const coursesToCreate = []

      // Generate courses for each week in the date range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 7)) {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 })
        
        scheduleForm.schedule.forEach(entry => {
          const courseDate = addDays(weekStart, entry.day)
          
          // Only create courses within the specified range and not in the past
          const today = new Date()
          today.setHours(0, 0, 0, 0) // Reset time to midnight for date comparison
          if (courseDate >= startDate && courseDate <= endDate && courseDate >= today) {
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
        toast.error('Keine Kurse zu erstellen (alle Termine liegen in der Vergangenheit)')
        return
      }

      const { error } = await supabase
        .from('courses')
        .insert(coursesToCreate)

      if (error) throw error

      toast.success(`${coursesToCreate.length} Kurse erfolgreich erstellt`)
      setScheduleForm({
        templateId: '',
        startDate: '',
        endDate: '',
        schedule: []
      })
    } catch (error) {
      console.error('Error generating courses:', error)
      toast.error('Fehler beim Erstellen der Kurse')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Vorlage löschen möchten?')) return

    try {
      const { error } = await supabase
        .from('course_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      toast.success('Vorlage erfolgreich gelöscht')
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Fehler beim Löschen der Vorlage')
    }
  }

  const addScheduleEntry = () => {
    setScheduleForm(prev => ({
      ...prev,
      schedule: [...prev.schedule, { day: 0, time: '09:00' }]
    }))
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
    { value: 0, label: 'Montag' },
    { value: 1, label: 'Dienstag' },
    { value: 2, label: 'Mittwoch' },
    { value: 3, label: 'Donnerstag' },
    { value: 4, label: 'Freitag' },
    { value: 5, label: 'Samstag' },
    { value: 6, label: 'Sonntag' }
  ]

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-muted-foreground">Lade Kursverwaltung...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Vorlagen</h2>
        <p className="text-muted-foreground">Erstelle und verwalte Kursvorlagen und Terminpläne</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Vorlagen</TabsTrigger>
          <TabsTrigger value="schedule">Terminplanung</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Neue Kursvorlage erstellen</CardTitle>
              <CardDescription>
                Erstellen Sie wiederverwendbare Vorlagen für Ihre Kurse
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
                      placeholder="Trainer Name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_participants">Max. Teilnehmer</Label>
                    <Input
                      type="number"
                      value={templateForm.max_participants}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, max_participants: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="registration_deadline_minutes">Anmeldefrist (Minuten vor Start)</Label>
                    <Input
                      type="number"
                      max="120"
                      value={templateForm.registration_deadline_minutes}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, registration_deadline_minutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cancellation_deadline_minutes">Abmeldefrist (Minuten vor Start)</Label>
                    <Input
                      type="number"
                      max="480"
                      value={templateForm.cancellation_deadline_minutes}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, cancellation_deadline_minutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration_minutes">Kursdauer (Minuten)</Label>
                    <Input
                      type="number"
                      max="120"
                      value={templateForm.duration_minutes}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, duration_minutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="color">Kursfarbe</Label>
                    <Select value={templateForm.color} onValueChange={(value) => setTemplateForm(prev => ({ ...prev, color: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded border border-gray-300" 
                                style={{ backgroundColor: color.value }}
                              />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Vorlage erstellen
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bestehende Vorlagen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead className="hidden sm:table-cell">Trainer</TableHead>
                        <TableHead className="hidden md:table-cell">Max. Teilnehmer</TableHead>
                        <TableHead className="hidden lg:table-cell">Dauer</TableHead>
                        <TableHead className="hidden xl:table-cell">Farbe</TableHead>
                        <TableHead>Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border border-gray-300" 
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
                              className="w-6 h-6 rounded border border-gray-300" 
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
              <CardTitle>Terminplanung</CardTitle>
              <CardDescription>
                Generiere Kurstermine aus bestehenden Vorlagen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateCourses} className="space-y-4">
                <div>
                  <Label htmlFor="templateId">Kursvorlage auswählen</Label>
                  <Select value={scheduleForm.templateId} onValueChange={(value) => setScheduleForm(prev => ({ ...prev, templateId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vorlage wählen" />
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
                    <Label htmlFor="startDate">Startdatum</Label>
                    <Input
                      type="date"
                      value={scheduleForm.startDate}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Enddatum</Label>
                    <Input
                      type="date"
                      value={scheduleForm.endDate}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Wochenplan</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addScheduleEntry}>
                      <Plus className="h-4 w-4 mr-1" />
                      Termin hinzufügen
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
                      Fügen Sie mindestens einen Wochentermin hinzu
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={scheduleForm.schedule.length === 0}>
                  Kurse erstellen
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Courses Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Kurse generieren</DialogTitle>
            <DialogDescription>
              Erstelle Kurse aus der Vorlage "{selectedTemplate?.title}" für den gewählten Zeitraum.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Startdatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">Enddatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: de }) : "Datum wählen"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={generateCourses} 
              disabled={loading || !startDate || !endDate}
            >
              {loading ? "Generiere..." : "Kurse erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CourseTemplateManager;