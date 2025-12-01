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
  safeModeEnabled?: boolean;
}

export interface BotSettings {
  botName: string;
  systemPrompt: string;
  autoReply: boolean;
}

// User classification types
export type UserClassification = 'normal' | 'test' | 'spam';

// User data with full management capabilities
export interface UserData {
  id: string;
  phoneNumber: string;
  name: string;
  classification: UserClassification;
  isBlocked: boolean;
  messageLimit: number; // messages per minute
  totalMessagesSent: number;
  totalMessagesReceived: number;
  messagesToday: number;
  lastActivity: Date;
  createdAt: Date;
  sessionId: string | null;
  errorCount: number;
  lastError: string | null;
}

// Log entry for complete logging system
export interface LogEntry {
  id: string;
  timestamp: Date;
  direction: 'incoming' | 'outgoing';
  phoneNumber: string;
  sessionId: string;
  content: string;
  messageType: 'text' | 'image' | 'sticker' | 'error' | 'system';
  status: 'success' | 'failed' | 'blocked' | 'rate_limited';
  errorMessage?: string;
}

// Rate limiting data per user
export interface RateLimitData {
  phoneNumber: string;
  messageCount: number;
  windowStart: Date;
  blocked: boolean;
  blockReason?: string;
  blockExpiry?: Date;
}

// Security settings
export interface SecuritySettings {
  defaultMessageLimit: number; // default messages per minute
  spamThreshold: number; // error count before auto-ban
  autoBlockEnabled: boolean;
  safeModeEnabled: boolean;
  maxMessagesPerDay: number;
}

// User statistics
export interface UserStats {
  totalUsers: number;
  activeToday: number;
  blockedUsers: number;
  spamUsers: number;
  totalMessagesToday: number;
}
