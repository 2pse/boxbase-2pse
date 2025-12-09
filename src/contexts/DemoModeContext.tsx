import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

interface DemoModeContextType {
  isDemoMode: boolean
}

const DemoModeContext = createContext<DemoModeContextType>({ isDemoMode: false })

export const useDemoMode = () => useContext(DemoModeContext)

interface DemoModeProviderProps {
  children: ReactNode
}

export const DemoModeProvider: React.FC<DemoModeProviderProps> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [bannerOffset, setBannerOffset] = useState(0)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Check URL parameter on mount and when params change
    const demoParam = searchParams.get('demoMode')
    const offsetParam = searchParams.get('bannerOffset')
    
    if (demoParam === 'true') {
      setIsDemoMode(true)
      // Persist to sessionStorage so it survives navigation
      sessionStorage.setItem('demoMode', 'true')
    } else {
      // Check sessionStorage for persisted demo mode
      const stored = sessionStorage.getItem('demoMode')
      setIsDemoMode(stored === 'true')
    }

    // Set banner offset from URL parameter (for smartphone notch)
    if (offsetParam) {
      const offset = parseInt(offsetParam, 10)
      if (!isNaN(offset)) {
        setBannerOffset(offset)
        sessionStorage.setItem('bannerOffset', offsetParam)
      }
    } else {
      // Check sessionStorage for persisted offset
      const storedOffset = sessionStorage.getItem('bannerOffset')
      if (storedOffset) {
        const offset = parseInt(storedOffset, 10)
        if (!isNaN(offset)) {
          setBannerOffset(offset)
        }
      }
    }
  }, [searchParams])

  // Calculate total top padding needed (banner height ~32px + offset)
  const bannerHeight = 32
  const totalTopPadding = bannerHeight + bannerOffset

  return (
    <DemoModeContext.Provider value={{ isDemoMode }}>
      {isDemoMode && (
        <div 
          className="fixed left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1 text-sm font-medium"
          style={{ top: bannerOffset }}
        >
          Demo Mode - Changes will not be saved
        </div>
      )}
      <div style={{ paddingTop: isDemoMode ? totalTopPadding : 0 }}>
        {children}
      </div>
    </DemoModeContext.Provider>
  )
}
