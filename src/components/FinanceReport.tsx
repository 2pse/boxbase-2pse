import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, TrendingUp, TrendingDown, Users, Activity, RefreshCw } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { loadMembershipPlanColors, getMembershipColor } from "@/lib/membershipColors"

interface StripeMetrics {
  totalRevenue: number
  activeSubscriptions: number
  mrr: number
  churnRate: number
  growthRate: number
  arpu: number
}

interface MonthlyRevenue {
  month: string
  total: number
}

interface SubscriptionBreakdown {
  product_id: string
  name: string
  count: number
  mrr: number
}

export const FinanceReport = () => {
  const [metrics, setMetrics] = useState<StripeMetrics | null>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([])
  const [subscriptionBreakdown, setSubscriptionBreakdown] = useState<SubscriptionBreakdown[]>([])
  const [loading, setLoading] = useState(true)
  const [planColors, setPlanColors] = useState<Map<string, string>>(new Map())
  const { toast } = useToast()

  useEffect(() => {
    loadStripeData()
    loadMembershipPlanColors().then(setPlanColors)
  }, [])

  const loadStripeData = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.functions.invoke('get-stripe-reporting-data')
      
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      if (!data?.metrics) throw new Error('No metrics in response')

      setMetrics(data.metrics)
      setMonthlyRevenue(data.monthlyRevenue || [])
      setSubscriptionBreakdown(data.subscriptionBreakdown || [])
      
      toast({
        title: "Success",
        description: "Stripe data loaded",
        duration: 2000,
      })
    } catch (error) {
      console.error('Error loading Stripe data:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load Stripe data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Finance</h2>
          <p className="text-muted-foreground">Live data from your Stripe account</p>
        </div>
        <Button onClick={loadStripeData} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* MRR Card - Highlighted */}
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Monthly Recurring Revenue
                </p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.mrr || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Predictable monthly revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Revenue (12 months)</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Subscriptions</p>
                <p className="text-2xl font-bold">{metrics?.activeSubscriptions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              {(metrics?.growthRate || 0) >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Growth Rate</p>
                <p className={`text-2xl font-bold ${(metrics?.growthRate || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(metrics?.growthRate || 0) >= 0 ? '+' : ''}{metrics?.growthRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">vs. last month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Churn Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Churn Rate</p>
                <p className="text-2xl font-bold">{metrics?.churnRate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground mt-1">Last month cancellations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ARPU */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">ARPU</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.arpu || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. revenue per user</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No revenue data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue by Membership Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {subscriptionBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subscriptionBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'mrr') return [formatCurrency(value), 'Monthly Revenue']
                      return [`${value}`, 'Count']
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="mrr" radius={[8, 8, 0, 0]}>
                    {subscriptionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getMembershipColor(entry.name, planColors)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No subscription data available
              </div>
            )}
          </div>
          
          {/* Detail Cards */}
          {subscriptionBreakdown.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-semibold text-sm">Details by Plan:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscriptionBreakdown.map((sub) => (
                  <Card key={sub.product_id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getMembershipColor(sub.name, planColors) }}
                          />
                          <p className="font-semibold truncate">{sub.name}</p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Members:</span>
                          <span className="font-medium">{sub.count}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Monthly Revenue:</span>
                          <span className="font-medium">{formatCurrency(sub.mrr)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
