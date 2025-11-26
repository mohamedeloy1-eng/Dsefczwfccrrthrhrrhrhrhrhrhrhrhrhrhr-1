import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
type Message = pkg.Message;
import QRCode from 'qrcode';
import { EventEmitter } from 'events';

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
}

class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private status: WhatsAppStatus = {
    isConnected: false,
    isReady: false,
    qrCode: null,
  };
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

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.status.isConnected = true;
      this.status.isReady = true;
      this.status.qrCode = null;
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
        };
        this.emit('status', this.status);
      }
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
      };
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
