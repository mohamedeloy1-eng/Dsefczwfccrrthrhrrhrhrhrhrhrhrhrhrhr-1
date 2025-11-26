import { ConversationData, MessageData } from './types';
import { randomUUID } from 'crypto';

class ConversationStore {
  private conversations: Map<string, ConversationData> = new Map();
  private totalMessagesCount: number = 0;

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

  addMessage(
    phoneNumber: string, 
    content: string, 
    isBot: boolean, 
    timestamp: number
  ): ConversationData {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    let conversation = this.conversations.get(normalizedPhone);

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
        name: `User ${normalizedPhone.slice(-4)}`,
        lastMessage: content,
        timestamp: this.formatTimestamp(timestamp),
        unreadCount: isBot ? 0 : 1,
        messages: [message],
      };
      this.conversations.set(normalizedPhone, conversation);
    } else {
      conversation.messages.push(message);
      conversation.lastMessage = content;
      conversation.timestamp = this.formatTimestamp(timestamp);
      if (!isBot) {
        conversation.unreadCount++;
      }
    }

    this.totalMessagesCount++;
    return conversation;
  }

  getConversation(phoneNumber: string): ConversationData | undefined {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    return this.conversations.get(normalizedPhone);
  }

  getAllConversations(): ConversationData[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => {
        const timeA = a.messages[a.messages.length - 1];
        const timeB = b.messages[b.messages.length - 1];
        return (timeB ? 1 : 0) - (timeA ? 1 : 0);
      });
  }

  markAsRead(phoneNumber: string): void {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const conversation = this.conversations.get(normalizedPhone);
    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  getTotalMessagesCount(): number {
    return this.totalMessagesCount;
  }

  getUsersCount(): number {
    return this.conversations.size;
  }

  clearAll(): void {
    this.conversations.clear();
    this.totalMessagesCount = 0;
  }
}

export const conversationStore = new ConversationStore();
