import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="h-full" data-testid="card-conversations">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Recent Conversations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                No conversations yet
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-md text-left transition-colors hover-elevate ${
                    selectedId === conv.id ? 'bg-accent' : ''
                  }`}
                  data-testid={`button-conversation-${conv.id}`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(conv.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{conv.name}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {conv.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge variant="default" className="shrink-0 h-5 min-w-5 flex items-center justify-center text-xs">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
