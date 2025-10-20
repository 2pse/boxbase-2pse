import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useNewsNotification } from "@/hooks/useNewsNotification"
import { useNavigate } from "react-router-dom"

interface DashboardNewsCardProps {
  user: User
}

export const DashboardNewsCard: React.FC<DashboardNewsCardProps> = ({ user }) => {
  const [newsCount, setNewsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { hasUnreadNews, markNewsAsRead } = useNewsNotification(user)
  const navigate = useNavigate()

  useEffect(() => {
    loadRecentNewsCount()
  }, [])

  const loadRecentNewsCount = async () => {
    try {
      // Count news from last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('news')
        .select('id')
        .eq('is_published', true)
        .gte('published_at', thirtyDaysAgo.toISOString())

      if (error) throw error

      setNewsCount(data?.length || 0)
      setLoading(false)
    } catch (error) {
      console.error('Error loading news count:', error)
      setLoading(false)
    }
  }

  const handleClick = async () => {
    await markNewsAsRead()
    navigate('/news')
  }

  if (loading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 h-32 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading News...</div>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3.5 md:p-8 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02] h-22 md:h-[155px] w-full text-left relative"
    >
      <div className="flex items-center justify-center h-full">
        <h3 className="text-base md:text-3.5xl font-semibold text-foreground">
          News
        </h3>
        <Bell className="absolute top-3.5 md:top-5.5 right-3.5 md:right-5.5 h-4.5 md:h-7 w-4.5 md:w-7 text-muted-foreground" />
        {hasUnreadNews && (
          <div className="absolute top-2.5 md:top-4.5 right-2.5 md:right-4.5 w-2.5 md:w-4.5 h-2.5 md:h-4.5 bg-red-500 rounded-full" />
        )}
      </div>
    </button>
  )
}