import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export const ScrollToTop = () => {
  const location = useLocation()

  useEffect(() => {
    // Always scroll to top on route changes, except for the main dashboard overview
    // The main dashboard tab switching will be handled separately
    if (location.pathname !== '/pro') {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      })
    }
  }, [location.pathname])

  return null
}