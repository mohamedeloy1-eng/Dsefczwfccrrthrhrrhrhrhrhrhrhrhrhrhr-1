import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  return null;
}

function BackgroundInitializer() {
  useEffect(() => {
    const savedBackground = localStorage.getItem('app-background');
    if (savedBackground) {
      const root = document.documentElement;
      root.style.setProperty('--app-background-image', `url(${savedBackground})`);
      document.body.classList.add('has-background-image');
    }
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInitializer />
        <BackgroundInitializer />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
