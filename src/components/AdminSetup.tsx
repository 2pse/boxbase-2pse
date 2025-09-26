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
        toast.error(`Error creating admin user: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success("Admin user successfully created!");
        setAdminCreated(true);
      } else {
        toast.error("Error creating admin user");
      }
    } catch (err) {
      console.error('Network error:', err);
      toast.error(`Network error: ${err.message}`);
    }
    setLoading(false);
  };

  if (adminCreated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-green-600">✓ Admin User Created</CardTitle>
          <CardDescription>
            The admin user has been successfully created:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> fitness@app.com</p>
            <p><strong>Password:</strong> 2025</p>
          </div>
          
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
          >
            Login Now
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Click "Login Now" to sign in with the credentials above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Admin User</CardTitle>
        <CardDescription>
          First create an admin user for managing the app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={createAdminUser} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Creating Admin User..." : "Create Admin User"}
        </Button>
        
        <div className="mt-4 text-xs text-muted-foreground">
          <p><strong>Email:</strong> fitness@app.com</p>
          <p><strong>Password:</strong> 2025</p>
        </div>
      </CardContent>
    </Card>
  );
};