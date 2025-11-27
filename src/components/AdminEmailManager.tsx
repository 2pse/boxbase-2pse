import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { SaveTemplateDialog } from "./SaveTemplateDialog"
import { MembershipBadge } from "./MembershipBadge"
import { 
  Search, 
  Mail, 
  Users, 
  FileText, 
  Send, 
  Save, 
  Trash2, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  Check
} from "lucide-react"

type StatusFilter = 'all' | 'active' | 'inactive'

interface Profile {
  id: string
  user_id: string | null
  first_name: string | null
  last_name: string | null
  display_name: string | null
  email: string | null
  access_code: string | null
  membership_type: string | null
  status: string | null
}

interface EmailTemplate {
  id: string
  title: string
  subject: string
  body: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export const AdminEmailManager = () => {
  const { toast } = useToast()
  
  // Tabs and filters
  const [activeTab, setActiveTab] = useState<'recipients' | 'compose'>('compose')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [membershipTypes, setMembershipTypes] = useState<string[]>([])
  const [selectedMembershipTypes, setSelectedMembershipTypes] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Recipients
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([])

  // Email content
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)

  // Membership colors
  const [planColors, setPlanColors] = useState<Map<string, string>>(new Map())

  // UI state
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewMemberIndex, setPreviewMemberIndex] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [statusFilter, selectedMembershipTypes])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadProfiles(),
      loadTemplates(),
      loadMembershipTypes()
    ])
    setLoading(false)
  }

  const loadMembershipTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_plans_v2')
        .select('name, color')
        .eq('is_active', true)
      
      if (error) throw error
      
      const types = data?.map(p => p.name) || []
      setMembershipTypes(types)
      
      // Load colors
      const colorMap = new Map<string, string>()
      data?.forEach(p => {
        if (p.color) colorMap.set(p.name, p.color)
      })
      setPlanColors(colorMap)
      
      // Initially select all membership types
      setSelectedMembershipTypes(types)
    } catch (error) {
      console.error('Error loading membership types:', error)
    }
  }

  const loadProfiles = async () => {
    try {
      // Load memberships with plan names
      const { data: memberships, error: membershipsError } = await supabase
        .from('user_memberships_v2')
        .select('user_id, membership_plans_v2(name)')
        .eq('status', 'active')

      if (membershipsError) throw membershipsError

      const membershipMap = new Map(
        memberships?.map(m => [
          m.user_id,
          (m.membership_plans_v2 as any)?.name || 'No Membership'
        ]) || []
      )

      // Get user IDs with active memberships
      const userIdsWithMembership = Array.from(membershipMap.keys())

      // Load profiles (excluding admins)
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      const adminUserIds = adminRoles?.map(r => r.user_id) || []

      let query = supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, display_name, access_code, status')
        .not('user_id', 'is', null)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data: profilesData, error: profilesError } = await query

      if (profilesError) throw profilesError

      // Filter out admins and apply membership type filter
      let filteredProfiles = (profilesData || [])
        .filter(p => p.user_id && !adminUserIds.includes(p.user_id))
        .filter(p => {
          const membershipType = membershipMap.get(p.user_id!) || 'No Membership'
          return selectedMembershipTypes.length === 0 || selectedMembershipTypes.includes(membershipType)
        })
        .map(p => ({
          ...p,
          membership_type: membershipMap.get(p.user_id!) || 'No Membership',
          email: null // Will be loaded via edge function
        }))

      // Load emails via edge function
      const userIds = filteredProfiles.map(p => p.user_id).filter(Boolean) as string[]
      
      if (userIds.length > 0) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const { data: emailResponse, error: emailError } = await supabase.functions.invoke('load-member-emails', {
            body: { userIds },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          })

          if (!emailError && emailResponse?.emailData) {
            filteredProfiles = filteredProfiles.map(p => ({
              ...p,
              email: emailResponse.emailData[p.user_id!] || null
            }))
          }
        }
      }

      // Filter out profiles without email
      filteredProfiles = filteredProfiles.filter(p => p.email)

      setProfiles(filteredProfiles)
    } catch (error) {
      console.error('Error loading profiles:', error)
      toast({
        title: "Fehler",
        description: "Fehler beim Laden der Mitglieder",
        variant: "destructive"
      })
    }
  }

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('title')

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const handleSelectAll = () => {
    const filteredProfiles = getFilteredProfiles()
    if (selectedMembers.length === filteredProfiles.length) {
      setSelectedMembers([])
    } else {
      setSelectedMembers([...filteredProfiles])
    }
  }

  const handleToggleMember = (profile: Profile) => {
    const exists = selectedMembers.find(m => m.id === profile.id)
    if (exists) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== profile.id))
    } else {
      setSelectedMembers([...selectedMembers, profile])
    }
  }

  const getFilteredProfiles = () => {
    if (!searchTerm) return profiles
    const search = searchTerm.toLowerCase()
    return profiles.filter(p => 
      p.first_name?.toLowerCase().includes(search) ||
      p.last_name?.toLowerCase().includes(search) ||
      p.display_name?.toLowerCase().includes(search) ||
      p.email?.toLowerCase().includes(search)
    )
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('email-body') as HTMLTextAreaElement
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newBody = body.substring(0, start) + variable + body.substring(end)
    setBody(newBody)
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variable.length, start + variable.length)
    }, 0)
  }

  const getPreviewText = (text: string, profile: Profile) => {
    return text
      .replace(/\{\{first_name\}\}/g, profile.first_name || 'Max')
      .replace(/\{\{last_name\}\}/g, profile.last_name || 'Mustermann')
      .replace(/\{\{membership_type\}\}/g, profile.membership_type || 'Premium')
      .replace(/\{\{email_and_code\}\}/g, 
        `Email: ${profile.email || 'user@example.com'}\nAccess Code: ${profile.access_code || 'N/A'}`)
  }

  const handleLoadTemplate = () => {
    const template = templates.find(t => t.id === selectedTemplateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
      toast({
        title: "Template geladen",
        description: `"${template.title}" wurde geladen`
      })
    }
  }

  const handleSaveTemplate = async (templateName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('email_templates')
        .insert({
          title: templateName,
          subject,
          body,
          created_by: user.id
        })

      if (error) throw error

      toast({
        title: "Erfolg",
        description: "Template wurde gespeichert"
      })

      await loadTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: "Fehler",
        description: "Template konnte nicht gespeichert werden",
        variant: "destructive"
      })
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return
    
    const template = templates.find(t => t.id === selectedTemplateId)
    if (!template) return

    if (!confirm(`Template "${template.title}" wirklich löschen?`)) return

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', selectedTemplateId)

      if (error) throw error

      toast({
        title: "Erfolg",
        description: "Template wurde gelöscht"
      })

      setSelectedTemplateId('')
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast({
        title: "Fehler",
        description: "Template konnte nicht gelöscht werden",
        variant: "destructive"
      })
    }
  }

  const sendEmails = async () => {
    setSending(true)
    setShowConfirmDialog(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const { error } = await supabase.functions.invoke('send-bulk-emails', {
        body: {
          subject,
          body,
          selectedUserIds: selectedMembers.map(m => m.user_id).filter(Boolean)
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) throw error

      toast({
        title: "Emails gesendet",
        description: `${selectedMembers.length} Email(s) wurden erfolgreich gesendet`
      })

      // Reset state
      setSubject('')
      setBody('')
      setSelectedMembers([])
      setSelectedTemplateId('')
      setActiveTab('recipients')
    } catch (error) {
      console.error('Error sending emails:', error)
      toast({
        title: "Fehler beim Senden",
        description: "Die Emails konnten nicht gesendet werden",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  const filteredProfiles = getFilteredProfiles()
  const previewMember = selectedMembers[previewMemberIndex] || selectedMembers[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Manager</h2>
        <p className="text-muted-foreground">Personalisierte Emails an Mitglieder senden</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'recipients' ? 'default' : 'outline'}
          onClick={() => setActiveTab('recipients')}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Empfänger auswählen
          {selectedMembers.length > 0 && (
            <Badge variant="secondary" className="ml-1">{selectedMembers.length}</Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'compose' ? 'default' : 'outline'}
          onClick={() => setActiveTab('compose')}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Email verfassen
        </Button>
      </div>

      {/* Recipients Tab */}
      {activeTab === 'recipients' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empfänger auswählen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Membership-Typen</Label>
                <Select 
                  value={selectedMembershipTypes.length === membershipTypes.length ? 'all' : 'custom'}
                  onValueChange={(v) => {
                    if (v === 'all') {
                      setSelectedMembershipTypes(membershipTypes)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Membership-Typen wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Typen</SelectItem>
                    {membershipTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Suche</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Name oder Email..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Membership Type Checkboxes */}
            <div className="flex flex-wrap gap-2">
              {membershipTypes.map(type => (
                <label 
                  key={type} 
                  className="flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedMembershipTypes.includes(type)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedMembershipTypes([...selectedMembershipTypes, type])
                      } else {
                        setSelectedMembershipTypes(selectedMembershipTypes.filter(t => t !== type))
                      }
                    }}
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>

            {/* Select All / Deselect All */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedMembers.length === filteredProfiles.length ? (
                  <>Alle abwählen</>
                ) : (
                  <>Alle auswählen ({filteredProfiles.length})</>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedMembers.length} von {filteredProfiles.length} ausgewählt
              </span>
            </div>

            {/* Members Table */}
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Membership</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map(profile => (
                    <TableRow 
                      key={profile.id}
                      className="cursor-pointer"
                      onClick={() => handleToggleMember(profile)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={!!selectedMembers.find(m => m.id === profile.id)}
                          onCheckedChange={() => handleToggleMember(profile)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {profile.first_name} {profile.last_name}
                          </div>
                          <div className="sm:hidden text-xs text-muted-foreground truncate max-w-[150px]">
                            {profile.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {profile.email}
                      </TableCell>
                      <TableCell>
                        <MembershipBadge type={profile.membership_type || 'No Membership'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Continue Button */}
            <div className="flex justify-end">
              <Button 
                onClick={() => setActiveTab('compose')}
                disabled={selectedMembers.length === 0}
              >
                Weiter zur Email
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Email Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Email verfassen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Template</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Template auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-1">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleLoadTemplate}
                    disabled={!selectedTemplateId}
                    title="Template laden"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setSaveTemplateOpen(true)}
                    disabled={!subject || !body}
                    title="Als Template speichern"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleDeleteTemplate}
                    disabled={!selectedTemplateId}
                    title="Template löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label htmlFor="email-subject">Betreff</Label>
                <Input
                  id="email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email Betreff..."
                />
              </div>

              {/* Variables */}
              <div>
                <Label>Variablen einfügen</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => insertVariable('{{first_name}}')}>
                    Vorname
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertVariable('{{last_name}}')}>
                    Nachname
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertVariable('{{membership_type}}')}>
                    Membership
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertVariable('{{email_and_code}}')}>
                    Email & Code
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div>
                <Label htmlFor="email-body">Inhalt</Label>
                <Textarea
                  id="email-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email Inhalt..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setPreviewDialogOpen(true)}
                  disabled={selectedMembers.length === 0 || !subject || !body}
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Vorschau
                </Button>
                <Button 
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={selectedMembers.length === 0 || !subject || !body || sending}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? 'Senden...' : `Senden (${selectedMembers.length})`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recipients Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ausgewählte Empfänger ({selectedMembers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMembers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine Empfänger ausgewählt</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setActiveTab('recipients')}
                  >
                    Empfänger auswählen
                  </Button>
                </div>
              ) : (
                <>
                  {selectedMembers.length > 50 && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">
                        Große Anzahl: Emails werden in Batches von 50 gesendet
                      </span>
                    </div>
                  )}
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-2">
                      {selectedMembers.map(member => (
                        <div 
                          key={member.id}
                          className="flex items-center justify-between p-2 border rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {member.first_name} {member.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleMember(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        onSave={handleSaveTemplate}
      />

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Vorschau</DialogTitle>
            <DialogDescription>
              Vorschau für: {previewMember?.first_name} {previewMember?.last_name}
            </DialogDescription>
          </DialogHeader>
          {previewMember && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Betreff:</Label>
                <div className="font-medium">{getPreviewText(subject, previewMember)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Inhalt:</Label>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-sm">
                  {getPreviewText(body, previewMember)}
                </div>
              </div>
              {selectedMembers.length > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewMemberIndex(Math.max(0, previewMemberIndex - 1))}
                    disabled={previewMemberIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Vorherige
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {previewMemberIndex + 1} von {selectedMembers.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewMemberIndex(Math.min(selectedMembers.length - 1, previewMemberIndex + 1))}
                    disabled={previewMemberIndex === selectedMembers.length - 1}
                  >
                    Nächste
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emails senden?</DialogTitle>
            <DialogDescription>
              Bist du sicher, dass du {selectedMembers.length} Email(s) senden möchtest?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={sendEmails} disabled={sending}>
              <Check className="h-4 w-4 mr-2" />
              {sending ? 'Senden...' : 'Ja, senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminEmailManager
