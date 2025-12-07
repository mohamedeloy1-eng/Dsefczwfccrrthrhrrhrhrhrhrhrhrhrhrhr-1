import { ConversationData, MessageData } from './types';
import { randomUUID } from 'crypto';

class ConversationStore {
  private sessionConversations: Map<string, Map<string, ConversationData>> = new Map();
  private sessionMessageCounts: Map<string, number> = new Map();
  private defaultSessionId: string = 'default';

  private getSessionMap(sessionId: string = this.defaultSessionId): Map<string, ConversationData> {
    if (!this.sessionConversations.has(sessionId)) {
      this.sessionConversations.set(sessionId, new Map());
    }
    return this.sessionConversations.get(sessionId)!;
  }

  private formatPhoneNumber(phone: string): string {
    return phone.replace('@c.us', '').replace(/\D/g, '');
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  private formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  setDefaultSessionId(sessionId: string): void {
    this.defaultSessionId = sessionId;
  }

  addMessage(
    phoneNumber: string, 
    content: string, 
    isBot: boolean, 
    timestamp: number,
    sessionId?: string
  ): ConversationData {
    const sid = sessionId || this.defaultSessionId;
    const conversations = this.getSessionMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    let conversation = conversations.get(normalizedPhone);

    const message: MessageData = {
      id: randomUUID(),
      content,
      isBot,
      timestamp: this.formatMessageTime(timestamp),
    };

    if (!conversation) {
      conversation = {
        id: randomUUID(),
        phoneNumber: normalizedPhone,
        name: `+${normalizedPhone}`,
        lastMessage: content,
        timestamp: this.formatTimestamp(timestamp),
        unreadCount: isBot ? 0 : 1,
        messages: [message],
      };
      conversations.set(normalizedPhone, conversation);
    } else {
      conversation.messages.push(message);
      conversation.lastMessage = content;
      conversation.timestamp = this.formatTimestamp(timestamp);
      if (!isBot) {
        conversation.unreadCount++;
      }
    }

    const currentCount = this.sessionMessageCounts.get(sid) || 0;
    this.sessionMessageCounts.set(sid, currentCount + 1);
    
    return conversation;
  }

  getConversation(phoneNumber: string, sessionId?: string): ConversationData | undefined {
    const sid = sessionId || this.defaultSessionId;
    const conversations = this.getSessionMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    return conversations.get(normalizedPhone);
  }

  getAllConversations(sessionId?: string): ConversationData[] {
    const sid = sessionId || this.defaultSessionId;
    const conversations = this.getSessionMap(sid);
    return Array.from(conversations.values())
      .sort((a, b) => {
        const timeA = a.messages[a.messages.length - 1];
        const timeB = b.messages[b.messages.length - 1];
        return (timeB ? 1 : 0) - (timeA ? 1 : 0);
      });
  }

  getAllSessionsConversations(): ConversationData[] {
    const allConversations: ConversationData[] = [];
    this.sessionConversations.forEach((conversations) => {
      allConversations.push(...conversations.values());
    });
    return allConversations.sort((a, b) => {
      const timeA = a.messages[a.messages.length - 1];
      const timeB = b.messages[b.messages.length - 1];
      return (timeB ? 1 : 0) - (timeA ? 1 : 0);
    });
  }

  markAsRead(phoneNumber: string, sessionId?: string): void {
    const sid = sessionId || this.defaultSessionId;
    const conversations = this.getSessionMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const conversation = conversations.get(normalizedPhone);
    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  getTotalMessagesCount(sessionId?: string): number {
    if (sessionId) {
      return this.sessionMessageCounts.get(sessionId) || 0;
    }
    let total = 0;
    this.sessionMessageCounts.forEach((count) => {
      total += count;
    });
    return total;
  }

  getUsersCount(sessionId?: string): number {
    if (sessionId) {
      return this.getSessionMap(sessionId).size;
    }
    let total = 0;
    this.sessionConversations.forEach((conversations) => {
      total += conversations.size;
    });
    return total;
  }

  clearSession(sessionId: string): void {
    this.sessionConversations.delete(sessionId);
    this.sessionMessageCounts.delete(sessionId);
  }

  clearAll(): void {
    this.sessionConversations.clear();
    this.sessionMessageCounts.clear();
  }
}

export const conversationStore = new ConversationStore();
