import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import ProVersion from "./pages/ProVersion";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import News from "./pages/News";
import NotFound from "./pages/NotFound";
import { StrengthValues } from "@/components/StrengthValues";
import { ExerciseSelection } from "@/components/ExerciseSelection";
import WorkoutManagement from "./pages/WorkoutManagement";
import { WorkoutStart } from "@/components/WorkoutStart";
import { AuthKeeper } from "@/components/AuthKeeper";

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthKeeper />
            {/* Globaler Wrapper mit iOS Safe Area Insets, plus Bottom-Navigation-Puffer */}
            <div
              className="min-h-screen bg-background flex flex-col"
              style={{
                paddingTop: "env(safe-area-inset-top)",
                // 4rem (~64px) als Puffer für die Bottom-Navigation + iOS Home Indicator
                paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem)",
              }}
            >
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pro" element={<ProVersion />} />
                <Route path="/pro/strength-values" element={<StrengthValues />} />
                <Route path="/pro/exercises" element={<ExerciseSelection />} />
                <Route path="/news" element={<News />} />
                <Route path="/workout-timer/start" element={<WorkoutStart />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/workouts" element={<WorkoutManagement />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;