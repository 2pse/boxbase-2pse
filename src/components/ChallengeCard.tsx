import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Target } from "lucide-react";
import { getChallengeIcon } from "@/utils/challengeIcons";

interface Challenge {
  id: string;
  title: string;
  description: string;
  year: number;
  month: number;
  checkpoint_count: number;
  bonus_points: number;
  icon: string;
  is_primary: boolean;
}

interface ChallengeProgress {
  id: string;
  user_id: string;
  challenge_id: string;
  completed_checkpoints: number;
  is_completed: boolean;
  completed_at?: string;
}

interface ChallengeCardProps {
  onOpenChallenge: (challenge: Challenge, progress: ChallengeProgress | null) => void;
}

export default function ChallengeCard({ onOpenChallenge }: ChallengeCardProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userProgress, setUserProgress] = useState<ChallengeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentChallenges();
  }, []);

  const loadCurrentChallenges = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Load current month's challenges
      const { data: challengesData, error: challengesError } = await supabase
        .from('monthly_challenges')
        .select('*')
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .eq('is_archived', false)
        .order('is_primary', { ascending: false });

      if (challengesError) throw challengesError;

      // Load user progress for these challenges
      const challengeIds = challengesData?.map(c => c.id) || [];
      if (challengeIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase
          .from('user_challenge_progress')
          .select('*')
          .eq('user_id', userData.user.id)
          .in('challenge_id', challengeIds);

        if (progressError) throw progressError;
        setUserProgress(progressData || []);
      }

      setChallenges(challengesData || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast.error('Error loading challenges');
    } finally {
      setLoading(false);
    }
  };

  const getProgressForChallenge = (challengeId: string): ChallengeProgress | null => {
    return userProgress.find(p => p.challenge_id === challengeId) || null;
  };

  const getProgressPercentage = (challenge: Challenge, progress: ChallengeProgress | null): number => {
    if (!progress) return 0;
    return Math.min((progress.completed_checkpoints / challenge.checkpoint_count) * 100, 100);
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = getChallengeIcon(iconName);
    return <IconComponent className="w-6 h-6" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Lädt Challenges...</div>
        </CardContent>
      </Card>
    );
  }

  if (challenges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Monats-Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center">
            Currently no challenges available for this month.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {challenges.map((challenge) => {
        const progress = getProgressForChallenge(challenge.id);
        const percentage = getProgressPercentage(challenge, progress);
        const isCompleted = progress?.is_completed || false;

        return (
          <Card 
            key={challenge.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onOpenChallenge(challenge, progress)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {getIconComponent(challenge.icon)}
                  <div>
                    <CardTitle className="text-lg">{challenge.title}</CardTitle>
                    <CardDescription>{challenge.description}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {challenge.is_primary && (
                    <Badge variant="default">Haupt-Challenge</Badge>
                  )}
                  {isCompleted && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Abgeschlossen
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Fortschritt</span>
                  <span>
                    {progress?.completed_checkpoints || 0} / {challenge.checkpoint_count}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Bonus: {challenge.bonus_points} Punkte
                  </span>
                  {isCompleted && (
                    <span className="text-green-600 font-medium">
                      ✓ Bonus erhalten!
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}