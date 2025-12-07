import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Moon, Sun, Power, PowerOff, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

interface HeaderProps {
  isConnected: boolean;
  onToggleConnection: () => void;
}

export default function Header({ isConnected, onToggleConnection }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300 dark:bg-card/60 dark:border-white/5" data-testid="header">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        <div 
          className="flex items-center gap-3 group cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className={`relative p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg transition-all duration-300 ${isHovered ? 'scale-110 shadow-primary/30' : ''}`}>
            <Bot className="h-5 w-5 text-primary-foreground transition-transform duration-300 group-hover:rotate-12" />
            <div className={`absolute -top-1 -right-1 transition-all duration-300 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}>
              <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text transition-all duration-300">GX-MODY</h1>
              <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary border-0 dark:bg-primary/20">
                AI Bot
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">WhatsApp AI Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${isConnected ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-muted/50'}`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-xs font-medium hidden sm:block">
              {isConnected ? 'Online' : 'Offline'}
            </span>
          </div>
          
          <Button
            variant={isConnected ? "destructive" : "default"}
            size="sm"
            onClick={onToggleConnection}
            className={`transition-all duration-300 ${!isConnected ? "animate-glow-pulse btn-shadow" : ""}`}
            data-testid="button-toggle-connection"
          >
            {isConnected ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Disconnect</span>
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Connect</span>
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="transition-all duration-300 hover:scale-105"
            data-testid="button-toggle-theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-90" />
            ) : (
              <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
