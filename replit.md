# GX-MODY WhatsApp AI Bot

## Overview
GX-MODY is an intelligent WhatsApp bot powered by OpenAI's GPT model. It automatically responds to WhatsApp messages with AI-generated responses, similar to ChatGPT.

## Architecture

### Backend (server/)
- **whatsapp.ts** - WhatsApp Web.js service for connecting to WhatsApp, handling QR code generation, and message processing
- **openai.ts** - OpenAI integration for generating AI responses with conversation context
- **conversationStore.ts** - In-memory storage for conversation history and statistics
- **userStore.ts** - User management with rate limiting, blocking, and classifications
- **logStore.ts** - Complete message logging system with timestamps and session IDs
- **mediaDownloader.ts** - YouTube media downloading service for extracting audio and video with FFmpeg conversion
- **routes.ts** - REST API endpoints + WebSocket for real-time updates, includes media download command handler
- **types.ts** - TypeScript type definitions

### Frontend (client/)
- **Dashboard.tsx** - Main dashboard page with tabs for Chats, Users, Security, Connection, and Settings
- **Header.tsx** - App header with connection toggle and theme switcher
- **StatusCard.tsx** - Bot status, connected phone number, message count, and user count display
- **QRCodeDisplay.tsx** - QR code and phone number linking for WhatsApp connection (supports both methods)
- **ConversationList.tsx** - List of all conversations
- **ChatView.tsx** - Individual conversation message view
- **SettingsPanel.tsx** - Bot configuration (name, system prompt, auto-reply toggle)
- **UserManagement.tsx** - User management panel with search, filtering, blocking, and statistics
- **SecurityPanel.tsx** - Security settings, SAFE MODE, and complete logging system

### Real-time Updates
- WebSocket connection at `/ws` for live updates
- Events: status, qr, pairingCode, message, stats, settings, users, security, safe_mode, security_settings

## Security Features

### Rate Limiting
- Default: 20 messages per minute per user
- Configurable per user
- Daily limit: 500 messages per day (configurable)

### Auto-Ban System
- Automatic blocking after 5 errors (spam threshold)
- Users classified as 'spam' are automatically blocked

### SAFE MODE
- Emergency shutdown feature
- Stops all message processing
- Disconnects WhatsApp
- Clears all user sessions
- Prevents new connections until disabled

### User Classification
- Normal: Regular users
- Test: Testing accounts
- Spam: Blocked users

## API Endpoints

### Status & Connection
- `GET /api/status` - Get bot status, connected number, message count, user count, safe mode status
- `POST /api/connect` - Initialize WhatsApp connection (blocked in safe mode)
- `POST /api/disconnect` - Disconnect from WhatsApp
- `POST /api/refresh-qr` - Refresh QR code
- `POST /api/request-pairing-code` - Request pairing code for phone number linking

### Conversations
- `GET /api/conversations` - Get all conversations
- `GET /api/conversations/:phoneNumber` - Get specific conversation
- `POST /api/conversations/:phoneNumber/send` - Send message to user (blocked in safe mode)
- `POST /api/conversations/:phoneNumber/clear` - Clear conversation history
- `POST /api/conversations/clear-all` - Clear all conversations

### User Management
- `GET /api/users` - Get all users
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/:phoneNumber` - Get specific user
- `POST /api/users/:phoneNumber/block` - Block user
- `POST /api/users/:phoneNumber/unblock` - Unblock user
- `POST /api/users/:phoneNumber/classification` - Set user classification
- `POST /api/users/:phoneNumber/limit` - Set user message limit
- `POST /api/users/:phoneNumber/delete-session` - Delete user session
- `GET /api/users/stats/summary` - Get user statistics

### Security
- `GET /api/security/settings` - Get security settings
- `POST /api/security/settings` - Update security settings
- `POST /api/security/safe-mode/enable` - Enable SAFE MODE
- `POST /api/security/safe-mode/disable` - Disable SAFE MODE

### Logs
- `GET /api/logs?limit=100` - Get recent logs
- `GET /api/logs/phone/:phoneNumber` - Get logs for specific user
- `GET /api/logs/errors` - Get error logs
- `GET /api/logs/blocked` - Get blocked/rate-limited logs
- `GET /api/logs/stats` - Get log statistics
- `GET /api/logs/search?q=query` - Search logs
- `POST /api/logs/clear` - Clear all logs
- `POST /api/logs/clear/:phoneNumber` - Clear logs for specific user

### Settings
- `GET /api/settings` - Get bot settings
- `POST /api/settings` - Update bot settings (botName, systemPrompt, autoReply)

### Scheduled Messages
- `GET /api/scheduled-messages` - Get all scheduled messages
- `POST /api/scheduled-messages` - Create scheduled message (phoneNumber, message, scheduledAt, repeatType)
- `POST /api/scheduled-messages/:id/cancel` - Cancel scheduled message
- `DELETE /api/scheduled-messages/:id` - Delete scheduled message

### Reminders
- `GET /api/reminders` - Get all reminders
- `POST /api/reminders` - Create reminder (phoneNumber, title, description, remindAt)
- `POST /api/reminders/:id/cancel` - Cancel reminder
- `DELETE /api/reminders/:id` - Delete reminder

### Welcome Messages
- `GET /api/welcome-messages` - Get all welcome messages
- `POST /api/welcome-messages` - Create welcome message
- `PUT /api/welcome-messages/:id` - Update welcome message
- `DELETE /api/welcome-messages/:id` - Delete welcome message

### Reply Templates
- `GET /api/reply-templates` - Get all reply templates
- `POST /api/reply-templates` - Create reply template (title, content, category)
- `PUT /api/reply-templates/:id` - Update reply template
- `DELETE /api/reply-templates/:id` - Delete reply template
- `POST /api/reply-templates/:id/button` - Add interactive button

### Analytics
- `GET /api/analytics/current` - Get current day statistics
- `GET /api/analytics/snapshots` - Get historical snapshots
- `POST /api/analytics/snapshot` - Create analytics snapshot

### Voice Settings
- `GET /api/voice-settings` - Get voice settings
- `PUT /api/voice-settings` - Update voice settings (isEnabled, ttsVoice, sttEnabled)

### Integrations
- `GET /api/integrations` - Get all integrations (Google, Notion, Stripe)
- `PUT /api/integrations/:name` - Update integration config
- `POST /api/integrations/:name/enable` - Enable integration
- `POST /api/integrations/:name/disable` - Disable integration

### Subscription Tiers
- `GET /api/subscription-tiers` - Get all subscription tiers
- `PUT /api/subscription-tiers/:tier` - Update tier settings

### User Memory
- `GET /api/user-memory/:phoneNumber` - Get user memories
- `POST /api/user-memory/:phoneNumber` - Save user memory (key, value, category)
- `DELETE /api/user-memory/:phoneNumber/:key` - Delete user memory

## Environment Variables
- `OPENAI_API_KEY` - OpenAI API key for AI responses (required)

## How to Use
1. Open the app and go to the "الاتصال" (Connect) tab
2. Choose your connection method:
   - **QR Code**: Scan the QR code with WhatsApp on your phone
   - **Phone Number**: Enter your phone number with country code, get a linking code, and enter it in WhatsApp
3. Once connected, the bot will automatically respond to incoming messages
4. View your connected phone number in the status cards at the top
5. Configure bot behavior in the "الإعدادات" (Settings) tab
6. View conversations in the "المحادثات" (Chats) tab
7. Manage users in the "المستخدمين" (Users) tab
8. Control security settings and SAFE MODE in the "الأمان" (Security) tab

## Tech Stack
- Frontend: React, TanStack Query, Tailwind CSS, shadcn/ui
- Backend: Express.js, WebSocket
- WhatsApp: whatsapp-web.js
- AI: OpenAI GPT-4o-mini
