import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Moon, Sun, Power, PowerOff } from "lucide-react";
import { useState, useEffect } from "react";

interface HeaderProps {
  isConnected: boolean;
  onToggleConnection: () => void;
}

export default function Header({ isConnected, onToggleConnection }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

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
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="header">
      <div className="container flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg">GX-MODY</h1>
            <Badge variant="secondary" className="text-xs">
              AI Bot
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isConnected ? "destructive" : "default"}
            size="sm"
            onClick={onToggleConnection}
            data-testid="button-toggle-connection"
          >
            {isConnected ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Disconnect
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Connect
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-toggle-theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
