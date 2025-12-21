import { type User, type InsertUser, type SupportTicket, type InsertSupportTicket } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Support Tickets
  createSupportTicket(ticket: Partial<InsertSupportTicket>): Promise<SupportTicket>;
  getSupportTickets(): Promise<SupportTicket[]>;
  getPendingTicket(phoneNumber: string): Promise<SupportTicket | undefined>;
  updateSupportTicket(id: number, update: Partial<SupportTicket>): Promise<SupportTicket>;
  deleteTicket(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tickets: Map<number, SupportTicket>;
  private nextTicketId: number = 1;

  constructor() {
    this.users = new Map();
    this.tickets = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createSupportTicket(insertTicket: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const id = this.nextTicketId++;
    const ticket: SupportTicket = {
      phoneNumber: insertTicket.phoneNumber!,
      issue: insertTicket.issue || null,
      status: insertTicket.status || "open",
      response: insertTicket.response || null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: (insertTicket as any).expiresAt || null,
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async getSupportTickets(): Promise<SupportTicket[]> {
    return Array.from(this.tickets.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPendingTicket(phoneNumber: string): Promise<SupportTicket | undefined> {
    return Array.from(this.tickets.values()).find(
      (t) => t.phoneNumber === phoneNumber && t.status === "pending"
    );
  }

  async updateSupportTicket(id: number, update: Partial<SupportTicket>): Promise<SupportTicket> {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error("Ticket not found");
    const updatedTicket = { ...ticket, ...update, updatedAt: new Date() };
    this.tickets.set(id, updatedTicket);
    return updatedTicket;
  }

  async deleteTicket(id: number): Promise<void> {
    this.tickets.delete(id);
  }
}

export const storage = new MemStorage();
