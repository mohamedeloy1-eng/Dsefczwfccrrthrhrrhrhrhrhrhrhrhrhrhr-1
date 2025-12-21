import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Moon, Sun, Power, PowerOff, Sparkles, Zap, Ticket } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

interface HeaderProps {
  isConnected: boolean;
  onToggleConnection: () => void;
}

export default function Header({ isConnected, onToggleConnection }: HeaderProps) {
  const [isDark, setIsDark] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDarkMode = savedTheme === 'dark' || (!savedTheme && true);
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300 dark:bg-card/40 dark:border-primary/10 dark:shadow-[0_4px_30px_rgba(139,92,246,0.1)]" data-testid="header">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div 
              className="flex items-center gap-3 group cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className={`relative p-2.5 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-blue-500 shadow-lg transition-all duration-500 ${isHovered ? 'scale-110 shadow-primary/40 shadow-[0_0_25px_rgba(139,92,246,0.5)]' : 'shadow-primary/20'}`}>
                <Bot className="h-5 w-5 text-primary-foreground transition-transform duration-300 group-hover:rotate-12" />
                <div className={`absolute -top-1 -right-1 transition-all duration-300 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}>
                  <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-xl bg-gradient-to-r from-primary via-purple-400 to-blue-400 bg-clip-text text-transparent transition-all duration-300">GX-MODY</h1>
                  <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 bg-gradient-to-r from-primary/20 to-blue-500/20 text-primary border border-primary/20 dark:border-primary/30">
                    <Zap className="h-3 w-3 ml-1" />
                    AI Bot
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">مساعد واتساب الذكي</span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link href="/support">
              <Button 
                variant={location === '/support' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="gap-2"
              >
                <Ticket className="h-4 w-4" />
                <span>تذاكر الدعم</span>
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 border ${isConnected ? 'bg-green-500/10 border-green-500/30 dark:bg-green-500/15 dark:shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-muted/50 border-muted'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-xs font-medium hidden sm:block">
              {isConnected ? 'متصل' : 'غير متصل'}
            </span>
          </div>
          
          <Button
            variant={isConnected ? "destructive" : "default"}
            size="sm"
            onClick={onToggleConnection}
            className={`transition-all duration-300 ${!isConnected ? "btn-neon dark:shadow-[0_0_20px_rgba(139,92,246,0.3)] dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]" : "dark:shadow-[0_0_15px_rgba(239,68,68,0.3)]"}`}
            data-testid="button-toggle-connection"
          >
            {isConnected ? (
              <>
                <PowerOff className="h-4 w-4 ml-2" />
                <span className="hidden sm:inline">قطع الاتصال</span>
              </>
            ) : (
              <>
                <Power className="h-4 w-4 ml-2" />
                <span className="hidden sm:inline">اتصال</span>
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="transition-all duration-300 hover:scale-105 dark:hover:bg-primary/10 dark:hover:text-primary"
            data-testid="button-toggle-theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-90 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
