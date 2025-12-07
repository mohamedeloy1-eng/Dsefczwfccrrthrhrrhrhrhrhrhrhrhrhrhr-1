import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Bot, MessageSquare, Users, Phone, RefreshCw, TrendingUp } from "lucide-react";

interface StatusCardProps {
  status: "connected" | "disconnected" | "connecting" | "reconnecting";
  messagesCount: number;
  usersCount: number;
  connectedNumber?: string | null;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
}

export default function StatusCard({ status, messagesCount, usersCount, connectedNumber, reconnectAttempt, maxReconnectAttempts }: StatusCardProps) {
  const statusConfig = {
    connected: {
      icon: Wifi,
      label: "متصل",
      color: "bg-green-500",
      badgeVariant: "default" as const,
      glowColor: "shadow-green-500/20",
      bgGradient: "from-green-500/10 to-transparent",
    },
    disconnected: {
      icon: WifiOff,
      label: "غير متصل",
      color: "bg-red-500",
      badgeVariant: "destructive" as const,
      glowColor: "shadow-red-500/20",
      bgGradient: "from-red-500/5 to-transparent",
    },
    connecting: {
      icon: Wifi,
      label: "جاري الاتصال...",
      color: "bg-yellow-500",
      badgeVariant: "secondary" as const,
      glowColor: "shadow-yellow-500/20",
      bgGradient: "from-yellow-500/10 to-transparent",
    },
    reconnecting: {
      icon: RefreshCw,
      label: reconnectAttempt && maxReconnectAttempts 
        ? `إعادة الاتصال (${reconnectAttempt}/${maxReconnectAttempts})`
        : "إعادة الاتصال...",
      color: "bg-orange-500",
      badgeVariant: "secondary" as const,
      glowColor: "shadow-orange-500/20",
      bgGradient: "from-orange-500/10 to-transparent",
    },
  };

  const config = statusConfig[status];

  const formatPhoneNumber = (number: string) => {
    if (number.length > 10) {
      return `+${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
    }
    return `+${number}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="status-cards">
      <Card className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:bg-card/60 dark:backdrop-blur-md dark:border-white/5 ${config.glowColor} stagger-1`} data-testid="card-bot-status">
        <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} pointer-events-none`} />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${status === 'connected' ? 'bg-gradient-to-br from-primary/20 to-primary/5' : 'bg-muted'} transition-all duration-300`}>
                <Bot className={`h-5 w-5 text-primary transition-transform duration-300 ${status === 'connected' ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Bot Status</p>
                <p className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">GX-MODY</p>
              </div>
            </div>
            <Badge variant={config.badgeVariant} className="gap-1.5 px-2.5 py-1" data-testid="badge-status">
              <span className={`h-2 w-2 rounded-full ${config.color} ${status === 'connecting' || status === 'reconnecting' ? 'animate-pulse' : ''}`} />
              <span className="text-xs">{config.label}</span>
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:bg-card/60 dark:backdrop-blur-md dark:border-white/5 stagger-2" data-testid="card-connected-number">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${connectedNumber ? 'bg-gradient-to-br from-blue-500/20 to-blue-500/5' : 'bg-muted'} transition-all duration-300`}>
              <Phone className={`h-5 w-5 ${connectedNumber ? 'text-blue-500' : 'text-muted-foreground'} transition-colors duration-300`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Connected Number</p>
              {connectedNumber ? (
                <p className="text-lg font-bold truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text" data-testid="text-connected-number" dir="ltr">
                  {formatPhoneNumber(connectedNumber)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-number">
                  Not connected
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:bg-card/60 dark:backdrop-blur-md dark:border-white/5 stagger-3" data-testid="card-messages-count">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <MessageSquare className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Messages Today</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text" data-testid="text-messages-count">{messagesCount}</p>
              </div>
            </div>
            {messagesCount > 0 && (
              <TrendingUp className="h-4 w-4 text-green-500 animate-bounce" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:bg-card/60 dark:backdrop-blur-md dark:border-white/5 stagger-4" data-testid="card-users-count">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5">
                <Users className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Users</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text" data-testid="text-users-count">{usersCount}</p>
              </div>
            </div>
            {usersCount > 0 && (
              <div className="flex -space-x-1">
                {[...Array(Math.min(usersCount, 3))].map((_, i) => (
                  <div key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-card flex items-center justify-center text-[10px] text-white font-medium">
                    {i + 1}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
