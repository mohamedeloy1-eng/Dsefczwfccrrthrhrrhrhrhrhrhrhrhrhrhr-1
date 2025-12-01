import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Wifi, 
  WifiOff,
  Clock,
  MessageSquare,
  Smartphone,
  Monitor,
  Play,
  Pause,
  RefreshCw,
  Globe,
  Cpu,
  Activity
} from "lucide-react";

interface SessionDetails {
  connectedNumber: string | null;
  isOnline: boolean;
  sessionStartTime: string | null;
  sessionDuration: string;
  whatsappOpenDuration: string;
  botRepliesCount: number;
  deviceInfo: {
    platform: string;
    browser: string;
    version: string;
    phoneModel: string | null;
  } | null;
  isSuspended: boolean;
}

export default function SessionMonitor() {
  const { toast } = useToast();

  const { data: session, isLoading, refetch, isRefetching } = useQuery<SessionDetails>({
    queryKey: ['/api/whatsapp/session'],
    refetchInterval: 10000,
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/session/suspend'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/session'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({ title: 'تم التعليق', description: 'تم تعليق الجلسة بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في تعليق الجلسة', variant: 'destructive' });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/session/resume'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/session'] });
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      toast({ title: 'تم التفعيل', description: 'تم إعادة تفعيل الجلسة بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في إعادة تفعيل الجلسة', variant: 'destructive' });
    },
  });

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session?.connectedNumber) {
    return (
      <Card data-testid="card-no-session">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <WifiOff className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد جلسة نشطة</p>
            <p className="text-sm text-muted-foreground mt-2">
              يرجى الاتصال بواتساب أولاً لعرض معلومات الجلسة
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-session-header">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                مراقبة الجلسة المتقدمة
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span dir="ltr">{session.connectedNumber}</span>
                {session.isOnline ? (
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
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefetching}
                data-testid="button-refresh-session"
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${isRefetching ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              {session.isSuspended ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  data-testid="button-resume-session"
                >
                  <Play className="h-4 w-4 ml-2" />
                  تفعيل الجلسة
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => suspendMutation.mutate()}
                  disabled={suspendMutation.isPending}
                  data-testid="button-suspend-session"
                >
                  <Pause className="h-4 w-4 ml-2" />
                  تعليق الجلسة
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-connection-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${session.isOnline ? 'bg-green-500/10' : 'bg-muted'}`}>
                {session.isOnline ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">حالة الاتصال</p>
                <p className="text-lg font-semibold" data-testid="text-connection-status">
                  {session.isOnline ? 'متصل بالإنترنت' : 'غير متصل'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-session-duration">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مدة الجلسة</p>
                <p className="text-lg font-semibold" data-testid="text-session-duration">
                  {session.sessionDuration}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-whatsapp-duration">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <Globe className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مدة فتح واتساب</p>
                <p className="text-lg font-semibold" data-testid="text-whatsapp-duration">
                  {session.whatsappOpenDuration}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-bot-replies">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ردود البوت</p>
                <p className="text-2xl font-bold" data-testid="text-bot-replies">
                  {session.botRepliesCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {session.deviceInfo && (
          <>
            <Card data-testid="card-platform">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-purple-500/10">
                    <Cpu className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">النظام</p>
                    <p className="text-lg font-semibold" data-testid="text-platform">
                      {session.deviceInfo.platform}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-browser">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-orange-500/10">
                    <Monitor className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">المتصفح</p>
                    <p className="text-lg font-semibold" data-testid="text-browser">
                      {session.deviceInfo.browser}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {session.deviceInfo?.phoneModel && (
          <Card data-testid="card-phone-model">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-cyan-500/10">
                  <Smartphone className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">طراز الهاتف</p>
                  <p className="text-lg font-semibold" data-testid="text-phone-model">
                    {session.deviceInfo.phoneModel}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {session.isSuspended && (
        <Card className="border-destructive/50 bg-destructive/5" data-testid="card-suspended-warning">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Pause className="h-6 w-6 text-destructive" />
              <div>
                <p className="font-medium text-destructive">الجلسة معلقة</p>
                <p className="text-sm text-muted-foreground">
                  البوت لن يرد على الرسائل الواردة حتى يتم إعادة تفعيل الجلسة
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
