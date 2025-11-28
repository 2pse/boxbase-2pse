import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { supabase } from "@/integrations/supabase/client"
import { timezone } from "@/lib/timezone"

interface YearlyTrainingHeatmapProps {
  userId: string
  primaryColor?: string
}

interface MonthlyTrainingData {
  month: string
  monthNumber: number
  trainingDays: number
}

export const YearlyTrainingHeatmap: React.FC<YearlyTrainingHeatmapProps> = ({ 
  userId, 
  primaryColor = '#B81243' 
}) => {
  const [monthlyData, setMonthlyData] = useState<MonthlyTrainingData[]>([])
  const [loading, setLoading] = useState(true)
  
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-12
  const monthNames = [
    'J', 'F', 'M', 'A', 'M', 'J',
    'J', 'A', 'S', 'O', 'N', 'D'
  ]

  useEffect(() => {
    loadTrainingSessions()
  }, [userId, currentYear])

  const loadTrainingSessions = async () => {
    try {
      setLoading(true)
      
      // Check if userId is valid before making the query
      if (!userId) {
        console.log('No userId available, skipping training sessions load')
        setMonthlyData([])
        return
      }
      
      // Calculate date range for the last 12 months
      const startDate = new Date(currentYear, currentMonth - 13, 1) // 13 months ago to be safe
      const endDate = new Date(currentYear, currentMonth, 0) // End of current month
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      
      const { data: sessions, error } = await supabase
        .from('training_sessions')
        .select('session_date')
        .eq('user_id', userId)
        .gte('session_date', startDateStr)
        .lte('session_date', endDateStr)
      
      if (error) throw error
      
      // Group sessions by year-month key
      const monthCounts: { [key: string]: number } = {}
      
      sessions?.forEach(session => {
        const date = new Date(session.session_date)
        const year = date.getFullYear()
        const month = date.getMonth() + 1 // 1-12
        const key = `${year}-${month}`
        monthCounts[key] = (monthCounts[key] || 0) + 1
      })
      
      // Create chart data for the last 12 months ending with current month
      const chartData: MonthlyTrainingData[] = []
      
      for (let i = 11; i >= 0; i--) {
        let month = currentMonth - i
        let year = currentYear
        
        if (month <= 0) {
          month += 12
          year -= 1
        }
        
        const key = `${year}-${month}`
        chartData.push({
          month: monthNames[month - 1],
          monthNumber: month,
          trainingDays: monthCounts[key] || 0
        })
      }
      
      setMonthlyData(chartData)
    } catch (error) {
      console.error('Error loading training sessions:', error)
      setMonthlyData([]) // Set empty data on error
    } finally {
      setLoading(false)
    }
  }

  const chartConfig = {
    trainingDays: {
      label: "Training Days",
      color: primaryColor,
    },
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-background shadow-none mb-4">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Training Log</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monthly training days in the last year
          </p>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20 bg-background shadow-none mb-4">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Training Log</CardTitle>
        <p className="text-sm text-muted-foreground">
          Monthly training days in the last year
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full bg-muted/30 rounded-lg">
          <LineChart data={monthlyData} margin={{ left: -20, right: 20, top: 5, bottom: 5 }}>
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'dataMax + 2']}
              allowDecimals={false}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />} 
            />
            <Line 
              type="monotone" 
              dataKey="trainingDays" 
              stroke={primaryColor}
              strokeWidth={2}
              dot={{ fill: primaryColor, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}