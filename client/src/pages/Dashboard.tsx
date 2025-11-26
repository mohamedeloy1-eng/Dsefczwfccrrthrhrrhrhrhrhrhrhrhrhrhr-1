import { useState } from "react";
import Header from "@/components/Header";
import StatusCard from "@/components/StatusCard";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import ConversationList from "@/components/ConversationList";
import ChatView from "@/components/ChatView";
import SettingsPanel from "@/components/SettingsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Settings, QrCode } from "lucide-react";

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
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: Message[];
}

// todo: remove mock functionality - replace with real API data
const mockConversations: Conversation[] = [
  {
    id: '1',
    phoneNumber: '+201234567890',
    name: 'Ahmed Mohamed',
    lastMessage: 'Thank you for your help!',
    timestamp: '2m ago',
    unreadCount: 2,
    messages: [
      { id: '1', content: 'Hello!', isBot: false, timestamp: '10:28 AM' },
      { id: '2', content: 'Hello! I am GX-MODY, your AI assistant. How can I help you today?', isBot: true, timestamp: '10:28 AM' },
      { id: '3', content: 'What is the weather like today?', isBot: false, timestamp: '10:29 AM' },
      { id: '4', content: 'I can help you with many things, but I don\'t have access to real-time weather data. I recommend checking a weather app or website for accurate information about your location.', isBot: true, timestamp: '10:29 AM' },
      { id: '5', content: 'Thank you for your help!', isBot: false, timestamp: '10:30 AM' },
    ],
  },
  {
    id: '2',
    phoneNumber: '+201987654321',
    name: 'Sara Ali',
    lastMessage: 'Can you help me with coding?',
    timestamp: '15m ago',
    unreadCount: 0,
    messages: [
      { id: '1', content: 'Hi, can you help me with coding?', isBot: false, timestamp: '10:15 AM' },
      { id: '2', content: 'Of course! I\'d be happy to help you with coding. What programming language or specific problem are you working with?', isBot: true, timestamp: '10:15 AM' },
    ],
  },
  {
    id: '3',
    phoneNumber: '+201122334455',
    name: 'Omar Hassan',
    lastMessage: 'What is AI?',
    timestamp: '1h ago',
    unreadCount: 1,
    messages: [
      { id: '1', content: 'What is AI?', isBot: false, timestamp: '9:30 AM' },
      { id: '2', content: 'AI stands for Artificial Intelligence. It refers to computer systems designed to perform tasks that typically require human intelligence, such as learning, problem-solving, understanding language, and recognizing patterns.', isBot: true, timestamp: '9:30 AM' },
    ],
  },
];

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(true); // todo: remove mock functionality
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>('1');
  const [conversations] = useState<Conversation[]>(mockConversations); // todo: remove mock functionality

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const handleToggleConnection = () => {
    setIsConnected(!isConnected);
  };

  const handleRefreshQR = () => {
    console.log('Refreshing QR code...'); // todo: remove mock functionality
  };

  const handleSaveSettings = (settings: { botName: string; systemPrompt: string; autoReply: boolean }) => {
    console.log('Saving settings:', settings); // todo: remove mock functionality
  };

  // todo: remove mock functionality - calculate from real data
  const messagesCount = conversations.reduce((acc, c) => acc + c.messages.length, 0);
  const usersCount = conversations.length;

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Header isConnected={isConnected} onToggleConnection={handleToggleConnection} />
      
      <main className="container px-4 py-6 space-y-6">
        <StatusCard 
          status={isConnected ? "connected" : "disconnected"} 
          messagesCount={messagesCount}
          usersCount={usersCount}
        />

        <Tabs defaultValue="conversations" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="conversations" className="gap-2" data-testid="tab-conversations">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chats</span>
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2" data-testid="tab-connection">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">Connect</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
              />
              {selectedConversation ? (
                <ChatView
                  messages={selectedConversation.messages}
                  userName={selectedConversation.name}
                />
              ) : (
                <div className="hidden lg:flex items-center justify-center h-[450px] bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">Select a conversation to view</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="connection" className="mt-6">
            <div className="max-w-md mx-auto">
              <QRCodeDisplay
                qrCode={null}
                isConnected={isConnected}
                onRefresh={handleRefreshQR}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="max-w-lg mx-auto">
              <SettingsPanel
                botName="GX-MODY"
                systemPrompt="You are GX-MODY, a helpful and friendly AI assistant. Answer questions clearly and concisely. Always be polite and helpful."
                autoReply={true}
                onSave={handleSaveSettings}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
