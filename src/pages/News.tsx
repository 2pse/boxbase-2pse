import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, User, ArrowLeft, ExternalLink } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { useNavigate } from "react-router-dom"

interface NewsItem {
  id: string
  title: string
  content: string
  published_at: string
  author_id: string
  link_url?: string
  profiles?: {
    display_name: string
  } | null
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadNews()
  }, [])

  const loadNews = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })

      if (error) throw error
      console.log('Loaded news data:', data) // Debug logging
      setNews(data || [])
    } catch (error) {
      console.error('Error loading news:', error)
      toast.error('Error loading news')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pro')}
            className="text-primary"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-xl font-bold">Gym News</h1>
          <div className="w-20" /> {/* Spacer for center alignment */}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading News...</p>
          </div>
        ) : news.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Keine Nachrichten</h3>
              <p className="text-muted-foreground">
                Aktuell sind keine Nachrichten verfügbar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {news.map(item => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <Badge variant="outline" className="text-xs px-2 py-1 opacity-80 text-muted-foreground border-muted/30 bg-muted/20">
                      <Calendar className="h-3 w-3 mr-1" />
                      {format(new Date(item.published_at), 'dd.MM.yyyy', { locale: de })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  </div>
                  {item.link_url && (
                    <div className="mt-4">
                      <Button 
                        onClick={() => {
                          console.log('Opening URL:', item.link_url) // Debug logging
                          window.open(item.link_url, '_blank', 'noopener,noreferrer')
                        }}
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Hier Klicken
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}