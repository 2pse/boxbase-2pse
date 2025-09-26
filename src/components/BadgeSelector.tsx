import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { 
  Target, 
  Trophy, 
  Award, 
  Star, 
  Heart, 
  Zap, 
  Crown, 
  Shield, 
  Flame, 
  Gem,
  Medal,
  Gift,
  Users,
  Calendar,
  TrendingUp
} from "lucide-react"

interface UploadedBadge {
  name: string
  url: string
  id: string
}

interface BadgeSelectorProps {
  selectedIcon: string
  onIconSelect: (icon: string) => void
  className?: string
}

const defaultIcons = [
  { name: 'target', icon: Target, label: 'Target' },
  { name: 'trophy', icon: Trophy, label: 'Trophy' },
  { name: 'award', icon: Award, label: 'Award' },
  { name: 'star', icon: Star, label: 'Star' },
  { name: 'heart', icon: Heart, label: 'Heart' },
  { name: 'zap', icon: Zap, label: 'Lightning' },
  { name: 'crown', icon: Crown, label: 'Crown' },
  { name: 'shield', icon: Shield, label: 'Shield' },
  { name: 'flame', icon: Flame, label: 'Flame' },
  { name: 'gem', icon: Gem, label: 'Diamond' },
  { name: 'medal', icon: Medal, label: 'Medal' },
  { name: 'gift', icon: Gift, label: 'Gift' },
  { name: 'users', icon: Users, label: 'Group' },
  { name: 'calendar', icon: Calendar, label: 'Calendar' },
  { name: 'trending-up', icon: TrendingUp, label: 'Trending Up' }
]

export const BadgeSelector = ({ selectedIcon, onIconSelect, className }: BadgeSelectorProps) => {
  const [uploadedBadges, setUploadedBadges] = useState<UploadedBadge[]>([])
  const [loading, setLoading] = useState(false)

  const loadUploadedBadges = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.storage
        .from('challenge-badges')
        .list()

      if (error) {
        console.error('Error loading badges:', error)
        return
      }

      const badgeList: UploadedBadge[] = data
        ?.filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => ({
          name: file.name,
          url: supabase.storage.from('challenge-badges').getPublicUrl(file.name).data.publicUrl,
          id: file.id || file.name
        })) || []

      setUploadedBadges(badgeList)
    } catch (error) {
      console.error('Error loading badges:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUploadedBadges()
  }, [])

  const isUploadedBadge = selectedIcon.startsWith('https://') || selectedIcon.startsWith('http://')

  return (
    <div className={className}>
      <Label htmlFor="icon-selector">Challenge Badge</Label>
      <Tabs defaultValue="icons" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="icons">Standard Icons</TabsTrigger>
          <TabsTrigger value="uploaded">Custom Badges</TabsTrigger>
        </TabsList>
        
        <TabsContent value="icons" className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            {defaultIcons.map(({ name, icon: IconComponent, label }) => (
              <Button
                key={name}
                variant={selectedIcon === name && !isUploadedBadge ? "default" : "outline"}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto p-2"
                onClick={() => onIconSelect(name)}
                title={label}
              >
                <IconComponent className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="uploaded" className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading badges...</p>
          ) : uploadedBadges.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  No custom badges available. Please upload badges first.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {uploadedBadges.map((badge) => (
                <Button
                  key={badge.id}
                  variant={selectedIcon === badge.url ? "default" : "outline"}
                  className="flex flex-col items-center gap-1 h-auto p-2 aspect-square"
                  onClick={() => onIconSelect(badge.url)}
                  title={badge.name}
                >
                  <div className="w-8 h-8 overflow-hidden rounded">
                    <img 
                      src={badge.url} 
                      alt={badge.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs truncate w-full">{badge.name.split('.')[0]}</span>
                </Button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {selectedIcon && (
        <div className="mt-2">
          <Label className="text-sm text-muted-foreground">Selected:</Label>
          <div className="flex items-center gap-2 mt-1">
            {isUploadedBadge ? (
              <div className="w-6 h-6 overflow-hidden rounded">
                <img 
                  src={selectedIcon} 
                  alt="Selected badge"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              (() => {
                const IconComponent = defaultIcons.find(icon => icon.name === selectedIcon)?.icon
                return IconComponent ? <IconComponent className="h-4 w-4" /> : null
              })()
            )}
            <Badge variant="secondary" className="text-xs">
              {isUploadedBadge ? 'Custom Badge' : selectedIcon}
            </Badge>
          </div>
        </div>
      )}
    </div>
  )
}