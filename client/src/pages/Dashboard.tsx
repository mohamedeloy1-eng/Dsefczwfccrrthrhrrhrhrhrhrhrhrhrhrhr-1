import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import StatusCard from "@/components/StatusCard";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import ConversationList from "@/components/ConversationList";
import ChatView from "@/components/ChatView";
import SettingsPanel from "@/components/SettingsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Settings, QrCode } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: Message[];
}

interface BotStatus {
  isConnected: boolean;
  isReady: boolean;
  qrCode: string | null;
  messagesCount: number;
  usersCount: number;
}

interface BotSettings {
  botName: string;
  systemPrompt: string;
  autoReply: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<BotStatus | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<BotStatus>({
    queryKey: ['/api/status'],
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
  });

  const { data: settings } = useQuery<BotSettings>({
    queryKey: ['/api/settings'],
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/connect'),
    onSuccess: () => {
      toast({ title: 'Connecting...', description: 'Initializing WhatsApp connection' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to connect', variant: 'destructive' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/disconnect'),
    onSuccess: () => {
      toast({ title: 'Disconnected', description: 'WhatsApp disconnected successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to disconnect', variant: 'destructive' });
    },
  });

  const refreshQRMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/refresh-qr'),
    onSuccess: () => {
      toast({ title: 'Refreshing...', description: 'Generating new QR code' });
    },
  });

  const repairMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/repair', {}),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'Repair Complete', description: data.message });
      } else {
        toast({ title: 'Repair Issue', description: data.message, variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to repair connection', variant: 'destructive' });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: BotSettings) => apiRequest('POST', '/api/settings', data),
    onSuccess: () => {
      toast({ title: 'Settings Saved', description: 'Bot settings updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    },
  });

  useEffect(() => {
    const unsubStatus = subscribe('status', (data: BotStatus) => {
      setLiveStatus(data);
      if (data.qrCode) {
        setQrCode(data.qrCode);
      } else if (data.isConnected) {
        setQrCode(null);
      }
    });

    const unsubQR = subscribe('qr', (data: string) => {
      setQrCode(data);
    });

    const unsubMessage = subscribe('message', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    const unsubStats = subscribe('stats', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    });

    const unsubSettings = subscribe('settings', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    });

    return () => {
      unsubStatus();
      unsubQR();
      unsubMessage();
      unsubStats();
      unsubSettings();
    };
  }, [subscribe]);

  const currentStatus = liveStatus || status;
  const isConnected = currentStatus?.isReady || false;
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnectMutation.mutate();
    } else {
      connectMutation.mutate();
    }
  };

  const handleRefreshQR = () => {
    refreshQRMutation.mutate();
  };

  const handleRepair = () => {
    repairMutation.mutate();
  };

  const handleSaveSettings = (newSettings: BotSettings) => {
    settingsMutation.mutate(newSettings);
  };

  const messagesCount = currentStatus?.messagesCount || 0;
  const usersCount = currentStatus?.usersCount || 0;

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Header 
        isConnected={isConnected} 
        onToggleConnection={handleToggleConnection} 
      />
      
      <main className="container px-4 py-6 space-y-6">
        <StatusCard 
          status={isConnected ? "connected" : (connectMutation.isPending ? "connecting" : "disconnected")} 
          messagesCount={messagesCount}
          usersCount={usersCount}
        />

        <Tabs defaultValue="conversations" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="conversations" className="gap-2" data-testid="tab-conversations">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chats</span>
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2" data-testid="tab-connection">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Connect</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
              />
              {selectedConversation ? (
                <ChatView
                  messages={selectedConversation.messages}
                  userName={selectedConversation.name}
                />
              ) : (
                <div className="hidden lg:flex items-center justify-center h-[450px] bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">
                    {conversationsLoading ? 'Loading conversations...' : 'Select a conversation to view'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="connection" className="mt-6">
            <div className="max-w-md mx-auto">
              <QRCodeDisplay
                qrCode={qrCode || currentStatus?.qrCode || null}
                isConnected={isConnected}
                onRefresh={handleRefreshQR}
                onRepair={handleRepair}
                isRepairing={repairMutation.isPending}
                isRefreshing={refreshQRMutation.isPending}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="max-w-lg mx-auto">
              <SettingsPanel
                botName={settings?.botName || "GX-MODY"}
                systemPrompt={settings?.systemPrompt || "You are GX-MODY, a helpful and friendly AI assistant."}
                autoReply={settings?.autoReply ?? true}
                onSave={handleSaveSettings}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
