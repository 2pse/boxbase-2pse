import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { enUS } from "date-fns/locale"
import { Edit, Trash2, Plus, Mail, Users, Loader2 } from "lucide-react"

interface NewsItem {
  id: string
  title: string
  content: string
  author_id: string
  published_at: string
  is_published: boolean
  created_at: string
  updated_at: string
  link_url?: string
  email_sent_at?: string
}

type StatusFilter = 'all' | 'active' | 'inactive'

export const NewsManager = () => {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Form state
  const [newsForm, setNewsForm] = useState({
    title: '',
    content: '',
    link_url: ''
  })

  // Email state
  const [sendEmail, setSendEmail] = useState(false)
  const [emailFilters, setEmailFilters] = useState({
    statusFilter: 'active' as StatusFilter,
    membershipTypes: [] as string[]
  })
  const [availableMembershipTypes, setAvailableMembershipTypes] = useState<string[]>([])
  const [previewRecipients, setPreviewRecipients] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    loadNews()
    loadMembershipTypes()
  }, [])

  useEffect(() => {
    if (!sendEmail) {
      setPreviewRecipients(0)
      return
    }

    // Debounce: 500ms after last change
    const timer = setTimeout(() => {
      loadPreviewRecipients()
    }, 500)

    return () => clearTimeout(timer)
  }, [sendEmail, emailFilters.statusFilter, emailFilters.membershipTypes])

  const loadMembershipTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_plans_v2')
        .select('name')
        .eq('is_active', true)
      
      if (error) throw error
      
      const types = data?.map(p => p.name) || []
      // Add "No Membership" option for members without active membership
      const typesWithNoMembership = [...types, 'No Membership']
      setAvailableMembershipTypes(typesWithNoMembership)
      setEmailFilters(prev => ({ ...prev, membershipTypes: typesWithNoMembership }))
    } catch (error) {
      console.error('Error loading membership types:', error)
    }
  }

  const loadPreviewRecipients = async () => {
    if (emailFilters.membershipTypes.length === 0) {
      setPreviewRecipients(0)
      return
    }

    setLoadingPreview(true)
    try {
      // Load memberships
      const { data: memberships } = await supabase
        .from('user_memberships_v2')
        .select('user_id, membership_plans_v2(name)')
        .eq('status', 'active')

      const membershipMap = new Map(
        memberships?.map(m => [
          m.user_id,
          (m.membership_plans_v2 as any)?.name || 'No Membership'
        ]) || []
      )

      // Get admin user IDs to exclude
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      const adminUserIds = adminRoles?.map(r => r.user_id) || []

      // Load all profiles (not just those with memberships)
      let query = supabase
        .from('profiles')
        .select('user_id')
        .not('user_id', 'is', null)

      if (emailFilters.statusFilter !== 'all') {
        query = query.eq('status', emailFilters.statusFilter)
      }

      const { data: profiles } = await query

      // Filter by membership types (including "No Membership")
      const count = profiles?.filter(p => {
        // Exclude admins
        if (adminUserIds.includes(p.user_id)) return false
        
        const type = membershipMap.get(p.user_id) || 'No Membership'
        return emailFilters.membershipTypes.includes(type)
      }).length || 0

      setPreviewRecipients(count)
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setLoadingPreview(false)
    }
  }

  const loadNews = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setNews(data || [])
    } catch (error) {
      console.error('Error loading news:', error)
      toast.error('Error loading news')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (sendEmail) {
      setSendingEmail(true)
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: newNews, error } = await supabase
        .from('news')
        .insert({
          title: newsForm.title,
          content: newsForm.content,
          link_url: newsForm.link_url || null,
          author_id: user.id,
          is_published: true,
          published_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Send email if enabled
      if (sendEmail && newNews) {
        try {
          const { data: emailResponse, error: emailError } = await supabase.functions.invoke(
            'send-news-email',
            {
              body: {
                newsId: newNews.id,
                title: newsForm.title,
                content: newsForm.content,
                statusFilter: emailFilters.statusFilter,
                membershipTypes: emailFilters.membershipTypes
              }
            }
          )

          if (emailError) {
            console.error('Email error:', emailError)
            toast.error('News created, but email could not be sent')
          } else {
            toast.success(`News created and email sent to ${emailResponse.sent} recipients`)
          }
        } catch (emailError) {
          console.error('Email sending failed:', emailError)
          toast.error('News created, but email sending failed')
        }
      } else {
        toast.success('Message created successfully')
      }

      setNewsForm({
        title: '',
        content: '',
        link_url: ''
      })
      setSendEmail(false)
      setCreateDialogOpen(false)
      await loadNews()
    } catch (error) {
      console.error('Error creating news:', error)
      toast.error('Error creating message')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleUpdateNews = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingNews) return

    try {
      const formData = new FormData(e.target as HTMLFormElement)
      const updates = {
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        link_url: (formData.get('link_url') as string) || null,
        is_published: true,
        published_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('news')
        .update(updates)
        .eq('id', editingNews.id)

      if (error) throw error

      toast.success('Message updated successfully')
      setEditingNews(null)
      await loadNews()
    } catch (error) {
      console.error('Error updating news:', error)
      toast.error('Error updating message')
    }
  }

  const handleDeleteNews = async (newsId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return

    try {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', newsId)

      if (error) throw error

      toast.success('Message deleted successfully')
      await loadNews()
    } catch (error) {
      console.error('Error deleting news:', error)
      toast.error('Error deleting message')
    }
  }


  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-muted-foreground">Loading news...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">News</h2>
          <p className="text-muted-foreground">Create and manage studio news</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Message</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateNews} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  value={newsForm.title}
                  onChange={(e) => setNewsForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="News title"
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('News title is required')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  value={newsForm.content}
                  onChange={(e) => setNewsForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="News content..."
                  rows={6}
                  onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('News content is required')}
                  onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="link_url">Link (Optional)</Label>
                <Input
                  type="url"
                  value={newsForm.link_url}
                  onChange={(e) => setNewsForm(prev => ({ ...prev, link_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              {/* Email Option */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-email"
                    checked={sendEmail}
                    onCheckedChange={(checked) => setSendEmail(!!checked)}
                  />
                  <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4" />
                    Send as Email
                  </Label>
                </div>

                {sendEmail && (
                  <div className="space-y-4 pt-2">
                    {/* Status Filter */}
                    <div>
                      <Label>Recipient Status</Label>
                      <Select 
                        value={emailFilters.statusFilter} 
                        onValueChange={(v) => setEmailFilters(prev => ({ ...prev, statusFilter: v as StatusFilter }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Membership Type Filter */}
                    <div>
                      <Label>Membership Types</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {availableMembershipTypes.map(type => (
                          <label 
                            key={type} 
                            className="flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={emailFilters.membershipTypes.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setEmailFilters(prev => ({ 
                                    ...prev, 
                                    membershipTypes: [...prev.membershipTypes, type] 
                                  }))
                                } else {
                                  setEmailFilters(prev => ({ 
                                    ...prev, 
                                    membershipTypes: prev.membershipTypes.filter(t => t !== type) 
                                  }))
                                }
                              }}
                            />
                            <span className="text-sm">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Recipients Preview */}
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {loadingPreview ? (
                        <span className="text-sm text-muted-foreground">Calculating recipients...</span>
                      ) : (
                        <span className="text-sm">
                          <span className="font-medium">{previewRecipients}</span> recipients will receive this email
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={sendingEmail}>
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Emails...
                  </>
                ) : sendEmail ? (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Create & Send Email
                  </>
                ) : (
                  'Create Message'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {news.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="sm:hidden text-sm text-muted-foreground">
                          {format(new Date(item.created_at), 'dd.MM.yyyy HH:mm', { locale: enUS })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(item.created_at), 'dd.MM.yyyy HH:mm', { locale: enUS })}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {item.email_sent_at ? (
                        <Badge variant="secondary" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Sent
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingNews(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteNews(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit News Dialog */}
      <Dialog open={!!editingNews} onOpenChange={() => setEditingNews(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
          </DialogHeader>
          {editingNews && (
            <form onSubmit={handleUpdateNews} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input 
                  name="title" 
                  defaultValue={editingNews.title} 
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('News title is required')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  required 
                />
              </div>
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea 
                  name="content" 
                  defaultValue={editingNews.content} 
                  rows={6} 
                  onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('News content is required')}
                  onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                  required 
                />
              </div>
              <div>
                <Label htmlFor="link_url">Link (Optional)</Label>
                <Input 
                  type="url"
                  name="link_url" 
                  defaultValue={editingNews.link_url || ''} 
                  placeholder="https://..."
                />
              </div>
              <Button type="submit" className="w-full">
                Update Message
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NewsManager
