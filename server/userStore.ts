import { UserData, UserClassification, RateLimitData, SecuritySettings, UserStats } from './types';
import { randomUUID } from 'crypto';

class UserStore {
  private sessionUsers: Map<string, Map<string, UserData>> = new Map();
  private sessionRateLimits: Map<string, Map<string, RateLimitData>> = new Map();
  private securitySettings: SecuritySettings = {
    defaultMessageLimit: 20,
    spamThreshold: 5,
    autoBlockEnabled: true,
    safeModeEnabled: false,
    maxMessagesPerDay: 500,
  };
  private defaultSessionId: string = 'default';

  private getSessionUsersMap(sessionId: string = this.defaultSessionId): Map<string, UserData> {
    if (!this.sessionUsers.has(sessionId)) {
      this.sessionUsers.set(sessionId, new Map());
    }
    return this.sessionUsers.get(sessionId)!;
  }

  private getSessionRateLimitsMap(sessionId: string = this.defaultSessionId): Map<string, RateLimitData> {
    if (!this.sessionRateLimits.has(sessionId)) {
      this.sessionRateLimits.set(sessionId, new Map());
    }
    return this.sessionRateLimits.get(sessionId)!;
  }

  private formatPhoneNumber(phone: string): string {
    return phone.replace('@c.us', '').replace(/\D/g, '');
  }

  setDefaultSessionId(sessionId: string): void {
    this.defaultSessionId = sessionId;
  }

  getOrCreateUser(phoneNumber: string, sessionId?: string): UserData {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    let user = users.get(normalizedPhone);

    if (!user) {
      user = {
        id: randomUUID(),
        phoneNumber: normalizedPhone,
        name: `+${normalizedPhone}`,
        classification: 'normal',
        isBlocked: false,
        messageLimit: this.securitySettings.defaultMessageLimit,
        totalMessagesSent: 0,
        totalMessagesReceived: 0,
        messagesToday: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
        sessionId: sid,
        errorCount: 0,
        lastError: null,
      };
      users.set(normalizedPhone, user);
    }

    return user;
  }

  getUser(phoneNumber: string, sessionId?: string): UserData | undefined {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    return users.get(normalizedPhone);
  }

  getAllUsers(sessionId?: string): UserData[] {
    if (sessionId) {
      const users = this.getSessionUsersMap(sessionId);
      return Array.from(users.values()).sort((a, b) => 
        b.lastActivity.getTime() - a.lastActivity.getTime()
      );
    }
    
    const allUsers: UserData[] = [];
    this.sessionUsers.forEach((users) => {
      allUsers.push(...users.values());
    });
    return allUsers.sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }

  searchUsers(query: string, sessionId?: string): UserData[] {
    const searchTerm = query.toLowerCase();
    return this.getAllUsers(sessionId).filter(user => 
      user.phoneNumber.includes(searchTerm) ||
      user.name.toLowerCase().includes(searchTerm)
    );
  }

  updateUser(phoneNumber: string, updates: Partial<UserData>, sessionId?: string): UserData | undefined {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = users.get(normalizedPhone);
    if (user) {
      Object.assign(user, updates);
      users.set(normalizedPhone, user);
    }
    return user;
  }

  blockUser(phoneNumber: string, reason?: string, sessionId?: string): boolean {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const rateLimits = this.getSessionRateLimitsMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = users.get(normalizedPhone);
    if (user) {
      user.isBlocked = true;
      user.lastError = reason || 'Blocked by admin';
      users.set(normalizedPhone, user);

      const rateLimit = rateLimits.get(normalizedPhone) || {
        phoneNumber: normalizedPhone,
        messageCount: 0,
        windowStart: new Date(),
        blocked: false,
      };
      rateLimit.blocked = true;
      rateLimit.blockReason = reason || 'Blocked by admin';
      rateLimits.set(normalizedPhone, rateLimit);

      return true;
    }
    return false;
  }

  unblockUser(phoneNumber: string, sessionId?: string): boolean {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const rateLimits = this.getSessionRateLimitsMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = users.get(normalizedPhone);
    if (user) {
      user.isBlocked = false;
      user.errorCount = 0;
      user.lastError = null;
      users.set(normalizedPhone, user);

      const rateLimit = rateLimits.get(normalizedPhone);
      if (rateLimit) {
        rateLimit.blocked = false;
        rateLimit.blockReason = undefined;
        rateLimit.blockExpiry = undefined;
        rateLimits.set(normalizedPhone, rateLimit);
      }

      return true;
    }
    return false;
  }

  setUserClassification(phoneNumber: string, classification: UserClassification, sessionId?: string): boolean {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = users.get(normalizedPhone);
    if (user) {
      user.classification = classification;
      if (classification === 'spam') {
        user.isBlocked = true;
      }
      users.set(normalizedPhone, user);
      return true;
    }
    return false;
  }

  setUserMessageLimit(phoneNumber: string, limit: number, sessionId?: string): boolean {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = users.get(normalizedPhone);
    if (user) {
      user.messageLimit = limit;
      users.set(normalizedPhone, user);
      return true;
    }
    return false;
  }

  deleteUserSession(phoneNumber: string, sessionId?: string): boolean {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const rateLimits = this.getSessionRateLimitsMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = users.get(normalizedPhone);
    if (user) {
      user.sessionId = null;
      user.messagesToday = 0;
      users.set(normalizedPhone, user);
      rateLimits.delete(normalizedPhone);
      return true;
    }
    return false;
  }

  checkRateLimit(phoneNumber: string, sessionId?: string): { allowed: boolean; reason?: string } {
    if (this.securitySettings.safeModeEnabled) {
      return { allowed: false, reason: 'Safe mode is enabled' };
    }

    const sid = sessionId || this.defaultSessionId;
    const rateLimits = this.getSessionRateLimitsMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.getOrCreateUser(normalizedPhone, sid);

    if (user.isBlocked) {
      return { allowed: false, reason: 'User is blocked' };
    }

    let rateLimit = rateLimits.get(normalizedPhone);
    const now = new Date();

    if (!rateLimit) {
      rateLimit = {
        phoneNumber: normalizedPhone,
        messageCount: 1,
        windowStart: now,
        blocked: false,
      };
      rateLimits.set(normalizedPhone, rateLimit);
      return { allowed: true };
    }

    const windowMs = 60 * 1000;
    const timeSinceStart = now.getTime() - rateLimit.windowStart.getTime();

    if (timeSinceStart > windowMs) {
      rateLimit.messageCount = 1;
      rateLimit.windowStart = now;
      rateLimits.set(normalizedPhone, rateLimit);
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
    rateLimits.set(normalizedPhone, rateLimit);
    
    if (rateLimit.messageCount > messageLimit) {
      return { allowed: false, reason: `Rate limit exceeded (${messageLimit}/min)` };
    }

    if (user.messagesToday >= this.securitySettings.maxMessagesPerDay) {
      return { allowed: false, reason: `Daily limit exceeded (${this.securitySettings.maxMessagesPerDay}/day)` };
    }

    return { allowed: true };
  }

  recordMessage(phoneNumber: string, isOutgoing: boolean, sessionId?: string): void {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.getOrCreateUser(normalizedPhone, sid);
    
    if (isOutgoing) {
      user.totalMessagesSent++;
    } else {
      user.totalMessagesReceived++;
    }
    user.messagesToday++;
    user.lastActivity = new Date();
    
    users.set(normalizedPhone, user);
  }

  recordError(phoneNumber: string, errorMessage: string, sessionId?: string): { shouldBlock: boolean; blocked: boolean } {
    const sid = sessionId || this.defaultSessionId;
    const users = this.getSessionUsersMap(sid);
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    const user = this.getOrCreateUser(normalizedPhone, sid);
    
    user.errorCount++;
    user.lastError = errorMessage;
    user.lastActivity = new Date();
    
    users.set(normalizedPhone, user);

    const threshold = this.securitySettings.spamThreshold;
    const shouldAutoBlock = this.securitySettings.autoBlockEnabled && user.errorCount >= threshold;

    if (shouldAutoBlock && !user.isBlocked) {
      const blocked = this.blockUser(normalizedPhone, `Auto-blocked: ${user.errorCount} errors (threshold: ${threshold})`, sid);
      if (blocked) {
        this.setUserClassification(normalizedPhone, 'spam', sid);
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

  getStats(sessionId?: string): UserStats {
    const users = this.getAllUsers(sessionId);
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

  resetDailyCounters(sessionId?: string): void {
    if (sessionId) {
      const users = this.getSessionUsersMap(sessionId);
      users.forEach((user, phone) => {
        user.messagesToday = 0;
        users.set(phone, user);
      });
    } else {
      this.sessionUsers.forEach((users) => {
        users.forEach((user, phone) => {
          user.messagesToday = 0;
          users.set(phone, user);
        });
      });
    }
  }

  clearSession(sessionId: string): void {
    this.sessionUsers.delete(sessionId);
    this.sessionRateLimits.delete(sessionId);
  }

  clearAllUserSessions(sessionId?: string): void {
    if (sessionId) {
      const users = this.getSessionUsersMap(sessionId);
      const rateLimits = this.getSessionRateLimitsMap(sessionId);
      users.forEach((user, phone) => {
        user.sessionId = null;
        user.messagesToday = 0;
        users.set(phone, user);
      });
      rateLimits.clear();
    } else {
      this.sessionUsers.forEach((users) => {
        users.forEach((user, phone) => {
          user.sessionId = null;
          user.messagesToday = 0;
          users.set(phone, user);
        });
      });
      this.sessionRateLimits.clear();
    }
  }
}

export const userStore = new UserStore();
