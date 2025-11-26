import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface BotSettings {
  botName: string;
  systemPrompt: string;
  autoReply: boolean;
}

let settings: BotSettings = {
  botName: 'GX-MODY',
  systemPrompt: `You are GX-MODY, a helpful and friendly AI assistant on WhatsApp. 
Answer questions clearly and concisely. Always be polite and helpful.
Keep responses brief and suitable for chat messages.
If asked about your identity, say you are GX-MODY, an AI assistant.`,
  autoReply: true,
};

const conversationHistory: Map<string, ConversationMessage[]> = new Map();

const MAX_HISTORY_LENGTH = 20;

export function updateSettings(newSettings: Partial<BotSettings>): BotSettings {
  settings = { ...settings, ...newSettings };
  return settings;
}

export function getSettings(): BotSettings {
  return { ...settings };
}

export function getConversationHistory(userId: string): ConversationMessage[] {
  return conversationHistory.get(userId) || [];
}

export function clearConversationHistory(userId: string): void {
  conversationHistory.delete(userId);
}

export function clearAllConversations(): void {
  conversationHistory.clear();
}

export async function generateResponse(userId: string, userMessage: string): Promise<string> {
  if (!settings.autoReply) {
    return '';
  }

  let history = conversationHistory.get(userId) || [];
  
  history.push({
    role: 'user',
    content: userMessage,
  });

  if (history.length > MAX_HISTORY_LENGTH) {
    history = history.slice(-MAX_HISTORY_LENGTH);
  }

  try {
    const messages: ConversationMessage[] = [
      {
        role: 'system',
        content: settings.systemPrompt,
      },
      ...history,
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    history.push({
      role: 'assistant',
      content: assistantMessage,
    });

    conversationHistory.set(userId, history);

    return assistantMessage;
  } catch (error: any) {
    console.error('OpenAI API error:', error?.message || error);
    
    if (error?.status === 401) {
      return 'Sorry, there is an issue with the API configuration. Please contact the administrator.';
    }
    
    if (error?.status === 429) {
      return 'Sorry, the service is currently busy. Please try again in a moment.';
    }
    
    return 'Sorry, I encountered an error while processing your message. Please try again.';
  }
}
