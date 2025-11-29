import OpenAI from 'openai';

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

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
  systemPrompt: `أنت GX-MODY، مساعد ذكاء اصطناعي متقدم على واتساب.

🔹 **قدراتك الرئيسية:**
- كتابة وشرح الأكواد البرمجية بجميع اللغات (Python, JavaScript, Java, C++, HTML, CSS, وغيرها)
- حل المشاكل البرمجية وتصحيح الأخطاء
- شرح المفاهيم التقنية بطريقة مبسطة
- الإجابة على الأسئلة العامة بذكاء

🔹 **تعليمات مهمة:**
- عند كتابة كود، استخدم تنسيق واضح وأضف تعليقات توضيحية
- اجعل الردود مناسبة للدردشة (موجزة لكن مفيدة)
- تحدث بالعربية أو الإنجليزية حسب لغة المستخدم
- كن ودوداً ومساعداً دائماً

🔹 **للصور والاستيكرات:**
- لإنشاء صورة: أرسل "صورة: [وصف الصورة]" أو "image: [description]"
- لإنشاء استيكر: أرسل "استيكر: [وصف]" أو "sticker: [description]"

عند سؤالك عن هويتك، قل أنك GX-MODY، بوت ذكاء اصطناعي متطور على واتساب.`,
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

export async function generateImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data[0]?.url;
    if (imageUrl) {
      return { success: true, imageUrl };
    }
    return { success: false, error: 'لم يتم إنشاء الصورة' };
  } catch (error: any) {
    console.error('DALL-E API error:', error?.message || error);
    
    if (error?.status === 429) {
      return { success: false, error: 'الخدمة مشغولة، حاول لاحقاً' };
    }
    if (error?.code === 'content_policy_violation') {
      return { success: false, error: 'المحتوى المطلوب غير مسموح به' };
    }
    return { success: false, error: error?.message || 'حدث خطأ في إنشاء الصورة' };
  }
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

    const openai = getOpenAIClient();
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
    
    if (error?.message?.includes('OPENAI_API_KEY is not configured')) {
      return 'عذراً، مفتاح OpenAI API غير مضاف. يرجى إضافته في الإعدادات.';
    }
    
    if (error?.status === 401) {
      return 'عذراً، مفتاح OpenAI API غير صحيح. يرجى التحقق منه.';
    }
    
    if (error?.status === 429) {
      return 'عذراً، الخدمة مشغولة حالياً. يرجى المحاولة لاحقاً.';
    }
    
    return 'عذراً، حدث خطأ أثناء معالجة رسالتك. يرجى المحاولة مرة أخرى.';
  }
}
