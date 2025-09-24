import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from 'next-themes';

interface GymSettings {
  id: string;
  gym_name: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  app_icon_url: string | null;
  primary_color: string;
  contact_email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  webhook_member_url: string | null;
  webhook_waitlist_url: string | null;
  webhook_reactivation_url: string | null;  
  show_functional_fitness_workouts?: boolean;
  show_bodybuilding_workouts?: boolean;
}

interface GymSettingsContextType {
  settings: GymSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: GymSettings = {
  id: '',
  gym_name: '',
  logo_light_url: null,
  logo_dark_url: null,
  app_icon_url: null,
  primary_color: '#52a7b4',
  contact_email: null,
  whatsapp_number: null,
  address: null,
  webhook_member_url: null,
  webhook_waitlist_url: null,
  webhook_reactivation_url: null,
  show_functional_fitness_workouts: true,
  show_bodybuilding_workouts: true,
};

const GymSettingsContext = createContext<GymSettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
});

export const useGymSettings = () => {
  const context = useContext(GymSettingsContext);
  if (!context) {
    throw new Error('useGymSettings must be used within a GymSettingsProvider');
  }
  return context;
};

export const GymSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('gym_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.warn('No gym settings found, using defaults');
        setSettings(defaultSettings);
      } else {
        const gymSettings: GymSettings = data;
        setSettings(gymSettings);
        
        // Apply primary color to CSS variables
        if (gymSettings.primary_color) {
          const root = document.documentElement;
          const hslColor = hexToHsl(gymSettings.primary_color);
          
          // Set primary color variables
          root.style.setProperty('--primary', hslColor);
          root.style.setProperty('--rise-accent', hslColor);
          root.style.setProperty('--ring', hslColor);
          root.style.setProperty('--accent', hslColor);
          
          // Set timer specific variables for both light and dark mode
          root.style.setProperty('--timer-input-border', hslColor);
          
          // Adjust lightness for primary-foreground (ensure good contrast)
          const [h, s, l] = hslColor.split(' ').map(val => parseFloat(val.replace('%', '')));
          const foregroundLightness = l > 50 ? '0%' : '100%'; // Dark text on light colors, light text on dark colors
          root.style.setProperty('--primary-foreground', `${h} ${s}% ${foregroundLightness}`);
          
          // Force update of dark mode specific variables
          const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const isDarkMode = document.documentElement.classList.contains('dark') || 
                           (!document.documentElement.classList.contains('light') && darkModeQuery.matches);
          
          if (isDarkMode) {
            // In dark mode, ensure timer input border uses the primary color
            root.style.setProperty('--timer-input-border', hslColor);
          }
        }

        // Update document title and favicon dynamically
        updateDocumentBranding(gymSettings);
        updateWebAppManifest(gymSettings);
      }
    } catch (error) {
      console.error('Error loading gym settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <GymSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </GymSettingsContext.Provider>
  );
};

// Helper function to convert hex to HSL
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Update document title and favicon
function updateDocumentBranding(settings: GymSettings) {
  // Update document title
  document.title = settings.gym_name;
  
  // Update favicon only if custom icon exists
  if (settings.app_icon_url) {
    updateFavicon(settings.app_icon_url);
  }
}

// Update favicon dynamically
function updateFavicon(iconUrl: string) {
  // Remove existing favicon
  const existingFavicon = document.querySelector('link[rel="icon"]');
  if (existingFavicon) {
    existingFavicon.remove();
  }

  // Add new favicon
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.href = iconUrl;
  favicon.type = 'image/png';
  document.head.appendChild(favicon);

  // Update apple touch icon
  const existingAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (existingAppleIcon) {
    existingAppleIcon.remove();
  }

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = iconUrl;
  document.head.appendChild(appleIcon);
}

// Update web app manifest dynamically
function updateWebAppManifest(settings: GymSettings) {
  const manifestContent = {
    name: settings.gym_name || 'BoxBase',
    short_name: settings.gym_name || 'BoxBase',
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: settings.primary_color,
    description: `${settings.gym_name || 'BoxBase'} - Fitness Management App`,
    icons: settings.app_icon_url ? [
      {
        src: settings.app_icon_url,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: settings.app_icon_url,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ] : []
  };

  // Remove existing manifest
  const existingManifest = document.querySelector('link[rel="manifest"]');
  if (existingManifest) {
    existingManifest.remove();
  }

  // Create new manifest as data URL
  const manifestBlob = new Blob([JSON.stringify(manifestContent)], { type: 'application/json' });
  const manifestUrl = URL.createObjectURL(manifestBlob);

  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = manifestUrl;
  document.head.appendChild(manifestLink);
}