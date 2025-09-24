import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';

// Optimized hook for paginated members
export const usePaginatedMembers = (pageSize: number = 50) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const queryKey = ['members', currentPage, pageSize, searchTerm];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const offset = (currentPage - 1) * pageSize;
      
      let query = supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, nickname, membership_type')
        .not('user_id', 'is', null)
        .range(offset, offset + pageSize - 1)
        .order('display_name');

      if (searchTerm) {
        query = query.or(`display_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        members: data || [],
        totalCount: count || 0,
        hasMore: offset + pageSize < (count || 0)
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const nextPage = () => {
    if (query.data?.hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const resetSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  return {
    ...query,
    members: query.data?.members || [],
    totalCount: query.data?.totalCount || 0,
    hasMore: query.data?.hasMore || false,
    currentPage,
    pageSize,
    searchTerm,
    setSearchTerm,
    nextPage,
    prevPage,
    resetSearch,
    setPage: setCurrentPage
  };
};

// Optimized hook for leaderboard with pagination
export const useLeaderboardQuery = (limit: number = 100) => {
  const query = useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: async () => {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Get leaderboard entries for current month
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard_entries')
        .select('user_id, training_count, challenge_bonus_points')
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .limit(limit);

      if (leaderboardError) throw leaderboardError;

      if (!leaderboardData?.length) {
        return [];
      }

      // Get user profiles for the leaderboard users
      const userIds = leaderboardData.map(entry => entry.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Get challenge progress for current month
      const { data: challengeProgressData, error: challengeError } = await supabase
        .from('user_challenge_progress')
        .select('user_id, is_completed')
        .in('user_id', userIds)
        .eq('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`);

      if (challengeError) console.warn('Challenge progress error:', challengeError);

      // Combine data and calculate total scores
      const leaderboardEntries = leaderboardData.map(entry => {
        const profile = profilesData?.find(p => p.user_id === entry.user_id);
        const challengeProgress = challengeProgressData?.find(cp => cp.user_id === entry.user_id);
        
        return {
          user_id: entry.user_id,
          training_count: entry.training_count,
          bonus_points: entry.challenge_bonus_points || 0,
          display_name: profile?.display_name || 'Unbekannt',
          avatar_url: profile?.avatar_url,
          total_score: entry.training_count + (entry.challenge_bonus_points || 0),
          hasCompletedChallenge: challengeProgress?.is_completed || false,
          month: currentMonth,
          year: currentYear
        };
      }).sort((a, b) => b.total_score - a.total_score);

      return leaderboardEntries;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return query;
};

// Optimized hook for course registrations with pagination
export const useCourseRegistrations = (courseId: string, pageSize: number = 50) => {
  const [currentPage, setCurrentPage] = useState(1);

  const query = useQuery({
    queryKey: ['course-registrations', courseId, currentPage, pageSize],
    queryFn: async () => {
      const offset = (currentPage - 1) * pageSize;

      const { data, error, count } = await supabase
        .from('course_registrations')
        .select(`
          user_id,
          status,
          registered_at,
          profiles:user_id (
            display_name,
            first_name,
            last_name,
            avatar_url,
            membership_type
          )
        `, { count: 'exact' })
        .eq('course_id', courseId)
        .neq('status', 'cancelled')
        .range(offset, offset + pageSize - 1)
        .order('registered_at');

      if (error) throw error;

      return {
        registrations: data || [],
        totalCount: count || 0,
        hasMore: offset + pageSize < (count || 0)
      };
    },
    enabled: !!courseId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
  });

  return {
    ...query,
    registrations: query.data?.registrations || [],
    totalCount: query.data?.totalCount || 0,
    hasMore: query.data?.hasMore || false,
    currentPage,
    pageSize,
    setPage: setCurrentPage
  };
};

// Generic optimized query hook with caching
export const useOptimizedQuery = <T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    gcTime?: number;
    enabled?: boolean;
  }
) => {
  return useQuery({
    queryKey: key,
    queryFn,
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes default
    gcTime: options?.gcTime || 10 * 60 * 1000, // 10 minutes default
    enabled: options?.enabled !== false,
  });
};