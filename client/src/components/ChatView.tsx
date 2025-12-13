import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, User, Image, Mic, Play, Pause, Sparkles, Reply, Sticker } from "lucide-react";
import { useState, useRef } from "react";

type MessageType = "text" | "image" | "sticker" | "voice" | "error" | "system";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
  messageType?: MessageType;
  mediaUrl?: string;
  replyTo?: {
    id: string;
    content: string;
    isBot: boolean;
  };
}

interface ChatViewProps {
  messages: Message[];
  userName: string;
  onSummarize?: () => void;
  isSummarizing?: boolean;
  summary?: string;
}

function VoiceMessagePreview({ url, isBot }: { url?: string; isBot: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(percent);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="hidden"
      />
      <Button
        size="icon"
        variant="ghost"
        className={`h-8 w-8 shrink-0 ${isBot ? 'hover:bg-background/50' : 'hover:bg-primary-foreground/20'}`}
        onClick={togglePlay}
        data-testid="button-voice-play"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <div className="flex-1 h-1.5 bg-current/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-current rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <Mic className="h-4 w-4 opacity-50" />
    </div>
  );
}

function ImagePreview({ url, alt }: { url?: string; alt: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className="flex items-center justify-center w-48 h-48 bg-muted/50 rounded-md">
        <Image className="h-8 w-8 opacity-50" />
      </div>
    );
  }

  return (
    <div className="relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-md">
          <div className="animate-pulse">
            <Image className="h-8 w-8 opacity-50" />
          </div>
        </div>
      )}
      <img
        src={url}
        alt={alt}
        className="max-w-[200px] max-h-[200px] rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        data-testid="img-message-preview"
      />
    </div>
  );
}

function StickerPreview({ url }: { url?: string }) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className="flex items-center justify-center w-24 h-24 bg-transparent">
        <Sticker className="h-8 w-8 opacity-50" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Sticker"
      className="max-w-[120px] max-h-[120px] object-contain"
      onError={() => setHasError(true)}
      data-testid="img-sticker-preview"
    />
  );
}

function ReplyPreview({ replyTo }: { replyTo: Message["replyTo"] }) {
  if (!replyTo) return null;

  return (
    <div className="flex items-start gap-1.5 mb-1.5 pl-2 border-l-2 border-current/30 opacity-70">
      <Reply className="h-3 w-3 mt-0.5 shrink-0" />
      <div className="text-xs truncate max-w-[180px]">
        <span className="font-medium">{replyTo.isBot ? "Bot" : "User"}: </span>
        {replyTo.content.slice(0, 50)}{replyTo.content.length > 50 ? "..." : ""}
      </div>
    </div>
  );
}

function MessageContent({ message }: { message: Message }) {
  const messageType = message.messageType || "text";

  switch (messageType) {
    case "image":
      return (
        <div>
          <ImagePreview url={message.mediaUrl} alt="Shared image" />
          {message.content && (
            <p className="text-sm whitespace-pre-wrap mt-2">{message.content}</p>
          )}
        </div>
      );
    
    case "voice":
      return (
        <VoiceMessagePreview url={message.mediaUrl} isBot={message.isBot} />
      );
    
    case "sticker":
      return <StickerPreview url={message.mediaUrl} />;
    
    case "error":
      return (
        <p className="text-sm whitespace-pre-wrap text-destructive">
          {message.content}
        </p>
      );
    
    case "system":
      return (
        <p className="text-sm whitespace-pre-wrap italic opacity-70">
          {message.content}
        </p>
      );
    
    default:
      return (
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      );
  }
}

export default function ChatView({ 
  messages, 
  userName, 
  onSummarize, 
  isSummarizing,
  summary 
}: ChatViewProps) {
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
        <div className="flex items-center justify-between gap-2">
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
          {onSummarize && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSummarize}
              disabled={isSummarizing || messages.length === 0}
              className="gap-1.5"
              data-testid="button-summarize"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isSummarizing ? "Summarizing..." : "AI Summary"}
            </Button>
          )}
        </div>
        {summary && (
          <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">AI Summary</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-summary">
              {summary}
            </p>
          </div>
        )}
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
                    message.messageType === 'sticker' 
                      ? 'bg-transparent p-0' 
                      : message.isBot
                        ? 'bg-muted text-foreground'
                        : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {message.replyTo && <ReplyPreview replyTo={message.replyTo} />}
                  <MessageContent message={message} />
                  {message.messageType !== 'sticker' && (
                    <p className={`text-[10px] mt-1 ${message.isBot ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                      {message.timestamp}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
