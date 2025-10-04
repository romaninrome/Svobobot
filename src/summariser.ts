import { GoogleGenAI } from "@google/genai";

interface Summary {
    forFacebook: string;
    forTwitter: string;
}

// Initialize with your API key
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY // Store your key in environment variables
});

export async function generateSummary(title: string, body: string): Promise<Summary | null> {
    try {
        const prompt = `Ты журналист Радио Свобода. Перескажи эту новость в двух форматах:

НОВОСТЬ:
Заголовок: ${title}
Текст: ${body}

ЗАДАНИЕ:
1. Facebook пост (100-150 слов): Нейтральный тон, ключевые факты, структурировано
2. Пост для X (Twitter) (максимум 250 символов):
Без кричащих заголовков, самое важное, без хештегов.

Ответь в формате:
FACEBOOK:
[текст]

TWITTER:
[текст]`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });

        const text = result.text || "";
        const facebookMatch = text.match(/FACEBOOK:\s*([\s\S]*?)(?=TWITTER:|$)/i);
        const twitterMatch = text.match(/TWITTER:\s*([\s\S]*?)$/i);

        if (!facebookMatch || !twitterMatch) {
            console.error('Failed to parse AI response');
            return null;
        }

        return {
            forFacebook: facebookMatch[1].trim(),
            forTwitter: twitterMatch[1].trim()
        };
    } catch (error) {
        console.error('AI error:', error);
        return null;
    }
}