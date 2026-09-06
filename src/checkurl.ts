import { botLogger } from './logger';

export function isValidURL(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
        );
    } catch {
        return false;
    }
}

/**
 * Only a confirmed 404 means missing; other failures leave existence unknown.
 */
export async function checkURL(
    url: string,
    timeoutMs: number = 5000,
    method: 'HEAD' | 'GET' = 'HEAD',
): Promise<{ exists: boolean | null; url: string }> {
    try {
        botLogger.debug({ url, timeoutMs }, 'Checking URL existence');

        const signal = AbortSignal.timeout(timeoutMs);
        let response = await fetch(url, {
            method,
            redirect: 'follow',
            signal,
        });

        if (method === 'HEAD' && response.status === 405) {
            await response.body?.cancel();
            response = await fetch(url, { method: 'GET', redirect: 'follow', signal });
        }
        // Checking reachability does not require downloading the article body.
        await response.body?.cancel();

        if (response.status === 404) {
            botLogger.warn({ url, status: response.status }, 'URL returned 404');
            return { exists: false, url: response.url || url };
        }

        const exists = response.ok ? true : null;
        botLogger.debug({ url, status: response.status, exists }, 'URL existence check completed');
        return { exists, url: response.url || url };
    } catch (error) {
        botLogger.warn({ err: error, url }, 'Failed to check URL existence');
        return { exists: null, url };
    }
}

export async function checkUrlExists(
    url: string,
    timeoutMs: number = 5000,
): Promise<boolean | null> {
    return (await checkURL(url, timeoutMs)).exists;
}
