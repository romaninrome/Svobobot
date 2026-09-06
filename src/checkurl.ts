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
export async function checkUrlExists(
    url: string,
    timeoutMs: number = 5000,
): Promise<boolean | null> {
    try {
        botLogger.debug({ url, timeoutMs }, 'Checking URL existence');

        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.status === 404) {
            botLogger.warn({ url, status: response.status }, 'URL returned 404');
            return false;
        }

        const exists = response.ok ? true : null;
        botLogger.debug({ url, status: response.status, exists }, 'URL existence check completed');
        return exists;
    } catch (error) {
        botLogger.warn({ err: error, url }, 'Failed to check URL existence');
        return null;
    }
}
