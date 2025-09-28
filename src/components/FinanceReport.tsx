import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar as CalendarIcon, DollarSign, TrendingUp, Users, Download } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface RevenueData {
  month: string
  booking_type: string
  membership_name: string  
  member_count: number
  total_revenue: number
}

interface MonthlyTotal {
  month: string
  total: number
  unlimited: number
  limited: number
  credits: number
  open_gym_only: number
}

export const FinanceReport = () => {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadFinancialData()
  }, [])

  // Helper function to map booking types to display categories
  const mapBookingTypeToCategory = (bookingType: string | undefined): string => {
    switch (bookingType) {
      case 'unlimited':
        return 'unlimited'
      case 'limited':
      case 'weekly_limit': 
      case 'monthly_limit':
        return 'limited'
      case 'credits':
        return 'credits'
      case 'open_gym_only':
        return 'open_gym_only'
      default:
        return 'unlimited'
    }
  }

  const loadFinancialData = async () => {
    try {
      setLoading(true)
      
      // Get current active memberships (only for users with profiles)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id')
      
      const { data: revenueV2 } = await supabase
        .from('user_memberships_v2')
        .select(`
          user_id,
          start_date,
          end_date,
          membership_plans_v2!inner(
            id,
            name,
            booking_rules,
            price_monthly,
            payment_frequency
          )
        `)
        .eq('status', 'active')

      // Get historical revenue data
      const { data: historicalRevenue } = await supabase
        .from('revenue_history')
        .select('*')

      // Create profile set for lookup
      const profileUserIds = new Set(allProfiles?.map(p => p.user_id) || [])
      
      // Process data by month and membership plan
      const processedData: { [key: string]: { [key: string]: { count: number, revenue: number, name: string, booking_type: string } } } = {}
      
      // Process current V2 data (only for users with profiles)
      revenueV2?.forEach(item => {
        // Only count if user still has a profile
        if (!profileUserIds.has(item.user_id)) return
        
        const startDate = new Date(item.start_date)
        const endDate = item.end_date ? new Date(item.end_date) : new Date() // Use current date if no end date
        const planId = item.membership_plans_v2.id
        const planName = item.membership_plans_v2.name
        const bookingRules = item.membership_plans_v2.booking_rules as any
        const bookingType = mapBookingTypeToCategory(bookingRules?.type)
        const price = Number(item.membership_plans_v2.price_monthly)
        const paymentFrequency = item.membership_plans_v2.payment_frequency

        if (paymentFrequency === 'one_time') {
          // For one-time payments, only count revenue in the first month
          const month = startDate.toISOString().slice(0, 7) // YYYY-MM format
          
          if (!processedData[month]) {
            processedData[month] = {}
          }
          
          if (!processedData[month][planId]) {
            processedData[month][planId] = { count: 0, revenue: 0, name: `${planName} (One-time)`, booking_type: bookingType }
          }
          
          processedData[month][planId].count += 1
          processedData[month][planId].revenue += price
        } else {
          // For monthly payments, calculate revenue for each month the membership is active
          let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          const lastDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
          const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          
          while (currentDate <= lastDate && currentDate <= currentMonth) {
            const month = currentDate.toISOString().slice(0, 7) // YYYY-MM format
            
            if (!processedData[month]) {
              processedData[month] = {}
            }
            
            if (!processedData[month][planId]) {
              processedData[month][planId] = { count: 0, revenue: 0, name: `${planName} (Monthly)`, booking_type: bookingType }
            }
            
            processedData[month][planId].count += 1
            processedData[month][planId].revenue += price
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1)
          }
        }
      })

      // Process historical revenue data
      historicalRevenue?.forEach(item => {
        const startDate = new Date(item.period_start)
        const endDate = new Date(item.period_end)
        const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        
        // Determine if this is a one-time payment based on booking_type
        const isOneTimePayment = item.booking_type === 'credits' || 
                                item.booking_type === 'one_time' ||
                                item.deleted_reason === 'membership_deleted'
        
        if (isOneTimePayment) {
          // For one-time payments, only count revenue in the month of period_start
          const month = startDate.toISOString().slice(0, 7) // YYYY-MM format
          const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          
          // Only process if it's not a future month
          if (startMonth <= currentMonth) {
            const planId = `historical_${item.id}` // Use unique ID for historical data
            
            if (!processedData[month]) {
              processedData[month] = {}
            }
            
            if (!processedData[month][planId]) {
              processedData[month][planId] = {
                count: 0,
                revenue: 0,
                name: `${item.membership_plan_name} (One-time)`,
                booking_type: mapBookingTypeToCategory(item.booking_type)
              }
            }
            
            processedData[month][planId].count += 1
            processedData[month][planId].revenue += Number(item.amount)
          }
        } else {
          // For monthly payments, generate monthly entries for the historical period
          let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          const lastDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
          
          // Stop processing at current month to avoid future months
          while (currentDate <= lastDate && currentDate <= currentMonth) {
            const month = currentDate.toISOString().slice(0, 7) // YYYY-MM format
            const planId = `historical_${item.id}` // Use unique ID for historical data
            
            if (!processedData[month]) {
              processedData[month] = {}
            }
            
            if (!processedData[month][planId]) {
              processedData[month][planId] = {
                count: 0,
                revenue: 0,
                name: `${item.membership_plan_name} (Monthly)`,
                booking_type: mapBookingTypeToCategory(item.booking_type)
              }
            }
            
            processedData[month][planId].count += 1
            processedData[month][planId].revenue += Number(item.amount)
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1)
          }
        }
      })

      console.log('Processed Revenue Data (with historical):', processedData)

      // V1 system deprecated, skipping V1 data processing

      // Convert to array format for charts
      const chartData: RevenueData[] = []
      const monthlyData: { [key: string]: MonthlyTotal } = {}
      
      Object.entries(processedData).forEach(([month, plans]) => {
        let monthTotal = 0
        const monthEntry: MonthlyTotal = {
          month,
          total: 0,
          unlimited: 0,
          limited: 0,
          credits: 0,
          open_gym_only: 0
        }
          
        Object.entries(plans).forEach(([planId, data]) => {
          chartData.push({
            month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            booking_type: data.booking_type,
            membership_name: data.name,
            member_count: data.count,
            total_revenue: data.revenue
          })
          
          monthTotal += data.revenue
          const currentValue = monthEntry[data.booking_type as keyof MonthlyTotal]
          if (typeof currentValue === 'number') {
            monthEntry[data.booking_type as keyof MonthlyTotal] = (currentValue + data.revenue) as never
          }
        })
        
        monthEntry.total = monthTotal
        monthlyData[month] = monthEntry
      })

      // Sort monthly data by date (newest first) and filter out future months
      const currentDate = new Date()
      const currentYearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      
      const sortedMonthlyData = Object.values(monthlyData)
        .filter(item => item.month <= currentYearMonth) // Only current and past months
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
        .slice(0, 12) // Last 12 months
        .map(item => ({
          ...item,
          month: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        }))
        .reverse() // Show oldest to newest for chart

      setRevenueData(chartData)
      setMonthlyTotals(sortedMonthlyData)
      
      // Calculate totals - using only V2 data
      const totalRev = sortedMonthlyData.reduce((sum, month) => sum + month.total, 0)
      const totalMems = revenueV2?.length || 0
      
      setTotalRevenue(totalRev)
      setTotalMembers(totalMems)
    } catch (error) {
      console.error('Error loading financial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMembershipColor = (type: string) => {
    switch (type) {
      case 'unlimited':
        return 'hsl(220, 15%, 45%)' // Professional dark blue-gray
      case 'limited':
      case 'monthly_limit':
      case 'weekly_limit':
        return 'hsl(200, 18%, 55%)' // Muted steel blue
      case 'credits':
        return 'hsl(150, 12%, 48%)' // Subtle sage green
      case 'open_gym_only':
        return 'hsl(25, 20%, 52%)' // Warm neutral brown
      default:
        return 'hsl(220, 15%, 45%)' // Default to professional dark blue-gray
    }
  }

  const getMembershipLabel = (type: string): string => {
    switch (type) {
      case 'unlimited': return 'Unlimited'
      case 'limited': return 'Limited'
      case 'monthly_limit': return 'Monthly Limit'
      case 'weekly_limit': return 'Weekly Limit'
      case 'credits': return 'Credits'
      case 'open_gym_only': return 'Open Gym'
      default: return type
    }
  }

  const exportToCSV = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast({
        title: "Error",
        description: "Please select start and end date",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      // Filter and group data by month and booking type
      const filteredData = revenueData.filter(item => {
        const itemDate = new Date(item.month + '-01')
        const startDate = new Date(exportStartDate + '-01')
        const endDate = new Date(exportEndDate + '-01')
        return itemDate >= startDate && itemDate <= endDate
      })

      // Group by month and booking type for better export format
      const groupedData: { [key: string]: { [key: string]: { count: number, revenue: number, name: string } } } = {}
      
      filteredData.forEach(item => {
        if (!groupedData[item.month]) {
          groupedData[item.month] = {}
        }
        
        if (!groupedData[item.month][item.booking_type]) {
          groupedData[item.month][item.booking_type] = { count: 0, revenue: 0, name: getMembershipLabel(item.booking_type) }
        }
        
        groupedData[item.month][item.booking_type].count += item.member_count
        groupedData[item.month][item.booking_type].revenue += item.total_revenue
      })

      // Create CSV content with one line per category per month
      const headers = ['Month', 'Category', 'Number of Memberships', 'Revenue (€)']
      const csvRows: string[] = []
      
      Object.entries(groupedData).forEach(([month, categories]) => {
        Object.entries(categories).forEach(([bookingType, data]) => {
          csvRows.push([
            month,
            data.name,
            data.count.toString(),
            data.revenue.toFixed(2)
          ].join(','))
        })
      })

      const csvContent = [headers.join(','), ...csvRows].join('\n')

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `finance_${exportStartDate}_to_${exportEndDate}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Success",
        description: "CSV export successfully downloaded",
      })
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast({
        title: "Error",
        description: "Error in CSV export",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Finance</h2>
        <p className="text-muted-foreground">Overview of revenue and membership statistics</p>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Memberships</p>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Monthly Revenue</p>
                <p className="text-2xl font-bold">€{(() => {
                  if (monthlyTotals.length === 0) return '0.00'
                  
                  // Calculate average only from months with actual data (exclude future months)
                  const currentDate = new Date()
                  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
                  
                  const completedMonths = monthlyTotals.filter(month => {
                    const monthDate = new Date(month.month + '-01')
                    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
                    return monthKey !== currentMonth
                  })
                  
                  if (completedMonths.length === 0) return '0.00'
                  
                  const totalRevenue = completedMonths.reduce((sum, month) => sum + month.total, 0)
                  return (totalRevenue / completedMonths.length).toFixed(2)
                })()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CalendarIcon className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Last Month</p>
                <p className="text-2xl font-bold">€{(() => {
                  if (monthlyTotals.length === 0) return '0.00'
                  
                  // Get the most recent completed month (not current month)
                  const currentDate = new Date()
                  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
                  
                  // Find the most recent month that is not the current month
                  const lastCompletedMonth = monthlyTotals
                    .slice()
                    .reverse() // Get back to newest first order
                    .find(month => {
                      const monthDate = new Date(month.month + '-01')
                      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
                      return monthKey !== currentMonth
                    })
                  
                  return lastCompletedMonth ? lastCompletedMonth.total.toFixed(2) : '0.00'
                })()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height={300} minWidth={400}>
              <LineChart data={monthlyTotals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `€${value}`}
                      />
                      <Tooltip 
                        formatter={(value) => [`€${Number(value).toFixed(2)}`, 'Revenue']}
                        labelStyle={{ color: '#000' }}
                      />
                      <Line 
                        type="monotone"
                        dataKey="total"
                        stroke={`hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '210 40% 98%'})`}
                        strokeWidth={2}
                        dot={{ fill: `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '210 40% 98%'})`, strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Breakdown by Membership Type */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Membership Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={300} minWidth={400}>
                    <BarChart data={monthlyTotals}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `€${value}`}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload.filter(p => typeof p.value === 'number' && p.value > 0);
                            if (data.length === 0) return null;
                            
                            return (
                              <div className="bg-white p-3 border rounded shadow-lg">
                                <p className="font-medium mb-2">{label}</p>
                                {data.map((entry, index) => {
                                  // Find the actual membership name for this booking type and value
                                  const currentMonth = monthlyTotals[monthlyTotals.length - 1]?.month;
                                  const matchingData = revenueData.find(item => 
                                    item.month === currentMonth && 
                                    item.booking_type === entry.dataKey &&
                                    item.total_revenue === entry.value
                                  );
                                  const displayName = matchingData ? matchingData.membership_name : entry.dataKey;
                                  
                                  return (
                                    <p key={index} style={{ color: entry.color }}>
                                      {displayName}: €{Number(entry.value).toFixed(2)}
                                    </p>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="unlimited" stackId="a" fill={getMembershipColor('unlimited')} name="Unlimited" />
                      <Bar dataKey="limited" stackId="a" fill={getMembershipColor('limited')} name="Limited" />
                      <Bar dataKey="credits" stackId="a" fill={getMembershipColor('credits')} name="Credits" />
                      <Bar dataKey="open_gym_only" stackId="a" fill={getMembershipColor('open_gym_only')} name="Open Gym" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

      {/* CSV Export Section - Moved to bottom */}
      <Card className="border-dashed">
        <CardContent className="p-4">
           <div className="flex flex-col md:flex-row gap-3 items-center">
             <div className="flex-1">
               <p className="text-sm font-medium mb-2">CSV Export</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 <div>
                   <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                   <Popover>
                     <PopoverTrigger asChild>
                       <Button
                         variant="outline"
                         className={cn(
                           "w-full justify-start text-left font-normal text-sm",
                           !exportStartDate && "text-muted-foreground"
                         )}
                       >
                         <CalendarIcon className="mr-2 h-4 w-4" />
                         {exportStartDate ? format(new Date(exportStartDate + '-01'), "MMM yyyy", { locale: enUS }) : "Select month"}
                       </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-auto p-0">
                       <Calendar
                         mode="single"
                         selected={exportStartDate ? new Date(exportStartDate + '-01') : undefined}
                         onSelect={(date) => setExportStartDate(date ? format(date, 'yyyy-MM') : '')}
                         initialFocus
                         locale={enUS}
                         className="pointer-events-auto"
                       />
                     </PopoverContent>
                   </Popover>
                 </div>
                 <div>
                   <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                   <Popover>
                     <PopoverTrigger asChild>
                       <Button
                         variant="outline"
                         className={cn(
                           "w-full justify-start text-left font-normal text-sm",
                           !exportEndDate && "text-muted-foreground"
                         )}
                       >
                         <CalendarIcon className="mr-2 h-4 w-4" />
                         {exportEndDate ? format(new Date(exportEndDate + '-01'), "MMM yyyy", { locale: enUS }) : "Select month"}
                       </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-auto p-0">
                       <Calendar
                         mode="single"
                         selected={exportEndDate ? new Date(exportEndDate + '-01') : undefined}
                         onSelect={(date) => setExportEndDate(date ? format(date, 'yyyy-MM') : '')}
                         initialFocus
                         locale={enUS}
                         className="pointer-events-auto"
                       />
                     </PopoverContent>
                   </Popover>
                 </div>
               </div>
             </div>
            <Button 
              onClick={exportToCSV} 
              disabled={exporting}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'CSV Export'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}