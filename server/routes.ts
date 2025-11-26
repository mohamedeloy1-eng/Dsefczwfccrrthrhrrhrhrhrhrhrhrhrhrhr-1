import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { whatsappService, type WhatsAppMessage } from "./whatsapp";
import { generateResponse, updateSettings, getSettings, clearConversationHistory, clearAllConversations } from "./openai";
import { conversationStore } from "./conversationStore";
import type { BotStatus } from "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients: Set<WebSocket> = new Set();

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    clients.add(ws);
    
    const status = whatsappService.getStatus();
    ws.send(JSON.stringify({ 
      type: 'status', 
      data: {
        ...status,
        messagesCount: conversationStore.getTotalMessagesCount(),
        usersCount: conversationStore.getUsersCount(),
      }
    }));

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });
  });

  const broadcast = (message: object) => {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  whatsappService.on('status', () => {
    const status = whatsappService.getStatus();
    broadcast({ 
      type: 'status', 
      data: {
        ...status,
        messagesCount: conversationStore.getTotalMessagesCount(),
        usersCount: conversationStore.getUsersCount(),
      }
    });
  });

  whatsappService.on('qr', (qrCode: string) => {
    broadcast({ type: 'qr', data: qrCode });
  });

  whatsappService.on('message', (message: WhatsAppMessage) => {
    const conversation = conversationStore.addMessage(
      message.from,
      message.body,
      message.isFromMe,
      message.timestamp
    );
    broadcast({ type: 'message', data: { message, conversation } });
    broadcast({
      type: 'stats',
      data: {
        messagesCount: conversationStore.getTotalMessagesCount(),
        usersCount: conversationStore.getUsersCount(),
      }
    });
  });

  whatsappService.setMessageHandler(async (message: WhatsAppMessage) => {
    try {
      const response = await generateResponse(message.from, message.body);
      if (response) {
        const timestamp = Math.floor(Date.now() / 1000);
        const conversation = conversationStore.addMessage(
          message.from,
          response,
          true,
          timestamp
        );
        broadcast({ type: 'message', data: { conversation } });
        broadcast({
          type: 'stats',
          data: {
            messagesCount: conversationStore.getTotalMessagesCount(),
            usersCount: conversationStore.getUsersCount(),
          }
        });
      }
      return response;
    } catch (error) {
      console.error('Error in message handler:', error);
      return null;
    }
  });

  app.get('/api/status', (req, res) => {
    const status = whatsappService.getStatus();
    const botStatus: BotStatus = {
      ...status,
      messagesCount: conversationStore.getTotalMessagesCount(),
      usersCount: conversationStore.getUsersCount(),
    };
    res.json(botStatus);
  });

  app.post('/api/connect', async (req, res) => {
    try {
      await whatsappService.initialize();
      res.json({ success: true, message: 'Initializing WhatsApp connection...' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to initialize' });
    }
  });

  app.post('/api/disconnect', async (req, res) => {
    try {
      await whatsappService.disconnect();
      res.json({ success: true, message: 'Disconnected from WhatsApp' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to disconnect' });
    }
  });

  app.post('/api/refresh-qr', async (req, res) => {
    try {
      await whatsappService.refreshQR();
      res.json({ success: true, message: 'Refreshing QR code...' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to refresh QR' });
    }
  });

  app.post('/api/repair', async (req, res) => {
    try {
      const result = await whatsappService.repair();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error?.message || 'Failed to repair',
        diagnostics: null 
      });
    }
  });

  app.get('/api/conversations', (req, res) => {
    const conversations = conversationStore.getAllConversations();
    res.json(conversations);
  });

  app.get('/api/conversations/:phoneNumber', (req, res) => {
    const conversation = conversationStore.getConversation(req.params.phoneNumber);
    if (conversation) {
      conversationStore.markAsRead(req.params.phoneNumber);
      res.json(conversation);
    } else {
      res.status(404).json({ error: 'Conversation not found' });
    }
  });

  app.post('/api/conversations/:phoneNumber/send', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const phoneNumber = req.params.phoneNumber + '@c.us';
    
    try {
      const success = await whatsappService.sendMessage(phoneNumber, message);
      
      if (success) {
        const timestamp = Math.floor(Date.now() / 1000);
        const conversation = conversationStore.addMessage(
          req.params.phoneNumber,
          message,
          true,
          timestamp
        );
        broadcast({ type: 'message', data: { conversation } });
        broadcast({
          type: 'stats',
          data: {
            messagesCount: conversationStore.getTotalMessagesCount(),
            usersCount: conversationStore.getUsersCount(),
          }
        });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to send message' });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: error?.message || 'Failed to send message' });
    }
  });

  app.get('/api/settings', (req, res) => {
    res.json(getSettings());
  });

  app.post('/api/settings', (req, res) => {
    const { botName, systemPrompt, autoReply } = req.body;
    const updated = updateSettings({ botName, systemPrompt, autoReply });
    broadcast({ type: 'settings', data: updated });
    res.json(updated);
  });

  app.post('/api/conversations/:phoneNumber/clear', (req, res) => {
    clearConversationHistory(req.params.phoneNumber);
    res.json({ success: true });
  });

  app.post('/api/conversations/clear-all', (req, res) => {
    clearAllConversations();
    conversationStore.clearAll();
    res.json({ success: true });
  });

  return httpServer;
}
