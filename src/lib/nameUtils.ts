import { Database } from '@/integrations/supabase/types';

type ProfileData = {
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  display_name?: string | null;
};

export function getDisplayName(
  profile: ProfileData,
  currentUserRole?: 'admin' | 'trainer' | 'member' | null,
  isOwnProfile?: boolean
): string {
  // For own profile or admin/trainer viewing, show full information available
  if (isOwnProfile || currentUserRole === 'admin' || currentUserRole === 'trainer') {
    // Prefer first_name + last_name if both available
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    // Fall back to first_name only
    if (profile.first_name) {
      return profile.first_name;
    }
    // Fall back to display_name
    if (profile.display_name) {
      return profile.display_name;
    }
  } else {
    // For regular members viewing others, show nickname or first_name only
    if (profile.nickname) {
      return profile.nickname;
    }
    if (profile.first_name) {
      return profile.first_name;
    }
    // Fall back to display_name
    if (profile.display_name) {
      return profile.display_name;
    }
  }

  return 'Unbekannt';
}

export function getShortDisplayName(profile: ProfileData): string {
  // Always prefer nickname for short display
  if (profile.nickname) {
    return profile.nickname;
  }
  // Then first_name
  if (profile.first_name) {
    return profile.first_name;
  }
  // Fall back to display_name
  if (profile.display_name) {
    return profile.display_name;
  }
  return 'Unbekannt';
}

export function getInitials(profile: ProfileData): string {
  if (profile.first_name && profile.last_name) {
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  }
  if (profile.first_name) {
    const names = profile.first_name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return profile.first_name.substring(0, 2).toUpperCase();
  }
  if (profile.display_name) {
    const names = profile.display_name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return profile.display_name.substring(0, 2).toUpperCase();
  }
  if (profile.nickname) {
    return profile.nickname.substring(0, 2).toUpperCase();
  }
  return 'UK'; // Unknown
}