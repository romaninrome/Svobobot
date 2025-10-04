// urlGenerator.ts
import { domains } from './domains';
import { config } from './config';

interface ApiResponse {
    short_url?: string;
}

function isValidURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function generateManualURL(originalUrl: URL, host: string): string {
    // Clone URL to avoid mutating the input
    const urlObject = new URL(originalUrl.toString());

    // Add UTM parameters
    urlObject.searchParams.set('utm_medium', 'proxy');
    urlObject.searchParams.set('utm_campaign', 'otf');
    urlObject.searchParams.set('utm_source', 'otf');

    // Build new URL with mirror domain
    const query = urlObject.searchParams.toString();
    const newUrl = `${urlObject.protocol}//${host}${urlObject.pathname}${query ? `?${query}` : ''}${urlObject.hash}`;

    return newUrl;
}

async function generateShortURL(url: string, urlObject: URL, host: string): Promise<string> {
    try {
        const response = await fetch(`${config.apiUrl}/?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: {
                'Authorization': config.authToken
            }
        });

        if (!response.ok) {
            console.warn(`API error: ${response.status}. Falling back to manual generation.`);
            return generateManualURL(urlObject, host);
        }

        const data: ApiResponse = await response.json();

        if (data.short_url && isValidURL(data.short_url)) {
            return data.short_url;
        } else {
            console.warn('Short URL API returned invalid or empty url. Falling back to manual generation.');
            return generateManualURL(urlObject, host);
        }
    } catch (error) {
        console.error('Error fetching from API. Falling back to manual generation:', error);
        return generateManualURL(urlObject, host);
    }
}

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
}