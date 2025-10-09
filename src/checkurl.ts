import { botLogger } from './logger';

export function isValidURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Checks if URL exists and returns non-404 status
 */
export async function checkUrlExists(url: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        botLogger.debug({ url, timeoutMs }, 'Checking URL existence');

        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.status === 404) {
            botLogger.warn({ url, status: response.status }, 'URL returned 404');
            return false;
        }

        const exists = response.ok;
        botLogger.debug({ url, status: response.status, exists }, 'URL existence check completed');
        return exists;
    } catch (error) {
        botLogger.warn({ err: error, url }, 'Failed to check URL existence');
        return false; // Overengineering is a mortal sin.
    }
}
