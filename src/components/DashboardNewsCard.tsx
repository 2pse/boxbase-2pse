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
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3 md:p-6 h-24 md:h-[155px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-xs md:text-sm">Lade News...</div>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3 md:p-6 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02] h-24 md:h-[155px] w-full cursor-pointer relative"
    >
      <div className="flex items-center justify-center h-full relative">
        <h3 className="text-lg md:text-4xl font-semibold text-foreground">
          News
        </h3>
        <div className="absolute top-0 right-0">
          <div className="relative">
            <Bell className="h-5 md:h-8 w-5 md:w-8 text-primary" />
            {hasUnreadNews && (
              <span className="absolute -top-1 md:-top-2 -right-1 md:-right-2 h-3 md:h-4 w-3 md:w-4 bg-red-500 rounded-full border-2 border-background" />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
