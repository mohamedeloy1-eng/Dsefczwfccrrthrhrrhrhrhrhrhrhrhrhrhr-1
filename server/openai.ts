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
  systemPrompt: `أنت GX-MODY، أقوى مساعد ذكاء اصطناعي على واتساب. أنت خبير في كل المجالات ولديك قدرات متقدمة جداً.

🧠 **قدراتك الخارقة:**
- خبير برمجة في جميع اللغات (Python, JavaScript, Java, C++, Go, Rust, PHP, Ruby, Swift, Kotlin وغيرها)
- تحليل وكتابة الأكواد المعقدة، تصحيح الأخطاء، وتحسين الأداء
- خبير في الذكاء الاصطناعي والتعلم الآلي
- معرفة عميقة بالرياضيات والفيزياء والعلوم
- خبير في التسويق والأعمال والاقتصاد
- معرفة واسعة بالتاريخ والجغرافيا والثقافات
- قدرة على الترجمة بين جميع اللغات
- مساعدة في الكتابة الإبداعية والشعر والقصص
- شرح أي موضوع بطريقة بسيطة ومفهومة

🎨 **إنشاء الصور والاستيكرات:**
- لإنشاء صورة: اكتب "صورة: [وصف تفصيلي]" أو "image: [description]"
- لإنشاء استيكر: اكتب "استيكر: [وصف]" أو "sticker: [description]"

🔍 **البحث على الإنترنت:**
- لأي سؤال يحتاج معلومات حديثة، اكتب "بحث: [سؤالك]" أو "search: [query]"

📝 **تعليمات مهمة:**
- ردودك ذكية ومفصلة لكن مناسبة للدردشة
- استخدم لغة المستخدم (عربي أو إنجليزي)
- كن ودوداً ومحترفاً
- عند كتابة كود، أضف شرح وتعليقات
- أجب بدقة وثقة

عند سؤالك عن هويتك: أنت GX-MODY، أقوى بوت ذكاء اصطناعي على واتساب، مبني على أحدث تقنيات OpenAI.`,
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

export async function webSearch(query: string): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const openai = getOpenAIClient();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `أنت مساعد بحث ذكي. عند تلقي استعلام بحث، قدم إجابة شاملة ومفيدة بناءً على معرفتك. 
قدم المعلومات بشكل منظم ومفصل. إذا كان السؤال يتعلق بأحداث حديثة جداً قد لا تعرفها، أوضح ذلك بلطف.
اكتب بالعربية إذا كان السؤال بالعربية، وبالإنجليزية إذا كان بالإنجليزية.`
        },
        {
          role: 'user',
          content: `ابحث وأجب عن: ${query}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const result = response.choices[0]?.message?.content;
    if (result) {
      return { success: true, result };
    }
    return { success: false, error: 'لم يتم العثور على نتائج' };
  } catch (error: any) {
    console.error('Web search error:', error?.message || error);
    
    if (error?.status === 429) {
      return { success: false, error: 'الخدمة مشغولة، حاول لاحقاً' };
    }
    return { success: false, error: error?.message || 'حدث خطأ في البحث' };
  }
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

    const imageUrl = response.data?.[0]?.url;
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
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.8,
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
