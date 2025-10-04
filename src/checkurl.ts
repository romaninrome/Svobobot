export function isValidURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Checks if URL exists and returns non-404 status
 */
export async function checkUrlExists(url: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.status === 404) {
            return false;
        }

        return response.ok;
    } catch (error) {
        console.warn(`Failed to check URL: ${url}`);
        return true; // Assume exists if can't check
    }
};