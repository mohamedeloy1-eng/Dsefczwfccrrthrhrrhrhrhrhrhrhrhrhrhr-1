import { useQuery, useMutation } from "@tanstack/react-query";
import { type SupportTicket } from "@shared/schema";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Header from "@/components/Header";
import { useLocation } from "wouter";

export default function SupportPage() {
  const [location] = useLocation();
  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: status } = useQuery<any>({
    queryKey: ["/api/status"],
  });

  const { toast } = useToast();
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});

  const replyMutation = useMutation({
    mutationFn: async ({ id, response }: { id: number; response: string }) => {
      await apiRequest("POST", `/api/tickets/${id}/reply`, { response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "تم الإرسال",
        description: "تم إرسال الرد للمستخدم وإغلاق التذكرة بنجاح.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إرسال الرد.",
        variant: "destructive",
      });
    },
  });

  const toggleConnectionMutation = useMutation({
    mutationFn: async () => {
      const endpoint = status?.isConnected ? "/api/disconnect" : "/api/connect";
      await apiRequest("POST", endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
    }
  });

  const handleReply = (id: number) => {
    const text = replyText[id];
    if (!text?.trim()) return;
    replyMutation.mutate({ id, response: text });
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header 
        isConnected={!!status?.isConnected} 
        onToggleConnection={() => toggleConnectionMutation.mutate()} 
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">تذاكر الدعم الفني</h1>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tickets?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>لا توجد تذاكر دعم حالياً</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {tickets?.map((ticket) => (
                <Card key={ticket.id} className={ticket.status === 'closed' ? 'opacity-75' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
                    <CardTitle className="text-sm font-medium">
                      تذكرة #{ticket.id} - {ticket.phoneNumber}
                    </CardTitle>
                    <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                      {ticket.status === 'open' ? (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> مفتوحة</span>
                      ) : (
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> مغلقة</span>
                      )}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-sm font-semibold mb-1">المشكلة:</p>
                        <p className="text-sm whitespace-pre-wrap">{ticket.issue}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {format(new Date(ticket.createdAt), 'yyyy/MM/dd HH:mm')}
                        </p>
                      </div>

                      {ticket.status === 'open' ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="اكتب ردك هنا..."
                            value={replyText[ticket.id] || ''}
                            onChange={(e) => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                            className="min-h-[100px] text-right"
                            dir="rtl"
                          />
                          <Button 
                            onClick={() => handleReply(ticket.id)}
                            disabled={replyMutation.isPending || !replyText[ticket.id]?.trim()}
                            className="w-full"
                          >
                            {replyMutation.isPending && replyMutation.variables?.id === ticket.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            إرسال الرد وإغلاق التذكرة
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-primary/5 p-3 rounded-md border border-primary/10">
                          <p className="text-sm font-semibold mb-1 text-primary">الرد:</p>
                          <p className="text-sm italic">{ticket.response}</p>
                          <p className="text-[10px] text-muted-foreground mt-2">
                            تم الرد في: {format(new Date(ticket.updatedAt), 'yyyy/MM/dd HH:mm')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
