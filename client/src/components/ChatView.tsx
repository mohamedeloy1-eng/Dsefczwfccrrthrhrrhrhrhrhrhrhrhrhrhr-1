import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
}

interface ChatViewProps {
  messages: Message[];
  userName: string;
}

export default function ChatView({ messages, userName }: ChatViewProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="h-full flex flex-col" data-testid="card-chat-view">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground">Active conversation</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[350px]">
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${message.isBot ? '' : 'flex-row-reverse'}`}
                data-testid={`message-${message.id}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={message.isBot ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                    {message.isBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
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
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
