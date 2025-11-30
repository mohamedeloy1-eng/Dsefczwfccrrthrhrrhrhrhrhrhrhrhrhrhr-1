# GX-MODY WhatsApp AI Bot

## Overview
GX-MODY is an intelligent WhatsApp bot powered by OpenAI's GPT model. It automatically responds to WhatsApp messages with AI-generated responses, similar to ChatGPT.

## Architecture

### Backend (server/)
- **whatsapp.ts** - WhatsApp Web.js service for connecting to WhatsApp, handling QR code generation, and message processing
- **openai.ts** - OpenAI integration for generating AI responses with conversation context
- **conversationStore.ts** - In-memory storage for conversation history and statistics
- **routes.ts** - REST API endpoints + WebSocket for real-time updates
- **types.ts** - TypeScript type definitions

### Frontend (client/)
- **Dashboard.tsx** - Main dashboard page with tabs for Chats, Connection, and Settings
- **Header.tsx** - App header with connection toggle and theme switcher
- **StatusCard.tsx** - Bot status, connected phone number, message count, and user count display
- **QRCodeDisplay.tsx** - QR code and phone number linking for WhatsApp connection (supports both methods)
- **ConversationList.tsx** - List of all conversations
- **ChatView.tsx** - Individual conversation message view
- **SettingsPanel.tsx** - Bot configuration (name, system prompt, auto-reply toggle)

### Real-time Updates
- WebSocket connection at `/ws` for live updates
- Events: status, qr, pairingCode, message, stats, settings

## API Endpoints

### Status & Connection
- `GET /api/status` - Get bot status, connected number, message count, user count
- `POST /api/connect` - Initialize WhatsApp connection
- `POST /api/disconnect` - Disconnect from WhatsApp
- `POST /api/refresh-qr` - Refresh QR code
- `POST /api/request-pairing-code` - Request pairing code for phone number linking

### Conversations
- `GET /api/conversations` - Get all conversations
- `GET /api/conversations/:phoneNumber` - Get specific conversation
- `POST /api/conversations/:phoneNumber/send` - Send message to user
- `POST /api/conversations/:phoneNumber/clear` - Clear conversation history
- `POST /api/conversations/clear-all` - Clear all conversations

### Settings
- `GET /api/settings` - Get bot settings
- `POST /api/settings` - Update bot settings (botName, systemPrompt, autoReply)

## Environment Variables
- `OPENAI_API_KEY` - OpenAI API key for AI responses (required)

## How to Use
1. Open the app and go to the "Connect" tab
2. Choose your connection method:
   - **QR Code**: Scan the QR code with WhatsApp on your phone
   - **Phone Number**: Enter your phone number with country code, get a linking code, and enter it in WhatsApp
3. Once connected, the bot will automatically respond to incoming messages
4. View your connected phone number in the status cards at the top
5. Configure bot behavior in the "Settings" tab
6. View conversations in the "Chats" tab

## Tech Stack
- Frontend: React, TanStack Query, Tailwind CSS, shadcn/ui
- Backend: Express.js, WebSocket
- WhatsApp: whatsapp-web.js
- AI: OpenAI GPT-4o-mini
