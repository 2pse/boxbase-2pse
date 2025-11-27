import { supabase } from "@/integrations/supabase/client"

// Cache for plan colors
let planColorsCache: Map<string, string> | null = null
let lastCacheUpdate: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Loads all active membership plan colors from the database
 * @returns Map<planName, hexColor>
 */
export const loadMembershipPlanColors = async (): Promise<Map<string, string>> => {
  // Cache check
  if (planColorsCache && Date.now() - lastCacheUpdate < CACHE_DURATION) {
    return planColorsCache
  }

  try {
    const { data, error } = await supabase
      .from('membership_plans_v2')
      .select('name, color')
      .eq('is_active', true)
    
    if (error) throw error
    
    const colorMap = new Map<string, string>()
    data?.forEach(plan => {
      colorMap.set(plan.name, plan.color || '#52a7b4') // Fallback to primary
    })
    
    planColorsCache = colorMap
    lastCacheUpdate = Date.now()
    
    return colorMap
  } catch (error) {
    console.error('Error loading membership plan colors:', error)
    return new Map()
  }
}

/**
 * Returns the color for a specific plan name
 */
export const getMembershipColor = (planName: string | null | undefined, colorMap: Map<string, string>): string => {
  if (!planName) return '#52a7b4' // Default primary color
  return colorMap.get(planName) || '#52a7b4'
}

/**
 * Invalidate cache (e.g., after plan update)
 */
export const invalidateMembershipColorCache = () => {
  planColorsCache = null
  lastCacheUpdate = 0
}
