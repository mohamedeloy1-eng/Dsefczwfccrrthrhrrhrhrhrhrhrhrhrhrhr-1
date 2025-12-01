import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const userClassificationEnum = pgEnum("user_classification", ["normal", "test", "spam"]);

export const whatsappUsers = pgTable("whatsapp_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  classification: userClassificationEnum("classification").default("normal").notNull(),
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

export const logStatusEnum = pgEnum("log_status", ["success", "failed", "blocked", "rate_limited"]);
export const logDirectionEnum = pgEnum("log_direction", ["incoming", "outgoing"]);
export const logMessageTypeEnum = pgEnum("log_message_type", ["text", "image", "sticker", "error", "system"]);

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
