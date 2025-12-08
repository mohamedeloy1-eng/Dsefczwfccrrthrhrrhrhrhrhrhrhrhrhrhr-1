import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Wifi, 
  WifiOff,
  Clock,
  MessageSquare,
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  Pause,
  Play,
  Phone,
  QrCode,
  Loader2,
  X,
  Copy,
  Check
} from "lucide-react";
import { useState, useEffect } from "react";

interface LinkedSession {
  id: string;
  phoneNumber: string;
  isConnected: boolean;
  isReady: boolean;
  sessionStartTime: string | null;
  botRepliesCount: number;
  isSuspended: boolean;
}

export default function LinkedSessions() {
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const [showLinkingPanel, setShowLinkingPanel] = useState(false);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const { data: sessions = [], isLoading, refetch, isRefetching } = useQuery<LinkedSession[]>({
    queryKey: ['/api/sessions'],
    refetchInterval: 10000,
  });

  useEffect(() => {
    const unsubQR = subscribe('qr', (data: { qrCode: string; sessionId: string }) => {
      if (showLinkingPanel && data.sessionId === newSessionId) {
        setQrCode(data.qrCode);
      }
    });

    const unsubPairingCode = subscribe('pairingCode', (data: { code: string; sessionId: string }) => {
      if (showLinkingPanel && data.sessionId === newSessionId) {
        setPairingCode(data.code);
      }
    });

    const unsubStatus = subscribe('status', (data: any) => {
      if (showLinkingPanel && data.isReady && data.sessionId === newSessionId) {
        toast({ title: 'تم الربط بنجاح', description: 'تم ربط رقم واتساب جديد' });
        setShowLinkingPanel(false);
        setQrCode(null);
        setPairingCode(null);
        setNewSessionId(null);
        setPhoneNumber("");
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      }
    });

    return () => {
      unsubQR();
      unsubPairingCode();
      unsubStatus();
    };
  }, [subscribe, showLinkingPanel, newSessionId, toast]);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sessions/create');
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.sessionId) {
        setNewSessionId(data.sessionId);
        setShowLinkingPanel(true);
        setQrCode(null);
        setPairingCode(null);
        setPhoneNumber("");
        setPairingError(null);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({ title: 'تم إنشاء جلسة جديدة', description: 'امسح رمز QR أو استخدم رقم الهاتف للربط' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في إنشاء جلسة جديدة', variant: 'destructive' });
    },
  });

  const handleRequestPairingCode = async () => {
    if (!phoneNumber.trim() || !newSessionId) {
      setPairingError("يرجى إدخال رقم الهاتف");
      return;
    }

    setIsRequestingCode(true);
    setPairingError(null);

    try {
      const response = await apiRequest('POST', '/api/request-pairing-code', { 
        phoneNumber: phoneNumber.trim(),
        sessionId: newSessionId
      });
      const result = await response.json() as { success: boolean; code?: string; error?: string };
      if (result.success && result.code) {
        setPairingCode(result.code);
        toast({ title: 'تم استلام الكود', description: 'أدخل الكود في واتساب لربط جهازك' });
      } else {
        setPairingError(result.error || "فشل في الحصول على كود الربط");
      }
    } catch (error: any) {
      setPairingError(error?.message || "فشل في طلب كود الربط");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCancelLinking = () => {
    if (newSessionId) {
      terminateSessionMutation.mutate(newSessionId);
    }
    setShowLinkingPanel(false);
    setQrCode(null);
    setPairingCode(null);
    setNewSessionId(null);
    setPhoneNumber("");
    setPairingError(null);
  };

  const terminateSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiRequest('POST', `/api/sessions/${sessionId}/terminate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({ title: 'تم إنهاء الجلسة', description: 'تم حذف الجلسة وبياناتها بنجاح' });
      setTerminatingSession(null);
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في إنهاء الجلسة', variant: 'destructive' });
    },
  });

  const suspendSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiRequest('POST', '/api/whatsapp/session/suspend', { sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({ title: 'تم التعليق', description: 'تم تعليق الجلسة بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في تعليق الجلسة', variant: 'destructive' });
    },
  });

  const resumeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiRequest('POST', '/api/whatsapp/session/resume', { sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({ title: 'تم التفعيل', description: 'تم إعادة تفعيل الجلسة بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في إعادة تفعيل الجلسة', variant: 'destructive' });
    },
  });

  const formatPhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) return 'غير متصل';
    return `+${phoneNumber}`;
  };

  const formatSessionDuration = (startTime: string | null): string => {
    if (!startTime) return '0 دقيقة';
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours} ساعة و ${remainingMins} دقيقة`;
    }
    return `${diffMins} دقيقة`;
  };

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-sessions-header">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                إدارة الجلسات المتصلة
              </CardTitle>
              <CardDescription className="mt-1">
                يمكنك ربط عدة أرقام واتساب وإدارتها من هنا
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefetching}
                data-testid="button-refresh-sessions"
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${isRefetching ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => createSessionMutation.mutate()}
                disabled={createSessionMutation.isPending}
                data-testid="button-create-session"
              >
                <Plus className="h-4 w-4 ml-2" />
                ربط رقم جديد
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showLinkingPanel && (
        <Card data-testid="card-linking-panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  ربط رقم واتساب جديد
                </CardTitle>
                <CardDescription className="mt-1">
                  امسح رمز QR أو استخدم رقم الهاتف للربط
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelLinking}
                data-testid="button-cancel-linking"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="qr" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="qr" className="gap-2" data-testid="tab-qr-code">
                  <QrCode className="h-4 w-4" />
                  رمز QR
                </TabsTrigger>
                <TabsTrigger value="phone" className="gap-2" data-testid="tab-phone-link">
                  <Phone className="h-4 w-4" />
                  رقم الهاتف
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="mt-0">
                <div className="flex flex-col items-center justify-center py-4">
                  {qrCode ? (
                    <div className="p-4 bg-white rounded-lg" data-testid="qr-code-image">
                      <img 
                        src={qrCode} 
                        alt="WhatsApp QR Code" 
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center" data-testid="qr-code-placeholder">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground px-4">
                          جاري تحميل رمز QR...
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 text-center space-y-1">
                    <p className="text-sm text-muted-foreground">
                      1. افتح واتساب على هاتفك
                    </p>
                    <p className="text-sm text-muted-foreground">
                      2. اذهب إلى الإعدادات ← الأجهزة المرتبطة
                    </p>
                    <p className="text-sm text-muted-foreground">
                      3. امسح رمز QR بهاتفك
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phone" className="mt-0">
                <div className="flex flex-col items-center justify-center py-4 space-y-4">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">رقم الهاتف</label>
                      <Input
                        type="tel"
                        placeholder="201234567890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="text-center text-lg"
                        dir="ltr"
                        data-testid="input-phone-number"
                        disabled={isRequestingCode}
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        أدخل الرقم مع كود الدولة (مثل: 201234567890)
                      </p>
                    </div>

                    <Button
                      onClick={handleRequestPairingCode}
                      disabled={isRequestingCode || !phoneNumber.trim()}
                      className="w-full"
                      data-testid="button-request-code"
                    >
                      {isRequestingCode ? (
                        <>
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          جاري الطلب...
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4 ml-2" />
                          الحصول على كود الربط
                        </>
                      )}
                    </Button>

                    {pairingError && (
                      <p className="text-sm text-destructive text-center" data-testid="text-pairing-error">
                        {pairingError}
                      </p>
                    )}

                    {pairingCode && (
                      <div className="mt-4 p-4 bg-primary/10 rounded-lg text-center space-y-2">
                        <p className="text-sm font-medium">كود الربط:</p>
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-3xl font-bold tracking-widest font-mono" data-testid="text-pairing-code" dir="ltr">
                            {pairingCode}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyCode}
                            data-testid="button-copy-code"
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          أدخل هذا الكود في واتساب لربط الجهاز
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-center space-y-1 pt-2">
                    <p className="text-sm text-muted-foreground">
                      1. افتح واتساب على هاتفك
                    </p>
                    <p className="text-sm text-muted-foreground">
                      2. اذهب إلى الإعدادات ← الأجهزة المرتبطة
                    </p>
                    <p className="text-sm text-muted-foreground">
                      3. اضغط "ربط جهاز" ثم "الربط برقم الهاتف بدلاً من ذلك"
                    </p>
                    <p className="text-sm text-muted-foreground">
                      4. أدخل كود الربط المعروض أعلاه
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-sessions-stats">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الجلسات</p>
                <p className="text-2xl font-bold" data-testid="text-total-sessions">
                  {sessions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <Wifi className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الجلسات النشطة</p>
                <p className="text-2xl font-bold" data-testid="text-active-sessions">
                  {sessions.filter(s => s.isConnected && s.isReady).length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي ردود البوت</p>
                <p className="text-2xl font-bold" data-testid="text-total-replies">
                  {sessions.reduce((sum, s) => sum + s.botRepliesCount, 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-sessions-list">
        <CardHeader>
          <CardTitle className="text-lg">الجلسات المتصلة</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Smartphone className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">لا توجد جلسات متصلة</p>
                <p className="text-sm text-muted-foreground mt-2">
                  اضغط على "ربط رقم جديد" لبدء جلسة جديدة
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <Card key={session.id} className="relative" data-testid={`session-card-${session.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${session.isConnected && session.isReady ? 'bg-green-500/10' : 'bg-muted'}`}>
                            {session.isConnected && session.isReady ? (
                              <Wifi className="h-6 w-6 text-green-500" />
                            ) : (
                              <WifiOff className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <p className="font-semibold text-lg" dir="ltr" data-testid={`session-phone-${session.id}`}>
                                {formatPhoneNumber(session.phoneNumber)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {session.isConnected && session.isReady ? (
                                <Badge variant="default" className="gap-1">
                                  <Wifi className="h-3 w-3" />
                                  متصل
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <WifiOff className="h-3 w-3" />
                                  غير متصل
                                </Badge>
                              )}
                              {session.isSuspended && (
                                <Badge variant="destructive" className="gap-1">
                                  <Pause className="h-3 w-3" />
                                  معلق
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {session.isConnected && session.isReady && (
                            <>
                              {session.isSuspended ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resumeSessionMutation.mutate(session.id)}
                                  disabled={resumeSessionMutation.isPending}
                                  data-testid={`button-resume-${session.id}`}
                                >
                                  <Play className="h-4 w-4 ml-1" />
                                  تفعيل
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => suspendSessionMutation.mutate(session.id)}
                                  disabled={suspendSessionMutation.isPending}
                                  data-testid={`button-suspend-${session.id}`}
                                >
                                  <Pause className="h-4 w-4 ml-1" />
                                  تعليق
                                </Button>
                              )}
                            </>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                data-testid={`button-terminate-${session.id}`}
                              >
                                <Trash2 className="h-4 w-4 ml-1" />
                                إنهاء
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>إنهاء الجلسة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من إنهاء جلسة الرقم {formatPhoneNumber(session.phoneNumber)}؟
                                  <br />
                                  سيتم قطع الاتصال وحذف جميع بيانات الجلسة نهائياً.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => terminateSessionMutation.mutate(session.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  إنهاء الجلسة
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">مدة الجلسة</p>
                            <p className="text-sm font-medium" data-testid={`session-duration-${session.id}`}>
                              {formatSessionDuration(session.sessionStartTime)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">ردود البوت</p>
                            <p className="text-sm font-medium" data-testid={`session-replies-${session.id}`}>
                              {session.botRepliesCount}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">معرف الجلسة</p>
                            <p className="text-sm font-medium font-mono truncate max-w-[150px]" title={session.id}>
                              {session.id.length > 15 ? session.id.slice(0, 15) + '...' : session.id}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
