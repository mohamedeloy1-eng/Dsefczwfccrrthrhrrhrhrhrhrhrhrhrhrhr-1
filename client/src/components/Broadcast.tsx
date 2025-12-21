import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Send, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  phoneNumber: string;
  name?: string;
  isBlocked?: boolean;
}

export default function Broadcast() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [lastResult, setLastResult] = useState<{ success: number; failed: number } | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const broadcastMutation = useMutation({
    mutationFn: async (msg: string) => {
      const activeUsers = users.filter(u => !u.isBlocked);
      setTotalCount(activeUsers.length);
      setSentCount(0);
      setLastResult(null);

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < activeUsers.length; i++) {
        const user = activeUsers[i];
        try {
          const response = await apiRequest("POST", "/api/broadcast/send", {
            phoneNumber: user.phoneNumber,
            message: msg,
          });
          const result = await response.json() as { success: boolean };
          
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
        }

        setSentCount(i + 1);

        // 5-second delay between messages
        if (i < activeUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      setLastResult({ success: successCount, failed: failedCount });
      return { success: successCount, failed: failedCount };
    },
    onSuccess: (result) => {
      toast({
        title: "تم الإرسال",
        description: `تم إرسال الرسالة إلى ${result.success} مستخدم${result.failed > 0 ? ` و${result.failed} فشل` : ""}`,
      });
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "حدث خطأ أثناء الإرسال",
        variant: "destructive",
      });
    },
  });

  const handleSendBroadcast = () => {
    if (!message.trim()) {
      toast({
        title: "تحذير",
        description: "يرجى كتابة رسالة قبل الإرسال",
        variant: "destructive",
      });
      return;
    }

    if (users.filter(u => !u.isBlocked).length === 0) {
      toast({
        title: "لا مستخدمين",
        description: "لا توجد مستخدمين نشطين للإرسال إليهم",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    broadcastMutation.mutate(message);
  };

  const activeUsers = users.filter(u => !u.isBlocked).length;

  return (
    <div className="space-y-6" data-testid="broadcast-page">
      <Card className="dark:bg-card/40 dark:backdrop-blur-sm dark:border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            إرسال رسالة جماعية
          </CardTitle>
          <CardDescription>
            أرسل رسالة لجميع المستخدمين المسجلين في النظام
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Count Info */}
          <Alert className="border-blue-500/50 bg-blue-500/10 dark:border-blue-400/30">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-300">
              عدد المستخدمين النشطين: <span className="font-bold">{activeUsers}</span> مستخدم
            </AlertDescription>
          </Alert>

          {/* Message Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              الرسالة
            </label>
            <Textarea
              placeholder="أكتب الرسالة التي تريد إرسالها لجميع المستخدمين..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending || usersLoading}
              className="min-h-[150px] resize-none dark:bg-background/50 dark:border-white/10"
              data-testid="textarea-broadcast-message"
            />
            <p className="text-xs text-muted-foreground">
              عدد الأحرف: {message.length}
            </p>
          </div>

          {/* Progress Info */}
          {isSending && (
            <Alert className="border-orange-500/50 bg-orange-500/10">
              <Loader2 className="h-4 w-4 animate-spin text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-300">
                جاري الإرسال: {sentCount} من {totalCount} ({totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0}%)
              </AlertDescription>
            </Alert>
          )}

          {/* Result Info */}
          {lastResult && !isSending && (
            <Alert className={`border-${lastResult.failed === 0 ? 'green' : 'yellow'}-500/50 bg-${lastResult.failed === 0 ? 'green' : 'yellow'}-500/10`}>
              <CheckCircle className={`h-4 w-4 text-${lastResult.failed === 0 ? 'green' : 'yellow'}-600 dark:text-${lastResult.failed === 0 ? 'green' : 'yellow'}-400`} />
              <AlertDescription className={`text-${lastResult.failed === 0 ? 'green' : 'yellow'}-800 dark:text-${lastResult.failed === 0 ? 'green' : 'yellow'}-300`}>
                تم الإرسال: {lastResult.success} نجح
                {lastResult.failed > 0 && ` و${lastResult.failed} فشل`}
              </AlertDescription>
            </Alert>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSendBroadcast}
            disabled={isSending || usersLoading || activeUsers === 0}
            className="w-full dark:bg-primary/80 dark:hover:bg-primary dark:text-white"
            size="lg"
            data-testid="button-send-broadcast"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                إرسال الرسالة
              </>
            )}
          </Button>

          {/* Info Box */}
          <div className="bg-muted/30 dark:bg-card/40 p-4 rounded-lg space-y-2 text-sm">
            <p className="font-medium">ملاحظات مهمة:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground dark:text-muted-foreground/80">
              <li>يتم إرسال الرسالة لكل مستخدم نشط فقط</li>
              <li>هناك تأخير 5 ثوان بين كل رسالة لتجنب الحظر</li>
              <li>المستخدمون المحظورون سيتم تجاهلهم</li>
              <li>سيتم عرض عدد الرسائل المرسلة بنجاح والمرسلة الفاشلة</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
