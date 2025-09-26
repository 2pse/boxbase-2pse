import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Target, Plus, Trophy } from "lucide-react";
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

interface ChallengeDetailProps {
  challenge: Challenge | null;
  progress: ChallengeProgress | null;
  isOpen: boolean;
  onClose: () => void;
  onProgressUpdate: () => void;
}

export default function ChallengeDetail({ 
  challenge, 
  progress, 
  isOpen, 
  onClose, 
  onProgressUpdate 
}: ChallengeDetailProps) {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [localProgress, setLocalProgress] = useState<ChallengeProgress | null>(progress);

  useEffect(() => {
    setLocalProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (challenge && isOpen) {
      loadCheckpoints();
    }
  }, [challenge, isOpen]);

  const loadCheckpoints = async () => {
    if (!challenge) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('challenge_checkpoints')
        .select('*')
        .eq('challenge_id', challenge.id)
        .eq('user_id', userData.user.id)
        .order('checkpoint_number');

      if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
        throw error;
      }

      setCheckpoints(data || []);
    } catch (error) {
      console.error('Error loading checkpoints:', error);
    }
  };

  const addCheckpoint = async () => {
    if (!challenge || !localProgress) return;

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const nextCheckpointNumber = localProgress.completed_checkpoints + 1;

      // Update local state immediately for instant UI feedback
      const newCompletedCount = nextCheckpointNumber;
      const isCompleted = newCompletedCount >= challenge.checkpoint_count;
      
      setLocalProgress({
        ...localProgress,
        completed_checkpoints: newCompletedCount,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : localProgress.completed_at
      });

      // Add checkpoint
      const { error: checkpointError } = await supabase
        .from('challenge_checkpoints')
        .insert({
          user_id: userData.user.id,
          challenge_id: challenge.id,
          checkpoint_number: nextCheckpointNumber
        });

      if (checkpointError) throw checkpointError;

      // Update progress in database
      const { error: progressError } = await supabase
        .from('user_challenge_progress')
        .upsert({
          user_id: userData.user.id,
          challenge_id: challenge.id,
          completed_checkpoints: newCompletedCount,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null
        }, { onConflict: 'user_id,challenge_id' });

      if (progressError) throw progressError;

      // Award badge if challenge is completed
      if (isCompleted) {
        const { error: badgeError } = await supabase
          .from('user_badges')
          .insert({
            user_id: userData.user.id,
            challenge_id: challenge.id
          });

        if (badgeError && badgeError.code !== '23505') { // Ignore duplicate key error
          console.error('Error awarding badge:', badgeError);
        }

        toast.success('🏆 Challenge abgeschlossen! Badge erhalten!');
      } else {
        toast.success('Checkpoint added!');
      }

      loadCheckpoints();
      onProgressUpdate();
    } catch (error) {
      console.error('Error adding checkpoint:', error);
      toast.error('Error adding checkpoint');
      // Revert local state on error
      setLocalProgress(progress);
    } finally {
      setLoading(false);
    }
  };

  const initializeProgress = async () => {
    if (!challenge) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('user_challenge_progress')
        .insert({
          user_id: userData.user.id,
          challenge_id: challenge.id,
          completed_checkpoints: 0,
          is_completed: false
        });

      if (error) throw error;

      onProgressUpdate();
    } catch (error) {
      console.error('Error initializing progress:', error);
      toast.error('Fehler beim Initialisieren des Fortschritts');
    }
  };

  if (!challenge) return null;

  const getIconByName = (iconName: string) => {
    const IconComponent = getChallengeIcon(iconName);
    return <IconComponent className="w-10 h-10 text-primary-foreground" />;
  };

  const currentProgress = localProgress || progress;
  const progressPercentage = currentProgress 
    ? Math.min((currentProgress.completed_checkpoints / challenge.checkpoint_count) * 100, 100)
    : 0;

  const isCompleted = currentProgress?.is_completed || false;
  const canAddCheckpoint = currentProgress && currentProgress.completed_checkpoints < challenge.checkpoint_count && !isCompleted;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          {/* Challenge Icon */}
          <div className="mx-auto w-20 h-20 bg-primary rounded-lg flex items-center justify-center mb-4">
            {getIconByName(challenge.icon)}
          </div>
          
          <DialogTitle className="text-xl font-semibold">
            {challenge.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {challenge.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bonus Points */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-medium text-primary">
              {challenge.bonus_points} Bonus Points for the Leaderboard
            </span>
          </div>

          {/* Progress Section */}
          {currentProgress ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">
                Checkpoints ({currentProgress.completed_checkpoints}/{challenge.checkpoint_count})
              </h3>
              
              {/* Checkpoint Grid */}
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: challenge.checkpoint_count }, (_, index) => {
                  const checkpointNumber = index + 1;
                  const isCompleted = checkpointNumber <= currentProgress.completed_checkpoints;
                  const isNext = checkpointNumber === currentProgress.completed_checkpoints + 1 && !currentProgress.is_completed;
                  
                  return (
                    <div key={checkpointNumber} className="flex justify-center">
                      <button
                        onClick={() => isNext ? addCheckpoint() : undefined}
                        disabled={loading || !isNext}
                        className={`
                          w-12 h-12 rounded-lg flex items-center justify-center font-semibold text-sm transition-all
                          ${isCompleted 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : isNext
                            ? 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer' 
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                          }
                          ${isNext && !loading ? 'hover:scale-105' : ''}
                        `}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          checkpointNumber
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Completion Message */}
              {isCompleted && (
                <div className="text-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-primary">
                    Glückwunsch! Challenge abgeschlossen!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Du hast {challenge.bonus_points} Bonus-Punkte erhalten.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-6 border border-dashed rounded-lg">
              <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Challenge starten</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Beginnen Sie mit dieser Challenge und verfolgen Sie Ihren Fortschritt.
              </p>
              <Button 
                onClick={initializeProgress}
                style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                Challenge beitreten
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}