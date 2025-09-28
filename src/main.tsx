import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from "next-themes"
import { GymSettingsProvider } from "./contexts/GymSettingsContext"

// Set document language for browser validation messages
document.documentElement.lang = 'en';

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <GymSettingsProvider>
      <App />
    </GymSettingsProvider>
  </ThemeProvider>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('SW registration failed:', err)
    })
  })
}

