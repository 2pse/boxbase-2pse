import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { enUS } from "date-fns/locale"
import { Edit, Trash2, Plus } from "lucide-react"

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
}

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

  useEffect(() => {
    loadNews()
  }, [])

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
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('news')
        .insert({
          title: newsForm.title,
          content: newsForm.content,
          link_url: newsForm.link_url || null,
          author_id: user.id,
          is_published: true,
          published_at: new Date().toISOString()
        })

      if (error) throw error

      toast.success('Message created successfully')
      setNewsForm({
        title: '',
        content: '',
        link_url: ''
      })
      setCreateDialogOpen(false)
      await loadNews()
    } catch (error) {
      console.error('Error creating news:', error)
      toast.error('Error creating message')
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
          <DialogContent className="max-w-2xl">
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
              <Button type="submit" className="w-full">
                Create Message
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

export default NewsManager;