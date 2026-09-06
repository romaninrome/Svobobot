import { domains, normalizeSupportedURL, archivedServices } from './domains';
import { config } from './config';
import { isValidURL, checkURL } from './checkurl';
import { botLogger } from './logger';

interface ApiResponse {
    url?: string;
    short_url?: string; // Compatibility with older custom providers.
}

export type MirrorURLResult =
    | {
          success: true;
          url: string;
          sourceUrl: string;
          kind: 'smart' | 'mirror' | 'original';
          notice?: string;
      }
    | {
          success: false;
          error: 'invalid_url' | 'unsupported_domain' | 'not_found' | 'generation_failure';
      };

function addUtmParams(url: URL): void {
    url.searchParams.set('utm_medium', 'proxy');
    url.searchParams.set('utm_campaign', 'otf');
    url.searchParams.set('utm_source', 'otf');
}

function generateManualURL(originalUrl: URL, host: string | null): string | null {
    if (!host) return null;
    const urlObject = new URL(originalUrl.toString());
    addUtmParams(urlObject);

    const query = urlObject.searchParams.toString();
    return `${urlObject.protocol}//${host}${urlObject.pathname}${query ? `?${query}` : ''}${
        urlObject.hash
    }`;
}

function fallbackToManual(
    urlObject: URL,
    host: string | null,
    reason: string,
    error?: unknown,
): string | null {
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

async function generateShortURL(
    url: string,
    urlObject: URL,
    host: string | null,
): Promise<string | null> {
    if (!config.apiUrl) return generateManualURL(urlObject, host);
    try {
        botLogger.debug({ url, apiUrl: config.apiUrl }, 'Generating short URL via API');

        const endpoint = new URL(config.apiUrl);
        endpoint.searchParams.set('url', url);
        const response = await fetch(endpoint.toString(), {
            method: 'GET',
            headers: { Authorization: config.authToken, 'Content-Type': 'application/json' },
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            botLogger.warn({ url, status: response.status }, 'API returned non-OK response');
            return fallbackToManual(urlObject, host, `API error: ${response.status}`);
        }

        const data: ApiResponse = await response.json();
        const shortUrl = data.url ?? data.short_url;
        if (typeof shortUrl === 'string' && isValidURL(shortUrl)) {
            botLogger.debug({ url, shortUrl }, 'Successfully generated short URL');
            return shortUrl;
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

    let urlObject = normalizeSupportedURL(url);

    if (!urlObject) {
        botLogger.warn({ url }, 'Unsupported domain');
        return { success: false, error: 'unsupported_domain' };
    }

    botLogger.debug({ url, hostname: urlObject.hostname }, 'Domain is supported');

    const archived = archivedServices[urlObject.hostname];
    const notice = archived
        ? `ℹ️ ${archived.name} closed on ${archived.closedOn}. This is archived content.`
        : undefined;
    url = urlObject.toString();
    const original = await checkURL(url);
    if (original.exists === false) {
        botLogger.warn({ url }, 'Article not found (404)');
        return { success: false, error: 'not_found' };
    }

    // Follow actual publisher redirects; never guess migrated article paths.
    const redirected = isValidURL(original.url) ? normalizeSupportedURL(original.url) : null;
    if (redirected) {
        urlObject = redirected;
        url = redirected.toString();
    }
    botLogger.debug({ url }, 'Proceeding with mirror generation');

    try {
        const host = domains[urlObject.hostname];
        const mirrorUrl = await generateShortURL(url, urlObject, host);

        if (mirrorUrl) {
            const candidate = await checkURL(mirrorUrl, 5000, 'GET');
            const isSmartLink = new URL(mirrorUrl).hostname === 'smarturl.click';
            // Keep publisher SmartURLs even when this connection lands on the original site.
            const returnsToPublisher =
                isValidURL(candidate.url) && normalizeSupportedURL(candidate.url);
            if (candidate.exists === true && (isSmartLink || !returnsToPublisher)) {
                botLogger.info({ url, mirrorUrl }, 'Generated link is reachable');
                return {
                    success: true,
                    url: mirrorUrl,
                    sourceUrl: url,
                    kind: isSmartLink ? 'smart' : 'mirror',
                    notice,
                };
            }
        }
        botLogger.warn({ url }, 'No working mirror verified; returning original link');
        return { success: true, url, sourceUrl: url, kind: 'original', notice };
    } catch (error) {
        botLogger.error({ err: error, url }, 'Mirror URL generation failed after existence check');
        return { success: false, error: 'generation_failure' };
    }
}
