import { LogEntry } from './types';
import { randomUUID } from 'crypto';

class LogStore {
  private logs: LogEntry[] = [];
  private maxLogs: number = 10000;

  private formatPhoneNumber(phone: string): string {
    return phone.replace('@c.us', '').replace(/\D/g, '');
  }

  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const log: LogEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      ...entry,
      phoneNumber: this.formatPhoneNumber(entry.phoneNumber),
    };

    this.logs.unshift(log);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return log;
  }

  logIncomingMessage(
    phoneNumber: string,
    sessionId: string,
    content: string,
    status: LogEntry['status'] = 'success',
    errorMessage?: string
  ): LogEntry {
    return this.addLog({
      direction: 'incoming',
      phoneNumber,
      sessionId,
      content,
      messageType: 'text',
      status,
      errorMessage,
    });
  }

  logOutgoingMessage(
    phoneNumber: string,
    sessionId: string,
    content: string,
    messageType: LogEntry['messageType'] = 'text',
    status: LogEntry['status'] = 'success',
    errorMessage?: string
  ): LogEntry {
    return this.addLog({
      direction: 'outgoing',
      phoneNumber,
      sessionId,
      content,
      messageType,
      status,
      errorMessage,
    });
  }

  logError(
    phoneNumber: string,
    sessionId: string,
    errorMessage: string
  ): LogEntry {
    return this.addLog({
      direction: 'outgoing',
      phoneNumber,
      sessionId,
      content: errorMessage,
      messageType: 'error',
      status: 'failed',
      errorMessage,
    });
  }

  logSystemEvent(
    phoneNumber: string,
    sessionId: string,
    content: string,
    status: LogEntry['status'] = 'success'
  ): LogEntry {
    return this.addLog({
      direction: 'outgoing',
      phoneNumber,
      sessionId,
      content,
      messageType: 'system',
      status,
    });
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByPhone(phoneNumber: string): LogEntry[] {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    return this.logs.filter(log => log.phoneNumber === normalizedPhone);
  }

  getLogsBySession(sessionId: string): LogEntry[] {
    return this.logs.filter(log => log.sessionId === sessionId);
  }

  getLogsByDirection(direction: 'incoming' | 'outgoing'): LogEntry[] {
    return this.logs.filter(log => log.direction === direction);
  }

  getLogsByStatus(status: LogEntry['status']): LogEntry[] {
    return this.logs.filter(log => log.status === status);
  }

  getLogsByDateRange(startDate: Date, endDate: Date): LogEntry[] {
    return this.logs.filter(log => 
      log.timestamp >= startDate && log.timestamp <= endDate
    );
  }

  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(0, limit);
  }

  getLogsToday(): LogEntry[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.logs.filter(log => log.timestamp >= today);
  }

  getErrorLogs(): LogEntry[] {
    return this.logs.filter(log => 
      log.status === 'failed' || log.messageType === 'error'
    );
  }

  getBlockedLogs(): LogEntry[] {
    return this.logs.filter(log => 
      log.status === 'blocked' || log.status === 'rate_limited'
    );
  }

  searchLogs(query: string): LogEntry[] {
    const searchTerm = query.toLowerCase();
    return this.logs.filter(log => 
      log.content.toLowerCase().includes(searchTerm) ||
      log.phoneNumber.includes(searchTerm) ||
      log.sessionId.includes(searchTerm)
    );
  }

  getLogStats(): {
    total: number;
    incoming: number;
    outgoing: number;
    errors: number;
    blocked: number;
    rateLimited: number;
    today: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total: this.logs.length,
      incoming: this.logs.filter(l => l.direction === 'incoming').length,
      outgoing: this.logs.filter(l => l.direction === 'outgoing').length,
      errors: this.logs.filter(l => l.status === 'failed').length,
      blocked: this.logs.filter(l => l.status === 'blocked').length,
      rateLimited: this.logs.filter(l => l.status === 'rate_limited').length,
      today: this.logs.filter(l => l.timestamp >= today).length,
    };
  }

  clearLogs(): void {
    this.logs = [];
  }

  clearLogsByPhone(phoneNumber: string): void {
    const normalizedPhone = this.formatPhoneNumber(phoneNumber);
    this.logs = this.logs.filter(log => log.phoneNumber !== normalizedPhone);
  }

  exportLogs(phoneNumber?: string): LogEntry[] {
    if (phoneNumber) {
      return this.getLogsByPhone(phoneNumber);
    }
    return this.getAllLogs();
  }
}

export const logStore = new LogStore();
