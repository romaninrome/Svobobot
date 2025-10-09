import { GoogleGenAI } from '@google/genai';
import { botLogger } from './logger';

interface Summary {
    forFacebook: string;
    forTwitter: string;
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY, //
});

export async function generateSummary(title: string, body: string): Promise<Summary | null> {
    try {
        botLogger.debug(
            { titleLength: title.length, bodyLength: body.length },
            'Starting AI summary generation',
        );

        const prompt = `You are a journalist for Radio Svoboda. Retell this news in two formats.

NEWS:
Title: ${title}
Text: ${body.length > 8000 ? body.substring(0, 8000) + '...' : body}
${
    body.length > 8000
        ? 'ATTENTION: Text truncated to 8000 characters. Retell only what is provided here.'
        : ''
}

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
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
        });

        const text = result.text || '';
        botLogger.debug({ responseLength: text.length }, 'Received AI response');

        const facebookMatch = text.match(/FACEBOOK:\s*([\s\S]*?)(?=TWITTER:|$)/i);
        const twitterMatch = text.match(/TWITTER:\s*([\s\S]*?)$/i);

        if (!facebookMatch || !twitterMatch) {
            botLogger.error(
                { responsePreview: text.substring(0, 200) },
                'Failed to parse AI response - missing sections',
            );
            return null;
        }

        const summary = {
            forFacebook: facebookMatch[1].trim(),
            forTwitter: twitterMatch[1].trim(),
        };

        botLogger.info(
            {
                facebookLength: summary.forFacebook.length,
                twitterLength: summary.forTwitter.length,
            },
            'AI summary generated successfully',
        );

        return summary;
    } catch (error) {
        botLogger.error({ err: error }, 'AI summary generation failed');
        return null;
    }
}
