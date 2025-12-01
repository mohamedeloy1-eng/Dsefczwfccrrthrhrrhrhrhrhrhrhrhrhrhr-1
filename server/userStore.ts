import { UserData, UserClassification, RateLimitData, SecuritySettings, UserStats } from './types';
import { randomUUID } from 'crypto';

class UserStore {
  private users: Map<string, UserData> = new Map();
  private rateLimits: Map<string, RateLimitData> = new Map();
  private securitySettings: SecuritySettings = {
    defaultMessageLimit: 20,
    spamThreshold: 5,
    autoBlockEnabled: true,
    safeModeEnabled: false,
    maxMessagesPerDay: 500,
  };

  private formatPhoneNumber(phone: string): string {
    return phone.replace('@c.us', '').replace(/\D/g, '');
  }

  getOrCreateUser(phoneNumber: string): UserData {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    let user = this.users.get(normalizedPhone);

    if (!user) {
      user = {
        id: randomUUID(),
        phoneNumber: normalizedPhone,
        name: `User ${normalizedPhone.slice(-4)}`,
        classification: 'normal',
        isBlocked: false,
        messageLimit: this.securitySettings.defaultMessageLimit,
        totalMessagesSent: 0,
        totalMessagesReceived: 0,
        messagesToday: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
        sessionId: randomUUID(),
        errorCount: 0,
        lastError: null,
      };
      this.users.set(normalizedPhone, user);
    }

    return user;
  }

  getUser(phoneNumber: string): UserData | undefined {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    return this.users.get(normalizedPhone);
  }

  getAllUsers(): UserData[] {
    return Array.from(this.users.values()).sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }

  searchUsers(query: string): UserData[] {
    const searchTerm = query.toLowerCase();
    return this.getAllUsers().filter(user => 
      user.phoneNumber.includes(searchTerm) ||
      user.name.toLowerCase().includes(searchTerm)
    );
  }

  updateUser(phoneNumber: string, updates: Partial<UserData>): UserData | undefined {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.users.get(normalizedPhone);
    if (user) {
      Object.assign(user, updates);
      this.users.set(normalizedPhone, user);
    }
    return user;
  }

  blockUser(phoneNumber: string, reason?: string): boolean {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.users.get(normalizedPhone);
    if (user) {
      user.isBlocked = true;
      user.lastError = reason || 'Blocked by admin';
      this.users.set(normalizedPhone, user);

      const rateLimit = this.rateLimits.get(normalizedPhone) || {
        phoneNumber: normalizedPhone,
        messageCount: 0,
        windowStart: new Date(),
        blocked: false,
      };
      rateLimit.blocked = true;
      rateLimit.blockReason = reason || 'Blocked by admin';
      this.rateLimits.set(normalizedPhone, rateLimit);

      return true;
    }
    return false;
  }

  unblockUser(phoneNumber: string): boolean {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.users.get(normalizedPhone);
    if (user) {
      user.isBlocked = false;
      user.errorCount = 0;
      user.lastError = null;
      this.users.set(normalizedPhone, user);

      const rateLimit = this.rateLimits.get(normalizedPhone);
      if (rateLimit) {
        rateLimit.blocked = false;
        rateLimit.blockReason = undefined;
        rateLimit.blockExpiry = undefined;
        this.rateLimits.set(normalizedPhone, rateLimit);
      }

      return true;
    }
    return false;
  }

  setUserClassification(phoneNumber: string, classification: UserClassification): boolean {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.users.get(normalizedPhone);
    if (user) {
      user.classification = classification;
      if (classification === 'spam') {
        user.isBlocked = true;
      }
      this.users.set(normalizedPhone, user);
      return true;
    }
    return false;
  }

  setUserMessageLimit(phoneNumber: string, limit: number): boolean {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.users.get(normalizedPhone);
    if (user) {
      user.messageLimit = limit;
      this.users.set(normalizedPhone, user);
      return true;
    }
    return false;
  }

  deleteUserSession(phoneNumber: string): boolean {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.users.get(normalizedPhone);
    if (user) {
      user.sessionId = null;
      user.messagesToday = 0;
      this.users.set(normalizedPhone, user);
      this.rateLimits.delete(normalizedPhone);
      return true;
    }
    return false;
  }

  checkRateLimit(phoneNumber: string): { allowed: boolean; reason?: string } {
    if (this.securitySettings.safeModeEnabled) {
      return { allowed: false, reason: 'Safe mode is enabled' };
    }

    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.getOrCreateUser(normalizedPhone);

    if (user.isBlocked) {
      return { allowed: false, reason: 'User is blocked' };
    }

    let rateLimit = this.rateLimits.get(normalizedPhone);
    const now = new Date();

    if (!rateLimit) {
      rateLimit = {
        phoneNumber: normalizedPhone,
        messageCount: 1,
        windowStart: now,
        blocked: false,
      };
      this.rateLimits.set(normalizedPhone, rateLimit);
      return { allowed: true };
    }

    const windowMs = 60 * 1000;
    const timeSinceStart = now.getTime() - rateLimit.windowStart.getTime();

    if (timeSinceStart > windowMs) {
      rateLimit.messageCount = 1;
      rateLimit.windowStart = now;
      this.rateLimits.set(normalizedPhone, rateLimit);
      return { allowed: true };
    }

    if (rateLimit.blocked) {
      if (rateLimit.blockExpiry && now > rateLimit.blockExpiry) {
        rateLimit.blocked = false;
        rateLimit.blockReason = undefined;
        rateLimit.blockExpiry = undefined;
      } else {
        return { allowed: false, reason: rateLimit.blockReason || 'Rate limited' };
      }
    }

    const messageLimit = user.messageLimit || this.securitySettings.defaultMessageLimit;
    
    rateLimit.messageCount++;
    this.rateLimits.set(normalizedPhone, rateLimit);
    
    if (rateLimit.messageCount > messageLimit) {
      return { allowed: false, reason: `Rate limit exceeded (${messageLimit}/min)` };
    }

    if (user.messagesToday >= this.securitySettings.maxMessagesPerDay) {
      return { allowed: false, reason: `Daily limit exceeded (${this.securitySettings.maxMessagesPerDay}/day)` };
    }

    return { allowed: true };
  }

  recordMessage(phoneNumber: string, isOutgoing: boolean): void {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.getOrCreateUser(normalizedPhone);
    
    if (isOutgoing) {
      user.totalMessagesSent++;
    } else {
      user.totalMessagesReceived++;
    }
    user.messagesToday++;
    user.lastActivity = new Date();
    
    this.users.set(normalizedPhone, user);
  }

  recordError(phoneNumber: string, errorMessage: string): { shouldBlock: boolean; blocked: boolean } {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.getOrCreateUser(normalizedPhone);
    
    user.errorCount++;
    user.lastError = errorMessage;
    user.lastActivity = new Date();
    
    this.users.set(normalizedPhone, user);

    const threshold = this.securitySettings.spamThreshold;
    const shouldAutoBlock = this.securitySettings.autoBlockEnabled && user.errorCount >= threshold;

    if (shouldAutoBlock && !user.isBlocked) {
      const blocked = this.blockUser(normalizedPhone, `Auto-blocked: ${user.errorCount} errors (threshold: ${threshold})`);
      if (blocked) {
        this.setUserClassification(normalizedPhone, 'spam');
      }
      return { shouldBlock: true, blocked };
    }

    return { shouldBlock: false, blocked: user.isBlocked };
  }

  getSecuritySettings(): SecuritySettings {
    return { ...this.securitySettings };
  }

  updateSecuritySettings(updates: Partial<SecuritySettings>): SecuritySettings {
    Object.assign(this.securitySettings, updates);
    return { ...this.securitySettings };
  }

  enableSafeMode(): void {
    this.securitySettings.safeModeEnabled = true;
  }

  disableSafeMode(): void {
    this.securitySettings.safeModeEnabled = false;
  }

  isSafeModeEnabled(): boolean {
    return this.securitySettings.safeModeEnabled;
  }

  getStats(): UserStats {
    const users = this.getAllUsers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalUsers: users.length,
      activeToday: users.filter(u => u.lastActivity >= today).length,
      blockedUsers: users.filter(u => u.isBlocked).length,
      spamUsers: users.filter(u => u.classification === 'spam').length,
      totalMessagesToday: users.reduce((sum, u) => sum + u.messagesToday, 0),
    };
  }

  resetDailyCounters(): void {
    this.users.forEach((user, phone) => {
      user.messagesToday = 0;
      this.users.set(phone, user);
    });
  }

  clearAllUserSessions(): void {
    this.users.forEach((user, phone) => {
      user.sessionId = null;
      user.messagesToday = 0;
      this.users.set(phone, user);
    });
    this.rateLimits.clear();
  }
}

export const userStore = new UserStore();
