export interface ConversationData {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
}

export interface BotStatus {
  isConnected: boolean;
  isReady: boolean;
  qrCode: string | null;
  connectedNumber: string | null;
  pairingCode: string | null;
  messagesCount: number;
  usersCount: number;
}

export interface BotSettings {
  botName: string;
  systemPrompt: string;
  autoReply: boolean;
}
