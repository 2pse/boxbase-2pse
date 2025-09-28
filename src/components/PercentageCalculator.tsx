import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calculator, TrendingUp } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface PercentageCalculatorProps {
  user: User
}

export const PercentageCalculator: React.FC<PercentageCalculatorProps> = ({ user }) => {
  const [selectedLift, setSelectedLift] = useState("")
  const [percentage, setPercentage] = useState("")
  const [strengthValues, setStrengthValues] = useState<any>({})
  const [useFixedValues, setUseFixedValues] = useState(true)
  const [freeWeight, setFreeWeight] = useState("")

  useEffect(() => {
    loadStrengthValues()
  }, [user.id])

  const loadStrengthValues = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('front_squat_1rm, back_squat_1rm, deadlift_1rm, bench_press_1rm, snatch_1rm, clean_1rm, jerk_1rm, clean_and_jerk_1rm')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        setStrengthValues({
          front_squat_1rm: profile.front_squat_1rm,
          back_squat_1rm: profile.back_squat_1rm,
          deadlift_1rm: profile.deadlift_1rm,
          bench_press_1rm: profile.bench_press_1rm,
          snatch_1rm: profile.snatch_1rm,
          clean_1rm: profile.clean_1rm,  
          jerk_1rm: profile.jerk_1rm,
          clean_and_jerk_1rm: profile.clean_and_jerk_1rm
        })
      }
    } catch (error) {
      console.error('Error loading strength values:', error)
    }
  }

  // Get all lifts with their values for the percentage calculator
  const getLiftsData = () => {
    const lifts = [
      { name: "Front Squat", value: strengthValues.front_squat_1rm },
      { name: "Back Squat", value: strengthValues.back_squat_1rm },
      { name: "Deadlift", value: strengthValues.deadlift_1rm },
      { name: "Bench Press", value: strengthValues.bench_press_1rm },
      { name: "Snatch", value: strengthValues.snatch_1rm },
      { name: "Clean", value: strengthValues.clean_1rm },
      { name: "Jerk", value: strengthValues.jerk_1rm },
      { name: "Clean & Jerk", value: strengthValues.clean_and_jerk_1rm }
    ]
    
    return lifts.filter(lift => lift.value && parseFloat(lift.value.toString()) > 0)
  }

  // Calculate percentage value
  const calculatePercentage = () => {
    if (!useFixedValues) {
      // Free calculation mode
      if (!freeWeight || !percentage) return null
      
      const weight = parseFloat(freeWeight)
      const percentValue = parseFloat(percentage)
      
      if (isNaN(weight) || isNaN(percentValue)) return null
      
      return ((weight * percentValue) / 100).toFixed(1)
    }
    
    // Saved values mode
    const selectedLiftData = getLiftsData().find(lift => lift.name === selectedLift)
    if (!selectedLiftData || !percentage) return null
    
    const oneRm = parseFloat(selectedLiftData.value.toString())
    const percentValue = parseFloat(percentage)
    
    if (isNaN(oneRm) || isNaN(percentValue)) return null
    
    return ((oneRm * percentValue) / 100).toFixed(1)
  }

  const availableLifts = getLiftsData()

  if (!useFixedValues || availableLifts.length === 0) {
    return (
      <div className="mx-4 space-y-6">
        {/* Header Card */}
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calculator className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Percentage Calculator</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {useFixedValues 
                      ? 'Calculate with saved strength values' 
                      : 'Free calculation with your own values'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end space-x-3 bg-muted/30 rounded-lg p-3">
                <Label htmlFor="calculator-mode" className="text-sm font-medium">
                  {useFixedValues ? 'Saved' : 'Free'}
                </Label>
                <Switch
                  id="calculator-mode"
                  checked={useFixedValues}
                  onCheckedChange={setUseFixedValues}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Calculator Card */}
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="p-6">
            {!useFixedValues ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Weight (kg)
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={freeWeight}
                      onChange={(e) => setFreeWeight(e.target.value)}
                      placeholder="e.g. 100"
                      className="h-12 text-lg border-primary/30 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      Percent (%)
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="150"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      placeholder="e.g. 75"
                      className="h-12 text-lg border-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
                
                {/* Result Display */}
                <div className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
                  <div className="text-center">
                    <Label className="text-sm font-semibold text-muted-foreground mb-2 block">
                      RESULT
                    </Label>
                    <div className="text-4xl font-bold text-primary mb-2">
                      {calculatePercentage() ? `${calculatePercentage()} kg` : '---'}
                    </div>
                    {calculatePercentage() && (
                      <p className="text-sm text-muted-foreground">
                        {percentage}% von {freeWeight}kg
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="p-4 bg-muted/30 rounded-2xl mb-4 inline-block">
                  <Calculator className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  No strength values found
                </p>
                <p className="text-sm text-muted-foreground">
                  Enter your 1RM values in the strength values to use the percentage calculator.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-4 space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Percentage Calculator</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {useFixedValues 
                    ? 'Calculate with saved strength values' 
                    : 'Free calculation with your own values'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end space-x-3 bg-muted/30 rounded-lg p-3">
              <Label htmlFor="calculator-mode" className="text-sm font-medium">
                {useFixedValues ? 'Saved' : 'Free'}
              </Label>
              <Switch
                id="calculator-mode"
                checked={useFixedValues}
                onCheckedChange={setUseFixedValues}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calculator Card */}
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {useFixedValues ? (
                <div className="space-y-2 md:col-span-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Übung auswählen
                  </Label>
                  <Select value={selectedLift} onValueChange={setSelectedLift}>
                    <SelectTrigger className="h-12 text-lg border-primary/30 focus:border-primary">
                      <SelectValue placeholder="Übung wählen" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {availableLifts.map((lift) => (
                        <SelectItem key={lift.name} value={lift.name} className="bg-background hover:bg-hover-neutral text-lg py-3">
                          <div className="flex justify-between items-center w-full">
                            <span>{lift.name}</span>
                            <span className="text-primary font-semibold ml-4">{lift.value}kg</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Weight (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={freeWeight}
                    onChange={(e) => setFreeWeight(e.target.value)}
                    placeholder="e.g. 100"
                    className="h-12 text-lg border-primary/30 focus:border-primary"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Percent (%)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="150"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="e.g. 75"
                  className="h-12 text-lg border-primary/30 focus:border-primary"
                />
              </div>
            </div>
            
            {/* Result Display */}
            <div className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
              <div className="text-center">
                <Label className="text-sm font-semibold text-muted-foreground mb-2 block">
                  RESULT
                </Label>
                <div className="text-4xl font-bold text-primary mb-2">
                  {calculatePercentage() ? `${calculatePercentage()} kg` : '---'}
                </div>
                {calculatePercentage() && (
                  <p className="text-sm text-muted-foreground">
                    {percentage}% von {useFixedValues 
                      ? `${availableLifts.find(lift => lift.name === selectedLift)?.value}kg (${selectedLift})`
                      : `${freeWeight}kg`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}