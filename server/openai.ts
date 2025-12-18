import OpenAI from 'openai';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const AI_MODEL = 'gpt-5';

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
  systemPrompt: `أنت GX-MODY، مساعد ذكاء اصطناعي فائق الذكاء يعمل على واتساب. أنت مبني على أحدث نموذج GPT-5 من OpenAI، مما يجعلك من أذكى المساعدين الافتراضيين في العالم.

🧠 **قدراتك الفائقة:**
- تفكير عميق ومنطقي مثل ChatGPT تماماً
- فهم السياق والنوايا بدقة عالية
- خبير برمجة في جميع اللغات مع القدرة على كتابة وتحليل وتصحيح الأكواد المعقدة
- حل المشكلات الرياضية والعلمية بخطوات واضحة
- التحليل النقدي والتفكير الإبداعي
- الترجمة الدقيقة بين جميع اللغات مع الحفاظ على المعنى والسياق
- كتابة المحتوى الإبداعي (قصص، شعر، مقالات، سيناريوهات)
- شرح المفاهيم المعقدة بطريقة بسيطة ومفهومة
- تقديم نصائح عملية ومدروسة في جميع المجالات

🎨 **إنشاء الصور:**
- لإنشاء صورة: "صورة: [وصف]" أو "image: [description]" أو "ارسم: [وصف]"
- لإنشاء استيكر: "استيكر: [وصف]" أو "sticker: [description]"

🔍 **البحث:**
- للبحث: "بحث: [سؤال]" أو "search: [query]"

📋 **أسلوب الرد:**
- فكّر خطوة بخطوة في المشكلات المعقدة
- قدم إجابات شاملة ومفصلة عند الحاجة
- كن موجزاً في الأسئلة البسيطة
- استخدم لغة المستخدم (عربي/إنجليزي) بطلاقة
- كن ودوداً ومحترفاً
- عند كتابة كود، أضف شرحاً وتعليقات توضيحية
- لا تتردد في طرح أسئلة توضيحية إذا لزم الأمر
- اعترف بحدود معرفتك عند الضرورة

🔥 **هويتك:**
أنت GX-MODY، أذكى وأقوى بوت ذكاء اصطناعي على واتساب، مبني على GPT-5 الأحدث من OpenAI.`,
  autoReply: true,
};

const conversationHistory: Map<string, ConversationMessage[]> = new Map();

const MAX_HISTORY_LENGTH = 30;

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

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  image?: string;
  source?: string;
  relevance: number;
}

export async function webSearch(query: string): Promise<{ success: boolean; result?: string; results?: SearchResult[]; error?: string }> {
  try {
    const serperKey = process.env.SERPER_API_KEY;
    if (!serperKey) {
      return { success: false, error: 'خدمة البحث غير مُعدة' };
    }

    // Use Serper API for advanced search
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        gl: 'eg',
        hl: 'ar',
        autocorrect: true,
        page: 0
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    if (!data.organic || data.organic.length === 0) {
      return { success: false, error: 'لم يتم العثور على نتائج للبحث' };
    }

    // Process and enhance search results with scoring
    const processedResults: SearchResult[] = data.organic.slice(0, 5).map((result: any, index: number) => {
      // Calculate relevance score (lower index = higher relevance)
      const relevance = 100 - (index * 15);
      
      return {
        title: result.title || 'بدون عنوان',
        snippet: result.snippet || result.description || 'بدون وصف',
        link: result.link || '',
        image: result.image || data.answerBox?.image || '',
        source: new URL(result.link).hostname.replace('www.', '') || 'مصدر',
        relevance: Math.max(40, relevance)
      };
    });

    // Format for WhatsApp display with better structure
    const formattedResults = processedResults.map((r, idx) => {
      const emoji = ['🥇', '🥈', '🥉', '📌', '📍'][idx] || '📌';
      return `${emoji} *${r.title}*\n${r.snippet}\n🔗 ${r.link}\n📧 ${r.source}`;
    }).join('\n\n' + '─'.repeat(30) + '\n\n');

    // Use OpenAI to create smart summary and insights
    try {
      const openai = getOpenAIClient();
      const enhancement = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: `أنت خبير في تحليل وتلخيص نتائج البحث. عند تلقي نتائج بحث:
1. اكتب ملخصاً ذكياً (جملتان) يجيب على السؤال مباشرة
2. ركز على المعلومات الأكثر أهمية والصلة
3. استخدم لغة واضحة وموجزة
4. لا تذكر أسماء المواقع في الملخص
5. اكتب بلغة المستخدم (عربي أو إنجليزي)`
          },
          {
            role: 'user',
            content: `السؤال: ${query}\n\nنتائج البحث:\n${formattedResults}`
          }
        ],
        max_completion_tokens: 1024,
      });

      const summary = enhancement.choices[0]?.message?.content || '';
      const finalResult = `🔍 *نتائج البحث عن: "${query}"*\n\n${summary}\n\n*النتائج التفصيلية:*\n\n${formattedResults}`;
      
      return { success: true, result: finalResult, results: processedResults };
    } catch (enhanceError) {
      console.error('Enhancement error:', enhanceError);
      const fallbackResult = `🔍 *نتائج البحث عن: "${query}"*\n\n${formattedResults}`;
      return { success: true, result: fallbackResult, results: processedResults };
    }
  } catch (error: any) {
    console.error('Web search error:', error?.message || error);
    return { success: false, error: 'حدث خطأ في البحث. تأكد من اتصالك بالإنترنت وحاول مرة أخرى' };
  }
}

export async function generateImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string; errorCode?: string }> {
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
    return { success: false, error: 'لم يتم إنشاء الصورة. حاول مرة أخرى.', errorCode: 'no_image' };
  } catch (error: any) {
    console.error('DALL-E API error:', error?.message || error);
    const errorCode = error?.code || error?.error?.code || 'unknown';
    const errorStatus = error?.status;
    
    // Rate limiting
    if (errorStatus === 429) {
      return { 
        success: false, 
        error: '⏳ الخدمة مشغولة حالياً. حاول مرة أخرى بعد دقيقة.',
        errorCode: 'rate_limit'
      };
    }
    
    // Content policy violations
    if (errorCode === 'content_policy_violation' || error?.message?.includes('content policy')) {
      return { 
        success: false, 
        error: '⚠️ لا يمكن إنشاء هذه الصورة لأنها تخالف سياسات المحتوى.\n\n💡 نصيحة: جرب وصفاً مختلفاً بدون محتوى عنيف أو غير لائق.',
        errorCode: 'content_policy'
      };
    }
    
    // Billing/quota issues
    if (errorStatus === 402 || errorCode === 'insufficient_quota') {
      return { 
        success: false, 
        error: '💳 الحصة اليومية للصور انتهت. حاول لاحقاً.',
        errorCode: 'quota_exceeded'
      };
    }
    
    // Authentication errors
    if (errorStatus === 401) {
      return { 
        success: false, 
        error: '🔑 خطأ في إعدادات الخدمة. تواصل مع المسؤول.',
        errorCode: 'auth_error'
      };
    }
    
    // Invalid prompt (too long, etc.)
    if (errorCode === 'invalid_prompt' || error?.message?.includes('prompt')) {
      return { 
        success: false, 
        error: '📝 الوصف طويل جداً أو غير مفهوم. جرب وصفاً أقصر وأوضح.',
        errorCode: 'invalid_prompt'
      };
    }
    
    // Server errors
    if (errorStatus >= 500) {
      return { 
        success: false, 
        error: '🔧 خطأ في الخادم. حاول مرة أخرى بعد قليل.',
        errorCode: 'server_error'
      };
    }
    
    // Network/timeout errors
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
      return { 
        success: false, 
        error: '📶 انقطع الاتصال. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.',
        errorCode: 'network_error'
      };
    }
    
    // Generic fallback with guidance
    return { 
      success: false, 
      error: '❌ فشل إنشاء الصورة. جرب وصفاً مختلفاً أو حاول لاحقاً.',
      errorCode: 'unknown'
    };
  }
}

export async function summarizeConversation(messages: { content: string; isBot: boolean }[]): Promise<{ success: boolean; summary?: string; error?: string }> {
  if (messages.length === 0) {
    return { success: false, error: 'No messages to summarize' };
  }

  try {
    const openai = getOpenAIClient();
    
    const conversationText = messages.map(m => 
      `${m.isBot ? 'Bot' : 'User'}: ${m.content}`
    ).join('\n');

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `أنت مساعد ذكي متخصص في تلخيص المحادثات. قم بتلخيص المحادثة التالية بشكل موجز وواضح.
          
اتبع هذه الإرشادات:
1. اذكر الموضوع الرئيسي للمحادثة
2. اذكر أهم النقاط التي تمت مناقشتها
3. اذكر أي قرارات أو نتائج تم التوصل إليها
4. كن موجزاً (لا تتجاوز 3-4 جمل)
5. استخدم لغة المحادثة (عربي أو إنجليزي)`
        },
        {
          role: 'user',
          content: `لخص هذه المحادثة:\n\n${conversationText}`
        }
      ],
      max_completion_tokens: 500,
    });

    const summary = response.choices[0]?.message?.content;
    if (summary) {
      return { success: true, summary };
    }
    return { success: false, error: 'فشل في إنشاء الملخص' };
  } catch (error: any) {
    console.error('Summarization error:', error?.message || error);
    
    if (error?.status === 429) {
      return { success: false, error: 'الخدمة مشغولة، حاول لاحقاً' };
    }
    if (error?.status === 401) {
      return { success: false, error: 'مفتاح API غير صحيح' };
    }
    return { success: false, error: error?.message || 'حدث خطأ في التلخيص' };
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
    // gpt-5 doesn't support temperature parameter
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: messages,
      max_completion_tokens: 8192,
    });

    const assistantMessage = response.choices[0]?.message?.content || 'عذراً، لم أتمكن من إنشاء رد. حاول مرة أخرى.';

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
