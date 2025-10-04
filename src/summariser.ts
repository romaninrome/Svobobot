import { GoogleGenAI } from "@google/genai";

interface Summary {
    forFacebook: string;
    forTwitter: string;
};

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY // 
});

export async function generateSummary(title: string, body: string): Promise<Summary | null> {
    try {
        const prompt = `Ты журналист Радио Свобода. Перескажи эту новость в двух форматах:

НОВОСТЬ:
Заголовок: ${title}
Текст: ${body.length > 8000 ? body.substring(0, 8000) + '...' : body}

${body.length > 8000 ? 'ВНИМАНИЕ: Текст обрезан до 8000 символов. Пересказывай только то, что здесь.' : ''}

ЗАДАНИЕ:
1. Facebook пост (50-100 слов): Нейтральный тон, ключевые факты, структурировано
2. Пост для X (Twitter) (максимум 250 символов): Без кричащих заголовков, только самое важное, без хештегов.

Ответь в формате:
FACEBOOK:
[текст]

TWITTER:
[текст]`;

        const result = await ai.models.generateContent({
            // model: "gemini-2.5-flash" better but slower
            model: "gemini-2.5-flash-lite",
            contents: prompt
        });

        const text = result.text || "";
        const facebookMatch = text.match(/FACEBOOK:\s*([\s\S]*?)(?=TWITTER:|$)/i);
        const twitterMatch = text.match(/TWITTER:\s*([\s\S]*?)$/i);

        if (!facebookMatch || !twitterMatch) {
            console.error('[Svobobot]Failed to parse AI response');
            return null;
        }

        return {
            forFacebook: facebookMatch[1].trim(),
            forTwitter: twitterMatch[1].trim()
        };
    } catch (error) {
        console.error('[Svobobot]AI error:', error);
        return null;
    }
};