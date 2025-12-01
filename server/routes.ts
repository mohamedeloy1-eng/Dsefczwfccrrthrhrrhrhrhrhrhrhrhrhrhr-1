import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { whatsappService, type WhatsAppMessage } from "./whatsapp";
import { generateResponse, generateImage, updateSettings, getSettings, clearConversationHistory, clearAllConversations } from "./openai";
import { conversationStore } from "./conversationStore";
import { userStore } from "./userStore";
import { logStore } from "./logStore";
import type { BotStatus, UserClassification } from "./types";

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
        safeModeEnabled: userStore.isSafeModeEnabled(),
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
        safeModeEnabled: userStore.isSafeModeEnabled(),
      }
    });
  });

  whatsappService.on('qr', (qrCode: string) => {
    broadcast({ type: 'qr', data: qrCode });
  });

  whatsappService.on('pairingCode', (code: string) => {
    broadcast({ type: 'pairingCode', data: code });
  });

  whatsappService.on('message', (message: WhatsAppMessage) => {
    const user = userStore.getOrCreateUser(message.from);
    userStore.recordMessage(message.from, message.isFromMe);
    
    const conversation = conversationStore.addMessage(
      message.from,
      message.body,
      message.isFromMe,
      message.timestamp
    );

    logStore.logIncomingMessage(
      message.from,
      user.sessionId || 'unknown',
      message.body,
      'success'
    );

    broadcast({ type: 'message', data: { message, conversation } });
    broadcast({
      type: 'stats',
      data: {
        messagesCount: conversationStore.getTotalMessagesCount(),
        usersCount: conversationStore.getUsersCount(),
      }
    });
    broadcast({ type: 'users', data: userStore.getAllUsers() });
  });

  whatsappService.setMessageHandler(async (message: WhatsAppMessage) => {
    const user = userStore.getOrCreateUser(message.from);
    const sessionId = user.sessionId || 'unknown';

    const rateLimitCheck = userStore.checkRateLimit(message.from);
    if (!rateLimitCheck.allowed) {
      logStore.logIncomingMessage(
        message.from,
        sessionId,
        message.body,
        rateLimitCheck.reason?.includes('Rate limit') ? 'rate_limited' : 'blocked',
        rateLimitCheck.reason
      );

      broadcast({ type: 'security', data: { 
        type: 'rate_limited', 
        phoneNumber: message.from, 
        reason: rateLimitCheck.reason 
      }});

      return null;
    }

    try {
      const imagePatterns = [
        /^صورة[:\s]+(.+)/i,
        /^image[:\s]+(.+)/i,
        /^ارسم[:\s]+(.+)/i,
        /^draw[:\s]+(.+)/i,
        /^generate[:\s]+(.+)/i,
      ];
      
      const stickerPatterns = [
        /^استيكر[:\s]+(.+)/i,
        /^sticker[:\s]+(.+)/i,
        /^ملصق[:\s]+(.+)/i,
      ];
      
      let imagePrompt: string | null = null;
      let isSticker = false;
      
      for (const pattern of stickerPatterns) {
        const match = message.body.match(pattern);
        if (match) {
          imagePrompt = match[1].trim();
          isSticker = true;
          break;
        }
      }
      
      if (!imagePrompt) {
        for (const pattern of imagePatterns) {
          const match = message.body.match(pattern);
          if (match) {
            imagePrompt = match[1].trim();
            break;
          }
        }
      }
      
      if (imagePrompt) {
        const result = await generateImage(imagePrompt);
        
        if (result.success && result.imageUrl) {
          try {
            const sent = await whatsappService.sendImage(message.from, result.imageUrl, isSticker);
            if (sent) {
              const successMsg = isSticker ? '✅ تم إرسال الاستيكر بنجاح!' : '✅ تم إرسال الصورة بنجاح!';
              const timestamp = Math.floor(Date.now() / 1000);
              conversationStore.addMessage(message.from, successMsg, true, timestamp);
              
              logStore.logOutgoingMessage(
                message.from,
                sessionId,
                successMsg,
                isSticker ? 'sticker' : 'image',
                'success'
              );

              broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from) } });
              return null;
            } else {
              const errorMsg = `❌ فشل في إرسال ${isSticker ? 'الاستيكر' : 'الصورة'}. حاول مرة أخرى.`;
              userStore.recordError(message.from, errorMsg);
              logStore.logError(message.from, sessionId, errorMsg);
              return errorMsg;
            }
          } catch (err) {
            console.error('Error sending image:', err);
            const errorMsg = `❌ فشل في إرسال ${isSticker ? 'الاستيكر' : 'الصورة'}. حاول مرة أخرى.`;
            const errorResult = userStore.recordError(message.from, errorMsg);
            logStore.logError(message.from, sessionId, errorMsg);

            if (errorResult.shouldBlock) {
              broadcast({ type: 'security', data: { 
                type: 'auto_blocked', 
                phoneNumber: message.from, 
                reason: 'Repeated errors' 
              }});
            }

            return errorMsg;
          }
        } else {
          const errorMsg = `❌ ${result.error || 'فشل في إنشاء الصورة. حاول مرة أخرى.'}`;
          userStore.recordError(message.from, errorMsg);
          logStore.logError(message.from, sessionId, errorMsg);
          return errorMsg;
        }
      }
      
      const response = await generateResponse(message.from, message.body);
      if (response) {
        const timestamp = Math.floor(Date.now() / 1000);
        const conversation = conversationStore.addMessage(
          message.from,
          response,
          true,
          timestamp
        );

        logStore.logOutgoingMessage(
          message.from,
          sessionId,
          response,
          'text',
          'success'
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
    } catch (error: any) {
      console.error('Error in message handler:', error);
      const errorMsg = 'عذراً، حدث خطأ. حاول مرة أخرى.';
      const errorResult = userStore.recordError(message.from, error?.message || 'Unknown error');
      logStore.logError(message.from, sessionId, error?.message || 'Unknown error');

      if (errorResult.shouldBlock) {
        broadcast({ type: 'security', data: { 
          type: 'auto_blocked', 
          phoneNumber: message.from, 
          reason: 'Repeated errors' 
        }});
      }

      return errorMsg;
    }
  });

  app.get('/api/status', (req, res) => {
    const status = whatsappService.getStatus();
    const botStatus: BotStatus = {
      ...status,
      messagesCount: conversationStore.getTotalMessagesCount(),
      usersCount: conversationStore.getUsersCount(),
      safeModeEnabled: userStore.isSafeModeEnabled(),
    };
    res.json(botStatus);
  });

  app.post('/api/connect', async (req, res) => {
    try {
      if (userStore.isSafeModeEnabled()) {
        return res.status(403).json({ success: false, error: 'Cannot connect while Safe Mode is enabled. Disable Safe Mode first.' });
      }
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

  app.post('/api/request-pairing-code', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ success: false, error: 'Phone number is required' });
      }
      
      const result = await whatsappService.requestPairingCode(phoneNumber);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error?.message || 'Failed to request pairing code' 
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
    if (userStore.isSafeModeEnabled()) {
      return res.status(403).json({ error: 'Cannot send messages while Safe Mode is enabled' });
    }

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

  app.get('/api/users', (req, res) => {
    const users = userStore.getAllUsers();
    res.json(users);
  });

  app.get('/api/users/search', (req, res) => {
    const query = req.query.q as string || '';
    const users = userStore.searchUsers(query);
    res.json(users);
  });

  app.get('/api/users/:phoneNumber', (req, res) => {
    const user = userStore.getUser(req.params.phoneNumber);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/users/:phoneNumber/block', (req, res) => {
    const { reason } = req.body;
    const success = userStore.blockUser(req.params.phoneNumber, reason);
    if (success) {
      const user = userStore.getUser(req.params.phoneNumber);
      logStore.logSystemEvent(
        req.params.phoneNumber,
        user?.sessionId || 'admin',
        `User blocked: ${reason || 'No reason provided'}`,
        'success'
      );
      broadcast({ type: 'users', data: userStore.getAllUsers() });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/users/:phoneNumber/unblock', (req, res) => {
    const success = userStore.unblockUser(req.params.phoneNumber);
    if (success) {
      const user = userStore.getUser(req.params.phoneNumber);
      logStore.logSystemEvent(
        req.params.phoneNumber,
        user?.sessionId || 'admin',
        'User unblocked',
        'success'
      );
      broadcast({ type: 'users', data: userStore.getAllUsers() });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/users/:phoneNumber/classification', (req, res) => {
    const { classification } = req.body as { classification: UserClassification };
    if (!classification || !['normal', 'test', 'spam'].includes(classification)) {
      return res.status(400).json({ error: 'Invalid classification' });
    }
    const success = userStore.setUserClassification(req.params.phoneNumber, classification);
    if (success) {
      broadcast({ type: 'users', data: userStore.getAllUsers() });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/users/:phoneNumber/limit', (req, res) => {
    const { limit } = req.body;
    if (typeof limit !== 'number' || limit < 1) {
      return res.status(400).json({ error: 'Invalid limit' });
    }
    const success = userStore.setUserMessageLimit(req.params.phoneNumber, limit);
    if (success) {
      broadcast({ type: 'users', data: userStore.getAllUsers() });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.post('/api/users/:phoneNumber/delete-session', (req, res) => {
    const success = userStore.deleteUserSession(req.params.phoneNumber);
    if (success) {
      const user = userStore.getUser(req.params.phoneNumber);
      logStore.logSystemEvent(
        req.params.phoneNumber,
        'admin',
        'Session deleted',
        'success'
      );
      broadcast({ type: 'users', data: userStore.getAllUsers() });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.get('/api/users/stats/summary', (req, res) => {
    const stats = userStore.getStats();
    res.json(stats);
  });

  app.get('/api/security/settings', (req, res) => {
    const settings = userStore.getSecuritySettings();
    res.json(settings);
  });

  app.post('/api/security/settings', (req, res) => {
    const settings = userStore.updateSecuritySettings(req.body);
    broadcast({ type: 'security_settings', data: settings });
    res.json(settings);
  });

  app.post('/api/security/safe-mode/enable', async (req, res) => {
    try {
      userStore.enableSafeMode();
      
      await whatsappService.disconnect();
      
      userStore.clearAllUserSessions();
      
      logStore.logSystemEvent('system', 'admin', 'SAFE MODE ENABLED - Bot stopped, sessions cleared', 'success');
      
      broadcast({ 
        type: 'safe_mode', 
        data: { enabled: true, timestamp: new Date().toISOString() } 
      });
      
      const status = whatsappService.getStatus();
      broadcast({ 
        type: 'status', 
        data: {
          ...status,
          messagesCount: conversationStore.getTotalMessagesCount(),
          usersCount: conversationStore.getUsersCount(),
          safeModeEnabled: true,
        }
      });

      res.json({ success: true, message: 'Safe mode enabled' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to enable safe mode' });
    }
  });

  app.post('/api/security/safe-mode/disable', (req, res) => {
    userStore.disableSafeMode();
    
    logStore.logSystemEvent('system', 'admin', 'SAFE MODE DISABLED', 'success');
    
    broadcast({ 
      type: 'safe_mode', 
      data: { enabled: false, timestamp: new Date().toISOString() } 
    });

    const status = whatsappService.getStatus();
    broadcast({ 
      type: 'status', 
      data: {
        ...status,
        messagesCount: conversationStore.getTotalMessagesCount(),
        usersCount: conversationStore.getUsersCount(),
        safeModeEnabled: false,
      }
    });

    res.json({ success: true, message: 'Safe mode disabled' });
  });

  app.get('/api/logs', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = logStore.getRecentLogs(limit);
    res.json(logs);
  });

  app.get('/api/logs/phone/:phoneNumber', (req, res) => {
    const logs = logStore.getLogsByPhone(req.params.phoneNumber);
    res.json(logs);
  });

  app.get('/api/logs/errors', (req, res) => {
    const logs = logStore.getErrorLogs();
    res.json(logs);
  });

  app.get('/api/logs/blocked', (req, res) => {
    const logs = logStore.getBlockedLogs();
    res.json(logs);
  });

  app.get('/api/logs/stats', (req, res) => {
    const stats = logStore.getLogStats();
    res.json(stats);
  });

  app.get('/api/logs/search', (req, res) => {
    const query = req.query.q as string || '';
    const logs = logStore.searchLogs(query);
    res.json(logs);
  });

  app.post('/api/logs/clear', (req, res) => {
    logStore.clearLogs();
    res.json({ success: true });
  });

  app.post('/api/logs/clear/:phoneNumber', (req, res) => {
    logStore.clearLogsByPhone(req.params.phoneNumber);
    res.json({ success: true });
  });

  return httpServer;
}
