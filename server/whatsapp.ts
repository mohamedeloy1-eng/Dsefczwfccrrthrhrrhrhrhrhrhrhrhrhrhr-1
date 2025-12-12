import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
type Message = pkg.Message;
type ClientType = InstanceType<typeof Client>;
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  isFromMe: boolean;
  sessionId?: string;
}

export interface WhatsAppStatus {
  isConnected: boolean;
  isReady: boolean;
  qrCode: string | null;
  connectedNumber: string | null;
  pairingCode: string | null;
  isSuspended: boolean;
}

export interface WhatsAppContactInfo {
  id: string;
  phoneNumber: string;
  name: string;
  pushName: string | null;
  isMyContact: boolean;
  isGroup: boolean;
  lastSeen: string | null;
  profilePicUrl: string | null;
}

export interface WhatsAppChatInfo {
  id: string;
  phoneNumber: string;
  name: string;
  lastMessage: string | null;
  timestamp: string | null;
  unreadCount: number;
  isPinned: boolean;
  isGroup: boolean;
  isArchived: boolean;
  isMuted: boolean;
}

export interface SessionDetails {
  connectedNumber: string | null;
  isOnline: boolean;
  sessionStartTime: Date | null;
  sessionDuration: string;
  whatsappOpenDuration: string;
  botRepliesCount: number;
  deviceInfo: {
    platform: string;
    browser: string;
    version: string;
    phoneModel: string | null;
  } | null;
  isSuspended: boolean;
}

export interface LinkedSession {
  id: string;
  phoneNumber: string;
  isConnected: boolean;
  isReady: boolean;
  sessionStartTime: Date | null;
  botRepliesCount: number;
  isSuspended: boolean;
}

class WhatsAppSession extends EventEmitter {
  public client: ClientType | null = null;
  public sessionId: string;
  public status: WhatsAppStatus & { isReconnecting?: boolean } = {
    isConnected: false,
    isReady: false,
    qrCode: null,
    connectedNumber: null,
    pairingCode: null,
    isSuspended: false,
  };
  public sessionStartTime: Date | null = null;
  public whatsappConnectTime: Date | null = null;
  public botRepliesCount: number = 0;
  public isSuspended: boolean = false;
  private pairingMode: boolean = false;
  private pendingPairingNumber: string | null = null;
  private pairingResolver: ((result: { success: boolean; code?: string; error?: string }) => void) | null = null;
  private messageHandler: ((message: WhatsAppMessage) => Promise<string | null>) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private isManualDisconnect: boolean = false;
  private autoReconnectEnabled: boolean = true;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnectInProgress: boolean = false;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }

  async initialize(): Promise<void> {
    if (this.client) {
      console.log(`WhatsApp session ${this.sessionId} already initialized`);
      return;
    }

    console.log(`Initializing WhatsApp session ${this.sessionId}...`);
    
    const authPath = `./.wwebjs_auth/session-${this.sessionId}`;
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
        clientId: this.sessionId,
      }),
      puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      },
    });

    this.setupEventListeners();

    try {
      await this.client.initialize();
    } catch (err) {
      console.error(`Error initializing WhatsApp session ${this.sessionId}:`, err);
      this.status.isReconnecting = false;
      this.isReconnectInProgress = false;
      this.emit('status', this.status);
      throw err;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr: string) => {
      console.log(`QR Code received for session ${this.sessionId}`);
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          width: 256,
          margin: 2,
        });
        this.status.qrCode = qrDataUrl;
        this.status.isConnected = false;
        this.status.isReady = false;
        this.emit('qr', qrDataUrl);
        this.emit('status', this.status);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    });

    this.client.on('ready', async () => {
      console.log(`WhatsApp session ${this.sessionId} is ready!`);
      this.status.isConnected = true;
      this.status.isReady = true;
      this.status.qrCode = null;
      this.status.pairingCode = null;
      this.status.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.isManualDisconnect = false;
      this.sessionStartTime = new Date();
      this.whatsappConnectTime = new Date();
      this.botRepliesCount = 0;
      
      try {
        const info = await this.client!.info;
        if (info && info.wid) {
          this.status.connectedNumber = info.wid.user;
          console.log(`Session ${this.sessionId} connected number:`, this.status.connectedNumber);
        }
      } catch (err) {
        console.error('Error getting client info:', err);
      }
      
      // تفعيل المزامنة الكاملة لجهات الاتصال عن طريق تحديث حالة الحضور
      try {
        await this.client!.sendPresenceAvailable();
        console.log(`Session ${this.sessionId}: Presence set to available for full sync`);
      } catch (err) {
        console.error(`Error setting presence for session ${this.sessionId}:`, err);
      }
      
      this.emit('ready');
      this.emit('status', this.status);
    });

    this.client.on('authenticated', () => {
      console.log(`WhatsApp session ${this.sessionId} authenticated`);
      this.status.isConnected = true;
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error(`WhatsApp session ${this.sessionId} authentication failed:`, msg);
      this.status.isConnected = false;
      this.status.isReady = false;
      
      if (this.status.isReconnecting) {
        console.log(`Auth failure during reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log(`Max reconnect attempts reached due to auth failures for session ${this.sessionId}`);
          this.status.isReconnecting = false;
          this.isReconnectInProgress = false;
          this.reconnectAttempts = 0;
          this.emit('reconnectFailed', { sessionId: this.sessionId, attempts: this.maxReconnectAttempts });
        }
      }
      
      this.emit('auth_failure', msg);
      this.emit('status', this.status);
    });

    this.client.on('disconnected', async (reason: string) => {
      console.log(`WhatsApp session ${this.sessionId} disconnected:`, reason);
      const wasConnected = this.status.isConnected && this.status.isReady;
      this.status.isConnected = false;
      this.status.isReady = false;
      this.status.qrCode = null;
      this.status.pairingCode = null;
      this.emit('disconnected', reason);
      this.emit('status', this.status);
      
      if (wasConnected && this.autoReconnectEnabled && !this.isManualDisconnect && !this.pairingMode) {
        console.log(`Auto-reconnect enabled for session ${this.sessionId}, attempting to reconnect...`);
        this.attemptReconnect();
      }
    });

    this.client.on('message', async (message: Message) => {
      // تجاهل الرسائل القديمة (قبل بدء الجلسة)
      const messageTime = message.timestamp * 1000; // تحويل لـ milliseconds
      const sessionStartMs = this.sessionStartTime?.getTime() || Date.now();
      
      // تجاهل الرسائل التي أرسلت قبل أكثر من 30 ثانية من بدء الجلسة
      if (messageTime < sessionStartMs - 30000) {
        console.log(`Ignoring old message from ${message.from} (sent before session started)`);
        return;
      }
      
      console.log(`Message received on session ${this.sessionId} from:`, message.from);
      
      const whatsappMessage: WhatsAppMessage = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        isFromMe: message.fromMe,
        sessionId: this.sessionId,
      };

      this.emit('message', whatsappMessage);

      if (!message.fromMe && this.messageHandler) {
        try {
          const response = await this.messageHandler(whatsappMessage);
          if (response) {
            await message.reply(response);
            console.log('Replied to message');
            this.botRepliesCount++;
          }
        } catch (err) {
          console.error('Error handling message:', err);
        }
      }
    });
  }

  setMessageHandler(handler: (message: WhatsAppMessage) => Promise<string | null>): void {
    this.messageHandler = handler;
  }

  private async attemptReconnect(): Promise<void> {
    if (this.isReconnectInProgress) {
      console.log(`Reconnect already in progress for session ${this.sessionId}, skipping`);
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`Max reconnect attempts (${this.maxReconnectAttempts}) reached for session ${this.sessionId}`);
      this.reconnectAttempts = 0;
      this.status.isReconnecting = false;
      this.isReconnectInProgress = false;
      this.emit('reconnectFailed', { sessionId: this.sessionId, attempts: this.maxReconnectAttempts });
      this.emit('status', this.status);
      return;
    }

    this.isReconnectInProgress = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} for session ${this.sessionId} in ${delay}ms`);
    
    this.status.isReconnecting = true;
    this.emit('reconnecting', { sessionId: this.sessionId, attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts });
    this.emit('status', this.status);

    await new Promise<void>((resolve) => {
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        resolve();
      }, delay);
    });

    if (this.isManualDisconnect || !this.autoReconnectEnabled) {
      console.log(`Reconnect cancelled for session ${this.sessionId}`);
      this.status.isReconnecting = false;
      this.isReconnectInProgress = false;
      this.reconnectAttempts = 0;
      this.emit('status', this.status);
      return;
    }

    try {
      if (this.client) {
        try {
          await this.client.destroy();
        } catch (destroyErr) {
          console.error(`Error destroying client during reconnect for session ${this.sessionId}:`, destroyErr);
        }
        this.client = null;
      }
      
      this.isReconnectInProgress = false;
      await this.initialize();
      console.log(`Reconnect successful for session ${this.sessionId}`);
    } catch (err) {
      console.error(`Reconnect failed for session ${this.sessionId}:`, err);
      this.isReconnectInProgress = false;
      await this.attemptReconnect();
    }
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnectInProgress = false;
    this.reconnectAttempts = 0;
    this.status.isReconnecting = false;
  }

  setAutoReconnect(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
  }

  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.client || !this.status.isReady) {
      console.error('WhatsApp client not ready');
      return false;
    }

    try {
      await this.client.sendMessage(to, message);
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  }

  async sendImage(to: string, imageUrl: string, asSticker: boolean = false): Promise<boolean> {
    if (!this.client || !this.status.isReady) {
      console.error('WhatsApp client not ready');
      return false;
    }

    try {
      const { buffer, mimeType } = await this.downloadImageWithMime(imageUrl);
      const base64 = buffer.toString('base64');
      const extension = mimeType.includes('png') ? 'png' : 'jpg';
      const media = new MessageMedia(mimeType, base64, `generated-image.${extension}`);
      
      if (asSticker) {
        await this.client.sendMessage(to, media, { 
          sendMediaAsSticker: true,
          stickerAuthor: 'GX-MODY',
          stickerName: 'AI Generated'
        });
      } else {
        await this.client.sendMessage(to, media);
      }
      return true;
    } catch (err) {
      console.error('Error sending image:', err);
      return false;
    }
  }

  private downloadImageWithMime(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadImageWithMime(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }
        
        const contentType = response.headers['content-type'] || 'image/png';
        const mimeType = contentType.split(';')[0].trim();
        
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve({ 
          buffer: Buffer.concat(chunks), 
          mimeType: mimeType.startsWith('image/') ? mimeType : 'image/png'
        }));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  async disconnect(manual: boolean = true): Promise<void> {
    if (manual) {
      this.isManualDisconnect = true;
      this.cancelReconnect();
    }
    
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.error(`Error disconnecting WhatsApp session ${this.sessionId}:`, err);
      } finally {
        this.client = null;
        this.status = {
          isConnected: false,
          isReady: false,
          qrCode: null,
          connectedNumber: null,
          pairingCode: null,
          isSuspended: false,
          isReconnecting: false,
        };
        this.pairingMode = false;
        this.pendingPairingNumber = null;
        this.pairingResolver = null;
        this.sessionStartTime = null;
        this.whatsappConnectTime = null;
        this.reconnectAttempts = 0;
        this.emit('status', this.status);
      }
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    console.log(`Requesting pairing code for session ${this.sessionId}:`, formattedNumber);
    
    if (this.client && this.status.isConnected) {
      return { success: false, error: 'Already connected to WhatsApp' };
    }

    if (this.client) {
      await this.disconnect();
    }

    this.pairingMode = true;
    this.pendingPairingNumber = formattedNumber;

    return new Promise((resolve) => {
      this.pairingResolver = resolve;
      
      const timeout = setTimeout(() => {
        if (this.pairingResolver) {
          this.pairingResolver({ success: false, error: 'انتهت مهلة طلب الربط. يرجى المحاولة مرة أخرى.' });
          this.pairingResolver = null;
          this.pendingPairingNumber = null;
          this.pairingMode = false;
        }
      }, 90000);

      this.once('pairingComplete', (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      this.initializeForPairing().catch((err) => {
        clearTimeout(timeout);
        this.pairingResolver = null;
        this.pendingPairingNumber = null;
        this.pairingMode = false;
        resolve({ success: false, error: err?.message || 'Failed to initialize WhatsApp client' });
      });
    });
  }

  private async initializeForPairing(): Promise<void> {
    if (this.client) {
      return;
    }

    console.log(`Initializing WhatsApp session ${this.sessionId} for pairing...`);
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
        clientId: this.sessionId,
      }),
      puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      },
    });

    let pairingCodeRequested = false;
    
    this.client.on('qr', async (qr: string) => {
      console.log('QR received in pairing mode');
      
      if (this.pairingMode && this.pendingPairingNumber && !pairingCodeRequested) {
        pairingCodeRequested = true;
        
        try {
          console.log('Injecting onCodeReceivedEvent function into page...');
          
          const pupPage = (this.client as any).pupPage;
          if (!pupPage) {
            throw new Error('Puppeteer page not available');
          }
          
          const functionExists = await pupPage.evaluate(() => {
            return typeof (window as any).onCodeReceivedEvent === 'function';
          });
          
          if (!functionExists) {
            await pupPage.exposeFunction('onCodeReceivedEvent', (code: string) => {
              console.log('Pairing code received via exposed function:', code);
              return code;
            });
            console.log('onCodeReceivedEvent function injected successfully');
          } else {
            console.log('onCodeReceivedEvent function already exists');
          }
          
          console.log('Waiting for WhatsApp Web to fully load...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          console.log('Requesting pairing code...');
          const code = await (this.client as any).requestPairingCode(this.pendingPairingNumber, true);
          console.log('Pairing code received:', code);
          
          this.status.pairingCode = code;
          this.emit('pairingCode', code);
          this.emit('status', this.status);
          this.emit('pairingComplete', { success: true, code });
          
        } catch (err: any) {
          pairingCodeRequested = false;
          console.error('Error in pairing process:', err?.message || err);
          
          let errorMessage = 'فشل الحصول على كود الربط. يرجى المحاولة لاحقاً أو استخدام رمز QR.';
          
          if (err?.message?.includes('rate') || err?.message?.includes('429')) {
            errorMessage = 'تم تجاوز الحد المسموح لطلبات الربط. يرجى الانتظار ساعة والمحاولة مرة أخرى.';
          } else if (err?.message?.includes('already been registered')) {
            errorMessage = 'الدالة مسجلة مسبقاً. يرجى إعادة تشغيل عملية الربط.';
          }
          
          this.emit('pairingComplete', { success: false, error: errorMessage });
        }
      }
    });

    this.client.on('ready', async () => {
      console.log(`WhatsApp session ${this.sessionId} is ready (pairing mode)!`);
      this.status.isConnected = true;
      this.status.isReady = true;
      this.status.qrCode = null;
      this.status.pairingCode = null;
      this.pendingPairingNumber = null;
      this.pairingResolver = null;
      this.sessionStartTime = new Date();
      this.whatsappConnectTime = new Date();
      this.botRepliesCount = 0;
      
      try {
        const info = await this.client!.info;
        if (info && info.wid) {
          this.status.connectedNumber = info.wid.user;
          console.log('Connected number:', this.status.connectedNumber);
        }
      } catch (err) {
        console.error('Error getting client info:', err);
      }
      
      // تفعيل المزامنة الكاملة لجهات الاتصال عن طريق تحديث حالة الحضور
      try {
        await this.client!.sendPresenceAvailable();
        console.log(`Session ${this.sessionId}: Presence set to available for full sync (pairing mode)`);
      } catch (err) {
        console.error(`Error setting presence for session ${this.sessionId}:`, err);
      }
      
      this.pairingMode = false;
      this.emit('ready');
      this.emit('status', this.status);
    });

    this.client.on('authenticated', () => {
      console.log(`WhatsApp session ${this.sessionId} authenticated (pairing mode)`);
      this.status.isConnected = true;
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error(`WhatsApp session ${this.sessionId} authentication failed (pairing mode):`, msg);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.pairingMode = false;
      this.pendingPairingNumber = null;
      this.pairingResolver = null;
      this.emit('auth_failure', msg);
      this.emit('status', this.status);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log(`WhatsApp session ${this.sessionId} disconnected (pairing mode):`, reason);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.status.qrCode = null;
      this.status.connectedNumber = null;
      this.status.pairingCode = null;
      this.pairingMode = false;
      this.pendingPairingNumber = null;
      this.pairingResolver = null;
      this.emit('disconnected', reason);
      this.emit('status', this.status);
    });

    this.client.on('message', async (message: Message) => {
      // تجاهل الرسائل القديمة (قبل بدء الجلسة)
      const messageTime = message.timestamp * 1000; // تحويل لـ milliseconds
      const sessionStartMs = this.sessionStartTime?.getTime() || Date.now();
      
      // تجاهل الرسائل التي أرسلت قبل أكثر من 30 ثانية من بدء الجلسة
      if (messageTime < sessionStartMs - 30000) {
        console.log(`Ignoring old message from ${message.from} (sent before session started)`);
        return;
      }
      
      const whatsappMessage: WhatsAppMessage = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        isFromMe: message.fromMe,
        sessionId: this.sessionId,
      };

      this.emit('message', whatsappMessage);

      if (!message.fromMe && this.messageHandler) {
        try {
          const response = await this.messageHandler(whatsappMessage);
          if (response) {
            await message.reply(response);
            console.log('Replied to message');
            this.botRepliesCount++;
          }
        } catch (err) {
          console.error('Error handling message:', err);
        }
      }
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error(`Error initializing WhatsApp session ${this.sessionId} for pairing:`, err);
      throw err;
    }
  }

  async refreshQR(): Promise<void> {
    if (this.status.isConnected) {
      console.log('Already connected, no need to refresh QR');
      return;
    }
    
    await this.disconnect();
    await this.initialize();
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => {
        console.log(`Session ${this.sessionId}: Operation timed out after ${timeoutMs}ms`);
        resolve(fallback);
      }, timeoutMs))
    ]);
  }

  private async getRealContacts(): Promise<WhatsAppContactInfo[]> {
    if (!this.client || !this.status.isReady) {
      return [];
    }

    try {
      console.log(`Session ${this.sessionId}: Attempting to fetch real saved contacts...`);
      
      let contacts: any[] = [];
      try {
        contacts = await this.withTimeout(this.client.getContacts(), 45000, [] as any[]);
      } catch (getContactsErr) {
        console.log(`Session ${this.sessionId}: getContacts() failed:`, getContactsErr);
        return [];
      }
      
      if (!contacts || contacts.length === 0) {
        console.log(`Session ${this.sessionId}: No contacts returned from getContacts()`);
        return [];
      }

      console.log(`Session ${this.sessionId}: Raw contacts count: ${contacts.length}`);

      const contactsList: WhatsAppContactInfo[] = [];
      const seenNumbers = new Set<string>();
      let savedCount = 0;
      let skippedCount = 0;

      for (const contact of contacts) {
        try {
          if (!contact || !contact.id) {
            skippedCount++;
            continue;
          }
          
          const idSerialized = contact.id._serialized || '';
          
          const isGroup = contact.isGroup || idSerialized.includes('@g.us');
          if (isGroup) {
            skippedCount++;
            continue;
          }
          
          if (idSerialized === 'status@broadcast' || idSerialized.includes('@broadcast')) {
            skippedCount++;
            continue;
          }
          
          if (contact.isMe) {
            skippedCount++;
            continue;
          }

          if (idSerialized.includes('@lid')) {
            skippedCount++;
            continue;
          }
          
          const phoneNumber = contact.id?.user || contact.number || '';
          if (!phoneNumber || seenNumbers.has(phoneNumber)) {
            skippedCount++;
            continue;
          }
          seenNumbers.add(phoneNumber);

          let isMyContact = false;
          let displayName = '';
          
          if (typeof contact.isMyContact === 'boolean') {
            isMyContact = contact.isMyContact;
          }
          
          if (contact.name && typeof contact.name === 'string' && contact.name.trim() !== '') {
            displayName = contact.name.trim();
            if (!isMyContact && !displayName.startsWith('+') && displayName !== contact.pushname) {
              isMyContact = true;
            }
          } else if (contact.pushname && typeof contact.pushname === 'string') {
            displayName = contact.pushname.trim();
          } else {
            displayName = phoneNumber ? `+${phoneNumber}` : 'Unknown';
          }

          if (isMyContact) savedCount++;

          contactsList.push({
            id: idSerialized,
            phoneNumber: phoneNumber,
            name: displayName,
            pushName: contact.pushname || null,
            isMyContact: isMyContact,
            isGroup: false,
            lastSeen: null,
            profilePicUrl: null,
          });
        } catch (contactErr) {
          skippedCount++;
          continue;
        }
      }

      console.log(`Session ${this.sessionId}: Processed ${contactsList.length} contacts (${savedCount} saved, ${skippedCount} skipped)`);
      return contactsList;
    } catch (err) {
      console.error(`Session ${this.sessionId}: Error getting real contacts:`, err);
      return [];
    }
  }

  private async getContactsFromChats(): Promise<WhatsAppContactInfo[]> {
    if (!this.client || !this.status.isReady) {
      return [];
    }

    try {
      console.log(`Session ${this.sessionId}: Fetching contacts from chats...`);
      const chats = await this.withTimeout(this.client.getChats(), 15000, [] as any[]);
      const contactsList: WhatsAppContactInfo[] = [];
      const seenNumbers = new Set<string>();

      for (const chat of chats) {
        try {
          if (!chat || !chat.id) continue;
          
          const chatIdSerialized = chat.id._serialized || '';
          if (chat.isGroup || chatIdSerialized.includes('@g.us') || chatIdSerialized === 'status@broadcast') {
            continue;
          }

          const phoneNumber = chat.id?.user || '';
          if (!phoneNumber || seenNumbers.has(phoneNumber)) {
            continue;
          }
          seenNumbers.add(phoneNumber);

          let contactName = chat.name || '';
          let pushName: string | null = null;
          let isMyContact = false;
          
          try {
            const contact = await this.withTimeout(
              this.client!.getContactById(chatIdSerialized),
              5000,
              null
            );
            
            if (contact) {
              if (contact.name) {
                contactName = contact.name;
              }
              pushName = contact.pushname || null;
              
              try {
                if (typeof contact.isMyContact === 'boolean') {
                  isMyContact = contact.isMyContact;
                } else if (contact.name && contact.name !== contact.pushname && !contact.name.startsWith('+')) {
                  isMyContact = true;
                }
              } catch {
                isMyContact = !!contact.name && contact.name !== contact.pushname && !contact.name.startsWith('+');
              }
            }
          } catch {}

          if (!contactName || contactName === phoneNumber) {
            contactName = phoneNumber ? `+${phoneNumber}` : 'Unknown';
          }

          contactsList.push({
            id: chatIdSerialized,
            phoneNumber: phoneNumber,
            name: contactName,
            pushName: pushName,
            isMyContact: isMyContact,
            isGroup: false,
            lastSeen: null,
            profilePicUrl: null,
          });
        } catch (chatErr) {
          continue;
        }
      }

      console.log(`Session ${this.sessionId}: Got ${contactsList.length} contacts from chats`);
      return contactsList;
    } catch (err) {
      console.error(`Session ${this.sessionId}: Error getting contacts from chats:`, err);
      return [];
    }
  }

  async getContacts(): Promise<WhatsAppContactInfo[]> {
    if (!this.client || !this.status.isReady) {
      return [];
    }

    console.log(`Session ${this.sessionId}: Fetching all contacts...`);
    
    const realContacts = await this.getRealContacts();
    
    console.log(`Session ${this.sessionId}: Got ${realContacts.length} contacts from WhatsApp API`);
    
    if (realContacts.length === 0) {
      console.log(`Session ${this.sessionId}: No contacts from API, trying chats as fallback...`);
      const chatContacts = await this.getContactsFromChats();
      console.log(`Session ${this.sessionId}: Got ${chatContacts.length} contacts from chats (fallback)`);
      return chatContacts.slice(0, 500);
    }
    
    const savedContacts = realContacts.filter(c => c.isMyContact);
    const otherContacts = realContacts.filter(c => !c.isMyContact);
    
    savedContacts.sort((a, b) => {
      const aIsPhone = a.name.startsWith('+');
      const bIsPhone = b.name.startsWith('+');
      if (!aIsPhone && bIsPhone) return -1;
      if (aIsPhone && !bIsPhone) return 1;
      return a.name.localeCompare(b.name, 'ar');
    });
    
    otherContacts.sort((a, b) => {
      const aIsPhone = a.name.startsWith('+');
      const bIsPhone = b.name.startsWith('+');
      if (!aIsPhone && bIsPhone) return -1;
      if (aIsPhone && !bIsPhone) return 1;
      return a.name.localeCompare(b.name, 'ar');
    });
    
    const allContacts = [...savedContacts, ...otherContacts];
    
    console.log(`Session ${this.sessionId}: Final contacts: ${allContacts.length} total (${savedContacts.length} saved, ${otherContacts.length} others)`);
    return allContacts.slice(0, 500);
  }

  async getChats(): Promise<WhatsAppChatInfo[]> {
    if (!this.client || !this.status.isReady) {
      return [];
    }

    try {
      const chats = await this.withTimeout(this.client.getChats(), 15000, [] as any[]);
      
      if (!chats || chats.length === 0) {
        return [];
      }
      
      const chatList: WhatsAppChatInfo[] = [];
      
      for (const chat of chats) {
        try {
          if (!chat || !chat.id) continue;
          
          const phoneNumber = chat.id?.user || '';
          const displayName = chat.name || (phoneNumber ? `+${phoneNumber}` : `Chat`);
          
          chatList.push({
            id: chat.id._serialized || '',
            phoneNumber: phoneNumber,
            name: displayName,
            lastMessage: chat.lastMessage?.body || null,
            timestamp: chat.lastMessage?.timestamp 
              ? new Date(chat.lastMessage.timestamp * 1000).toLocaleString('ar-EG')
              : null,
            unreadCount: chat.unreadCount || 0,
            isPinned: chat.pinned || false,
            isGroup: chat.isGroup || false,
            isArchived: chat.archived || false,
            isMuted: chat.isMuted || false,
          });
        } catch (chatErr) {
          continue;
        }
      }
      
      return chatList;
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  }

  async getPinnedChats(): Promise<WhatsAppChatInfo[]> {
    try {
      const chats = await this.getChats();
      return chats.filter(chat => chat.isPinned);
    } catch (err) {
      console.error('Error fetching pinned chats:', err);
      return [];
    }
  }

  async getRecentChats(limit: number = 20): Promise<WhatsAppChatInfo[]> {
    try {
      const chats = await this.getChats();
      return chats
        .filter(chat => !chat.isArchived)
        .slice(0, limit);
    } catch (err) {
      console.error('Error fetching recent chats:', err);
      return [];
    }
  }

  private formatDuration(startTime: Date | null): string {
    if (!startTime) return '0 دقيقة';
    
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours} ساعة و ${remainingMins} دقيقة`;
    }
    return `${diffMins} دقيقة`;
  }

  async getSessionDetails(): Promise<SessionDetails> {
    let deviceInfo = null;

    if (this.client && this.status.isReady) {
      try {
        const info = await this.client.info;
        if (info) {
          deviceInfo = {
            platform: info.platform || 'Unknown',
            browser: 'WhatsApp Web',
            version: info.pushname || 'Unknown',
            phoneModel: (info as any).phone?.device_model || null,
          };
        }
      } catch (err) {
        console.error('Error getting device info:', err);
      }
    }

    return {
      connectedNumber: this.status.connectedNumber,
      isOnline: this.status.isConnected && this.status.isReady,
      sessionStartTime: this.sessionStartTime,
      sessionDuration: this.formatDuration(this.sessionStartTime),
      whatsappOpenDuration: this.formatDuration(this.whatsappConnectTime),
      botRepliesCount: this.botRepliesCount,
      deviceInfo,
      isSuspended: this.isSuspended,
    };
  }

  async suspendSession(): Promise<{ success: boolean; message: string }> {
    if (!this.status.isConnected) {
      return { success: false, message: 'لا توجد جلسة متصلة' };
    }

    this.isSuspended = true;
    this.status.isSuspended = true;
    this.emit('status', this.status);
    this.emit('sessionSuspended', true);
    
    return { success: true, message: 'تم تعليق الجلسة بنجاح' };
  }

  async resumeSession(): Promise<{ success: boolean; message: string }> {
    if (!this.status.isConnected) {
      return { success: false, message: 'لا توجد جلسة متصلة' };
    }

    this.isSuspended = false;
    this.status.isSuspended = false;
    this.emit('status', this.status);
    this.emit('sessionResumed', true);
    
    return { success: true, message: 'تم إعادة تفعيل الجلسة بنجاح' };
  }

  isSessionSuspended(): boolean {
    return this.isSuspended;
  }

  incrementBotReplies(): void {
    this.botRepliesCount++;
  }

  getLinkedSessionInfo(): LinkedSession {
    return {
      id: this.sessionId,
      phoneNumber: this.status.connectedNumber || '',
      isConnected: this.status.isConnected,
      isReady: this.status.isReady,
      sessionStartTime: this.sessionStartTime,
      botRepliesCount: this.botRepliesCount,
      isSuspended: this.isSuspended,
    };
  }
}

class WhatsAppService extends EventEmitter {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private activeSessionId: string = 'default';
  private messageHandler: ((message: WhatsAppMessage) => Promise<string | null>) | null = null;

  constructor() {
    super();
  }

  async restoreStoredSessions(): Promise<void> {
    const authPath = './.wwebjs_auth';
    if (!fs.existsSync(authPath)) {
      console.log('No stored sessions found');
      return;
    }

    try {
      const entries = fs.readdirSync(authPath, { withFileTypes: true });
      const sessionDirs = entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('session-'))
        .map(entry => entry.name.replace('session-', ''));

      console.log(`Found ${sessionDirs.length} stored sessions:`, sessionDirs);

      // Clean up old pairing and temporary sessions
      const sessionsToClean = sessionDirs.filter(id => 
        id.startsWith('pairing_') || 
        (id.startsWith('session_') && id !== 'default')
      );
      
      for (const sessionId of sessionsToClean) {
        try {
          const sessionPath = path.join(authPath, `session-${sessionId}`);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`Cleaned up old session: ${sessionId}`);
          }
        } catch (err) {
          console.error(`Failed to clean up session ${sessionId}:`, err);
        }
      }

      // Only restore the default session
      if (sessionDirs.includes('default')) {
        try {
          console.log('Restoring default session');
          const session = this.getOrCreateSession('default');
          await session.initialize();
          console.log('Default session restored successfully');
        } catch (err) {
          console.error('Failed to restore default session:', err);
        }
      } else {
        console.log('No default session found, starting fresh');
      }
    } catch (err) {
      console.error('Error restoring sessions:', err);
    }
  }

  private getOrCreateSession(sessionId: string = 'default'): WhatsAppSession {
    if (!this.sessions.has(sessionId)) {
      const session = new WhatsAppSession(sessionId);
      
      session.on('status', (status) => {
        this.emit('status', { ...status, sessionId });
      });
      
      session.on('qr', (qrCode) => {
        this.emit('qr', { qrCode, sessionId });
      });
      
      session.on('pairingCode', (code) => {
        this.emit('pairingCode', { code, sessionId });
      });
      
      session.on('message', (message) => {
        this.emit('message', message);
      });
      
      session.on('ready', () => {
        this.emit('ready', sessionId);
      });
      
      session.on('disconnected', (reason) => {
        this.emit('disconnected', { sessionId, reason });
      });

      if (this.messageHandler) {
        session.setMessageHandler(this.messageHandler);
      }
      
      this.sessions.set(sessionId, session);
    }
    return this.sessions.get(sessionId)!;
  }

  private getActiveSession(): WhatsAppSession | null {
    return this.sessions.get(this.activeSessionId) || null;
  }

  async initialize(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    const session = this.getOrCreateSession(id);
    await session.initialize();
  }

  async createNewSession(): Promise<string> {
    const sessionId = `session_${Date.now()}`;
    const session = this.getOrCreateSession(sessionId);
    await session.initialize();
    return sessionId;
  }

  async terminateSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'الجلسة غير موجودة' };
    }

    try {
      await session.disconnect();
      this.sessions.delete(sessionId);
      
      const authPath = path.join('./.wwebjs_auth', `session-${sessionId}`);
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      
      this.emit('sessionTerminated', sessionId);
      return { success: true, message: 'تم إنهاء الجلسة وحذف بياناتها بنجاح' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'فشل في إنهاء الجلسة' };
    }
  }

  getLinkedSessions(): LinkedSession[] {
    const sessions: LinkedSession[] = [];
    this.sessions.forEach((session, id) => {
      if (session.status.isConnected || session.status.isReady || id === 'default') {
        sessions.push(session.getLinkedSessionInfo());
      }
    });
    return sessions;
  }

  getAllSessions(): LinkedSession[] {
    const sessions: LinkedSession[] = [];
    this.sessions.forEach((session) => {
      sessions.push(session.getLinkedSessionInfo());
    });
    return sessions;
  }

  setActiveSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      return true;
    }
    return false;
  }

  setMessageHandler(handler: (message: WhatsAppMessage) => Promise<string | null>): void {
    this.messageHandler = handler;
    this.sessions.forEach(session => {
      session.setMessageHandler(handler);
    });
  }

  getStatus(sessionId?: string): WhatsAppStatus {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.getStatus();
    }
    return {
      isConnected: false,
      isReady: false,
      qrCode: null,
      connectedNumber: null,
      pairingCode: null,
      isSuspended: false,
    };
  }

  async sendMessage(to: string, message: string, sessionId?: string): Promise<boolean> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.sendMessage(to, message);
    }
    return false;
  }

  async sendImage(to: string, imageUrl: string, asSticker: boolean = false, sessionId?: string): Promise<boolean> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.sendImage(to, imageUrl, asSticker);
    }
    return false;
  }

  async disconnect(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      await session.disconnect();
    }
  }

  async requestPairingCode(phoneNumber: string, sessionId?: string): Promise<{ success: boolean; code?: string; error?: string }> {
    const id = sessionId || `pairing_${Date.now()}`;
    const session = this.getOrCreateSession(id);
    this.activeSessionId = id;
    return session.requestPairingCode(phoneNumber);
  }

  async refreshQR(sessionId?: string): Promise<void> {
    const id = sessionId || this.activeSessionId;
    const session = this.getOrCreateSession(id);
    await session.refreshQR();
  }

  async repair(sessionId?: string): Promise<{ success: boolean; message: string; diagnostics: any }> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      sessionId: id,
      checks: [],
      actions: [],
    };

    try {
      if (session) {
        diagnostics.checks.push({ name: 'Session Status', result: session.status.isConnected ? 'Connected' : 'Disconnected' });
        diagnostics.actions.push('Disconnecting existing session');
        await session.disconnect();
        this.sessions.delete(id);
      }

      diagnostics.actions.push('Creating new session');
      await this.initialize(id);

      diagnostics.actions.push('Repair completed successfully');
      return {
        success: true,
        message: 'تم إصلاح الاتصال بنجاح - Repair completed successfully',
        diagnostics,
      };
    } catch (error: any) {
      diagnostics.actions.push(`Error during repair: ${error?.message || 'Unknown error'}`);
      return {
        success: false,
        message: `فشل الإصلاح: ${error?.message || 'Unknown error'}`,
        diagnostics,
      };
    }
  }

  incrementBotReplies(sessionId?: string): void {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      session.incrementBotReplies();
    }
  }

  async getContacts(sessionId?: string): Promise<WhatsAppContactInfo[]> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.getContacts();
    }
    return [];
  }

  async getChats(sessionId?: string): Promise<WhatsAppChatInfo[]> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.getChats();
    }
    return [];
  }

  async getPinnedChats(sessionId?: string): Promise<WhatsAppChatInfo[]> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.getPinnedChats();
    }
    return [];
  }

  async getRecentChats(limit: number = 20, sessionId?: string): Promise<WhatsAppChatInfo[]> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.getRecentChats(limit);
    }
    return [];
  }

  async getSessionDetails(sessionId?: string): Promise<SessionDetails> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.getSessionDetails();
    }
    return {
      connectedNumber: null,
      isOnline: false,
      sessionStartTime: null,
      sessionDuration: '0 دقيقة',
      whatsappOpenDuration: '0 دقيقة',
      botRepliesCount: 0,
      deviceInfo: null,
      isSuspended: false,
    };
  }

  async suspendSession(sessionId?: string): Promise<{ success: boolean; message: string }> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.suspendSession();
    }
    return { success: false, message: 'الجلسة غير موجودة' };
  }

  async resumeSession(sessionId?: string): Promise<{ success: boolean; message: string }> {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.resumeSession();
    }
    return { success: false, message: 'الجلسة غير موجودة' };
  }

  isSessionSuspended(sessionId?: string): boolean {
    const id = sessionId || this.activeSessionId;
    const session = this.sessions.get(id);
    if (session) {
      return session.isSessionSuspended();
    }
    return false;
  }
}

export const whatsappService = new WhatsAppService();
