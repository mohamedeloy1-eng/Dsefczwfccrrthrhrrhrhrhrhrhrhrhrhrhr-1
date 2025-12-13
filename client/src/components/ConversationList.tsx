import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Search, Pin, Clock, Image, Mic, Sticker } from "lucide-react";
import { useState, useMemo } from "react";

type MessageType = "text" | "image" | "sticker" | "voice" | "error" | "system";

interface Conversation {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageType?: MessageType;
  timestamp: string;
  unreadCount: number;
  isPinned?: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function LastMessagePreview({ message, type }: { message: string; type?: MessageType }) {
  const messageType = type || "text";
  
  switch (messageType) {
    case "image":
      return (
        <span className="flex items-center gap-1">
          <Image className="h-3 w-3" />
          <span>Photo</span>
        </span>
      );
    case "voice":
      return (
        <span className="flex items-center gap-1">
          <Mic className="h-3 w-3" />
          <span>Voice message</span>
        </span>
      );
    case "sticker":
      return (
        <span className="flex items-center gap-1">
          <Sticker className="h-3 w-3" />
          <span>Sticker</span>
        </span>
      );
    default:
      return <span>{message}</span>;
  }
}

function ConversationItem({ 
  conv, 
  isSelected, 
  onSelect 
}: { 
  conv: Conversation; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-3 p-3 rounded-md text-left transition-colors hover-elevate ${
        isSelected ? 'bg-accent' : ''
      }`}
      data-testid={`button-conversation-${conv.id}`}
    >
      <div className="relative">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(conv.name)}
          </AvatarFallback>
        </Avatar>
        {conv.isPinned && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
            <Pin className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm truncate">{conv.name}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {conv.timestamp}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          <LastMessagePreview message={conv.lastMessage} type={conv.lastMessageType} />
        </p>
      </div>
      {conv.unreadCount > 0 && (
        <Badge variant="default" className="shrink-0 h-5 min-w-5 flex items-center justify-center text-xs">
          {conv.unreadCount}
        </Badge>
      )}
    </button>
  );
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredConversations = useMemo(() => {
    let result = conversations;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(conv => 
        conv.name.toLowerCase().includes(query) ||
        conv.phoneNumber.includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
      );
    }

    switch (activeTab) {
      case "pinned":
        result = result.filter(conv => conv.isPinned);
        break;
      case "recent":
        result = result.slice(0, 10);
        break;
      default:
        break;
    }

    return result;
  }, [conversations, searchQuery, activeTab]);

  const pinnedCount = useMemo(() => 
    conversations.filter(c => c.isPinned).length, 
    [conversations]
  );

  return (
    <Card className="h-full" data-testid="card-conversations">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Conversations
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
            data-testid="input-search-conversations"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs gap-1" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="pinned" className="text-xs gap-1" data-testid="tab-pinned">
              <Pin className="h-3 w-3" />
              {pinnedCount > 0 && <span>({pinnedCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="recent" className="text-xs gap-1" data-testid="tab-recent">
              <Clock className="h-3 w-3" />
              Recent
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                {searchQuery ? "No conversations found" : "No conversations yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isSelected={selectedId === conv.id}
                  onSelect={() => onSelect(conv.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
