import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import StatusCard from "@/components/StatusCard";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import ConversationList from "@/components/ConversationList";
import ChatView from "@/components/ChatView";
import SettingsPanel from "@/components/SettingsPanel";
import UserManagement from "@/components/UserManagement";
import SecurityPanel from "@/components/SecurityPanel";
import ContactsConversations from "@/components/ContactsConversations";
import SessionMonitor from "@/components/SessionMonitor";
import LinkedSessions from "@/components/LinkedSessions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Settings, QrCode, Users, Shield, Contact, Activity, Link2 } from "lucide-react";
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
  connectedNumber: string | null;
  pairingCode: string | null;
  messagesCount: number;
  usersCount: number;
  safeModeEnabled?: boolean;
  isReconnecting?: boolean;
}

interface ReconnectingData {
  sessionId: string;
  attempt: number;
  maxAttempts: number;
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
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<BotStatus | null>(null);
  const [reconnectingData, setReconnectingData] = useState<ReconnectingData | null>(null);

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
      toast({ title: 'جاري الاتصال...', description: 'جاري تهيئة اتصال واتساب' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في الاتصال', variant: 'destructive' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/disconnect'),
    onSuccess: () => {
      toast({ title: 'تم قطع الاتصال', description: 'تم قطع اتصال واتساب بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في قطع الاتصال', variant: 'destructive' });
    },
  });

  const refreshQRMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/refresh-qr'),
    onSuccess: () => {
      toast({ title: 'جاري التحديث...', description: 'جاري إنشاء رمز QR جديد' });
    },
  });

  const repairMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/repair', {}),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: 'تم الإصلاح', description: data.message });
      } else {
        toast({ title: 'مشكلة في الإصلاح', description: data.message, variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في إصلاح الاتصال', variant: 'destructive' });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: BotSettings) => apiRequest('POST', '/api/settings', data),
    onSuccess: () => {
      toast({ title: 'تم الحفظ', description: 'تم تحديث إعدادات البوت بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في حفظ الإعدادات', variant: 'destructive' });
    },
  });

  useEffect(() => {
    const unsubStatus = subscribe('status', (data: BotStatus) => {
      setLiveStatus(data);
      if (data.qrCode) {
        setQrCode(data.qrCode);
      } else if (data.isConnected) {
        setQrCode(null);
        setPairingCode(null);
      }
      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
      }
    });

    const unsubQR = subscribe('qr', (data: string) => {
      setQrCode(data);
    });

    const unsubPairingCode = subscribe('pairingCode', (data: string) => {
      setPairingCode(data);
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

    const unsubUsers = subscribe('users', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/stats/summary'] });
    });

    const unsubSecurity = subscribe('security', (data: any) => {
      if (data.type === 'rate_limited' || data.type === 'auto_blocked') {
        toast({ 
          title: data.type === 'auto_blocked' ? 'تم الحظر التلقائي' : 'تم تقييد المعدل',
          description: `${data.phoneNumber}: ${data.reason}`,
          variant: 'destructive'
        });
      }
    });

    const unsubSafeMode = subscribe('safe_mode', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/security/settings'] });
    });

    const unsubSecuritySettings = subscribe('security_settings', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security/settings'] });
    });

    const unsubSessionStatus = subscribe('session_status', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/session'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    });

    const unsubSessions = subscribe('sessions', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    });

    const unsubSessionTerminated = subscribe('sessionTerminated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
    });

    const unsubReconnecting = subscribe('reconnecting', (data: ReconnectingData) => {
      setReconnectingData(data);
      toast({ 
        title: 'جاري إعادة الاتصال...', 
        description: `المحاولة ${data.attempt} من ${data.maxAttempts}`,
      });
    });

    const unsubReconnectFailed = subscribe('reconnectFailed', (data: { sessionId: string; attempts: number }) => {
      setReconnectingData(null);
      toast({ 
        title: 'فشل إعادة الاتصال', 
        description: `فشلت جميع المحاولات (${data.attempts}). يرجى إعادة الاتصال يدوياً.`,
        variant: 'destructive'
      });
    });

    return () => {
      unsubStatus();
      unsubQR();
      unsubPairingCode();
      unsubMessage();
      unsubStats();
      unsubSettings();
      unsubUsers();
      unsubSecurity();
      unsubSafeMode();
      unsubSecuritySettings();
      unsubSessionStatus();
      unsubSessions();
      unsubSessionTerminated();
      unsubReconnecting();
      unsubReconnectFailed();
    };
  }, [subscribe, toast]);

  const currentStatus = liveStatus || status;
  const isConnected = currentStatus?.isReady || false;
  const isReconnecting = reconnectingData !== null || currentStatus?.isReconnecting || false;
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  
  useEffect(() => {
    if (isConnected && reconnectingData) {
      setReconnectingData(null);
    }
  }, [isConnected, reconnectingData]);

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

  const handleRequestPairingCode = async (phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      const response = await apiRequest('POST', '/api/request-pairing-code', { phoneNumber });
      const result = await response.json() as { success: boolean; code?: string; error?: string };
      if (result.success && result.code) {
        setPairingCode(result.code);
        toast({ title: 'تم استلام الكود', description: 'أدخل الكود في واتساب لربط جهازك' });
      }
      return result;
    } catch (error: any) {
      return { success: false, error: error?.message || 'فشل في طلب كود الربط' };
    }
  };

  const messagesCount = currentStatus?.messagesCount || 0;
  const usersCount = currentStatus?.usersCount || 0;
  const connectedNumber = currentStatus?.connectedNumber || null;

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Header 
        isConnected={isConnected} 
        onToggleConnection={handleToggleConnection} 
      />
      
      <main className="container px-4 py-6 space-y-6">
        <StatusCard 
          status={isConnected ? "connected" : (isReconnecting ? "reconnecting" : (connectMutation.isPending ? "connecting" : "disconnected"))} 
          messagesCount={messagesCount}
          usersCount={usersCount}
          connectedNumber={connectedNumber}
          reconnectAttempt={reconnectingData?.attempt}
          maxReconnectAttempts={reconnectingData?.maxAttempts}
        />

        <Tabs defaultValue="conversations" className="w-full">
          <TabsList className="grid w-full grid-cols-8 max-w-5xl">
            <TabsTrigger value="conversations" className="gap-2" data-testid="tab-conversations">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">المحادثات</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2" data-testid="tab-contacts">
              <Contact className="h-4 w-4" />
              <span className="hidden sm:inline">جهات الاتصال</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2" data-testid="tab-linked-sessions">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">الجلسات</span>
            </TabsTrigger>
            <TabsTrigger value="session" className="gap-2" data-testid="tab-session">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">المراقبة</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">المستخدمين</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
              <Shield className={`h-4 w-4 ${currentStatus?.safeModeEnabled ? 'text-red-500' : ''}`} />
              <span className="hidden sm:inline">الأمان</span>
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2" data-testid="tab-connection">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">الاتصال</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">الإعدادات</span>
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
                    {conversationsLoading ? 'جاري تحميل المحادثات...' : 'اختر محادثة للعرض'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <ContactsConversations />
          </TabsContent>

          <TabsContent value="sessions" className="mt-6">
            <LinkedSessions />
          </TabsContent>

          <TabsContent value="session" className="mt-6">
            <SessionMonitor />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <SecurityPanel safeModeEnabled={currentStatus?.safeModeEnabled || false} />
          </TabsContent>

          <TabsContent value="connection" className="mt-6">
            <div className="max-w-md mx-auto">
              <QRCodeDisplay
                qrCode={qrCode || currentStatus?.qrCode || null}
                isConnected={isConnected}
                onRefresh={handleRefreshQR}
                onRepair={handleRepair}
                onRequestPairingCode={handleRequestPairingCode}
                pairingCode={pairingCode}
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
