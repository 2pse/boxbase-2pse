import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"

export const useNewsNotification = (user: User | null) => {
  const [hasUnreadNews, setHasUnreadNews] = useState(false)

  useEffect(() => {
    if (!user) return

    const checkUnreadNews = async () => {
      try {
        // Get latest published news
        const { data: latestNews, error: newsError } = await supabase
          .from('news')
          .select('id, published_at')
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .single()

        if (newsError || !latestNews) {
          setHasUnreadNews(false)
          return
        }

        // Check if user has read this news
        const { data: readNews, error: readError } = await supabase
          .from('user_read_news')
          .select('id')
          .eq('user_id', user.id)
          .eq('news_id', latestNews.id)
          .single()

        if (readError && readError.code !== 'PGRST116') {
          console.error('Error checking read news:', readError)
          return
        }

        // If no read record exists, there's unread news
        setHasUnreadNews(!readNews)
      } catch (error) {
        console.error('Error checking unread news:', error)
      }
    }

    checkUnreadNews()

    // Set up real-time subscription for new news
    const channel = supabase
      .channel('news-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'news',
          filter: 'is_published=eq.true'
        },
        () => {
          setHasUnreadNews(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const markNewsAsRead = async () => {
    if (!user) return

    try {
      // Get latest published news
      const { data: latestNews, error: newsError } = await supabase
        .from('news')
        .select('id')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .single()

      if (newsError || !latestNews) return

      // Mark as read
      await supabase
        .from('user_read_news')
        .upsert({
          user_id: user.id,
          news_id: latestNews.id
        })

      setHasUnreadNews(false)
    } catch (error) {
      console.error('Error marking news as read:', error)
    }
  }

  return { hasUnreadNews, markNewsAsRead }
}