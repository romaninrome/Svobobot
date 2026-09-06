import { domains } from '../src/domains';

const endpoints = Object.entries(domains).flatMap(([host, mirror]) => [
    { kind: 'original', host },
    ...(mirror ? [{ kind: 'mirror', host: mirror }] : []),
]);
async function check(endpoint: { kind: string; host: string }) {
    try {
        const response = await fetch(`https://${endpoint.host}/`, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(12000),
        });
        return { ...endpoint, status: response.status, finalURL: response.url };
    } catch (error) {
        return {
            ...endpoint,
            status: null,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
const results: Awaited<ReturnType<typeof check>>[] = [];
for (let i = 0; i < endpoints.length; i += 6) {
    results.push(...(await Promise.all(endpoints.slice(i, i + 6).map(check))));
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
