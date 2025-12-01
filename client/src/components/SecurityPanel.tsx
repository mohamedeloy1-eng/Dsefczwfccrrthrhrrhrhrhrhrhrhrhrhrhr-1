import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  ShieldOff, 
  AlertTriangle, 
  Power,
  Settings,
  FileText,
  Search,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  XCircle,
  Ban,
  Activity,
  Trash2,
  RefreshCw
} from "lucide-react";

interface SecuritySettings {
  defaultMessageLimit: number;
  spamThreshold: number;
  autoBlockEnabled: boolean;
  safeModeEnabled: boolean;
  maxMessagesPerDay: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  phoneNumber: string;
  sessionId: string;
  content: string;
  messageType: 'text' | 'image' | 'sticker' | 'error' | 'system';
  status: 'success' | 'failed' | 'blocked' | 'rate_limited';
  errorMessage?: string;
}

interface LogStats {
  total: number;
  incoming: number;
  outgoing: number;
  errors: number;
  blocked: number;
  rateLimited: number;
  today: number;
}

interface SecurityPanelProps {
  safeModeEnabled: boolean;
}

export default function SecurityPanel({ safeModeEnabled: initialSafeMode }: SecurityPanelProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: settings } = useQuery<SecuritySettings>({
    queryKey: ['/api/security/settings'],
  });

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<LogEntry[]>({
    queryKey: ['/api/logs'],
  });

  const { data: logStats } = useQuery<LogStats>({
    queryKey: ['/api/logs/stats'],
  });

  const { data: errorLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ['/api/logs/errors'],
  });

  const { data: blockedLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ['/api/logs/blocked'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<SecuritySettings>) => 
      apiRequest('POST', '/api/security/settings', newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security/settings'] });
      toast({ title: 'تم الحفظ', description: 'تم تحديث إعدادات الأمان' });
    },
  });

  const enableSafeModeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/security/safe-mode/enable'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/security/settings'] });
      setShowConfirmDialog(false);
      toast({ 
        title: 'تم تفعيل الوضع الآمن', 
        description: 'تم إيقاف البوت وقطع الاتصال ومسح الجلسات',
        variant: 'destructive'
      });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في تفعيل الوضع الآمن', variant: 'destructive' });
    },
  });

  const disableSafeModeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/security/safe-mode/disable'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/security/settings'] });
      toast({ title: 'تم إيقاف الوضع الآمن', description: 'يمكنك الآن إعادة الاتصال' });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/logs/clear'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logs/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logs/errors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logs/blocked'] });
      toast({ title: 'تم المسح', description: 'تم مسح جميع السجلات' });
    },
  });

  const filteredLogs = logs.filter(log =>
    log.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.phoneNumber.includes(searchQuery) ||
    log.sessionId.includes(searchQuery)
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ar', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default">نجاح</Badge>;
      case 'failed':
        return <Badge variant="destructive">فشل</Badge>;
      case 'blocked':
        return <Badge variant="destructive">محظور</Badge>;
      case 'rate_limited':
        return <Badge variant="secondary">تجاوز الحد</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'incoming' 
      ? <ArrowDownCircle className="h-4 w-4 text-blue-500" />
      : <ArrowUpCircle className="h-4 w-4 text-green-500" />;
  };

  const currentSafeMode = settings?.safeModeEnabled ?? initialSafeMode;

  return (
    <div className="space-y-6">
      <Card className={currentSafeMode ? 'border-red-500 bg-red-500/5' : ''} data-testid="card-safe-mode">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentSafeMode ? (
              <ShieldOff className="h-5 w-5 text-red-500" />
            ) : (
              <Shield className="h-5 w-5 text-green-500" />
            )}
            الوضع الآمن (SAFE MODE)
          </CardTitle>
          <CardDescription>
            {currentSafeMode 
              ? 'الوضع الآمن مُفعّل - البوت متوقف وجميع الجلسات ممسوحة'
              : 'قم بتفعيل الوضع الآمن لإيقاف البوت فوراً وقطع الاتصال'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-full ${currentSafeMode ? 'bg-red-500/20 animate-pulse' : 'bg-green-500/20'}`}>
                <Power className={`h-8 w-8 ${currentSafeMode ? 'text-red-500' : 'text-green-500'}`} />
              </div>
              <div>
                <p className="font-medium text-lg">
                  {currentSafeMode ? 'البوت متوقف' : 'البوت يعمل'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentSafeMode 
                    ? 'لن يتم استقبال أو إرسال أي رسائل'
                    : 'البوت يستقبل ويرسل الرسائل بشكل طبيعي'}
                </p>
              </div>
            </div>
            <Button
              variant={currentSafeMode ? "default" : "destructive"}
              size="lg"
              onClick={() => currentSafeMode ? disableSafeModeMutation.mutate() : setShowConfirmDialog(true)}
              disabled={enableSafeModeMutation.isPending || disableSafeModeMutation.isPending}
              data-testid="button-toggle-safe-mode"
            >
              {currentSafeMode ? (
                <>
                  <Shield className="h-5 w-5 mr-2" />
                  إيقاف الوضع الآمن
                </>
              ) : (
                <>
                  <ShieldOff className="h-5 w-5 mr-2" />
                  تفعيل الوضع الآمن
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-security-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              إعدادات الأمان
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>حد الرسائل الافتراضي: {settings?.defaultMessageLimit || 20} رسالة/دقيقة</Label>
              <Slider
                value={[settings?.defaultMessageLimit || 20]}
                onValueChange={(value) => updateSettingsMutation.mutate({ defaultMessageLimit: value[0] })}
                min={5}
                max={100}
                step={5}
                data-testid="slider-default-limit"
              />
            </div>

            <div className="space-y-2">
              <Label>عتبة السبام: {settings?.spamThreshold || 10} أخطاء</Label>
              <Slider
                value={[settings?.spamThreshold || 10]}
                onValueChange={(value) => updateSettingsMutation.mutate({ spamThreshold: value[0] })}
                min={3}
                max={50}
                step={1}
                data-testid="slider-spam-threshold"
              />
              <p className="text-xs text-muted-foreground">عدد الأخطاء المتكررة قبل الحظر التلقائي</p>
            </div>

            <div className="space-y-2">
              <Label>الحد اليومي: {settings?.maxMessagesPerDay || 500} رسالة/يوم</Label>
              <Slider
                value={[settings?.maxMessagesPerDay || 500]}
                onValueChange={(value) => updateSettingsMutation.mutate({ maxMessagesPerDay: value[0] })}
                min={100}
                max={2000}
                step={100}
                data-testid="slider-daily-limit"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-0.5">
                <Label>الحظر التلقائي</Label>
                <p className="text-xs text-muted-foreground">
                  حظر المستخدمين تلقائياً عند تجاوز عتبة الأخطاء
                </p>
              </div>
              <Switch
                checked={settings?.autoBlockEnabled ?? true}
                onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoBlockEnabled: checked })}
                data-testid="switch-auto-block"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-log-stats">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              إحصائيات السجلات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">إجمالي السجلات</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-total-logs">{logStats?.total || 0}</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">اليوم</span>
                </div>
                <p className="text-2xl font-bold mt-1" data-testid="text-logs-today">{logStats?.today || 0}</p>
              </div>

              <div className="p-4 rounded-lg bg-blue-500/10">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">واردة</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-blue-500" data-testid="text-incoming-logs">{logStats?.incoming || 0}</p>
              </div>

              <div className="p-4 rounded-lg bg-green-500/10">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">صادرة</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-green-500" data-testid="text-outgoing-logs">{logStats?.outgoing || 0}</p>
              </div>

              <div className="p-4 rounded-lg bg-red-500/10">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">أخطاء</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-red-500" data-testid="text-error-logs">{logStats?.errors || 0}</p>
              </div>

              <div className="p-4 rounded-lg bg-orange-500/10">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">محظور/محدود</span>
                </div>
                <p className="text-2xl font-bold mt-1 text-orange-500" data-testid="text-blocked-logs">{(logStats?.blocked || 0) + (logStats?.rateLimited || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-logs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                سجل الرسائل
              </CardTitle>
              <CardDescription>سجل كامل لجميع الرسائل الواردة والصادرة</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في السجلات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 w-full sm:w-[200px]"
                  data-testid="input-search-logs"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetchLogs()} data-testid="button-refresh-logs">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={() => clearLogsMutation.mutate()} data-testid="button-clear-logs">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all" data-testid="tab-all-logs">الكل ({logs.length})</TabsTrigger>
              <TabsTrigger value="errors" data-testid="tab-error-logs">الأخطاء ({errorLogs.length})</TabsTrigger>
              <TabsTrigger value="blocked" data-testid="tab-blocked-logs">المحظور ({blockedLogs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <LogList logs={filteredLogs} isLoading={logsLoading} formatDate={formatDate} getStatusBadge={getStatusBadge} getDirectionIcon={getDirectionIcon} />
            </TabsContent>

            <TabsContent value="errors">
              <LogList logs={errorLogs} isLoading={logsLoading} formatDate={formatDate} getStatusBadge={getStatusBadge} getDirectionIcon={getDirectionIcon} />
            </TabsContent>

            <TabsContent value="blocked">
              <LogList logs={blockedLogs} isLoading={logsLoading} formatDate={formatDate} getStatusBadge={getStatusBadge} getDirectionIcon={getDirectionIcon} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              تأكيد تفعيل الوضع الآمن
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>سيقوم هذا الإجراء بـ:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>إيقاف البوت فوراً</li>
                <li>قطع اتصال واتساب</li>
                <li>مسح جميع الجلسات النشطة</li>
                <li>إيقاف جميع الرسائل الواردة والصادرة</li>
              </ul>
              <p className="text-red-500 font-medium mt-4">هل أنت متأكد؟</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => enableSafeModeMutation.mutate()}
              disabled={enableSafeModeMutation.isPending}
              data-testid="button-confirm-safe-mode"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              تفعيل الوضع الآمن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogList({ 
  logs, 
  isLoading, 
  formatDate, 
  getStatusBadge, 
  getDirectionIcon 
}: { 
  logs: LogEntry[];
  isLoading: boolean;
  formatDate: (date: string) => string;
  getStatusBadge: (status: string) => JSX.Element;
  getDirectionIcon: (direction: string) => JSX.Element;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-2" />
        <p className="text-muted-foreground">لا توجد سجلات</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`p-3 rounded-lg border text-sm ${
              log.status === 'failed' || log.status === 'blocked' 
                ? 'bg-red-500/5 border-red-500/20' 
                : log.status === 'rate_limited'
                  ? 'bg-orange-500/5 border-orange-500/20'
                  : 'bg-card'
            }`}
            data-testid={`log-entry-${log.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {getDirectionIcon(log.direction)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs" dir="ltr">{log.phoneNumber}</span>
                    {getStatusBadge(log.status)}
                    <span className="text-xs text-muted-foreground">
                      {log.messageType}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate mt-1">{log.content}</p>
                  {log.errorMessage && (
                    <p className="text-red-500 text-xs mt-1">{log.errorMessage}</p>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(log.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
