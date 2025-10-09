// htmlparser.ts
import * as cheerio from 'cheerio';
import { botLogger } from './logger';

interface Article {
    title: string;
    body: string;
}

const polAzara = 8000; // Max parsing text size. An insider joke, don't sweat it.

export async function parseArticle(url: string): Promise<Article | null> {
    try {
        botLogger.debug({ url }, 'Starting article parse');

        const response = await fetch(url);
        if (!response.ok) {
            botLogger.warn(
                { url, status: response.status },
                'Failed to fetch article - non-OK response',
            );
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('h1.pg-title').text().trim() || $('h1').first().text().trim();
        botLogger.debug({ url, titleLength: title.length }, 'Extracted article title');

        // All text
        let body = $('.wsw')
            .clone()
            .find('script, style, iframe') // Remove excess
            .remove()
            .end()
            .text()
            .trim()
            .replace(/\s+/g, ' ') // spaces
            .replace(/\. /g, '.\n\n'); // paragraphs

        botLogger.debug({ url, bodyLength: body.length }, 'Extracted article body');

        if (body.length > polAzara) {
            botLogger.info(
                { url, originalLength: body.length, truncatedLength: polAzara },
                'Article truncated',
            );
            body = body.substring(0, polAzara);
        }

        if (!title || !body || body.length < 100) {
            botLogger.warn(
                { url, titleExists: !!title, bodyExists: !!body, bodyLength: body.length },
                'Article missing required content',
            );
            return null;
        }

        botLogger.info(
            { url, titleLength: title.length, bodyLength: body.length },
            'Article parsed successfully',
        );
        return { title, body };
    } catch (error) {
        botLogger.error({ err: error, url }, 'Article parsing failed');
        return null;
    }
}
