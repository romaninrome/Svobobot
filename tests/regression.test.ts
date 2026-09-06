import { afterEach, expect, mock, test } from 'bun:test';

mock.module('../src/logger', () => ({
    botLogger: { debug() {}, info() {}, warn() {}, error() {} },
}));
mock.module('../src/config', () => ({
    config: {
        telegramToken: '123456:test-token',
        apiUrl: 'https://shortener.example/link',
        authToken: '',
        allowedChats: [],
    },
}));
const { generateMirrorURL } = await import('../src/urlGenerator');
const { checkUrlExists, isValidURL } = await import('../src/checkurl');
const { parseArticle } = await import('../src/htmlparser');
const { domains, normalizeSupportedURL } = await import('../src/domains');
const originalFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = originalFetch;
});
function setFetch(fn: (input: any, init?: any) => Promise<any>) {
    globalThis.fetch = fn as typeof fetch;
}
const articleURL = 'https://www.svoboda.org/a/example/123.html';

for (const status of [403, 405, 429, 500]) {
    test(`HEAD ${status} still allows a verified mirror`, async () => {
        setFetch(
            async (input) =>
                new Response(null, {
                    status: String(input).includes('cloudfront.net') ? 200 : status,
                }),
        );
        const result = await generateMirrorURL(articleURL);
        expect(result.success).toBe(true);
        if (result.success) expect(new URL(result.url).hostname).toBe(domains['www.svoboda.org']!);
    });
}
test('confirmed 404 prevents shortening', async () => {
    let calls = 0;
    setFetch(async () => {
        calls++;
        return new Response(null, { status: 404 });
    });
    expect(await generateMirrorURL(articleURL)).toEqual({ success: false, error: 'not_found' });
    expect(calls).toBe(1);
});
test('network failure returns an original link instead of an unverified mirror', async () => {
    setFetch(async () => {
        throw new Error('offline');
    });
    expect(await generateMirrorURL(articleURL)).toMatchObject({
        success: true,
        kind: 'original',
        url: articleURL,
    });
});
test('bare aliases normalize and preserve article path, query and fragment', async () => {
    const calls: string[] = [];
    setFetch(async (input, init) => {
        calls.push(String(input));
        return new Response(null, {
            status: String(input).includes('shortener.example') ? 503 : 200,
        });
    });
    const result = await generateMirrorURL('https://svoboda.org/a/example?x=1#section');
    expect(calls[0]).toBe('https://www.svoboda.org/a/example?x=1#section');
    expect(result.success).toBe(true);
    if (result.success) {
        const url = new URL(result.url);
        expect(url.pathname).toBe('/a/example');
        expect(url.searchParams.get('x')).toBe('1');
        expect(url.searchParams.get('utm_medium')).toBe('proxy');
        expect(url.hash).toBe('#section');
    }
    for (const host of Object.keys(domains)) {
        if (host.startsWith('www.'))
            expect(normalizeSupportedURL(`https://${host.slice(4)}`)?.hostname).toBe(host);
    }
    expect(normalizeSupportedURL('https://rus.azattyq.org')?.hostname).toBe('rus.azattyq.org');
    expect(normalizeSupportedURL('https://svoboda.org.evil.example')).toBeNull();
});
test('rejects non-web URLs and credentials', async () => {
    for (const input of [
        'file:///tmp/article',
        'ftp://www.svoboda.org/a',
        'https://user:password@www.svoboda.org/a',
    ]) {
        expect(isValidURL(input)).toBe(false);
        expect(await generateMirrorURL(input)).toEqual({ success: false, error: 'invalid_url' });
    }
});
test('successful shortening returns API URL', async () => {
    setFetch(async (_, init) =>
        init?.method === 'HEAD'
            ? new Response(null, { status: 200 })
            : Response.json({ url: 'https://short.example/123' }),
    );
    expect(await generateMirrorURL(articleURL)).toMatchObject({
        success: true,
        kind: 'mirror',
        sourceUrl: articleURL,
        url: 'https://short.example/123',
    });
});
test('existence timeout returns unknown', async () => {
    setFetch(
        async (_, init) =>
            new Promise((_, reject) => {
                init.signal.addEventListener('abort', () => reject(init.signal.reason), {
                    once: true,
                });
            }),
    );
    expect(await checkUrlExists(articleURL, 10)).toBeNull();
});
test('article timeout covers stalled response bodies', async () => {
    setFetch(async (_, init) => ({
        ok: true,
        text: () =>
            new Promise((_, reject) => {
                init.signal.addEventListener('abort', () => reject(init.signal.reason), {
                    once: true,
                });
            }),
    }));
    expect(await parseArticle(articleURL, 10)).toBeNull();
});
test('article parsing strips scripts and bounds article length', async () => {
    setFetch(
        async () =>
            new Response(
                `<h1 class="pg-title">Article title</h1><div class="wsw"><script>secret-script</script>${'Body text. '.repeat(1000)}</div>`,
            ),
    );
    const article = await parseArticle(articleURL);
    expect(article?.title).toBe('Article title');
    expect(article?.body.length).toBe(8000);
    expect(article?.body).not.toContain('secret-script');
});

// Exercise real grammY middleware and the installed Google SDK without live services.
const grammy = await import('grammy');
let bot: InstanceType<typeof grammy.Bot>;
mock.module('grammy', () => ({
    ...grammy,
    Bot: class extends grammy.Bot {
        constructor(token: string) {
            super(token, {
                botInfo: {
                    id: 123456,
                    is_bot: true,
                    first_name: 'Test',
                    username: 'test_bot',
                    can_join_groups: true,
                    can_read_all_group_messages: false,
                    supports_inline_queries: false,
                    can_connect_to_business: false,
                    has_main_web_app: false,
                    has_topics_enabled: false,
                    allows_users_to_create_topics: false,
                    can_manage_bots: false,
                    supports_join_request_queries: false,
                },
            });
            bot = this;
        }
        async start() {}
    },
}));
process.env.GEMINI_API_KEY = 'test-key';
await import('../src/linkbot');
const replies: string[] = [];
bot!.api.config.use(async (_previous, _method, payload: any) => {
    replies.push(payload.text);
    return {
        ok: true,
        result: { message_id: 42, date: 0, chat: { id: 1, type: 'private' }, text: payload.text },
    } as any;
});
for (const aiFails of [false, true]) {
    test(`full bot flow ${aiFails ? 'preserves mirror when AI fails' : 'returns summaries and mirror'}`, async () => {
        replies.length = 0;
        let aiCalls = 0;
        setFetch(async (input, init) => {
            const url = String(input instanceof Request ? input.url : input);
            if (url.includes('generativelanguage.googleapis.com')) {
                aiCalls++;
                return aiFails
                    ? Response.json(
                          {
                              error: {
                                  code: 400,
                                  message: 'test failure',
                                  status: 'INVALID_ARGUMENT',
                              },
                          },
                          { status: 400 },
                      )
                    : Response.json({
                          candidates: [
                              {
                                  content: {
                                      role: 'model',
                                      parts: [
                                          {
                                              text: 'FACEBOOK:\nFacebook summary\n\nTWITTER:\nTwitter summary',
                                          },
                                      ],
                                  },
                                  finishReason: 'STOP',
                              },
                          ],
                      });
            }
            if (url.includes('cloudfront.net')) return new Response(null, { status: 200 });
            if (url.startsWith('https://shortener.example'))
                return new Response(null, { status: 503 });
            if (url.startsWith('https://www.svoboda.org/')) {
                return init?.method === 'HEAD'
                    ? new Response(null, { status: 200 })
                    : new Response(
                          `<h1>Test article</h1><div class="wsw">${'Article text. '.repeat(30)}</div>`,
                      );
            }
            throw new Error(`Unexpected external request: ${url}`);
        });
        await bot!.handleUpdate({
            update_id: aiFails ? 2 : 1,
            message: {
                message_id: 1,
                date: 0,
                chat: { id: 1, type: 'private', first_name: 'Test' },
                from: { id: 1, is_bot: false, first_name: 'Test' },
                text: 'https://svoboda.org/a/example/123.html',
            },
        });
        expect(aiCalls).toBe(1);
        expect(replies.at(-1)).toContain(domains['www.svoboda.org']!);
        expect(replies.at(-1)).toContain(
            aiFails ? 'Could not generate summaries' : 'Facebook summary',
        );
        if (!aiFails) expect(replies.at(-1)).toContain('Twitter summary');
    });
}

for (const status of [403, 404, 500]) {
    test(`unavailable mirror (${status}) returns original link`, async () => {
        setFetch(
            async (input) =>
                new Response(null, { status: String(input) === articleURL ? 200 : status }),
        );
        expect(await generateMirrorURL(articleURL)).toMatchObject({
            success: true,
            kind: 'original',
            url: articleURL,
        });
    });
}
for (const host of ['www.mashaalradio.com', 'www.ekhokavkaza.com']) {
    test(`${host} archived articles remain supported with a closure notice`, async () => {
        setFetch(async () => new Response(null, { status: 200 }));
        const result = await generateMirrorURL(`https://${host}/a/archive/123.html`);
        expect(result.success).toBe(true);
        if (result.success) expect(result.notice).toContain('archived content');
    });
}
test('Azattyq Asia is supported without inventing a static mirror', async () => {
    setFetch(
        async (input) =>
            new Response(null, { status: String(input).includes('shortener') ? 503 : 200 }),
    );
    expect(await generateMirrorURL('https://azattyqasia.org/a/news/123.html')).toMatchObject({
        success: true,
        kind: 'original',
        url: 'https://www.azattyqasia.org/a/news/123.html',
    });
});
test('uses the actual migrated article URL for shortening and parsing', async () => {
    const migrated = 'https://www.azattyqasia.org/a/moved-article/123.html';
    setFetch(async (input) => {
        if (String(input).startsWith('https://rus.azattyq.org/')) {
            const response = new Response(null, { status: 200 });
            Object.defineProperty(response, 'url', { value: migrated });
            return response;
        }
        return new Response(null, { status: 503 });
    });
    expect(await generateMirrorURL('https://rus.azattyq.org/a/old-article/123.html')).toMatchObject(
        {
            success: true,
            kind: 'original',
            url: migrated,
            sourceUrl: migrated,
        },
    );
});
test('short URLs redirecting to a publisher are not advertised as mirrors', async () => {
    setFetch(async (input) => {
        if (String(input).includes('shortener'))
            return Response.json({ url: 'https://short.example/123' });
        const response = new Response(null, { status: 200 });
        Object.defineProperty(response, 'url', { value: articleURL });
        return response;
    });
    expect(await generateMirrorURL(articleURL)).toMatchObject({ success: true, kind: 'original' });
});
test('bot labels original fallback clearly and still produces summaries', async () => {
    replies.length = 0;
    setFetch(async (input, init) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes('generativelanguage.googleapis.com'))
            return Response.json({
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'FACEBOOK: Archived summary\nTWITTER: Short summary' }],
                        },
                    },
                ],
            });
        if (url.includes('cloudfront.net') || url.includes('shortener.example'))
            throw new Error('offline');
        return init?.method === 'HEAD'
            ? new Response(null, { status: 200 })
            : new Response(`<h1>Archive</h1><div class="wsw">${'Archive body. '.repeat(30)}</div>`);
    });
    await bot!.handleUpdate({
        update_id: 3,
        message: {
            message_id: 3,
            date: 0,
            chat: { id: 2, type: 'private', first_name: 'Test' },
            from: { id: 2, is_bot: false, first_name: 'Test' },
            text: 'https://mashaalradio.com/a/archive/123.html',
        },
    });
    expect(replies.at(-1)).toContain('Archived summary');
    expect(replies.at(-1)).toContain('Radio Mashaal closed on 2026-03-31');
    expect(replies.at(-1)).toContain('No working smart link or mirror could be verified');
    expect(replies.at(-1)).not.toContain('✅ Mirror URL');
});

test('SmartURL API uses exact endpoint, encoded URL and url response field', async () => {
    const article = 'https://www.svoboda.org/a/story?x=1&y=2';
    let calledAPI = false;
    const smartLink = 'https://smarturl.click/test-article';
    setFetch(async (input, init) => {
        const url = String(input);
        if (url.startsWith('https://shortener.example')) {
            const endpoint = new URL(url);
            expect(endpoint.pathname).toBe('/link');
            expect(endpoint.searchParams.get('url')).toBe(article);
            expect(init.redirect).toBe('error');
            calledAPI = true;
            return Response.json({ url: smartLink });
        }
        if (url === smartLink) {
            expect(init.method).toBe('GET');
            const response = new Response('Article', { status: 200 });
            Object.defineProperty(response, 'url', { value: article });
            return response;
        }
        return new Response(null, { status: 200 });
    });
    expect(await generateMirrorURL(article)).toMatchObject({
        success: true,
        kind: 'smart',
        url: smartLink,
        sourceUrl: article,
    });
    expect(calledAPI).toBe(true);
});
test('HEAD 405 retries GET and releases the response body', async () => {
    const methods: string[] = [];
    let cancelled = false;
    setFetch(async (_, init) => {
        methods.push(init.method);
        return init.method === 'HEAD'
            ? new Response(null, { status: 405 })
            : new Response(
                  new ReadableStream({
                      start(controller) {
                          controller.enqueue(new TextEncoder().encode('Article'));
                      },
                      cancel() {
                          cancelled = true;
                      },
                  }),
              );
    });
    expect(await checkUrlExists(articleURL)).toBe(true);
    expect(methods).toEqual(['HEAD', 'GET']);
    expect(cancelled).toBe(true);
});
