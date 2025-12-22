import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { whatsappService, type WhatsAppMessage, type WhatsAppContactInfo, type WhatsAppChatInfo, type SessionDetails, type LinkedSession } from "./whatsapp";
import { generateResponse, generateImage, webSearch, updateSettings, getSettings, clearConversationHistory, clearAllConversations, summarizeConversation } from "./openai";
import { conversationStore } from "./conversationStore";
import { userStore } from "./userStore";
import { logStore } from "./logStore";
import { storage } from "./storage";
import type { BotStatus, UserClassification } from "./types";
import {
  scheduledMessagesStore,
  remindersStore,
  welcomeMessagesStore,
  replyTemplatesStore,
  analyticsStore,
  voiceSettingsStore,
  integrationsStore,
  subscriptionTiersStore,
  userMemoryStore,
} from "./featureStores";
import { 
  downloadYouTubeAudio, 
  downloadYouTubeVideo, 
  extractYouTubeUrl, 
  cleanupFile 
} from "./mediaDownloader";

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
    
    ws.send(JSON.stringify({ type: 'sessions', data: whatsappService.getLinkedSessions() }));

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

  console.log('Starting to restore stored WhatsApp sessions...');
  whatsappService.restoreStoredSessions().then(() => {
    console.log('Session restoration complete');
    broadcast({ type: 'sessions', data: whatsappService.getLinkedSessions() });
  }).catch(err => {
    console.error('Error during session restoration:', err);
  });

  whatsappService.on('status', (statusData) => {
    const status = whatsappService.getStatus();
    
    if (statusData?.sessionId && statusData.isReady) {
      conversationStore.setDefaultSessionId(statusData.sessionId);
      userStore.setDefaultSessionId(statusData.sessionId);
    }
    
    broadcast({ 
      type: 'status', 
      data: {
        ...status,
        sessionId: statusData?.sessionId,
        messagesCount: conversationStore.getTotalMessagesCount(),
        usersCount: conversationStore.getUsersCount(),
        safeModeEnabled: userStore.isSafeModeEnabled(),
      }
    });
    broadcast({ type: 'sessions', data: whatsappService.getLinkedSessions() });
  });

  whatsappService.on('qr', (data: { qrCode: string; sessionId: string }) => {
    broadcast({ type: 'qr', data: { qrCode: data.qrCode, sessionId: data.sessionId } });
  });

  whatsappService.on('pairingCode', (data: { code: string; sessionId: string }) => {
    broadcast({ type: 'pairingCode', data: { code: data.code, sessionId: data.sessionId } });
  });

  whatsappService.on('sessionTerminated', (sessionId: string) => {
    broadcast({ type: 'sessionTerminated', data: { sessionId } });
    broadcast({ type: 'sessions', data: whatsappService.getLinkedSessions() });
  });

  whatsappService.on('reconnecting', (data: { sessionId: string; attempt: number; maxAttempts: number }) => {
    broadcast({ type: 'reconnecting', data });
  });

  whatsappService.on('reconnectFailed', (data: { sessionId: string; attempts: number }) => {
    broadcast({ type: 'reconnectFailed', data });
  });

  whatsappService.on('message', (message: WhatsAppMessage) => {
    const sessionId = message.sessionId || 'default';
    const user = userStore.getOrCreateUser(message.from, sessionId);
    userStore.recordMessage(message.from, message.isFromMe, sessionId);
    
    const conversation = conversationStore.addMessage(
      message.from,
      message.body,
      message.isFromMe,
      message.timestamp,
      sessionId
    );

    logStore.logIncomingMessage(
      message.from,
      sessionId,
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
    const sessionId = message.sessionId || 'default';
    
    if (whatsappService.isSessionSuspended(sessionId)) {
      console.log('Session is suspended, not responding to message');
      return null;
    }

    // Support Ticket Logic
    const pendingTicket = await storage.getPendingTicket(message.from);
    
    if (message.body.startsWith('/support') || message.body.startsWith('.ticket') || message.body.startsWith('.دعم')) {
      if (pendingTicket) {
        await storage.deleteTicket(pendingTicket.id);
      }
      
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      await storage.createSupportTicket({
        phoneNumber: message.from,
        status: "pending",
        expiresAt: expiresAt
      });

      const responseMsg = "🎫 تم فتح تذكرة دعم جديدة. الرجاء كتابة المشكلة التي تواجهك الآن.\n\n⚠️ ملاحظة: سيتم إرسال التذكرة تلقائياً بعد 5 دقائق إذا لم يتم الرد.";
      const timestamp = Math.floor(Date.now() / 1000);
      conversationStore.addMessage(message.from, responseMsg, true, timestamp, sessionId);
      broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
      
      // Auto-submit after 5 minutes
      setTimeout(async () => {
        const ticket = await storage.getPendingTicket(message.from);
        if (ticket && ticket.status === "pending") {
          await storage.updateSupportTicket(ticket.id, { status: "open" });
          const timeoutMsg = "⏱️ انتهى وقت الانتظار. تم إرسال التذكرة بالمعلومات المتوفرة.";
          whatsappService.sendMessage(message.from + '@c.us', timeoutMsg, sessionId);
          broadcast({ type: 'tickets_update' });
        }
      }, 5 * 60 * 1000);

      return responseMsg;
    }

    if (pendingTicket && pendingTicket.status === "pending") {
      await storage.updateSupportTicket(pendingTicket.id, { 
        issue: message.body,
        status: "open"
      });
      
      const successMsg = "✅ شكرًا لك. تم استلام تفاصيل المشكلة وتحويلها لفريق الدعم. سيتم الرد عليك قريباً.";
      const timestamp = Math.floor(Date.now() / 1000);
      conversationStore.addMessage(message.from, successMsg, true, timestamp, sessionId);
      broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
      broadcast({ type: 'tickets_update' });
      return successMsg;
    }

    const user = userStore.getOrCreateUser(message.from, sessionId);

    const rateLimitCheck = userStore.checkRateLimit(message.from, sessionId);
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
      
      const searchPatterns = [
        /^بحث[:\s]+(.+)/i,
        /^search[:\s]+(.+)/i,
        /^ابحث[:\s]+(.+)/i,
        /^ابحث عن[:\s]+(.+)/i,
      ];

      const downloadPatterns = [
        /^حمل[:\s]+(.+)/i,
        /^download[:\s]+(.+)/i,
        /^تحميل[:\s]+(.+)/i,
        /^صوت[:\s]+(.+)/i,
        /^audio[:\s]+(.+)/i,
        /^فيديو[:\s]+(.+)/i,
        /^video[:\s]+(.+)/i,
      ];
      
      let downloadQuery: string | null = null;
      let downloadType: 'audio' | 'video' = 'audio';
      let matchedPatternIndex = -1;
      
      for (let i = 0; i < downloadPatterns.length; i++) {
        const match = message.body.match(downloadPatterns[i]);
        if (match) {
          downloadQuery = match[1].trim();
          matchedPatternIndex = i;
          if (i >= 4) {
            downloadType = 'video';
          }
          break;
        }
      }
      
      if (downloadQuery) {
        const youtubeUrl = extractYouTubeUrl(downloadQuery);
        
        if (youtubeUrl) {
          const statusMsg = downloadType === 'video' ? '⏳ جاري تحميل الفيديو...' : '⏳ جاري تحميل الصوت...';
          const timestamp = Math.floor(Date.now() / 1000);
          conversationStore.addMessage(message.from, statusMsg, true, timestamp, sessionId);
          broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
          
          try {
            const downloadResult = downloadType === 'video' 
              ? await downloadYouTubeVideo(youtubeUrl)
              : await downloadYouTubeAudio(youtubeUrl);
            
            if (downloadResult.success && downloadResult.filePath && downloadResult.fileName) {
              const sent = downloadType === 'video'
                ? await whatsappService.sendVideoFile(message.from, downloadResult.filePath, downloadResult.fileName, sessionId)
                : await whatsappService.sendAudioFile(message.from, downloadResult.filePath, downloadResult.fileName, sessionId);
              
              if (sent) {
                const successMsg = downloadType === 'video' ? '✅ تم إرسال الفيديو بنجاح!' : '✅ تم إرسال الصوت بنجاح!';
                conversationStore.addMessage(message.from, successMsg, true, timestamp, sessionId);
                
                logStore.logOutgoingMessage(
                  message.from,
                  sessionId,
                  successMsg,
                  'text',
                  'success'
                );
                
                whatsappService.incrementBotReplies(sessionId);
                broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
                
                cleanupFile(downloadResult.filePath);
                return null;
              } else {
                const errorMsg = `❌ فشل في إرسال ${downloadType === 'video' ? 'الفيديو' : 'الصوت'}. حاول مرة أخرى.`;
                conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
                userStore.recordError(message.from, errorMsg, sessionId);
                logStore.logError(message.from, sessionId, errorMsg);
                broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
                cleanupFile(downloadResult.filePath);
                return errorMsg;
              }
            } else {
              const errorMsg = downloadResult.error || `❌ فشل في تحميل ${downloadType === 'video' ? 'الفيديو' : 'الصوت'}. حاول مرة أخرى.`;
              conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
              userStore.recordError(message.from, errorMsg, sessionId);
              logStore.logError(message.from, sessionId, errorMsg);
              broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
              return errorMsg;
            }
          } catch (err: any) {
            console.error('Download error:', err);
            const errorMsg = `❌ خطأ في التحميل: ${err?.message || 'حاول مرة أخرى'}`;
            const timestamp = Math.floor(Date.now() / 1000);
            conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
            const errorResult = userStore.recordError(message.from, err?.message || errorMsg, sessionId);
            logStore.logError(message.from, sessionId, err?.message || 'Download error');
            
            if (errorResult.shouldBlock) {
              broadcast({ type: 'security', data: { 
                type: 'auto_blocked', 
                phoneNumber: message.from, 
                reason: 'Repeated errors' 
              }});
            }
            
            broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
            return errorMsg;
          }
        } else {
          const errorMsg = '❌ أرسل رابط يوتيوب صحيح. مثال:\nحمل: https://youtube.com/watch?v=xxxxx';
          const timestamp = Math.floor(Date.now() / 1000);
          conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
          broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
          return errorMsg;
        }
      }
      
      let searchQuery: string | null = null;
      for (const pattern of searchPatterns) {
        const match = message.body.match(pattern);
        if (match) {
          searchQuery = match[1].trim();
          break;
        }
      }
      
      if (searchQuery) {
        const result = await webSearch(searchQuery);
        
        if (result.success && result.result) {
          const searchResponse = `🔍 *نتائج البحث:*\n\n${result.result}`;
          const timestamp = Math.floor(Date.now() / 1000);
          conversationStore.addMessage(message.from, searchResponse, true, timestamp, sessionId);
          
          logStore.logOutgoingMessage(
            message.from,
            sessionId,
            searchResponse,
            'text',
            'success'
          );

          whatsappService.incrementBotReplies(sessionId);
          broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
          return searchResponse;
        } else {
          const errorMsg = `❌ ${result.error || 'فشل في البحث. حاول مرة أخرى.'}`;
          userStore.recordError(message.from, errorMsg, sessionId);
          logStore.logError(message.from, sessionId, errorMsg);
          return errorMsg;
        }
      }
      
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
            const sent = await whatsappService.sendImage(message.from, result.imageUrl, isSticker, sessionId);
            if (sent) {
              const successMsg = isSticker ? '✅ تم إرسال الاستيكر بنجاح!' : '✅ تم إرسال الصورة بنجاح!';
              const timestamp = Math.floor(Date.now() / 1000);
              conversationStore.addMessage(message.from, successMsg, true, timestamp, sessionId);
              
              logStore.logOutgoingMessage(
                message.from,
                sessionId,
                successMsg,
                isSticker ? 'sticker' : 'image',
                'success'
              );

              whatsappService.incrementBotReplies(sessionId);
              broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
              return null;
            } else {
              const errorMsg = `❌ فشل في إرسال ${isSticker ? 'الاستيكر' : 'الصورة'}. حاول مرة أخرى.`;
              const timestamp = Math.floor(Date.now() / 1000);
              conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
              userStore.recordError(message.from, errorMsg, sessionId);
              logStore.logError(message.from, sessionId, errorMsg);
              broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
              return errorMsg;
            }
          } catch (err: any) {
            console.error('Error sending image:', err);
            const errorMsg = `❌ فشل في إرسال ${isSticker ? 'الاستيكر' : 'الصورة'}. حاول مرة أخرى.`;
            const timestamp = Math.floor(Date.now() / 1000);
            conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
            const errorResult = userStore.recordError(message.from, err?.message || errorMsg, sessionId);
            logStore.logError(message.from, sessionId, err?.message || errorMsg);

            if (errorResult.shouldBlock) {
              broadcast({ type: 'security', data: { 
                type: 'auto_blocked', 
                phoneNumber: message.from, 
                reason: 'Repeated errors' 
              }});
            }

            broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
            return errorMsg;
          }
        } else {
          const errorMsg = result.error || '❌ فشل في إنشاء الصورة. حاول مرة أخرى.';
          const timestamp = Math.floor(Date.now() / 1000);
          conversationStore.addMessage(message.from, errorMsg, true, timestamp, sessionId);
          userStore.recordError(message.from, errorMsg, sessionId);
          logStore.logError(message.from, sessionId, `Image generation failed: ${result.errorCode || 'unknown'}`);
          broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(message.from, sessionId) } });
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
          timestamp,
          sessionId
        );

        whatsappService.incrementBotReplies(sessionId);

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
      const errorResult = userStore.recordError(message.from, error?.message || 'Unknown error', sessionId);
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
      const sessionId = req.body?.sessionId;
      await whatsappService.disconnect(sessionId);
      res.json({ success: true, message: 'Disconnected from WhatsApp' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to disconnect' });
    }
  });

  app.post('/api/refresh-qr', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      await whatsappService.refreshQR(sessionId);
      res.json({ success: true, message: 'Refreshing QR code...' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to refresh QR' });
    }
  });

  app.post('/api/repair', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      const result = await whatsappService.repair(sessionId);
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
      const { phoneNumber, sessionId } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ success: false, error: 'Phone number is required' });
      }
      
      const result = await whatsappService.requestPairingCode(phoneNumber, sessionId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error?.message || 'Failed to request pairing code' 
      });
    }
  });

  app.post('/api/sessions/create', async (req, res) => {
    try {
      if (userStore.isSafeModeEnabled()) {
        return res.status(403).json({ success: false, error: 'Cannot create session while Safe Mode is enabled.' });
      }
      const sessionId = await whatsappService.createNewSession();
      res.json({ success: true, sessionId, message: 'New session created' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to create session' });
    }
  });

  app.post('/api/sessions/:sessionId/terminate', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await whatsappService.terminateSession(sessionId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to terminate session' });
    }
  });

  app.get('/api/sessions', (req, res) => {
    const sessions = whatsappService.getLinkedSessions();
    res.json(sessions);
  });

  app.get('/api/sessions/all', (req, res) => {
    const sessions = whatsappService.getAllSessions();
    res.json(sessions);
  });

  app.post('/api/sessions/:sessionId/set-active', (req, res) => {
    const { sessionId } = req.params;
    const success = whatsappService.setActiveSession(sessionId);
    if (success) {
      conversationStore.setDefaultSessionId(sessionId);
      userStore.setDefaultSessionId(sessionId);
      res.json({ success: true, message: 'Active session changed' });
    } else {
      res.status(404).json({ success: false, message: 'Session not found' });
    }
  });

  app.get('/api/conversations', (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    const conversations = sessionId 
      ? conversationStore.getAllConversations(sessionId)
      : conversationStore.getAllSessionsConversations();
    res.json(conversations);
  });

  // Support Tickets API
  app.get('/api/tickets', async (req, res) => {
    try {
      const tickets = await storage.getSupportTickets();
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets/:id/reply', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { response } = req.body;
      if (!response) return res.status(400).json({ error: "Response is required" });

      const tickets = await storage.getSupportTickets();
      const ticket = tickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      // Send to WhatsApp
      const sent = await whatsappService.sendMessage(ticket.phoneNumber + '@c.us', `🎫 *رد على تذكرة الدعم:*\n\n${response}\n\nتم إغلاق التذكرة.`);
      
      // Also add to conversation history
      const timestamp = Math.floor(Date.now() / 1000);
      conversationStore.addMessage(ticket.phoneNumber, `🎫 *رد على تذكرة الدعم:*\n\n${response}\n\nتم إغلاق التذكرة.`, true, timestamp, 'default');
      
      if (sent) {
        await storage.updateSupportTicket(id, { 
          response, 
          status: "closed" 
        });
        broadcast({ type: 'tickets_update' });
        broadcast({ type: 'message', data: { conversation: conversationStore.getConversation(ticket.phoneNumber, 'default') } });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to send WhatsApp message" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/conversations/:phoneNumber', (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;
    const conversation = conversationStore.getConversation(req.params.phoneNumber, sessionId);
    if (conversation) {
      conversationStore.markAsRead(req.params.phoneNumber, sessionId);
      res.json(conversation);
    } else {
      res.status(404).json({ error: 'Conversation not found' });
    }
  });

  app.post('/api/conversations/:phoneNumber/send', async (req, res) => {
    if (userStore.isSafeModeEnabled()) {
      return res.status(403).json({ error: 'Cannot send messages while Safe Mode is enabled' });
    }

    const { message, sessionId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const phoneNumber = req.params.phoneNumber + '@c.us';
    
    try {
      const success = await whatsappService.sendMessage(phoneNumber, message, sessionId);
      
      if (success) {
        const timestamp = Math.floor(Date.now() / 1000);
        const conversation = conversationStore.addMessage(
          req.params.phoneNumber,
          message,
          true,
          timestamp,
          sessionId
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

  app.post('/api/settings/api-key', async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || apiKey.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'API key is required' });
      }
      
      process.env.OPENAI_API_KEY = apiKey;
      
      res.json({ 
        success: true, 
        message: 'API key saved successfully',
        configured: true
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error?.message || 'Failed to save API key' 
      });
    }
  });

  app.get('/api/ai/status', (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({ 
        configured: false, 
        message: 'مفتاح OpenAI API غير مضاف. يرجى إضافته في الإعدادات السرية.',
        messageEn: 'OpenAI API key is not configured. Please add it in Secrets.'
      });
    } else if (apiKey.length < 20) {
      res.json({ 
        configured: false, 
        message: 'مفتاح OpenAI API غير صالح. يرجى التحقق منه.',
        messageEn: 'OpenAI API key appears invalid. Please check it.'
      });
    } else {
      res.json({ 
        configured: true, 
        message: 'مفتاح OpenAI API مضاف ويعمل بشكل صحيح.',
        messageEn: 'OpenAI API key is configured and working.'
      });
    }
  });

  // AI APIs
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, userId } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }
      const id = userId || 'web_user_' + Date.now();
      const response = await generateResponse(id, message);
      res.json({ success: true, response, userId: id });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to generate response' });
    }
  });

  app.post('/api/ai/image', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' });
      }
      const result = await generateImage(prompt);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to generate image' });
    }
  });

  app.get('/api/ai/history/:userId', (req, res) => {
    const { getConversationHistory } = require('./openai');
    const history = getConversationHistory(req.params.userId);
    res.json({ userId: req.params.userId, history });
  });

  app.post('/api/ai/summarize', async (req, res) => {
    try {
      const { messages, phoneNumber, sessionId } = req.body;
      
      let messagesToSummarize = messages;
      
      if (!messages && phoneNumber) {
        const conversation = conversationStore.getConversation(phoneNumber, sessionId || 'default');
        if (conversation) {
          messagesToSummarize = conversation.messages.map(m => ({
            content: m.content,
            isBot: m.isBot
          }));
        }
      }
      
      if (!messagesToSummarize || messagesToSummarize.length === 0) {
        return res.status(400).json({ success: false, error: 'No messages to summarize' });
      }
      
      const result = await summarizeConversation(messagesToSummarize);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to summarize' });
    }
  });

  app.delete('/api/ai/history/:userId', (req, res) => {
    clearConversationHistory(req.params.userId);
    res.json({ success: true, message: 'Conversation history cleared' });
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

  app.get('/api/whatsapp/contacts', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const contacts = await whatsappService.getContacts(sessionId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch contacts' });
    }
  });

  app.get('/api/whatsapp/chats', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const chats = await whatsappService.getChats(sessionId);
      res.json(chats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch chats' });
    }
  });

  app.get('/api/whatsapp/chats/pinned', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const pinnedChats = await whatsappService.getPinnedChats(sessionId);
      res.json(pinnedChats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch pinned chats' });
    }
  });

  app.get('/api/whatsapp/chats/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const sessionId = req.query.sessionId as string | undefined;
      const recentChats = await whatsappService.getRecentChats(limit, sessionId);
      res.json(recentChats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch recent chats' });
    }
  });

  app.get('/api/whatsapp/session', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const sessionDetails = await whatsappService.getSessionDetails(sessionId);
      res.json(sessionDetails);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch session details' });
    }
  });

  app.post('/api/whatsapp/session/suspend', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      const result = await whatsappService.suspendSession(sessionId);
      if (result.success) {
        broadcast({ type: 'session_status', data: { suspended: true, sessionId } });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to suspend session' });
    }
  });

  app.post('/api/whatsapp/session/resume', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      const result = await whatsappService.resumeSession(sessionId);
      if (result.success) {
        broadcast({ type: 'session_status', data: { suspended: false, sessionId } });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || 'Failed to resume session' });
    }
  });

  app.get('/api/whatsapp/contacts-data', async (req, res) => {
    try {
      let sessionId = req.query.sessionId as string | undefined;
      
      if (!sessionId) {
        // First try to find any ready session
        const linkedSessions = whatsappService.getLinkedSessions();
        const readySession = linkedSessions.find(s => s.isConnected && s.isReady);
        if (readySession) {
          sessionId = readySession.id;
        } else {
          // Fall back to default session
          sessionId = 'default';
        }
      }
      
      const status = whatsappService.getStatus(sessionId);
      if (!status.isConnected || !status.isReady) {
        return res.json({
          phoneNumber: null,
          contacts: [],
          pinnedChats: [],
          recentChats: [],
          lastUpdated: new Date(),
        });
      }

      const [contacts, pinnedChats, recentChats] = await Promise.all([
        whatsappService.getContacts(sessionId),
        whatsappService.getPinnedChats(sessionId),
        whatsappService.getRecentChats(30, sessionId),
      ]);

      res.json({
        phoneNumber: status.connectedNumber,
        contacts,
        pinnedChats,
        recentChats,
        lastUpdated: new Date(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to fetch contacts data' });
    }
  });

  // ========== Feature Stores APIs ==========

  // Scheduled Messages APIs
  app.get('/api/scheduled-messages', (req, res) => res.json(scheduledMessagesStore.getAll()));
  app.post('/api/scheduled-messages', (req, res) => {
    const { phoneNumber, message, scheduledAt, sessionId, repeatType } = req.body;
    if (!phoneNumber || !message || !scheduledAt) {
      return res.status(400).json({ error: 'phoneNumber, message, and scheduledAt are required' });
    }
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt date' });
    }
    const msg = scheduledMessagesStore.create({ phoneNumber, message, scheduledAt: date, sessionId, repeatType });
    res.json(msg);
  });
  app.post('/api/scheduled-messages/:id/cancel', (req, res) => {
    const success = scheduledMessagesStore.cancel(req.params.id);
    res.json({ success });
  });
  app.delete('/api/scheduled-messages/:id', (req, res) => {
    const success = scheduledMessagesStore.delete(req.params.id);
    res.json({ success });
  });

  // Reminders APIs
  app.get('/api/reminders', (req, res) => res.json(remindersStore.getAll()));
  app.post('/api/reminders', (req, res) => {
    const { phoneNumber, title, description, remindAt, sessionId } = req.body;
    if (!phoneNumber || !title || !remindAt) {
      return res.status(400).json({ error: 'phoneNumber, title, and remindAt are required' });
    }
    const date = new Date(remindAt);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid remindAt date' });
    }
    const reminder = remindersStore.create({ phoneNumber, title, description, remindAt: date, sessionId });
    res.json(reminder);
  });
  app.post('/api/reminders/:id/cancel', (req, res) => {
    const success = remindersStore.cancel(req.params.id);
    res.json({ success });
  });
  app.delete('/api/reminders/:id', (req, res) => {
    const success = remindersStore.delete(req.params.id);
    res.json({ success });
  });

  // Welcome Messages APIs
  app.get('/api/welcome-messages', (req, res) => res.json(welcomeMessagesStore.getAll()));
  app.post('/api/welcome-messages', (req, res) => {
    const { message, isEnabled, sessionId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    const msg = welcomeMessagesStore.create({ message, isEnabled: isEnabled ?? true, sessionId });
    res.json(msg);
  });
  app.put('/api/welcome-messages/:id', (req, res) => {
    const updated = welcomeMessagesStore.update(req.params.id, req.body);
    if (updated) res.json(updated);
    else res.status(404).json({ error: 'Not found' });
  });
  app.delete('/api/welcome-messages/:id', (req, res) => {
    const success = welcomeMessagesStore.delete(req.params.id);
    res.json({ success });
  });

  // Reply Templates APIs
  app.get('/api/reply-templates', (req, res) => res.json(replyTemplatesStore.getAll()));
  app.post('/api/reply-templates', (req, res) => {
    const { title, content, category, shortcut, isActive, buttons } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }
    const template = replyTemplatesStore.create({ 
      title, 
      content, 
      category: category || 'general', 
      shortcut, 
      isActive: isActive ?? true, 
      buttons 
    });
    res.json(template);
  });
  app.put('/api/reply-templates/:id', (req, res) => {
    const updated = replyTemplatesStore.update(req.params.id, req.body);
    if (updated) res.json(updated);
    else res.status(404).json({ error: 'Not found' });
  });
  app.delete('/api/reply-templates/:id', (req, res) => {
    const success = replyTemplatesStore.delete(req.params.id);
    res.json({ success });
  });
  app.post('/api/reply-templates/:id/button', (req, res) => {
    const button = replyTemplatesStore.addButton(req.params.id, req.body);
    res.json(button);
  });

  // Analytics APIs
  app.get('/api/analytics/current', (req, res) => res.json(analyticsStore.getCurrentStats()));
  app.get('/api/analytics/snapshots', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 30;
    res.json(analyticsStore.getSnapshots(limit));
  });
  app.post('/api/analytics/snapshot', (req, res) => {
    const totalUsers = userStore.getAllUsers().length;
    const scheduledMessages = scheduledMessagesStore.getAll().filter(m => m.status === 'pending').length;
    const snapshot = analyticsStore.createSnapshot(totalUsers, scheduledMessages);
    res.json(snapshot);
  });

  // Voice Settings APIs
  app.get('/api/voice-settings', (req, res) => res.json(voiceSettingsStore.get()));
  app.put('/api/voice-settings', (req, res) => {
    const settings = voiceSettingsStore.update(req.body);
    res.json(settings);
  });

  // Integrations APIs
  app.get('/api/integrations', (req, res) => res.json(integrationsStore.getAll()));
  app.put('/api/integrations/:name', (req, res) => {
    const updated = integrationsStore.update(req.params.name, req.body);
    if (updated) res.json(updated);
    else res.status(404).json({ error: 'Not found' });
  });
  app.post('/api/integrations/:name/enable', (req, res) => {
    const success = integrationsStore.enable(req.params.name);
    res.json({ success });
  });
  app.post('/api/integrations/:name/disable', (req, res) => {
    const success = integrationsStore.disable(req.params.name);
    res.json({ success });
  });

  // Subscription Tiers APIs
  app.get('/api/subscription-tiers', (req, res) => res.json(subscriptionTiersStore.getAll()));
  app.put('/api/subscription-tiers/:tier', (req, res) => {
    const updated = subscriptionTiersStore.update(req.params.tier, req.body);
    if (updated) res.json(updated);
    else res.status(404).json({ error: 'Not found' });
  });

  // User Memory APIs
  app.get('/api/user-memory/:phoneNumber', (req, res) => {
    const memories = userMemoryStore.getAll(req.params.phoneNumber);
    res.json(memories);
  });
  app.post('/api/user-memory/:phoneNumber', (req, res) => {
    const { key, value, category } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }
    const memory = userMemoryStore.set(req.params.phoneNumber, key, value, category || 'general');
    res.json(memory);
  });
  app.delete('/api/user-memory/:phoneNumber/:key', (req, res) => {
    const success = userMemoryStore.delete(req.params.phoneNumber, req.params.key);
    res.json({ success });
  });

  // Broadcast API
  app.post('/api/broadcast/send', async (req, res) => {
    try {
      const { phoneNumber, message, sessionId = 'default' } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ success: false, error: 'phoneNumber and message are required' });
      }

      const formattedNumber = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      const success = await whatsappService.sendMessage(formattedNumber, message, sessionId);
      
      if (success) {
        logStore.logOutgoingMessage(phoneNumber, sessionId, message, 'text', 'success');
        res.json({ success: true });
      } else {
        logStore.logError(phoneNumber, sessionId, 'Failed to send broadcast message');
        res.json({ success: false, error: 'Failed to send message' });
      }
    } catch (error: any) {
      console.error('Broadcast error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to send broadcast' });
    }
  });

  // Connect message handlers for scheduled messages and reminders
  scheduledMessagesStore.setMessageHandler(async (phoneNumber, message, sessionId) => {
    return await whatsappService.sendMessage(phoneNumber, message, sessionId);
  });

  remindersStore.setReminderHandler(async (phoneNumber, title, description, sessionId) => {
    const msg = `⏰ تذكير: ${title}${description ? '\n' + description : ''}`;
    await whatsappService.sendMessage(phoneNumber + '@c.us', msg, sessionId);
  });

  return httpServer;
}