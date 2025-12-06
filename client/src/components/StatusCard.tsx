import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Bot, MessageSquare, Users, Phone, RefreshCw } from "lucide-react";

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
    },
    disconnected: {
      icon: WifiOff,
      label: "غير متصل",
      color: "bg-red-500",
      badgeVariant: "destructive" as const,
    },
    connecting: {
      icon: Wifi,
      label: "جاري الاتصال...",
      color: "bg-yellow-500",
      badgeVariant: "secondary" as const,
    },
    reconnecting: {
      icon: RefreshCw,
      label: reconnectAttempt && maxReconnectAttempts 
        ? `إعادة الاتصال (${reconnectAttempt}/${maxReconnectAttempts})`
        : "إعادة الاتصال...",
      color: "bg-orange-500",
      badgeVariant: "secondary" as const,
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
      <Card data-testid="card-bot-status">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${status === 'connected' ? 'bg-primary/10' : 'bg-muted'}`}>
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bot Status</p>
                <p className="text-lg font-semibold">GX-MODY</p>
              </div>
            </div>
            <Badge variant={config.badgeVariant} className="gap-1" data-testid="badge-status">
              <span className={`h-2 w-2 rounded-full ${config.color} animate-pulse`} />
              {config.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-connected-number">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${connectedNumber ? 'bg-primary/10' : 'bg-muted'}`}>
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Connected Number</p>
              {connectedNumber ? (
                <p className="text-lg font-bold truncate" data-testid="text-connected-number" dir="ltr">
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

      <Card data-testid="card-messages-count">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Messages Today</p>
              <p className="text-2xl font-bold" data-testid="text-messages-count">{messagesCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-users-count">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold" data-testid="text-users-count">{usersCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
