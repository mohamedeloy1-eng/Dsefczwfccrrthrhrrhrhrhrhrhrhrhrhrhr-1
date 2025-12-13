import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== ENUMS ====================

export const userClassificationEnum = pgEnum("user_classification", ["normal", "test", "spam"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "basic", "premium", "vip"]);
export const logStatusEnum = pgEnum("log_status", ["success", "failed", "blocked", "rate_limited"]);
export const logDirectionEnum = pgEnum("log_direction", ["incoming", "outgoing"]);
export const logMessageTypeEnum = pgEnum("log_message_type", ["text", "image", "sticker", "voice", "error", "system"]);
export const scheduleStatusEnum = pgEnum("schedule_status", ["pending", "sent", "failed", "cancelled"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["active", "triggered", "cancelled"]);

// ==================== USERS (Auth) ====================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== SUBSCRIPTION TIERS ====================

export const subscriptionTiers = pgTable("subscription_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(),
  tier: subscriptionTierEnum("tier").notNull().unique(),
  messagesPerMinute: integer("messages_per_minute").default(20).notNull(),
  messagesPerDay: integer("messages_per_day").default(500).notNull(),
  voiceMessagesEnabled: boolean("voice_messages_enabled").default(false).notNull(),
  schedulingEnabled: boolean("scheduling_enabled").default(false).notNull(),
  analyticsEnabled: boolean("analytics_enabled").default(false).notNull(),
  priority: integer("priority").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;

// ==================== WHATSAPP USERS ====================

export const whatsappUsers = pgTable("whatsapp_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  classification: userClassificationEnum("classification").default("normal").notNull(),
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free").notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  messageLimit: integer("message_limit").default(20).notNull(),
  totalMessagesSent: integer("total_messages_sent").default(0).notNull(),
  totalMessagesReceived: integer("total_messages_received").default(0).notNull(),
  messagesToday: integer("messages_today").default(0).notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sessionId: varchar("session_id"),
  errorCount: integer("error_count").default(0).notNull(),
  lastError: text("last_error"),
});

export const insertWhatsappUserSchema = createInsertSchema(whatsappUsers).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

export type InsertWhatsappUser = z.infer<typeof insertWhatsappUserSchema>;
export type WhatsappUser = typeof whatsappUsers.$inferSelect;

// ==================== USER MEMORY (Long-term Memory) ====================

export const userMemory = pgTable("user_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value").notNull(),
  category: varchar("category", { length: 50 }).default("general").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserMemorySchema = createInsertSchema(userMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type UserMemory = typeof userMemory.$inferSelect;

// ==================== CONVERSATIONS (Persistent) ====================

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  sessionId: varchar("session_id").notNull(),
  lastMessage: text("last_message"),
  unreadCount: integer("unread_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// ==================== MESSAGES (Persistent) ====================

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  content: text("content").notNull(),
  isBot: boolean("is_bot").default(false).notNull(),
  messageType: logMessageTypeEnum("message_type").default("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ==================== MESSAGE LOGS ====================

export const messageLogs = pgTable("message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  direction: logDirectionEnum("direction").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  sessionId: varchar("session_id").notNull(),
  content: text("content").notNull(),
  messageType: logMessageTypeEnum("message_type").notNull(),
  status: logStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
});

export const insertMessageLogSchema = createInsertSchema(messageLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertMessageLog = z.infer<typeof insertMessageLogSchema>;
export type MessageLog = typeof messageLogs.$inferSelect;

// ==================== SCHEDULED MESSAGES ====================

export const scheduledMessages = pgTable("scheduled_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  message: text("message").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: scheduleStatusEnum("status").default("pending").notNull(),
  sessionId: varchar("session_id"),
  repeatType: varchar("repeat_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
});

export const insertScheduledMessageSchema = createInsertSchema(scheduledMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  errorMessage: true,
});

export type InsertScheduledMessage = z.infer<typeof insertScheduledMessageSchema>;
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;

// ==================== REMINDERS ====================

export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  remindAt: timestamp("remind_at").notNull(),
  status: reminderStatusEnum("status").default("active").notNull(),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  triggeredAt: timestamp("triggered_at"),
});

export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
});

export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;

// ==================== WELCOME MESSAGES ====================

export const welcomeMessages = pgTable("welcome_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  message: text("message").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWelcomeMessageSchema = createInsertSchema(welcomeMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWelcomeMessage = z.infer<typeof insertWelcomeMessageSchema>;
export type WelcomeMessage = typeof welcomeMessages.$inferSelect;

// ==================== QUICK REPLY TEMPLATES ====================

export const replyTemplates = pgTable("reply_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 100 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).default("general").notNull(),
  shortcut: varchar("shortcut", { length: 20 }),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReplyTemplateSchema = createInsertSchema(replyTemplates).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReplyTemplate = z.infer<typeof insertReplyTemplateSchema>;
export type ReplyTemplate = typeof replyTemplates.$inferSelect;

// ==================== INTERACTIVE BUTTONS ====================

export const interactiveButtons = pgTable("interactive_buttons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id"),
  label: varchar("label", { length: 50 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  payload: jsonb("payload"),
  order: integer("order").default(0).notNull(),
});

export const insertInteractiveButtonSchema = createInsertSchema(interactiveButtons).omit({
  id: true,
});

export type InsertInteractiveButton = z.infer<typeof insertInteractiveButtonSchema>;
export type InteractiveButton = typeof interactiveButtons.$inferSelect;

// ==================== ANALYTICS SNAPSHOTS ====================

export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  totalMessages: integer("total_messages").default(0).notNull(),
  incomingMessages: integer("incoming_messages").default(0).notNull(),
  outgoingMessages: integer("outgoing_messages").default(0).notNull(),
  totalUsers: integer("total_users").default(0).notNull(),
  newUsers: integer("new_users").default(0).notNull(),
  activeUsers: integer("active_users").default(0).notNull(),
  blockedUsers: integer("blocked_users").default(0).notNull(),
  voiceMessages: integer("voice_messages").default(0).notNull(),
  scheduledMessages: integer("scheduled_messages").default(0).notNull(),
  topQuestions: jsonb("top_questions"),
  peakHours: jsonb("peak_hours"),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

// ==================== WHATSAPP SESSIONS (Multi-Session) ====================

export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id", { length: 50 }).notNull().unique(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  name: varchar("name", { length: 100 }),
  isActive: boolean("is_active").default(false).notNull(),
  isConnected: boolean("is_connected").default(false).notNull(),
  priority: integer("priority").default(0).notNull(),
  maxLoad: integer("max_load").default(100).notNull(),
  currentLoad: integer("current_load").default(0).notNull(),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActivity: true,
});

export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;

// ==================== SECURITY SETTINGS ====================

export const securitySettings = pgTable("security_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 50 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSecuritySettingSchema = createInsertSchema(securitySettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSecuritySetting = z.infer<typeof insertSecuritySettingSchema>;
export type SecuritySetting = typeof securitySettings.$inferSelect;

// ==================== BOT SETTINGS ====================

export const botSettings = pgTable("bot_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 50 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBotSettingSchema = createInsertSchema(botSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertBotSetting = z.infer<typeof insertBotSettingSchema>;
export type BotSetting = typeof botSettings.$inferSelect;

// ==================== EXTERNAL INTEGRATIONS ====================

export const externalIntegrations = pgTable("external_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(),
  type: varchar("type", { length: 30 }).notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExternalIntegrationSchema = createInsertSchema(externalIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExternalIntegration = z.infer<typeof insertExternalIntegrationSchema>;
export type ExternalIntegration = typeof externalIntegrations.$inferSelect;

// ==================== VOICE SETTINGS ====================

export const voiceSettings = pgTable("voice_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  ttsVoice: varchar("tts_voice", { length: 50 }).default("alloy").notNull(),
  sttEnabled: boolean("stt_enabled").default(true).notNull(),
  autoVoiceReply: boolean("auto_voice_reply").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVoiceSettingSchema = createInsertSchema(voiceSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertVoiceSetting = z.infer<typeof insertVoiceSettingSchema>;
export type VoiceSetting = typeof voiceSettings.$inferSelect;

// ==================== RELATIONS ====================

export const whatsappUsersRelations = relations(whatsappUsers, ({ many }) => ({
  memories: many(userMemory),
  conversations: many(conversations),
  scheduledMessages: many(scheduledMessages),
  reminders: many(reminders),
}));

export const userMemoryRelations = relations(userMemory, ({ one }) => ({
  user: one(whatsappUsers, {
    fields: [userMemory.phoneNumber],
    references: [whatsappUsers.phoneNumber],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(whatsappUsers, {
    fields: [conversations.phoneNumber],
    references: [whatsappUsers.phoneNumber],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const replyTemplatesRelations = relations(replyTemplates, ({ many }) => ({
  buttons: many(interactiveButtons),
}));

export const interactiveButtonsRelations = relations(interactiveButtons, ({ one }) => ({
  template: one(replyTemplates, {
    fields: [interactiveButtons.templateId],
    references: [replyTemplates.id],
  }),
}));
