import { domains } from './domains';
import { config } from './config';
import { isValidURL, checkUrlExists } from './checkurl';
import { botLogger } from './logger';

interface ApiResponse {
    short_url?: string;
}

export type MirrorURLResult =
    | { success: true; url: string }
    | {
          success: false;
          error: 'invalid_url' | 'unsupported_domain' | 'not_found' | 'generation_failure';
      };

function addUtmParams(url: URL): void {
    url.searchParams.set('utm_medium', 'proxy');
    url.searchParams.set('utm_campaign', 'otf');
    url.searchParams.set('utm_source', 'otf');
}

function generateManualURL(originalUrl: URL, host: string): string {
    const urlObject = new URL(originalUrl.toString());
    addUtmParams(urlObject);

    const query = urlObject.searchParams.toString();
    return `${urlObject.protocol}//${host}${urlObject.pathname}${query ? `?${query}` : ''}${
        urlObject.hash
    }`;
}

function fallbackToManual(urlObject: URL, host: string, reason: string, error?: unknown): string {
    if (error) {
        botLogger.warn(
            { err: error, reason, url: urlObject.toString() },
            'Falling back to manual URL generation',
        );
    } else {
        botLogger.warn(
            { reason, url: urlObject.toString() },
            'Falling back to manual URL generation',
        );
    }
    return generateManualURL(urlObject, host);
}

async function generateShortURL(url: string, urlObject: URL, host: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        botLogger.debug({ url, apiUrl: config.apiUrl }, 'Generating short URL via API');

        const response = await fetch(`${config.apiUrl}/?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: { Authorization: config.authToken },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            botLogger.warn({ url, status: response.status }, 'API returned non-OK response');
            return fallbackToManual(urlObject, host, `API error: ${response.status}`);
        }

        const data: ApiResponse = await response.json();
        if (data.short_url && isValidURL(data.short_url)) {
            botLogger.debug({ url, shortUrl: data.short_url }, 'Successfully generated short URL');
            return data.short_url;
        }

        botLogger.warn({ url, response: data }, 'API returned invalid or empty short URL');
        return fallbackToManual(urlObject, host, 'Short URL API returned invalid or empty url.');
    } catch (error) {
        botLogger.error({ err: error, url }, 'Error fetching from short URL API');
        return fallbackToManual(urlObject, host, 'Error fetching from API', error);
    }
}

export async function generateMirrorURL(url: string): Promise<MirrorURLResult> {
    botLogger.debug({ url }, 'Starting mirror URL generation');

    if (!isValidURL(url)) {
        botLogger.warn({ url }, 'Invalid URL provided');
        return { success: false, error: 'invalid_url' };
    }

    const urlObject = new URL(url);

    if (!domains[urlObject.hostname]) {
        botLogger.warn({ hostname: urlObject.hostname, url }, 'Unsupported domain');
        return { success: false, error: 'unsupported_domain' };
    }

    botLogger.debug({ url, hostname: urlObject.hostname }, 'Domain is supported');

    const exists = await checkUrlExists(url);
    if (!exists) {
        botLogger.warn({ url }, 'Article not found (404)');
        return { success: false, error: 'not_found' };
    }

    botLogger.debug({ url }, 'Article exists, proceeding with mirror generation');

    try {
        const host = domains[urlObject.hostname];
        const mirrorUrl = await generateShortURL(url, urlObject, host);

        botLogger.info(
            { url, mirrorUrl, hostname: urlObject.hostname },
            'Mirror URL generated successfully',
        );
        return { success: true, url: mirrorUrl };
    } catch (error) {
        botLogger.error({ err: error, url }, 'Mirror URL generation failed after existence check');
        return { success: false, error: 'generation_failure' };
    }
}
