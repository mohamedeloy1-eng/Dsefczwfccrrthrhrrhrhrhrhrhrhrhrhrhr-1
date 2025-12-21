import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  const [manualPhoneNumber, setManualPhoneNumber] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const broadcastMutation = useMutation({
    mutationFn: async (msg: string) => {
      // Determine recipients
      let recipients: string[] = [];
      
      if (manualPhoneNumber.trim()) {
        // Use manual phone number if provided
        recipients = [manualPhoneNumber.trim()];
      } else {
        // Use registered users
        const activeUsers = users.filter(u => !u.isBlocked);
        recipients = activeUsers.map(u => u.phoneNumber);
      }

      if (recipients.length === 0) {
        throw new Error("لا توجد أرقام هواتف للإرسال إليها");
      }

      setTotalCount(recipients.length);
      setSentCount(0);
      setLastResult(null);

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const phoneNumber = recipients[i];
        try {
          const response = await apiRequest("POST", "/api/broadcast/send", {
            phoneNumber,
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
        if (i < recipients.length - 1) {
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
      setIsSending(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "حدث خطأ أثناء الإرسال",
        variant: "destructive",
      });
      setIsSending(false);
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

    const activeUsers = users.filter(u => !u.isBlocked);
    const hasManualNumber = manualPhoneNumber.trim().length > 0;

    if (activeUsers.length === 0 && !hasManualNumber) {
      toast({
        title: "تحذير",
        description: "الرجاء إدخال رقم هاتف أو وجود مستخدمين مسجلين",
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

          {/* Manual Phone Number Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              رقم هاتف محدد (اختياري)
            </label>
            <Input
              placeholder="أدخل رقم الهاتف مثل: 20xxxxxxxxx"
              value={manualPhoneNumber}
              onChange={(e) => setManualPhoneNumber(e.target.value)}
              disabled={isSending || usersLoading}
              className="dark:bg-background/50 dark:border-white/10"
              data-testid="input-manual-phone"
            />
            <p className="text-xs text-muted-foreground">
              إذا أدخلت رقم هاتف، ستُرسل الرسالة إليه. وإلا ستُرسل لجميع المستخدمين المسجلين
            </p>
          </div>

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
            <Alert className={lastResult.failed === 0 ? "border-green-500/50 bg-green-500/10" : "border-yellow-500/50 bg-yellow-500/10"}>
              <CheckCircle className={lastResult.failed === 0 ? "h-4 w-4 text-green-600 dark:text-green-400" : "h-4 w-4 text-yellow-600 dark:text-yellow-400"} />
              <AlertDescription className={lastResult.failed === 0 ? "text-green-800 dark:text-green-300" : "text-yellow-800 dark:text-yellow-300"}>
                تم الإرسال: {lastResult.success} نجح
                {lastResult.failed > 0 && ` و${lastResult.failed} فشل`}
              </AlertDescription>
            </Alert>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSendBroadcast}
            disabled={isSending || usersLoading}
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
