import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash, Target } from "lucide-react";
import { getChallengeIcon } from "@/utils/challengeIcons";
import { BadgeSelector } from "./BadgeSelector";
import { BadgeUpload } from "./BadgeUpload";

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
  is_recurring: boolean;
  is_archived: boolean;
  created_at: string;
}

export default function AdminChallengeManager() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    checkpoint_count: 12,
    bonus_points: 10,
    icon: "target",
    is_primary: false,
    is_recurring: false
  });

  // Removed iconOptions as it's now handled by BadgeSelector

  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_challenges')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setChallenges(data || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
      toast.error('Fehler beim Laden der Challenges');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Nicht angemeldet');
        return;
      }

      const { error } = await supabase
        .from('monthly_challenges')
        .insert({
          ...formData,
          created_by: userData.user.id
        });

      if (error) throw error;

      toast.success('Challenge erfolgreich erstellt');
      setShowCreateDialog(false);
      resetForm();
      loadChallenges();
    } catch (error) {
      console.error('Error creating challenge:', error);
      toast.error('Fehler beim Erstellen der Challenge');
    }
  };

  const handleUpdateChallenge = async () => {
    if (!editingChallenge) return;

    try {
      const { error } = await supabase
        .from('monthly_challenges')
        .update(formData)
        .eq('id', editingChallenge.id);

      if (error) throw error;

      toast.success('Challenge erfolgreich aktualisiert');
      setEditingChallenge(null);
      resetForm();
      loadChallenges();
    } catch (error) {
      console.error('Error updating challenge:', error);
      toast.error('Fehler beim Aktualisieren der Challenge');
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!confirm('Challenge wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('monthly_challenges')
        .delete()
        .eq('id', challengeId);

      if (error) throw error;

      toast.success('Challenge gelöscht');
      loadChallenges();
    } catch (error) {
      console.error('Error deleting challenge:', error);
      toast.error('Fehler beim Löschen der Challenge');
    }
  };

  const handleArchiveChallenge = async (challengeId: string, archived: boolean) => {
    try {
      const { error } = await supabase
        .from('monthly_challenges')
        .update({ is_archived: archived })
        .eq('id', challengeId);

      if (error) throw error;

      toast.success(archived ? 'Challenge archiviert' : 'Challenge reaktiviert');
      loadChallenges();
    } catch (error) {
      console.error('Error archiving challenge:', error);
      toast.error('Fehler beim Archivieren');
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      checkpoint_count: 12,
      bonus_points: 10,
      icon: "target",
      is_primary: false,
      is_recurring: false
    });
  };

  const openEditDialog = (challenge: Challenge) => {
    setFormData({
      title: challenge.title,
      description: challenge.description,
      year: challenge.year,
      month: challenge.month,
      checkpoint_count: challenge.checkpoint_count,
      bonus_points: challenge.bonus_points,
      icon: challenge.icon,
      is_primary: challenge.is_primary,
      is_recurring: challenge.is_recurring
    });
    setEditingChallenge(challenge);
  };

  if (loading) {
    return <div className="p-6">Lädt Challenges...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Challenges</h2>
        <p className="text-muted-foreground">Erstelle und verwalte monatliche Fitness-Challenges</p>
      </div>
      
      <Tabs defaultValue="challenges" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="challenges">Challenges verwalten</TabsTrigger>
          <TabsTrigger value="badges">Badges verwalten</TabsTrigger>
        </TabsList>
        
        <TabsContent value="challenges" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold">Monats-Challenges</h3>
              <p className="text-muted-foreground">
                Verwalten Sie monatliche Fitness-Challenges für Ihre Mitglieder
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Challenge erstellen
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {challenges.map((challenge) => (
              <Card key={challenge.id} className={challenge.is_archived ? "opacity-50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {challenge.icon.startsWith('http') ? (
                        <img src={challenge.icon} alt="Challenge badge" className="w-5 h-5 object-cover rounded" />
                      ) : (
                        (() => {
                          const IconComponent = getChallengeIcon(challenge.icon);
                          return <IconComponent className="w-5 h-5" />;
                        })()
                      )}
                      <CardTitle className="text-lg">{challenge.title}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      {challenge.is_primary && (
                        <Badge variant="default">Primär</Badge>
                      )}
                      {challenge.is_recurring && (
                        <Badge variant="secondary">Wiederkehrend</Badge>
                      )}
                      {challenge.is_archived && (
                        <Badge variant="destructive">Archiviert</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {challenge.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <span className="font-medium">Monat:</span>
                      <br />
                      {monthNames[challenge.month - 1]} {challenge.year}
                    </div>
                    <div>
                      <span className="font-medium">Checkpoints:</span>
                      <br />
                      {challenge.checkpoint_count}
                    </div>
                    <div>
                      <span className="font-medium">Bonus Punkte:</span>
                      <br />
                      {challenge.bonus_points}
                    </div>
                    <div>
                      <span className="font-medium">Badge:</span>
                      <br />
                      <div className="flex items-center gap-1">
                        {challenge.icon.startsWith('http') ? (
                          <img src={challenge.icon} alt="Challenge badge" className="w-4 h-4 object-cover rounded" />
                        ) : (
                          (() => {
                            const IconComponent = getChallengeIcon(challenge.icon);
                            return <IconComponent className="w-4 h-4" />;
                          })()
                        )}
                        <span className="text-xs">
                          {challenge.icon.startsWith('http') ? 'Eigenes Badge' : challenge.icon}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(challenge)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveChallenge(challenge.id, !challenge.is_archived)}
                    >
                      {challenge.is_archived ? "Reaktivieren" : "Archivieren"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteChallenge(challenge.id)}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="badges" className="space-y-6">
          <BadgeUpload onBadgeUploaded={() => {
            // Reload challenges to reflect any badge changes
            loadChallenges();
          }} />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingChallenge} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingChallenge(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingChallenge ? 'Challenge bearbeiten' : 'Neue Challenge erstellen'}
            </DialogTitle>
            <DialogDescription>
              Erstellen Sie eine neue monatliche Challenge für Ihre Mitglieder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Challenge Titel"
              />
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Challenge Beschreibung"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Jahr</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="month">Monat</Label>
                <Select value={formData.month.toString()} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, month: parseInt(value) }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkpoints">Checkpoints</Label>
                <Input
                  id="checkpoints"
                  type="number"
                  value={formData.checkpoint_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkpoint_count: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label htmlFor="bonus">Bonus Punkte</Label>
                <Input
                  id="bonus"
                  type="number"
                  value={formData.bonus_points}
                  onChange={(e) => setFormData(prev => ({ ...prev, bonus_points: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <BadgeSelector
              selectedIcon={formData.icon}
              onIconSelect={(icon) => setFormData(prev => ({ ...prev, icon }))}
              className="space-y-2"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingChallenge(null);
                resetForm();
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={editingChallenge ? handleUpdateChallenge : handleCreateChallenge}>
              {editingChallenge ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}