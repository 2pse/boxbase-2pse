import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const AdminSetup = () => {
  const [loading, setLoading] = useState(false);
  const [adminCreated, setAdminCreated] = useState(false);

  const createAdminUser = async () => {
    setLoading(true);
    try {
      console.log('Calling create-admin edge function...');
      
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email: 'fitness@app.com',
          password: '2025'
        }
      });

      console.log('Response:', { data, error });

      if (error) {
        console.error('Error from edge function:', error);
        toast.error(`Fehler beim Erstellen des Admin-Users: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success("Admin-User erfolgreich erstellt!");
        setAdminCreated(true);
      } else {
        toast.error("Fehler beim Erstellen des Admin-Users");
      }
    } catch (err) {
      console.error('Network error:', err);
      toast.error(`Netzwerkfehler: ${err.message}`);
    }
    setLoading(false);
  };

  if (adminCreated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-green-600">✓ Admin-User erstellt</CardTitle>
          <CardDescription>
            Der Admin-User wurde erfolgreich erstellt:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> fitness@app.com</p>
            <p><strong>Passwort:</strong> 2025</p>
          </div>
          
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
          >
            Jetzt einloggen
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Klicken Sie auf "Jetzt einloggen" um sich mit den obigen Daten anzumelden.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Admin-User erstellen</CardTitle>
        <CardDescription>
          Erstellen Sie zuerst einen Admin-User für die Verwaltung der App.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={createAdminUser} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Erstelle Admin-User..." : "Admin-User erstellen"}
        </Button>
        
        <div className="mt-4 text-xs text-muted-foreground">
          <p><strong>Email:</strong> fitness@app.com</p>
          <p><strong>Passwort:</strong> 2025</p>
        </div>
      </CardContent>
    </Card>
  );
};