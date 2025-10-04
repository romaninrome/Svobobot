import { domains } from './domains';
import { config } from './config';
import { isValidURL, checkUrlExists } from './checkurl';

interface ApiResponse {
    short_url?: string;
};

export type MirrorURLResult =
    | { success: true; url: string }
    | { success: false; error: 'not_found' | 'generation_failure' };

function addUtmParams(url: URL): void {
    url.searchParams.set('utm_medium', 'proxy');
    url.searchParams.set('utm_campaign', 'otf');
    url.searchParams.set('utm_source', 'otf');
};

function generateManualURL(originalUrl: URL, host: string): string {
    const urlObject = new URL(originalUrl.toString());
    addUtmParams(urlObject);

    const query = urlObject.searchParams.toString();
    return `${urlObject.protocol}//${host}${urlObject.pathname}${query ? `?${query}` : ''}${urlObject.hash}`;
};

function fallbackToManual(urlObject: URL, host: string, reason: string, error?: unknown): string {
    if (error) {
        console.error(`${reason}:`, error);
    } else {
        console.warn(reason);
    }
    return generateManualURL(urlObject, host);
};

async function generateShortURL(url: string, urlObject: URL, host: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${config.apiUrl}/?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: { 'Authorization': config.authToken },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return fallbackToManual(urlObject, host, `API error: ${response.status}`);
        }

        const data: ApiResponse = await response.json();
        if (data.short_url && isValidURL(data.short_url)) {
            return data.short_url;
        }

        return fallbackToManual(urlObject, host, 'Short URL API returned invalid or empty url.');
    } catch (error) {
        return fallbackToManual(urlObject, host, 'Error fetching from API', error);
    }
};

export async function generateMirrorURL(url: string, urlObject: URL, host: string): Promise<MirrorURLResult> {
    const exists = await checkUrlExists(url);
    if (exists === false) {
        console.warn(`Article not found (404): ${url}`);
        return { success: false, error: 'not_found' };
    }

    try {
        const mirrorUrl = await generateShortURL(url, urlObject, host);
        return { success: true, url: mirrorUrl };
    } catch (e) {
        console.error('Mirror URL generation failed after existence check', e);
        return { success: false, error: 'generation_failure' };
    }
};