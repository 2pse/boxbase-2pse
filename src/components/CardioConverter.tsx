import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Calendar, Trophy, Dumbbell, ArrowRightLeft } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { TrainingPathHeader } from "./TrainingPathHeader"

type Device = "row" | "run" | "bikeerg" | "skierg" | "assault"
type Unit = "meters" | "calories"

interface DeviceConfig {
  name: string
  meterFactor?: number
  calorieFactor?: number
  supportsMeters: boolean
  supportsCalories: boolean
}

const devices: Record<Device, DeviceConfig> = {
  row: { 
    name: "Row", 
    meterFactor: 250, 
    calorieFactor: 20, 
    supportsMeters: true, 
    supportsCalories: true 
  },
  run: { 
    name: "Run", 
    meterFactor: 200, 
    supportsMeters: true, 
    supportsCalories: false 
  },
  bikeerg: { 
    name: "BikeErg", 
    meterFactor: 500, 
    calorieFactor: 20, 
    supportsMeters: true, 
    supportsCalories: true 
  },
  skierg: { 
    name: "SkiErg", 
    meterFactor: 250, 
    calorieFactor: 20, 
    supportsMeters: true, 
    supportsCalories: true 
  },
  assault: { 
    name: "Assault Bike", 
    calorieFactor: 15, 
    supportsMeters: false, 
    supportsCalories: true 
  },
}

export const CardioConverter = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [trainingDaysThisMonth, setTrainingDaysThisMonth] = useState(0)
  
  const [inputDevice, setInputDevice] = useState<Device>("row")
  const [inputUnit, setInputUnit] = useState<Unit>("meters")
  const [inputValue, setInputValue] = useState<string>("")
  const [outputDevice, setOutputDevice] = useState<Device>("run")
  const [outputUnit, setOutputUnit] = useState<Unit>("meters")

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single()

    if (profile) setUserAvatar(profile.avatar_url)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const { count } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('session_date', startOfMonth.toISOString().split('T')[0])

    setTrainingDaysThisMonth(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const getAvailableUnits = (device: Device): Unit[] => {
    const units: Unit[] = []
    if (devices[device].supportsMeters) units.push("meters")
    if (devices[device].supportsCalories) units.push("calories")
    return units
  }

  const handleInputDeviceChange = (device: Device) => {
    setInputDevice(device)
    const availableUnits = getAvailableUnits(device)
    if (!availableUnits.includes(inputUnit)) {
      setInputUnit(availableUnits[0])
    }
  }

  const handleOutputDeviceChange = (device: Device) => {
    setOutputDevice(device)
    const availableUnits = getAvailableUnits(device)
    if (!availableUnits.includes(outputUnit)) {
      setOutputUnit(availableUnits[0])
    }
  }

  const calculateConversion = () => {
    const value = parseFloat(inputValue)
    if (isNaN(value) || value <= 0) return null

    const inputDeviceConfig = devices[inputDevice]
    const outputDeviceConfig = devices[outputDevice]
    let units = 0

    // Step 1: Convert input to universal units
    if (inputUnit === "meters" && inputDeviceConfig.meterFactor) {
      units = value / inputDeviceConfig.meterFactor
    } else if (inputUnit === "calories" && inputDeviceConfig.calorieFactor) {
      units = value / inputDeviceConfig.calorieFactor
    }

    // Step 2: Convert from universal units to output device
    if (outputUnit === "meters" && outputDeviceConfig.meterFactor) {
      return Math.round(units * outputDeviceConfig.meterFactor)
    } else if (outputUnit === "calories" && outputDeviceConfig.calorieFactor) {
      return Math.round(units * outputDeviceConfig.calorieFactor)
    }

    return null
  }

  const result = calculateConversion()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {user && (
        <TrainingPathHeader
          userAvatar={userAvatar}
          onProfileClick={() => {}}
          onLogout={handleLogout}
          trainingDaysThisMonth={trainingDaysThisMonth}
          totalDaysInMonth={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
          user={user}
        />
      )}

      {/* Back Button */}
      <div className="px-4 pt-4 pb-2">
        <Button variant="ghost" onClick={() => {
          navigate('/pro')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('changeTab', { detail: 'wod' }))
          }, 50)
        }} size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Title */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-foreground">Cardio Converter</h1>
        <p className="text-sm text-muted-foreground mt-1">Convert between cardio machines</p>
      </div>

      {/* Converter Form */}
      <div className="px-4 pb-24 space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-border"></div>
            <span className="text-xs font-semibold text-muted-foreground">FROM</span>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          {/* Device Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Device</Label>
            <Select value={inputDevice} onValueChange={(value) => handleInputDeviceChange(value as Device)}>
              <SelectTrigger className="h-12 text-lg border-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {Object.entries(devices).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-lg py-3">
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value and Unit Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Value</Label>
              <Input
                type="number"
                placeholder="e.g. 1000"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-12 text-lg border-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Unit</Label>
              <Select value={inputUnit} onValueChange={(value) => setInputUnit(value as Unit)}>
                <SelectTrigger className="h-12 text-lg border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {getAvailableUnits(inputDevice).map((unit) => (
                    <SelectItem key={unit} value={unit} className="text-lg py-3">
                      {unit === "meters" ? "Meters" : "Calories"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Divider with Arrow */}
        <div className="flex items-center justify-center py-2">
          <div className="p-2 bg-primary/10 rounded-full">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-border"></div>
            <span className="text-xs font-semibold text-muted-foreground">TO</span>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          {/* Device Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Device</Label>
            <Select value={outputDevice} onValueChange={(value) => handleOutputDeviceChange(value as Device)}>
              <SelectTrigger className="h-12 text-lg border-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {Object.entries(devices).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-lg py-3">
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Unit</Label>
            <Select value={outputUnit} onValueChange={(value) => setOutputUnit(value as Unit)}>
              <SelectTrigger className="h-12 text-lg border-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {getAvailableUnits(outputDevice).map((unit) => (
                  <SelectItem key={unit} value={unit} className="text-lg py-3">
                    {unit === "meters" ? "Meters" : "Calories"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Result Display */}
        <div className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
          <div className="text-center">
            <Label className="text-sm font-semibold text-muted-foreground mb-2 block">
              RESULT
            </Label>
            <div className="text-4xl font-bold text-primary mb-2">
              {result !== null ? `${result} ${outputUnit === "meters" ? "m" : "cal"}` : '---'}
            </div>
            {result !== null && (
              <p className="text-sm text-muted-foreground">
                {inputValue} {inputUnit === "meters" ? "m" : "cal"} ({devices[inputDevice].name}) = {result} {outputUnit === "meters" ? "m" : "cal"} ({devices[outputDevice].name})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 md:p-3 z-50 h-[72px] md:h-[110px]">
        <div className="flex justify-around max-w-md md:max-w-2xl mx-auto h-full">
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Home className="h-5 w-5 md:h-[48px] md:w-[48px]" />
            <span className="text-xs md:text-sm font-medium">Overview</span>
          </button>
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Calendar className="h-5 w-5 md:h-[48px] md:w-[48px]" />
            <span className="text-xs md:text-sm font-medium">Courses</span>
          </button>
          <button
            onClick={() => navigate('/pro?openWod=true')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-primary bg-primary/10"
          >
            <Dumbbell className="h-5 w-5 md:h-[48px] md:w-[48px]" />
            <span className="text-xs md:text-sm font-medium">Workout</span>
          </button>
          <button
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 md:gap-2 h-full py-2 md:py-3 px-3 md:px-4 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Trophy className="h-5 w-5 md:h-[48px] md:w-[48px]" />
            <span className="text-xs md:text-sm font-medium">Leaderboard</span>
          </button>
        </div>
      </div>
    </div>
  )
}
