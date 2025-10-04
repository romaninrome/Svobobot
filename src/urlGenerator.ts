import { domains } from './domains';
import { config } from './config';

interface ApiResponse {
    short_url?: string;
};

function isValidURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

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
        const response = await fetch(`${config.apiUrl}/?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: { 'Authorization': config.authToken }
        });

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

export async function generateMirrorURL(url: string): Promise<string | null> {
    if (!isValidURL(url)) {
        console.error(`Invalid URL: ${url}`);
        return null;
    }

    const urlObject = new URL(url);

    if (!domains[urlObject.hostname]) {
        console.warn(`Hostname ${urlObject.hostname} not found in domains list`);
        return null;
    }

    const host = domains[urlObject.hostname];

    return await generateShortURL(url, urlObject, host);
};