import React from 'react';

// Badge image mapping - verwende korrekte Dateinamen aus Supabase Storage
const BADGE_IMAGE_MAP: Record<string, string> = {
  'power': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-power-start.png',
  'consistency': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/Badge-Consistency-King.png',
  'streak': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-streak-master.png',
  'early': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-rise-early.png',
  'sweat': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-7-days-of-sweat.png',
  'monday': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-never-miss-monday.png',
  'weekend': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-weekend-warrior.png',
  'midweek': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-midweek-motivation.png',
  'attendance': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-attendance-beast.png',
  'summer': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-early-summer-burn.png',
  'hattrick': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-triple-hattrick.png',
  'warrior': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-weekend-streak.png',
  'flame': 'https://vdpeyaphtsbrhygupfbc.supabase.co/storage/v1/object/public/challenge-badges/badge-power-start.png' // Temporary mapping for flame icon
};

interface BadgeImageProps {
  icon: string;
  alt: string;
  className?: string;
}

export const BadgeImage: React.FC<BadgeImageProps> = ({ icon, alt, className = "w-8 h-8" }) => {
  const imageSrc = BADGE_IMAGE_MAP[icon];
  
  if (!imageSrc) {
    // Fallback für unbekannte Icons - zeige Flamme Icon für flame
    if (icon === 'flame') {
      return (
        <div className={`${className} bg-orange-500 rounded-full flex items-center justify-center text-white`}>
          <span className="text-xs">🔥</span>
        </div>
      );
    }
    
    // Fallback zu einem default badge image oder icon
    return (
      <div className={`${className} bg-primary/10 rounded-full flex items-center justify-center`}>
        <span className="text-xs text-primary">🏆</span>
      </div>
    );
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt}
      className={`${className} object-contain`}
    />
  );
};

export const BADGE_ICONS_FOR_ADMIN = [
  { value: "power", label: "Power Start", image: BADGE_IMAGE_MAP.power },
  { value: "consistency", label: "Consistency King/Queen", image: BADGE_IMAGE_MAP.consistency },
  { value: "streak", label: "Streak Master", image: BADGE_IMAGE_MAP.streak },
  { value: "early", label: "Rise Early", image: BADGE_IMAGE_MAP.early },
  { value: "sweat", label: "7 Days of Sweat", image: BADGE_IMAGE_MAP.sweat },
  { value: "monday", label: "Never Miss Monday", image: BADGE_IMAGE_MAP.monday },
  { value: "weekend", label: "Weekend Warrior", image: BADGE_IMAGE_MAP.weekend },
  { value: "midweek", label: "Midweek Motivation", image: BADGE_IMAGE_MAP.midweek },
  { value: "attendance", label: "Attendance Beast", image: BADGE_IMAGE_MAP.attendance },
  { value: "summer", label: "Early Summer Burn", image: BADGE_IMAGE_MAP.summer },
  { value: "hattrick", label: "Triple Hattrick", image: BADGE_IMAGE_MAP.hattrick },
  { value: "warrior", label: "Weekend Streak", image: BADGE_IMAGE_MAP.warrior },
  { value: "flame", label: "Flame Challenge", image: BADGE_IMAGE_MAP.flame }
];