import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Search, 
  Ban, 
  CheckCircle, 
  MessageSquare, 
  Trash2, 
  Settings2, 
  Clock, 
  AlertTriangle,
  Activity,
  UserCheck,
  UserX,
  Filter
} from "lucide-react";

interface UserData {
  id: string;
  phoneNumber: string;
  name: string;
  classification: 'normal' | 'test' | 'spam';
  isBlocked: boolean;
  messageLimit: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  messagesToday: number;
  lastActivity: string;
  createdAt: string;
  sessionId: string | null;
  errorCount: number;
  lastError: string | null;
}

interface UserStats {
  totalUsers: number;
  activeToday: number;
  blockedUsers: number;
  spamUsers: number;
  totalMessagesToday: number;
}

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
  messages: Message[];
}

export default function UserManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [newLimit, setNewLimit] = useState(20);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserData[]>({
    queryKey: ['/api/users'],
  });

  const { data: stats } = useQuery<UserStats>({
    queryKey: ['/api/users/stats/summary'],
  });

  const { data: selectedConversation } = useQuery<Conversation>({
    queryKey: ['/api/conversations', selectedUser?.phoneNumber],
    enabled: !!selectedUser && showChatDialog,
  });

  const blockMutation = useMutation({
    mutationFn: (phoneNumber: string) => apiRequest('POST', `/api/users/${phoneNumber}/block`, { reason: 'Blocked by admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/stats/summary'] });
      toast({ title: 'تم الحظر', description: 'تم حظر المستخدم بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في حظر المستخدم', variant: 'destructive' });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (phoneNumber: string) => apiRequest('POST', `/api/users/${phoneNumber}/unblock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/stats/summary'] });
      toast({ title: 'تم إلغاء الحظر', description: 'تم إلغاء حظر المستخدم بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في إلغاء الحظر', variant: 'destructive' });
    },
  });

  const classificationMutation = useMutation({
    mutationFn: ({ phoneNumber, classification }: { phoneNumber: string; classification: string }) => 
      apiRequest('POST', `/api/users/${phoneNumber}/classification`, { classification }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/stats/summary'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث تصنيف المستخدم' });
    },
  });

  const limitMutation = useMutation({
    mutationFn: ({ phoneNumber, limit }: { phoneNumber: string; limit: number }) => 
      apiRequest('POST', `/api/users/${phoneNumber}/limit`, { limit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowLimitDialog(false);
      toast({ title: 'تم التحديث', description: 'تم تحديث حد الرسائل' });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (phoneNumber: string) => apiRequest('POST', `/api/users/${phoneNumber}/delete-session`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'تم الحذف', description: 'تم حذف جلسة المستخدم' });
    },
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.phoneNumber.includes(searchQuery) || 
                         user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterClassification === "all" || user.classification === filterClassification;
    return matchesSearch && matchesFilter;
  });

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'spam':
        return <Badge variant="destructive">سبام</Badge>;
      case 'test':
        return <Badge variant="secondary">اختبار</Badge>;
      default:
        return <Badge variant="outline">عادي</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return date.toLocaleDateString('ar');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card data-testid="card-total-users">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المستخدمين</p>
                <p className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-today">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نشط اليوم</p>
                <p className="text-2xl font-bold" data-testid="text-active-today">{stats?.activeToday || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-blocked-users">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">محظورون</p>
                <p className="text-2xl font-bold" data-testid="text-blocked-users">{stats?.blockedUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-spam-users">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">سبام</p>
                <p className="text-2xl font-bold" data-testid="text-spam-users">{stats?.spamUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-messages-today">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">رسائل اليوم</p>
                <p className="text-2xl font-bold" data-testid="text-messages-today">{stats?.totalMessagesToday || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-user-list">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                إدارة المستخدمين
              </CardTitle>
              <CardDescription>جميع أرقام واتساب التي تفاعلت مع البوت</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث عن رقم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 w-full sm:w-[200px]"
                  data-testid="input-search-users"
                />
              </div>
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-filter-classification">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="فلترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="test">اختبار</SelectItem>
                  <SelectItem value="spam">سبام</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">جاري التحميل...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">لا يوجد مستخدمين</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 rounded-lg border ${user.isBlocked ? 'bg-red-500/5 border-red-500/20' : 'bg-card'}`}
                    data-testid={`user-row-${user.phoneNumber}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={user.isBlocked ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium" dir="ltr">{user.phoneNumber}</p>
                            {getClassificationBadge(user.classification)}
                            {user.isBlocked && (
                              <Badge variant="destructive" className="gap-1">
                                <Ban className="h-3 w-3" />
                                محظور
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(user.lastActivity)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {user.messagesToday} اليوم
                            </span>
                            <span>
                              إجمالي: {user.totalMessagesSent + user.totalMessagesReceived}
                            </span>
                            {user.errorCount > 0 && (
                              <span className="text-red-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {user.errorCount} أخطاء
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant={user.isBlocked ? "default" : "destructive"}
                          size="sm"
                          onClick={() => user.isBlocked ? unblockMutation.mutate(user.phoneNumber) : blockMutation.mutate(user.phoneNumber)}
                          disabled={blockMutation.isPending || unblockMutation.isPending}
                          data-testid={`button-${user.isBlocked ? 'unblock' : 'block'}-${user.phoneNumber}`}
                        >
                          {user.isBlocked ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              إلغاء الحظر
                            </>
                          ) : (
                            <>
                              <Ban className="h-4 w-4 mr-1" />
                              حظر
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowChatDialog(true);
                          }}
                          data-testid={`button-view-chat-${user.phoneNumber}`}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          المحادثة
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewLimit(user.messageLimit);
                            setShowLimitDialog(true);
                          }}
                          data-testid={`button-set-limit-${user.phoneNumber}`}
                        >
                          <Settings2 className="h-4 w-4 mr-1" />
                          الحد
                        </Button>

                        <Select
                          value={user.classification}
                          onValueChange={(value) => classificationMutation.mutate({ phoneNumber: user.phoneNumber, classification: value })}
                        >
                          <SelectTrigger className="w-[100px]" data-testid={`select-classification-${user.phoneNumber}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">عادي</SelectItem>
                            <SelectItem value="test">اختبار</SelectItem>
                            <SelectItem value="spam">سبام</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSessionMutation.mutate(user.phoneNumber)}
                          disabled={deleteSessionMutation.isPending}
                          data-testid={`button-delete-session-${user.phoneNumber}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              محادثة {selectedUser?.name}
            </DialogTitle>
            <DialogDescription dir="ltr">
              {selectedUser?.phoneNumber}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {selectedConversation?.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">لا توجد رسائل</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedConversation?.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        message.isBot
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-[10px] mt-1 ${message.isBot ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحديد حد الرسائل</DialogTitle>
            <DialogDescription>
              تحديد الحد الأقصى للرسائل في الدقيقة لـ {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الحد الأقصى: {newLimit} رسالة/دقيقة</Label>
              <Slider
                value={[newLimit]}
                onValueChange={(value) => setNewLimit(value[0])}
                min={1}
                max={100}
                step={1}
                data-testid="slider-message-limit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={() => selectedUser && limitMutation.mutate({ phoneNumber: selectedUser.phoneNumber, limit: newLimit })}
              disabled={limitMutation.isPending}
              data-testid="button-save-limit"
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
