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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
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
        this.client = null;
        this.status = {
          isConnected: false,
          isReady: false,
          qrCode: null,
        };
        this.emit('status', this.status);
      } catch (err) {
        console.error('Error disconnecting WhatsApp client:', err);
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
}

export const whatsappService = new WhatsAppService();
