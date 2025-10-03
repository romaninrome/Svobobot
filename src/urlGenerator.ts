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

function generateManualURL(url: string): string | null {
    try {
        const urlObject = new URL(url);

        if (!domains[urlObject.hostname]) {
            console.log(`Hostname ${urlObject.hostname} not found in domains list`);
            return null;
        }

        const host = domains[urlObject.hostname];

        // Add UTM parameters
        urlObject.searchParams.set('utm_medium', 'proxy');
        urlObject.searchParams.set('utm_campaign', 'otf');
        urlObject.searchParams.set('utm_source', 'otf');

        // Build new URL with mirror domain
        const newUrl = `${urlObject.protocol}//${host}${urlObject.pathname}?${urlObject.searchParams.toString()}${urlObject.hash}`;

        return newUrl;
    } catch (error) {
        console.error('Error generating manual URL:', error);
        return null;
    }
}

async function generateShortURL(url: string): Promise<string | null> {
    try {
        const urlObject = new URL(url);

        if (!domains[urlObject.hostname]) {
            console.log(`Hostname ${urlObject.hostname} not found in domains list`);
            return null;
        }

        const response = await fetch(`${config.apiUrl}/?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.authToken}`
            }
        });

        if (!response.ok) {
            console.error(`API error: ${response.status}`);
            return generateManualURL(url);
        }

        const data: ApiResponse = await response.json();

        if (data.short_url && data.short_url.length > 5) {
            return data.short_url;
        } else {
            return generateManualURL(url);
        }
    } catch (error) {
        console.error('Error fetching from API:', error);
        return generateManualURL(url);
    }
}

export async function generateMirrorURL(url: string): Promise<string | null> {
    if (!isValidURL(url)) {
        console.error('Invalid URL');
        return null;
    }

    return await generateShortURL(url);
}