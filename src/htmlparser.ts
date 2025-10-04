import * as cheerio from 'cheerio';

interface Article {
    title: string;
    body: string;
};

const polAzara = 8000; // Max parsing text size

export async function parseArticle(url: string): Promise<Article | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('h1.pg-title').text().trim() || $('h1').first().text().trim();

        // All text
        let body = $('.wsw')
            .clone()
            .find('script, style, iframe') // Remove exceed 
            .remove()
            .end()
            .text()
            .trim()
            .replace(/\s+/g, ' ') // spaces
            .replace(/\. /g, '.\n\n'); // paragraphs

        if (body.length > polAzara) {
            body = body.substring(0, polAzara);
            console.log(`Article truncated from ${body.length} to ${polAzara} chars`);
        }

        if (!title || !body || body.length < 100) {
            return null;
        }

        return { title, body };
    } catch (error) {
        console.error('Parse error:', error);
        return null;
    }
};