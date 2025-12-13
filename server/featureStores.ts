import { randomUUID } from 'crypto';

export interface ScheduledMessage {
  id: string;
  phoneNumber: string;
  message: string;
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sessionId?: string;
  repeatType?: string;
  createdAt: Date;
  sentAt?: Date;
  errorMessage?: string;
}

export interface Reminder {
  id: string;
  phoneNumber: string;
  title: string;
  description?: string;
  remindAt: Date;
  status: 'active' | 'triggered' | 'cancelled';
  sessionId?: string;
  createdAt: Date;
  triggeredAt?: Date;
}

export interface WelcomeMessage {
  id: string;
  sessionId?: string;
  message: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut?: string;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  buttons?: InteractiveButton[];
}

export interface InteractiveButton {
  id: string;
  templateId?: string;
  label: string;
  action: string;
  payload?: any;
  order: number;
}

export interface AnalyticsSnapshot {
  id: string;
  date: Date;
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  blockedUsers: number;
  voiceMessages: number;
  scheduledMessages: number;
  topQuestions?: any;
  peakHours?: any;
  sessionId?: string;
  createdAt: Date;
}

export interface VoiceSettings {
  id: string;
  isEnabled: boolean;
  ttsVoice: string;
  sttEnabled: boolean;
  autoVoiceReply: boolean;
  updatedAt: Date;
}

export interface ExternalIntegration {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  config?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  tier: 'free' | 'basic' | 'premium' | 'vip';
  messagesPerMinute: number;
  messagesPerDay: number;
  voiceMessagesEnabled: boolean;
  schedulingEnabled: boolean;
  analyticsEnabled: boolean;
  priority: number;
  createdAt: Date;
}

export interface UserMemory {
  id: string;
  phoneNumber: string;
  key: string;
  value: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

class ScheduledMessagesStore {
  private messages: Map<string, ScheduledMessage> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private messageHandler: ((phoneNumber: string, message: string, sessionId?: string) => Promise<boolean>) | null = null;

  constructor() {
    this.startChecker();
  }

  setMessageHandler(handler: (phoneNumber: string, message: string, sessionId?: string) => Promise<boolean>) {
    this.messageHandler = handler;
  }

  private startChecker() {
    this.checkInterval = setInterval(() => this.checkPendingMessages(), 30000);
  }

  private async checkPendingMessages() {
    const now = new Date();
    for (const [id, msg] of this.messages) {
      if (msg.status === 'pending' && msg.scheduledAt <= now) {
        await this.sendScheduledMessage(id);
      }
    }
  }

  private async sendScheduledMessage(id: string) {
    const msg = this.messages.get(id);
    if (!msg || !this.messageHandler) return;

    try {
      const success = await this.messageHandler(msg.phoneNumber + '@c.us', msg.message, msg.sessionId);
      if (success) {
        msg.status = 'sent';
        msg.sentAt = new Date();
        if (msg.repeatType) {
          this.scheduleNext(msg);
        }
      } else {
        msg.status = 'failed';
        msg.errorMessage = 'Failed to send message';
      }
    } catch (error: any) {
      msg.status = 'failed';
      msg.errorMessage = error?.message || 'Unknown error';
    }
    this.messages.set(id, msg);
  }

  private scheduleNext(msg: ScheduledMessage) {
    const newMsg: ScheduledMessage = {
      ...msg,
      id: randomUUID(),
      status: 'pending',
      sentAt: undefined,
      errorMessage: undefined,
      createdAt: new Date(),
    };
    
    const nextDate = new Date(msg.scheduledAt);
    switch (msg.repeatType) {
      case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
    }
    newMsg.scheduledAt = nextDate;
    this.messages.set(newMsg.id, newMsg);
  }

  create(data: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status'>): ScheduledMessage {
    const msg: ScheduledMessage = {
      ...data,
      id: randomUUID(),
      status: 'pending',
      createdAt: new Date(),
    };
    this.messages.set(msg.id, msg);
    return msg;
  }

  getAll(): ScheduledMessage[] {
    return Array.from(this.messages.values()).sort((a, b) => 
      a.scheduledAt.getTime() - b.scheduledAt.getTime()
    );
  }

  get(id: string): ScheduledMessage | undefined {
    return this.messages.get(id);
  }

  cancel(id: string): boolean {
    const msg = this.messages.get(id);
    if (msg && msg.status === 'pending') {
      msg.status = 'cancelled';
      this.messages.set(id, msg);
      return true;
    }
    return false;
  }

  delete(id: string): boolean {
    return this.messages.delete(id);
  }

  getByPhone(phoneNumber: string): ScheduledMessage[] {
    return this.getAll().filter(m => m.phoneNumber === phoneNumber);
  }
}

class RemindersStore {
  private reminders: Map<string, Reminder> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private reminderHandler: ((phoneNumber: string, title: string, description?: string, sessionId?: string) => Promise<void>) | null = null;

  constructor() {
    this.startChecker();
  }

  setReminderHandler(handler: (phoneNumber: string, title: string, description?: string, sessionId?: string) => Promise<void>) {
    this.reminderHandler = handler;
  }

  private startChecker() {
    this.checkInterval = setInterval(() => this.checkActiveReminders(), 30000);
  }

  private async checkActiveReminders() {
    const now = new Date();
    for (const [id, reminder] of this.reminders) {
      if (reminder.status === 'active' && reminder.remindAt <= now) {
        await this.triggerReminder(id);
      }
    }
  }

  private async triggerReminder(id: string) {
    const reminder = this.reminders.get(id);
    if (!reminder || !this.reminderHandler) return;

    try {
      await this.reminderHandler(reminder.phoneNumber, reminder.title, reminder.description, reminder.sessionId);
      reminder.status = 'triggered';
      reminder.triggeredAt = new Date();
      this.reminders.set(id, reminder);
    } catch (error) {
      console.error('Failed to trigger reminder:', error);
    }
  }

  create(data: Omit<Reminder, 'id' | 'createdAt' | 'status'>): Reminder {
    const reminder: Reminder = {
      ...data,
      id: randomUUID(),
      status: 'active',
      createdAt: new Date(),
    };
    this.reminders.set(reminder.id, reminder);
    return reminder;
  }

  getAll(): Reminder[] {
    return Array.from(this.reminders.values()).sort((a, b) => 
      a.remindAt.getTime() - b.remindAt.getTime()
    );
  }

  get(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  cancel(id: string): boolean {
    const reminder = this.reminders.get(id);
    if (reminder && reminder.status === 'active') {
      reminder.status = 'cancelled';
      this.reminders.set(id, reminder);
      return true;
    }
    return false;
  }

  delete(id: string): boolean {
    return this.reminders.delete(id);
  }

  getByPhone(phoneNumber: string): Reminder[] {
    return this.getAll().filter(r => r.phoneNumber === phoneNumber);
  }
}

class WelcomeMessagesStore {
  private messages: Map<string, WelcomeMessage> = new Map();

  constructor() {
    const defaultMsg: WelcomeMessage = {
      id: randomUUID(),
      message: 'مرحباً بك! 👋 أنا GX-MODY، مساعدك الذكي على واتساب. كيف يمكنني مساعدتك اليوم؟',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.messages.set(defaultMsg.id, defaultMsg);
  }

  getAll(): WelcomeMessage[] {
    return Array.from(this.messages.values());
  }

  get(id: string): WelcomeMessage | undefined {
    return this.messages.get(id);
  }

  getDefault(): WelcomeMessage | undefined {
    return this.getAll().find(m => !m.sessionId && m.isEnabled);
  }

  getForSession(sessionId: string): WelcomeMessage | undefined {
    return this.getAll().find(m => m.sessionId === sessionId && m.isEnabled) || this.getDefault();
  }

  create(data: Omit<WelcomeMessage, 'id' | 'createdAt' | 'updatedAt'>): WelcomeMessage {
    const msg: WelcomeMessage = {
      ...data,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.messages.set(msg.id, msg);
    return msg;
  }

  update(id: string, data: Partial<WelcomeMessage>): WelcomeMessage | undefined {
    const msg = this.messages.get(id);
    if (msg) {
      Object.assign(msg, data, { updatedAt: new Date() });
      this.messages.set(id, msg);
      return msg;
    }
    return undefined;
  }

  delete(id: string): boolean {
    return this.messages.delete(id);
  }
}

class ReplyTemplatesStore {
  private templates: Map<string, ReplyTemplate> = new Map();
  private buttons: Map<string, InteractiveButton> = new Map();

  getAll(): ReplyTemplate[] {
    const templates = Array.from(this.templates.values());
    return templates.map(t => ({
      ...t,
      buttons: this.getButtonsForTemplate(t.id),
    }));
  }

  get(id: string): ReplyTemplate | undefined {
    const template = this.templates.get(id);
    if (template) {
      return { ...template, buttons: this.getButtonsForTemplate(id) };
    }
    return undefined;
  }

  getByShortcut(shortcut: string): ReplyTemplate | undefined {
    const template = Array.from(this.templates.values()).find(t => t.shortcut === shortcut && t.isActive);
    if (template) {
      return { ...template, buttons: this.getButtonsForTemplate(template.id) };
    }
    return undefined;
  }

  getByCategory(category: string): ReplyTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  create(data: Omit<ReplyTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): ReplyTemplate {
    const template: ReplyTemplate = {
      ...data,
      id: randomUUID(),
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.set(template.id, template);

    if (data.buttons) {
      data.buttons.forEach((btn, index) => {
        const button: InteractiveButton = {
          ...btn,
          id: randomUUID(),
          templateId: template.id,
          order: btn.order ?? index,
        };
        this.buttons.set(button.id, button);
      });
    }

    return this.get(template.id)!;
  }

  update(id: string, data: Partial<ReplyTemplate>): ReplyTemplate | undefined {
    const template = this.templates.get(id);
    if (template) {
      Object.assign(template, data, { updatedAt: new Date() });
      this.templates.set(id, template);
      return this.get(id);
    }
    return undefined;
  }

  incrementUsage(id: string): void {
    const template = this.templates.get(id);
    if (template) {
      template.usageCount++;
      template.updatedAt = new Date();
      this.templates.set(id, template);
    }
  }

  delete(id: string): boolean {
    for (const [btnId, btn] of this.buttons) {
      if (btn.templateId === id) {
        this.buttons.delete(btnId);
      }
    }
    return this.templates.delete(id);
  }

  private getButtonsForTemplate(templateId: string): InteractiveButton[] {
    return Array.from(this.buttons.values())
      .filter(b => b.templateId === templateId)
      .sort((a, b) => a.order - b.order);
  }

  addButton(templateId: string, button: Omit<InteractiveButton, 'id'>): InteractiveButton {
    const btn: InteractiveButton = {
      ...button,
      id: randomUUID(),
      templateId,
    };
    this.buttons.set(btn.id, btn);
    return btn;
  }

  removeButton(buttonId: string): boolean {
    return this.buttons.delete(buttonId);
  }
}

class AnalyticsStore {
  private snapshots: Map<string, AnalyticsSnapshot> = new Map();
  private dailyStats: {
    messages: { incoming: number; outgoing: number; voice: number };
    users: { new: number; active: Set<string>; blocked: number };
    peakHours: Map<number, number>;
    questions: Map<string, number>;
  } = {
    messages: { incoming: 0, outgoing: 0, voice: 0 },
    users: { new: 0, active: new Set(), blocked: 0 },
    peakHours: new Map(),
    questions: new Map(),
  };

  recordIncomingMessage(phoneNumber: string) {
    this.dailyStats.messages.incoming++;
    this.dailyStats.users.active.add(phoneNumber);
    const hour = new Date().getHours();
    this.dailyStats.peakHours.set(hour, (this.dailyStats.peakHours.get(hour) || 0) + 1);
  }

  recordOutgoingMessage() {
    this.dailyStats.messages.outgoing++;
  }

  recordVoiceMessage() {
    this.dailyStats.messages.voice++;
  }

  recordNewUser() {
    this.dailyStats.users.new++;
  }

  recordBlockedUser() {
    this.dailyStats.users.blocked++;
  }

  recordQuestion(question: string) {
    const words = question.toLowerCase().slice(0, 50);
    this.dailyStats.questions.set(words, (this.dailyStats.questions.get(words) || 0) + 1);
  }

  createSnapshot(totalUsers: number, scheduledMessages: number, sessionId?: string): AnalyticsSnapshot {
    const peakHours: Record<string, number> = {};
    this.dailyStats.peakHours.forEach((count, hour) => {
      peakHours[hour.toString()] = count;
    });

    const topQuestions: { question: string; count: number }[] = [];
    this.dailyStats.questions.forEach((count, question) => {
      topQuestions.push({ question, count });
    });
    topQuestions.sort((a, b) => b.count - a.count);

    const snapshot: AnalyticsSnapshot = {
      id: randomUUID(),
      date: new Date(),
      totalMessages: this.dailyStats.messages.incoming + this.dailyStats.messages.outgoing,
      incomingMessages: this.dailyStats.messages.incoming,
      outgoingMessages: this.dailyStats.messages.outgoing,
      totalUsers,
      newUsers: this.dailyStats.users.new,
      activeUsers: this.dailyStats.users.active.size,
      blockedUsers: this.dailyStats.users.blocked,
      voiceMessages: this.dailyStats.messages.voice,
      scheduledMessages,
      topQuestions: topQuestions.slice(0, 10),
      peakHours,
      sessionId,
      createdAt: new Date(),
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.resetDailyStats();
    return snapshot;
  }

  private resetDailyStats() {
    this.dailyStats = {
      messages: { incoming: 0, outgoing: 0, voice: 0 },
      users: { new: 0, active: new Set(), blocked: 0 },
      peakHours: new Map(),
      questions: new Map(),
    };
  }

  getSnapshots(limit = 30): AnalyticsSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  }

  getCurrentStats() {
    return {
      todayMessages: this.dailyStats.messages.incoming + this.dailyStats.messages.outgoing,
      todayIncoming: this.dailyStats.messages.incoming,
      todayOutgoing: this.dailyStats.messages.outgoing,
      todayVoice: this.dailyStats.messages.voice,
      todayActiveUsers: this.dailyStats.users.active.size,
      todayNewUsers: this.dailyStats.users.new,
      todayBlockedUsers: this.dailyStats.users.blocked,
    };
  }
}

class VoiceSettingsStore {
  private settings: VoiceSettings = {
    id: randomUUID(),
    isEnabled: false,
    ttsVoice: 'alloy',
    sttEnabled: true,
    autoVoiceReply: false,
    updatedAt: new Date(),
  };

  get(): VoiceSettings {
    return { ...this.settings };
  }

  update(data: Partial<VoiceSettings>): VoiceSettings {
    Object.assign(this.settings, data, { updatedAt: new Date() });
    return this.get();
  }
}

class IntegrationsStore {
  private integrations: Map<string, ExternalIntegration> = new Map();

  constructor() {
    const defaults = [
      { name: 'google', type: 'calendar', isEnabled: false },
      { name: 'notion', type: 'notes', isEnabled: false },
      { name: 'stripe', type: 'payments', isEnabled: false },
    ];
    defaults.forEach(d => {
      const integration: ExternalIntegration = {
        id: randomUUID(),
        ...d,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.integrations.set(integration.name, integration);
    });
  }

  getAll(): ExternalIntegration[] {
    return Array.from(this.integrations.values());
  }

  get(name: string): ExternalIntegration | undefined {
    return this.integrations.get(name);
  }

  update(name: string, data: Partial<ExternalIntegration>): ExternalIntegration | undefined {
    const integration = this.integrations.get(name);
    if (integration) {
      Object.assign(integration, data, { updatedAt: new Date() });
      this.integrations.set(name, integration);
      return integration;
    }
    return undefined;
  }

  enable(name: string): boolean {
    const integration = this.integrations.get(name);
    if (integration) {
      integration.isEnabled = true;
      integration.updatedAt = new Date();
      this.integrations.set(name, integration);
      return true;
    }
    return false;
  }

  disable(name: string): boolean {
    const integration = this.integrations.get(name);
    if (integration) {
      integration.isEnabled = false;
      integration.updatedAt = new Date();
      this.integrations.set(name, integration);
      return true;
    }
    return false;
  }

  setConfig(name: string, config: any): boolean {
    const integration = this.integrations.get(name);
    if (integration) {
      integration.config = config;
      integration.updatedAt = new Date();
      this.integrations.set(name, integration);
      return true;
    }
    return false;
  }
}

class SubscriptionTiersStore {
  private tiers: Map<string, SubscriptionTier> = new Map();

  constructor() {
    const defaults: Omit<SubscriptionTier, 'id' | 'createdAt'>[] = [
      { name: 'مجاني', tier: 'free', messagesPerMinute: 10, messagesPerDay: 100, voiceMessagesEnabled: false, schedulingEnabled: false, analyticsEnabled: false, priority: 0 },
      { name: 'أساسي', tier: 'basic', messagesPerMinute: 20, messagesPerDay: 500, voiceMessagesEnabled: false, schedulingEnabled: true, analyticsEnabled: false, priority: 1 },
      { name: 'متميز', tier: 'premium', messagesPerMinute: 50, messagesPerDay: 2000, voiceMessagesEnabled: true, schedulingEnabled: true, analyticsEnabled: true, priority: 2 },
      { name: 'VIP', tier: 'vip', messagesPerMinute: 100, messagesPerDay: 10000, voiceMessagesEnabled: true, schedulingEnabled: true, analyticsEnabled: true, priority: 3 },
    ];
    defaults.forEach(d => {
      const tier: SubscriptionTier = { ...d, id: randomUUID(), createdAt: new Date() };
      this.tiers.set(tier.tier, tier);
    });
  }

  getAll(): SubscriptionTier[] {
    return Array.from(this.tiers.values()).sort((a, b) => a.priority - b.priority);
  }

  get(tier: string): SubscriptionTier | undefined {
    return this.tiers.get(tier);
  }

  update(tier: string, data: Partial<SubscriptionTier>): SubscriptionTier | undefined {
    const t = this.tiers.get(tier);
    if (t) {
      Object.assign(t, data);
      this.tiers.set(tier, t);
      return t;
    }
    return undefined;
  }
}

class UserMemoryStore {
  private memories: Map<string, UserMemory> = new Map();

  private getKey(phoneNumber: string, key: string): string {
    return `${phoneNumber}:${key}`;
  }

  set(phoneNumber: string, key: string, value: string, category = 'general'): UserMemory {
    const memKey = this.getKey(phoneNumber, key);
    const existing = this.memories.get(memKey);
    
    if (existing) {
      existing.value = value;
      existing.category = category;
      existing.updatedAt = new Date();
      this.memories.set(memKey, existing);
      return existing;
    }

    const memory: UserMemory = {
      id: randomUUID(),
      phoneNumber,
      key,
      value,
      category,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memories.set(memKey, memory);
    return memory;
  }

  get(phoneNumber: string, key: string): string | undefined {
    return this.memories.get(this.getKey(phoneNumber, key))?.value;
  }

  getAll(phoneNumber: string): UserMemory[] {
    return Array.from(this.memories.values()).filter(m => m.phoneNumber === phoneNumber);
  }

  getByCategory(phoneNumber: string, category: string): UserMemory[] {
    return this.getAll(phoneNumber).filter(m => m.category === category);
  }

  delete(phoneNumber: string, key: string): boolean {
    return this.memories.delete(this.getKey(phoneNumber, key));
  }

  deleteAll(phoneNumber: string): void {
    for (const [k, m] of this.memories) {
      if (m.phoneNumber === phoneNumber) {
        this.memories.delete(k);
      }
    }
  }
}

export const scheduledMessagesStore = new ScheduledMessagesStore();
export const remindersStore = new RemindersStore();
export const welcomeMessagesStore = new WelcomeMessagesStore();
export const replyTemplatesStore = new ReplyTemplatesStore();
export const analyticsStore = new AnalyticsStore();
export const voiceSettingsStore = new VoiceSettingsStore();
export const integrationsStore = new IntegrationsStore();
export const subscriptionTiersStore = new SubscriptionTiersStore();
export const userMemoryStore = new UserMemoryStore();
