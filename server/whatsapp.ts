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
}

class WhatsAppService extends EventEmitter {
  private client: ClientType | null = null;
  private status: WhatsAppStatus = {
    isConnected: false,
    isReady: false,
    qrCode: null,
    connectedNumber: null,
    pairingCode: null,
  };
  private pairingMode: boolean = false;
  private pendingPairingNumber: string | null = null;
  private pairingResolver: ((result: { success: boolean; code?: string; error?: string }) => void) | null = null;
  private messageHandler: ((message: WhatsAppMessage) => Promise<string | null>) | null = null;

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
        };
        this.pairingMode = false;
        this.pendingPairingNumber = null;
        this.pairingResolver = null;
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
        
        console.log('Waiting 6 seconds for WhatsApp Web to fully load...');
        await new Promise(resolve => setTimeout(resolve, 6000));
        
        const maxRetries = 3;
        let lastError: any = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Pairing code request attempt ${attempt}/${maxRetries}...`);
            
            const code = await (this.client as any).requestPairingCode(this.pendingPairingNumber, true);
            console.log('Pairing code received:', code);
            
            this.status.pairingCode = code;
            this.emit('pairingCode', code);
            this.emit('status', this.status);
            this.emit('pairingComplete', { success: true, code });
            return;
          } catch (err: any) {
            lastError = err;
            console.error(`Pairing code attempt ${attempt} failed:`, err?.message || err);
            
            if (attempt < maxRetries) {
              const waitTime = 3000 * attempt;
              console.log(`Retrying in ${waitTime / 1000} seconds...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        pairingCodeRequested = false;
        console.error('All pairing code attempts failed:', lastError?.message);
        
        const errorMessage = lastError?.message?.includes('rate') || lastError?.message?.includes('429')
          ? 'تم تجاوز الحد المسموح لطلبات الربط. يرجى الانتظار ساعة والمحاولة مرة أخرى أو استخدام رمز QR.'
          : 'فشل الحصول على كود الربط. يرجى المحاولة لاحقاً أو استخدام رمز QR.';
        
        this.emit('pairingComplete', { success: false, error: errorMessage });
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
      };
      this.pairingMode = false;
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
}

export const whatsappService = new WhatsAppService();
