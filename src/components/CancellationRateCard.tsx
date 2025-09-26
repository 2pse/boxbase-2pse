import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/integrations/supabase/client"
import { AlertTriangle } from "lucide-react"

interface CancellationStats {
  totalRegistrations: number
  cancellations: number
  cancellationRate: number
  recentTrend: 'up' | 'down' | 'stable'
}

export const CancellationRateCard = () => {
  const [stats, setStats] = useState<CancellationStats>({
    totalRegistrations: 0,
    cancellations: 0,
    cancellationRate: 0,
    recentTrend: 'stable'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCancellationStats()
  }, [])

  const loadCancellationStats = async () => {
    try {
      // Get registrations from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: registrations, error } = await supabase
        .from('course_registrations')
        .select('status, registered_at')
        .gte('registered_at', thirtyDaysAgo.toISOString())

      if (error) throw error

      const totalRegistrations = registrations?.length || 0
      const cancellations = registrations?.filter(r => r.status === 'cancelled').length || 0
      const cancellationRate = totalRegistrations > 0 ? (cancellations / totalRegistrations) * 100 : 0

      // Calculate trend (compare last 15 days vs previous 15 days)
      const fifteenDaysAgo = new Date()
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
      
      const recentRegistrations = registrations?.filter(r => 
        new Date(r.registered_at) >= fifteenDaysAgo
      ) || []
      const olderRegistrations = registrations?.filter(r => 
        new Date(r.registered_at) < fifteenDaysAgo
      ) || []

      const recentCancellationRate = recentRegistrations.length > 0 
        ? (recentRegistrations.filter(r => r.status === 'cancelled').length / recentRegistrations.length) * 100 
        : 0
      const olderCancellationRate = olderRegistrations.length > 0 
        ? (olderRegistrations.filter(r => r.status === 'cancelled').length / olderRegistrations.length) * 100 
        : 0

      let recentTrend: 'up' | 'down' | 'stable' = 'stable'
      if (recentCancellationRate > olderCancellationRate + 2) {
        recentTrend = 'up'
      } else if (recentCancellationRate < olderCancellationRate - 2) {
        recentTrend = 'down'
      }

      setStats({
        totalRegistrations,
        cancellations,
        cancellationRate,
        recentTrend
      })
    } catch (error) {
      console.error('Error loading cancellation stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Cancellation rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-6 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getTrendColor = () => {
    switch (stats.recentTrend) {
      case 'up': return 'text-red-600'
      case 'down': return 'text-green-600'
      default: return 'text-muted-foreground'
    }
  }

  const getTrendText = () => {
    switch (stats.recentTrend) {
      case 'up': return 'Rising'
      case 'down': return 'Falling'
      default: return 'Stable'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Cancellation rate
        </CardTitle>
        <p className="text-xs text-muted-foreground">30 days</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Cancellations</span>
            <span className="font-medium">{Math.round(stats.cancellationRate)}%</span>
          </div>
          <Progress 
            value={stats.cancellationRate} 
            className="h-2"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total registrations</p>
            <p className="text-xl font-bold">{stats.totalRegistrations}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cancelled</p>
            <p className="text-xl font-bold">{stats.cancellations}</p>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <p className={`text-xs font-medium ${getTrendColor()}`}>
            Trend: {getTrendText()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}