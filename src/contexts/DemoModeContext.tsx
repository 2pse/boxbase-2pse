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
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Check URL parameter on mount and when params change
    const demoParam = searchParams.get('demoMode')
    if (demoParam === 'true') {
      setIsDemoMode(true)
      // Persist to sessionStorage so it survives navigation
      sessionStorage.setItem('demoMode', 'true')
    } else {
      // Check sessionStorage for persisted demo mode
      const stored = sessionStorage.getItem('demoMode')
      setIsDemoMode(stored === 'true')
    }
  }, [searchParams])

  return (
    <DemoModeContext.Provider value={{ isDemoMode }}>
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1 text-sm font-medium">
          🎮 Demo Mode - Changes will not be saved
        </div>
      )}
      <div className={isDemoMode ? 'pt-8' : ''}>
        {children}
      </div>
    </DemoModeContext.Provider>
  )
}
