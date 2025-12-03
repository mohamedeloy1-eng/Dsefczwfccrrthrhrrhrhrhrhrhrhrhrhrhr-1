import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  Search, 
  MessageSquare, 
  Pin,
  Clock,
  Phone,
  User,
  RefreshCw,
  MessageCircle,
  Smartphone
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface LinkedSession {
  id: string;
  phoneNumber: string;
  isConnected: boolean;
  isReady: boolean;
}

interface WhatsAppContact {
  id: string;
  phoneNumber: string;
  name: string;
  pushName: string | null;
  isMyContact: boolean;
  isGroup: boolean;
  lastSeen: string | null;
  profilePicUrl: string | null;
}

interface WhatsAppChat {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string | null;
  timestamp: string | null;
  unreadCount: number;
  isPinned: boolean;
  isGroup: boolean;
  isArchived: boolean;
  isMuted: boolean;
}

interface ContactsData {
  phoneNumber: string | null;
  contacts: WhatsAppContact[];
  pinnedChats: WhatsAppChat[];
  recentChats: WhatsAppChat[];
  lastUpdated: string;
}

export default function ContactsConversations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: sessions = [] } = useQuery<LinkedSession[]>({
    queryKey: ['/api/sessions'],
    refetchInterval: 30000,
  });

  const activeSessions = sessions.filter(s => s.isConnected && s.isReady);

  const { data: contactsData, isLoading, refetch, isRefetching } = useQuery<ContactsData>({
    queryKey: ['/api/whatsapp/contacts-data', selectedSessionId],
    queryFn: async () => {
      const url = selectedSessionId 
        ? `/api/whatsapp/contacts-data?sessionId=${selectedSessionId}`
        : '/api/whatsapp/contacts-data';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
    refetchInterval: 60000,
    enabled: activeSessions.length > 0 || !selectedSessionId,
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId === 'all' ? null : sessionId);
  };

  const filteredContacts = (contactsData?.contacts || []).filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phoneNumber.includes(searchQuery)
  );

  const filteredPinnedChats = (contactsData?.pinnedChats || []).filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phoneNumber.includes(searchQuery)
  );

  const filteredRecentChats = (contactsData?.recentChats || []).filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.phoneNumber.includes(searchQuery)
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (activeSessions.length === 0 && !contactsData?.phoneNumber) {
    return (
      <Card data-testid="card-no-connection">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">غير متصل</p>
            <p className="text-sm text-muted-foreground mt-2">
              يرجى الاتصال بواتساب أولاً لعرض جهات الاتصال والمحادثات
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-contacts-info">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                جهات الاتصال والمحادثات
              </CardTitle>
              {activeSessions.length > 1 ? (
                <div className="flex items-center gap-2 mt-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <Select 
                    value={selectedSessionId || 'all'} 
                    onValueChange={handleSessionChange}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-session">
                      <SelectValue placeholder="اختر جلسة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الجلسات</SelectItem>
                      {activeSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          +{session.phoneNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : contactsData?.phoneNumber && (
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">+{contactsData.phoneNumber}</span>
                </CardDescription>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
              data-testid="button-refresh-contacts"
            >
              <RefreshCw className={`h-4 w-4 ml-2 ${isRefetching ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-contacts-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">جهات الاتصال</p>
                <p className="text-2xl font-bold" data-testid="text-contacts-count">
                  {contactsData?.contacts?.length ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pinned-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-500/10">
                <Pin className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المحادثات المثبتة</p>
                <p className="text-2xl font-bold" data-testid="text-pinned-count">
                  {contactsData?.pinnedChats?.length ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-recent-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <MessageCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المحادثات الحديثة</p>
                <p className="text-2xl font-bold" data-testid="text-recent-count">
                  {contactsData?.recentChats?.length ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-contacts-list">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="contacts" className="gap-2" data-testid="tab-contacts-list">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">جهات الاتصال</span>
                </TabsTrigger>
                <TabsTrigger value="pinned" className="gap-2" data-testid="tab-pinned-chats">
                  <Pin className="h-4 w-4" />
                  <span className="hidden sm:inline">المثبتة</span>
                </TabsTrigger>
                <TabsTrigger value="recent" className="gap-2" data-testid="tab-recent-chats">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">الحديثة</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="relative mt-4">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
              data-testid="input-search-contacts"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="contacts" className="mt-0">
                <ScrollArea className="h-[400px]">
                  {filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">لا توجد جهات اتصال</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                          data-testid={`contact-row-${contact.phoneNumber}`}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{contact.name}</p>
                            <p className="text-sm text-muted-foreground" dir="ltr">
                              {contact.phoneNumber}
                            </p>
                          </div>
                          {contact.isMyContact && (
                            <Badge variant="outline" className="shrink-0">
                              <User className="h-3 w-3 ml-1" />
                              جهة اتصال
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="pinned" className="mt-0">
                <ScrollArea className="h-[400px]">
                  {filteredPinnedChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Pin className="h-12 w-12 text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">لا توجد محادثات مثبتة</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredPinnedChats.map((chat) => (
                        <div
                          key={chat.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                          data-testid={`pinned-chat-row-${chat.phoneNumber}`}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-yellow-500/10 text-yellow-600">
                              {getInitials(chat.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{chat.name}</p>
                              <Pin className="h-3 w-3 text-yellow-500 shrink-0" />
                            </div>
                            {chat.lastMessage && (
                              <p className="text-sm text-muted-foreground truncate">
                                {chat.lastMessage}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {chat.timestamp && (
                              <span className="text-xs text-muted-foreground">{chat.timestamp}</span>
                            )}
                            {chat.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 min-w-5">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="recent" className="mt-0">
                <ScrollArea className="h-[400px]">
                  {filteredRecentChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">لا توجد محادثات حديثة</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRecentChats.map((chat) => (
                        <div
                          key={chat.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                          data-testid={`recent-chat-row-${chat.phoneNumber}`}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-500/10 text-blue-600">
                              {getInitials(chat.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{chat.name}</p>
                              {chat.isPinned && (
                                <Pin className="h-3 w-3 text-yellow-500 shrink-0" />
                              )}
                            </div>
                            {chat.lastMessage && (
                              <p className="text-sm text-muted-foreground truncate">
                                {chat.lastMessage}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {chat.timestamp && (
                              <span className="text-xs text-muted-foreground">{chat.timestamp}</span>
                            )}
                            {chat.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 min-w-5">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
