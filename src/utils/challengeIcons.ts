import { 
  Target, 
  Trophy, 
  Calendar, 
  CheckCircle, 
  Star, 
  Award, 
  Zap, 
  Flame, 
  Heart, 
  Clock, 
  Dumbbell, 
  Shield, 
  Crown, 
  Medal, 
  Rocket,
  LucideIcon
} from "lucide-react";

// Central mapping for all challenge icons
export const getChallengeIcon = (iconName: string): LucideIcon => {
  const iconMap: Record<string, LucideIcon> = {
    target: Target,
    trophy: Trophy,
    calendar: Calendar,
    check: CheckCircle,
    star: Star,
    award: Award,
    zap: Zap,
    flame: Flame,
    heart: Heart,
    clock: Clock,
    dumbbell: Dumbbell,
    shield: Shield,
    crown: Crown,
    medal: Medal,
    rocket: Rocket
  };

  return iconMap[iconName.toLowerCase()] || Target;
};

// Get icon name for display
export const getChallengeIconName = (iconName: string): string => {
  const nameMap: Record<string, string> = {
    target: "Ziel",
    trophy: "Pokal",
    calendar: "Kalender", 
    check: "Häkchen",
    star: "Stern",
    award: "Auszeichnung",
    zap: "Blitz",
    flame: "Flamme",
    heart: "Herz",
    clock: "Uhr",
    dumbbell: "Hantel",
    shield: "Schild",
    crown: "Krone",
    medal: "Medaille",
    rocket: "Rakete"
  };

  return nameMap[iconName.toLowerCase()] || "Ziel";
};