import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Bot, MessageSquare, Users, Phone, RefreshCw, TrendingUp, Zap } from "lucide-react";

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
      glowColor: "dark:shadow-[0_0_20px_rgba(34,197,94,0.15)]",
      bgGradient: "from-green-500/10 via-green-500/5 to-transparent",
      iconGlow: "dark:drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]",
    },
    disconnected: {
      icon: WifiOff,
      label: "غير متصل",
      color: "bg-red-500",
      badgeVariant: "destructive" as const,
      glowColor: "dark:shadow-[0_0_20px_rgba(239,68,68,0.15)]",
      bgGradient: "from-red-500/10 via-red-500/5 to-transparent",
      iconGlow: "",
    },
    connecting: {
      icon: Wifi,
      label: "جاري الاتصال...",
      color: "bg-yellow-500",
      badgeVariant: "secondary" as const,
      glowColor: "dark:shadow-[0_0_20px_rgba(234,179,8,0.15)]",
      bgGradient: "from-yellow-500/10 via-yellow-500/5 to-transparent",
      iconGlow: "dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]",
    },
    reconnecting: {
      icon: RefreshCw,
      label: reconnectAttempt && maxReconnectAttempts 
        ? `إعادة الاتصال (${reconnectAttempt}/${maxReconnectAttempts})`
        : "إعادة الاتصال...",
      color: "bg-orange-500",
      badgeVariant: "secondary" as const,
      glowColor: "dark:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      bgGradient: "from-orange-500/10 via-orange-500/5 to-transparent",
      iconGlow: "dark:drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]",
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
      <Card className={`relative overflow-hidden transition-all duration-500 hover:scale-[1.02] dark:bg-card/50 dark:backdrop-blur-xl dark:border-primary/10 ${config.glowColor} hover:dark:shadow-[0_0_30px_rgba(139,92,246,0.2)] animate-stagger-in stagger-1`} data-testid="card-bot-status">
        <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} pointer-events-none`} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${status === 'connected' ? 'bg-gradient-to-br from-primary/30 to-blue-500/20 dark:shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'bg-muted/80'} transition-all duration-300`}>
                <Bot className={`h-5 w-5 text-primary transition-transform duration-300 ${status === 'connected' ? 'animate-pulse' : ''} ${config.iconGlow}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">حالة البوت</p>
                <p className="text-lg font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">GX-MODY</p>
              </div>
            </div>
            <Badge variant={config.badgeVariant} className="gap-1.5 px-2.5 py-1 dark:border-0" data-testid="badge-status">
              <span className={`h-2 w-2 rounded-full ${config.color} ${status === 'connecting' || status === 'reconnecting' ? 'animate-pulse' : ''} ${status === 'connected' ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ''}`} />
              <span className="text-xs">{config.label}</span>
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden transition-all duration-500 hover:scale-[1.02] dark:bg-card/50 dark:backdrop-blur-xl dark:border-blue-500/10 dark:shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:dark:shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-stagger-in stagger-2" data-testid="card-connected-number">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${connectedNumber ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/20 dark:shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-muted/80'} transition-all duration-300`}>
              <Phone className={`h-5 w-5 ${connectedNumber ? 'text-blue-400 dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'text-muted-foreground'} transition-colors duration-300`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">الرقم المتصل</p>
              {connectedNumber ? (
                <p className="text-lg font-bold truncate bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent" data-testid="text-connected-number" dir="ltr">
                  {formatPhoneNumber(connectedNumber)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-number">
                  غير متصل
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden transition-all duration-500 hover:scale-[1.02] dark:bg-card/50 dark:backdrop-blur-xl dark:border-purple-500/10 dark:shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:dark:shadow-[0_0_30px_rgba(168,85,247,0.2)] animate-stagger-in stagger-3" data-testid="card-messages-count">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 dark:shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <MessageSquare className="h-5 w-5 text-purple-400 dark:drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الرسائل اليوم</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent" data-testid="text-messages-count">{messagesCount}</p>
              </div>
            </div>
            {messagesCount > 0 && (
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-400 animate-bounce dark:drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                <Zap className="h-3 w-3 text-yellow-400 animate-pulse" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden transition-all duration-500 hover:scale-[1.02] dark:bg-card/50 dark:backdrop-blur-xl dark:border-amber-500/10 dark:shadow-[0_0_20px_rgba(245,158,11,0.1)] hover:dark:shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-stagger-in stagger-4" data-testid="card-users-count">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <CardContent className="pt-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 dark:shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <Users className="h-5 w-5 text-amber-400 dark:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المستخدمين النشطين</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent" data-testid="text-users-count">{usersCount}</p>
              </div>
            </div>
            {usersCount > 0 && (
              <div className="flex -space-x-1 rtl:space-x-reverse">
                {[...Array(Math.min(usersCount, 3))].map((_, i) => (
                  <div key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-card flex items-center justify-center text-[10px] text-white font-medium shadow-[0_0_10px_rgba(245,158,11,0.4)]">
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
