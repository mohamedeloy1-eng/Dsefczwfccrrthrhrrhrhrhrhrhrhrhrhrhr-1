import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
type Message = pkg.Message;
type ClientType = InstanceType<typeof Client>;
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  isFromMe: boolean;
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

class WhatsAppService extends EventEmitter {
  private client: ClientType | null = null;
  private status: WhatsAppStatus = {
    isConnected: false,
    isReady: false,
    qrCode: null,
    connectedNumber: null,
    pairingCode: null,
    isSuspended: false,
  };
  private pairingMode: boolean = false;
  private pendingPairingNumber: string | null = null;
  private pairingResolver: ((result: { success: boolean; code?: string; error?: string }) => void) | null = null;
  private messageHandler: ((message: WhatsAppMessage) => Promise<string | null>) | null = null;
  
  private sessionStartTime: Date | null = null;
  private whatsappConnectTime: Date | null = null;
  private botRepliesCount: number = 0;
  private isSuspended: boolean = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.client) {
      console.log('WhatsApp client already initialized');
      return;
    }

    console.log('Initializing WhatsApp client...');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
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

    this.client.on('qr', async (qr: string) => {
      console.log('QR Code received');
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
      console.log('WhatsApp client is ready!');
      this.status.isConnected = true;
      this.status.isReady = true;
      this.status.qrCode = null;
      this.status.pairingCode = null;
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
      
      this.emit('ready');
      this.emit('status', this.status);
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
      this.status.isConnected = true;
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('WhatsApp authentication failed:', msg);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.emit('auth_failure', msg);
      this.emit('status', this.status);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log('WhatsApp client disconnected:', reason);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.status.qrCode = null;
      this.status.connectedNumber = null;
      this.status.pairingCode = null;
      this.emit('disconnected', reason);
      this.emit('status', this.status);
    });

    this.client.on('message', async (message: Message) => {
      console.log('Message received from:', message.from);
      
      const whatsappMessage: WhatsAppMessage = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        isFromMe: message.fromMe,
      };

      this.emit('message', whatsappMessage);

      if (!message.fromMe && this.messageHandler) {
        try {
          const response = await this.messageHandler(whatsappMessage);
          if (response) {
            await message.reply(response);
            console.log('Replied to message');
          }
        } catch (err) {
          console.error('Error handling message:', err);
        }
      }
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error('Error initializing WhatsApp client:', err);
      throw err;
    }
  }

  setMessageHandler(handler: (message: WhatsAppMessage) => Promise<string | null>): void {
    this.messageHandler = handler;
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

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        console.error('Error disconnecting WhatsApp client:', err);
      } finally {
        this.client = null;
        this.status = {
          isConnected: false,
          isReady: false,
          qrCode: null,
          connectedNumber: null,
          pairingCode: null,
          isSuspended: false,
        };
        this.pairingMode = false;
        this.pendingPairingNumber = null;
        this.pairingResolver = null;
        this.sessionStartTime = null;
        this.whatsappConnectTime = null;
        this.emit('status', this.status);
      }
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    console.log('Requesting pairing code for:', formattedNumber);
    
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

    console.log('Initializing WhatsApp client for pairing...');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
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
      console.log('WhatsApp client is ready (pairing mode)!');
      this.status.isConnected = true;
      this.status.isReady = true;
      this.status.qrCode = null;
      this.status.pairingCode = null;
      this.pendingPairingNumber = null;
      this.pairingResolver = null;
      
      try {
        const info = await this.client!.info;
        if (info && info.wid) {
          this.status.connectedNumber = info.wid.user;
          console.log('Connected number:', this.status.connectedNumber);
        }
      } catch (err) {
        console.error('Error getting client info:', err);
      }
      
      this.pairingMode = false;
      this.emit('ready');
      this.emit('status', this.status);
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client authenticated (pairing mode)');
      this.status.isConnected = true;
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('WhatsApp authentication failed (pairing mode):', msg);
      this.status.isConnected = false;
      this.status.isReady = false;
      this.pairingMode = false;
      this.pendingPairingNumber = null;
      this.pairingResolver = null;
      this.emit('auth_failure', msg);
      this.emit('status', this.status);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log('WhatsApp client disconnected (pairing mode):', reason);
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
      const whatsappMessage: WhatsAppMessage = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: message.timestamp,
        isFromMe: message.fromMe,
      };

      this.emit('message', whatsappMessage);

      if (!message.fromMe && this.messageHandler) {
        try {
          const response = await this.messageHandler(whatsappMessage);
          if (response) {
            await message.reply(response);
            console.log('Replied to message');
          }
        } catch (err) {
          console.error('Error handling message:', err);
        }
      }
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error('Error initializing WhatsApp client for pairing:', err);
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

  async repair(): Promise<{ success: boolean; message: string; diagnostics: any }> {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      status: { ...this.status },
      checks: [],
      actions: [],
    };

    try {
      diagnostics.checks.push({ name: 'Client Status', result: this.client ? 'Exists' : 'Null' });
      diagnostics.checks.push({ name: 'Connection', result: this.status.isConnected ? 'Connected' : 'Disconnected' });
      diagnostics.checks.push({ name: 'Ready', result: this.status.isReady ? 'Ready' : 'Not Ready' });

      if (this.client && !this.status.isConnected) {
        diagnostics.actions.push('Destroying stale client');
        try {
          await this.client.destroy();
        } catch (e) {
          diagnostics.actions.push('Client destroy failed (expected if already dead)');
        }
        this.client = null;
      }

      diagnostics.actions.push('Resetting status');
      this.status = {
        isConnected: false,
        isReady: false,
        qrCode: null,
        connectedNumber: null,
        pairingCode: null,
        isSuspended: false,
      };
      this.pairingMode = false;
      this.sessionStartTime = null;
      this.whatsappConnectTime = null;
      this.botRepliesCount = 0;
      this.emit('status', this.status);

      diagnostics.actions.push('Reinitializing WhatsApp client');
      await this.initialize();

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

  incrementBotReplies(): void {
    this.botRepliesCount++;
  }

  async getContacts(): Promise<WhatsAppContactInfo[]> {
    if (!this.client || !this.status.isReady) {
      return [];
    }

    try {
      const contacts = await this.client.getContacts();
      return contacts
        .filter(contact => !contact.isGroup && contact.id._serialized !== 'status@broadcast')
        .map(contact => ({
          id: contact.id._serialized,
          phoneNumber: contact.id.user || '',
          name: contact.name || contact.pushname || `User ${contact.id.user?.slice(-4) || ''}`,
          pushName: contact.pushname || null,
          isMyContact: contact.isMyContact || false,
          isGroup: contact.isGroup || false,
          lastSeen: null,
          profilePicUrl: null,
        }))
        .slice(0, 100);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      return [];
    }
  }

  async getChats(): Promise<WhatsAppChatInfo[]> {
    if (!this.client || !this.status.isReady) {
      return [];
    }

    try {
      const chats = await this.client.getChats();
      return chats.map(chat => ({
        id: chat.id._serialized,
        phoneNumber: chat.id.user || '',
        name: chat.name || `Chat ${chat.id.user?.slice(-4) || ''}`,
        lastMessage: chat.lastMessage?.body || null,
        timestamp: chat.lastMessage?.timestamp 
          ? new Date(chat.lastMessage.timestamp * 1000).toLocaleString('ar-EG')
          : null,
        unreadCount: chat.unreadCount || 0,
        isPinned: chat.pinned || false,
        isGroup: chat.isGroup || false,
        isArchived: chat.archived || false,
        isMuted: chat.isMuted || false,
      }));
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  }

  async getPinnedChats(): Promise<WhatsAppChatInfo[]> {
    const chats = await this.getChats();
    return chats.filter(chat => chat.isPinned);
  }

  async getRecentChats(limit: number = 20): Promise<WhatsAppChatInfo[]> {
    const chats = await this.getChats();
    return chats
      .filter(chat => !chat.isArchived)
      .slice(0, limit);
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
}

export const whatsappService = new WhatsAppService();
