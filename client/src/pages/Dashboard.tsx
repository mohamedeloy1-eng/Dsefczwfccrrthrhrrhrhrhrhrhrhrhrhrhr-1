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
import Broadcast from "@/components/Broadcast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Settings, QrCode, Users, Shield, Contact, Activity, Link2, Loader2, Wifi, WifiOff, RefreshCw, X, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";

type MessageType = "text" | "image" | "sticker" | "voice" | "error" | "system";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
  messageType?: MessageType;
  mediaUrl?: string;
  replyTo?: {
    id: string;
    content: string;
    isBot: boolean;
  };
}

interface Conversation {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageType?: MessageType;
  timestamp: string;
  unreadCount: number;
  isPinned?: boolean;
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

function InitialLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden" data-testid="loading-screen">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="text-center space-y-6 relative z-10">
        <div className="relative">
          <div className="w-20 h-20 mx-auto relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-blue-500 animate-spin" style={{ animationDuration: '3s' }}>
              <div className="absolute inset-1 rounded-full bg-background" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          </div>
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">جاري التحميل...</h2>
          <p className="text-sm text-muted-foreground">يتم تحميل لوحة تحكم GX-MODY</p>
        </div>
        <div className="flex justify-center gap-3 pt-4">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}

interface ConnectionAlertProps {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
  wsConnected: boolean;
  onReconnect: () => void;
  onDismiss: () => void;
  visible: boolean;
}

function ConnectionStatusAlert({ 
  isConnected, 
  isReconnecting, 
  reconnectAttempt, 
  maxReconnectAttempts, 
  wsConnected,
  onReconnect, 
  onDismiss,
  visible 
}: ConnectionAlertProps) {
  if (!visible) return null;

  if (isConnected && wsConnected) return null;

  if (isReconnecting) {
    return (
      <Alert className="border-orange-500/50 bg-orange-500/10 mb-4" data-testid="alert-reconnecting">
        <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <span className="font-medium text-orange-600 dark:text-orange-400">جاري إعادة الاتصال...</span>
            {reconnectAttempt && maxReconnectAttempts && (
              <span className="text-sm text-muted-foreground">
                (المحاولة {reconnectAttempt} من {maxReconnectAttempts})
              </span>
            )}
          </span>
          <Button variant="ghost" size="icon" onClick={onDismiss} data-testid="button-dismiss-alert">
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!wsConnected) {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10 mb-4" data-testid="alert-ws-disconnected">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <span className="font-medium text-yellow-600 dark:text-yellow-400">انقطاع الاتصال بالخادم</span>
            <span className="text-sm text-muted-foreground">جاري إعادة المحاولة...</span>
          </span>
          <Button variant="ghost" size="icon" onClick={onDismiss} data-testid="button-dismiss-ws-alert">
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isConnected) {
    return (
      <Alert className="border-red-500/50 bg-red-500/10 mb-4" data-testid="alert-disconnected">
        <WifiOff className="h-4 w-4 text-red-500" />
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <span className="font-medium text-red-600 dark:text-red-400">غير متصل بواتساب</span>
            <span className="text-sm text-muted-foreground">اذهب إلى تبويب الاتصال لربط جهازك</span>
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReconnect} data-testid="button-reconnect">
              <RefreshCw className="h-3 w-3 mr-1" />
              إعادة الاتصال
            </Button>
            <Button variant="ghost" size="icon" onClick={onDismiss} data-testid="button-dismiss-disconnect-alert">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { subscribe, wsConnected } = useWebSocket();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<BotStatus | null>(null);
  const [reconnectingData, setReconnectingData] = useState<ReconnectingData | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [previousConnectedState, setPreviousConnectedState] = useState<boolean | null>(null);
  const [previousWsConnected, setPreviousWsConnected] = useState<boolean | null>(null);
  const [conversationSummary, setConversationSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

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

    const unsubQR = subscribe('qr', (data: { qrCode: string; sessionId: string }) => {
      if (data.sessionId === 'default') {
        setQrCode(data.qrCode);
      }
    });

    const unsubPairingCode = subscribe('pairingCode', (data: { code: string; sessionId: string }) => {
      if (data.sessionId === 'default') {
        setPairingCode(data.code);
      }
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
    setConversationSummary(null);
  }, [selectedConversationId]);
  
  useEffect(() => {
    if (isConnected && reconnectingData) {
      setReconnectingData(null);
    }
  }, [isConnected, reconnectingData]);

  useEffect(() => {
    if (previousConnectedState !== null && previousConnectedState !== isConnected) {
      setAlertDismissed(false);
      
      if (isConnected) {
        toast({ 
          title: 'تم الاتصال بنجاح', 
          description: 'واتساب متصل الآن ويعمل بشكل طبيعي',
        });
      } else if (!isReconnecting) {
        toast({ 
          title: 'انقطع الاتصال', 
          description: 'تم قطع اتصال واتساب',
          variant: 'destructive'
        });
      }
    }
    setPreviousConnectedState(isConnected);
  }, [isConnected, isReconnecting, previousConnectedState, toast]);

  useEffect(() => {
    if (previousWsConnected !== null && previousWsConnected !== wsConnected) {
      setAlertDismissed(false);
      
      if (!wsConnected) {
        toast({ 
          title: 'انقطاع الاتصال بالخادم', 
          description: 'جاري إعادة الاتصال تلقائياً...',
          variant: 'destructive'
        });
      } else if (previousWsConnected === false) {
        toast({ 
          title: 'تم استعادة الاتصال', 
          description: 'الاتصال بالخادم يعمل بشكل طبيعي',
        });
      }
    }
    setPreviousWsConnected(wsConnected);
  }, [wsConnected, previousWsConnected, toast]);

  if (statusLoading && !liveStatus) {
    return <InitialLoadingScreen />;
  }

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

  const handleSummarize = async () => {
    if (!selectedConversation) return;
    
    setIsSummarizing(true);
    setConversationSummary(null);
    
    try {
      const response = await apiRequest('POST', '/api/ai/summarize', {
        messages: selectedConversation.messages.map(m => ({
          content: m.content,
          isBot: m.isBot
        }))
      });
      const result = await response.json() as { success: boolean; summary?: string; error?: string };
      
      if (result.success && result.summary) {
        setConversationSummary(result.summary);
      } else {
        toast({ 
          title: 'فشل التلخيص', 
          description: result.error || 'حدث خطأ أثناء تلخيص المحادثة',
          variant: 'destructive' 
        });
      }
    } catch (error: any) {
      toast({ 
        title: 'خطأ', 
        description: error?.message || 'فشل في تلخيص المحادثة',
        variant: 'destructive' 
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleRequestPairingCode = async (phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> => {
    try {
      const response = await apiRequest('POST', '/api/request-pairing-code', { phoneNumber, sessionId: 'default' });
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
    <div className="min-h-screen bg-background relative z-10" data-testid="dashboard-page">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>
      
      <Header 
        isConnected={isConnected} 
        onToggleConnection={handleToggleConnection} 
      />
      
      <main className="container px-4 py-6 space-y-6 animate-fade-in relative z-10">
        <ConnectionStatusAlert
          isConnected={isConnected}
          isReconnecting={isReconnecting}
          reconnectAttempt={reconnectingData?.attempt}
          maxReconnectAttempts={reconnectingData?.maxAttempts}
          wsConnected={wsConnected}
          onReconnect={() => connectMutation.mutate()}
          onDismiss={() => setAlertDismissed(true)}
          visible={!alertDismissed}
        />
        
        <StatusCard 
          status={isConnected ? "connected" : (isReconnecting ? "reconnecting" : (connectMutation.isPending ? "connecting" : "disconnected"))} 
          messagesCount={messagesCount}
          usersCount={usersCount}
          connectedNumber={connectedNumber}
          reconnectAttempt={reconnectingData?.attempt}
          maxReconnectAttempts={reconnectingData?.maxAttempts}
        />

        <Tabs defaultValue="conversations" className="w-full animate-fade-in-up">
          <TabsList className="grid w-full grid-cols-9 max-w-6xl dark:bg-card/60 dark:backdrop-blur-md dark:border-white/5">
            <TabsTrigger value="conversations" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-conversations">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">المحادثات</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-contacts">
              <Contact className="h-4 w-4" />
              <span className="hidden sm:inline">جهات الاتصال</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-broadcast">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">بث</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-linked-sessions">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">الجلسات</span>
            </TabsTrigger>
            <TabsTrigger value="session" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-session">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">المراقبة</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-users">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">المستخدمين</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-security">
              <Shield className={`h-4 w-4 ${currentStatus?.safeModeEnabled ? 'text-red-500' : ''}`} />
              <span className="hidden sm:inline">الأمان</span>
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-connection">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">الاتصال</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 transition-all duration-200 data-[state=active]:dark:bg-primary/20 data-[state=active]:dark:text-primary" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">الإعدادات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="mt-6 animate-fade-in-up">
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
                  onSummarize={handleSummarize}
                  isSummarizing={isSummarizing}
                  summary={conversationSummary || undefined}
                />
              ) : (
                <div className="hidden lg:flex items-center justify-center h-[450px] bg-muted/30 dark:bg-card/40 dark:backdrop-blur-sm rounded-lg border dark:border-white/5">
                  <p className="text-muted-foreground">
                    {conversationsLoading ? 'جاري تحميل المحادثات...' : 'اختر محادثة للعرض'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6 animate-fade-in-up">
            <ContactsConversations />
          </TabsContent>

          <TabsContent value="broadcast" className="mt-6 animate-fade-in-up">
            <Broadcast />
          </TabsContent>

          <TabsContent value="sessions" className="mt-6 animate-fade-in-up">
            <LinkedSessions />
          </TabsContent>

          <TabsContent value="session" className="mt-6 animate-fade-in-up">
            <SessionMonitor />
          </TabsContent>

          <TabsContent value="users" className="mt-6 animate-fade-in-up">
            <UserManagement />
          </TabsContent>

          <TabsContent value="security" className="mt-6 animate-fade-in-up">
            <SecurityPanel safeModeEnabled={currentStatus?.safeModeEnabled || false} />
          </TabsContent>

          <TabsContent value="connection" className="mt-6 animate-fade-in-up">
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

          <TabsContent value="settings" className="mt-6 animate-fade-in-up">
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
