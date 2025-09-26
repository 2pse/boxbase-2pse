import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  Users, 
  Calendar, 
  DollarSign, 
  Activity, 
  Newspaper,
  Database,
  FileSpreadsheet,
  FileJson,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  tables: string[];
}


const exportOptions: ExportOption[] = [
  {
    id: 'members',
    title: 'All Members',
    description: 'Profiles, contact data, memberships, access codes, passwords',
    icon: Users,
    tables: ['profiles', 'user_memberships_v2', 'user_roles', 'auth.users']
  },
  {
    id: 'courses',
    title: 'Courses & Bookings',
    description: 'Courses, registrations, cancellations, waitlists, course templates',
    icon: Calendar,
    tables: ['courses', 'course_registrations', 'course_templates', 'waitlist_promotion_events']
  },
  {
    id: 'finance',
    title: 'Financial Data',
    description: 'Membership plans, revenue history, billing data',
    icon: DollarSign,
    tables: ['membership_plans_v2', 'revenue_history']
  },
  {
    id: 'training',
    title: 'Training & Challenges',
    description: 'Training sessions, challenge progress, badges, leaderboard',
    icon: Activity,
    tables: ['training_sessions', 'user_challenge_progress', 'challenge_checkpoints', 'user_badges', 'monthly_challenges', 'leaderboard_entries']
  },
  {
    id: 'content',
    title: 'Content & Workouts',
    description: 'News, Crossfit workouts, bodybuilding workouts',
    icon: Newspaper,
    tables: ['news', 'user_read_news', 'crossfit_workouts', 'bodybuilding_workouts']
  },
  {
    id: 'settings',
    title: 'Settings & Webhooks',
    description: 'Gym settings, webhook events, reactivation events',
    icon: Database,
    tables: ['gym_settings', 'reactivation_webhook_events']
  },
  {
    id: 'full',
    title: 'Complete Export',
    description: 'All data from the entire database (including sensitive data)',
    icon: Database,
    tables: ['all']
  }
];

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async (exportType: string) => {
    if (isExporting) return;

    setIsExporting(true);
    setExportingType(exportType);
    setExportProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('data-export', {
        body: {
          export_type: exportType,
          include_sensitive: true // Include passwords, tokens, etc.
        }
      });

      clearInterval(progressInterval);
      setExportProgress(100);

      if (error) {
        throw error;
      }

      if (data?.success && data?.csv_files) {
        // Download each CSV file separately
        for (const file of data.csv_files) {
          const link = document.createElement('a');
          link.href = file.download_url;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        toast({
          title: "CSV Export Successful",
          description: `${data.tables_exported} separate CSV files downloaded`,
          variant: "default",
        });
      } else {
        throw new Error(data?.error ||'Unknown export error');
      }

    } catch (error: any) {
      console.error('Export error:', error);

      toast({
        title: "Export Failed",
        description: error.message || "Error exporting data",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportingType(null);
      setExportProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Export</h2>
          <p className="text-muted-foreground">
            Export all data as separate CSV files for backup or analysis
          </p>
        </div>
      </div>

      {/* Export Progress */}
      {isExporting && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Exporting {exportOptions.find(o => o.id === exportingType)?.title}...
                </span>
                <span className="text-sm text-muted-foreground">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exportOptions.map((option) => {
          const IconComponent = option.icon;
          const isCurrentlyExporting = isExporting && exportingType === option.id;
          
          return (
            <Card key={option.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{option.title}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {option.tables.length === 1 && option.tables[0] === 'all' 
                        ? 'All Tables' 
                        : `${option.tables.length} Tables`}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {option.tables.slice(0, 3).map((table) => (
                    <Badge key={table} variant="outline" className="text-xs">
                      {table}
                    </Badge>
                  ))}
                  {option.tables.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{option.tables.length - 3} more
                    </Badge>
                  )}
                </div>
                <Button 
                  onClick={() => handleExport(option.id)}
                  disabled={isExporting}
                  className="w-full"
                  variant={option.id === 'full' ? 'default' : 'outline'}
                >
                  {isCurrentlyExporting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      CSV Export
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Backup & Restore */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-primary">Backup & Restore</h3>
              <p className="text-sm text-primary/80 mt-1">
                CSV files can be imported via Table Editor → Import CSV in Supabase
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}