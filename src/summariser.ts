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
        const prompt = `You are a journalist for Radio Svoboda. Retell this news in two formats.

NEWS:
Title: ${title}
Text: ${body.length > 8000 ? body.substring(0, 8000) + '...' : body}
${body.length > 8000 ? 'ATTENTION: Text truncated to 8000 characters. Retell only what is provided here.' : ''}

TASK:
1. Facebook post (50-100 words): Neutral tone, key facts, well-structured
2. X (Twitter) post (maximum 250 characters): No sensational headlines, only the most important information, no hashtags

CRITICAL: Write your entire response in the SAME LANGUAGE as the original news article above.

Response format:
FACEBOOK:
[text in article's language]

TWITTER:
[text in article's language]`;

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