import { Bot, Context } from 'grammy';
import { config } from './config';
import { generateMirrorURL, MirrorURLResult } from './urlGenerator';
import { normalizeSupportedURL } from './domains';
import { isValidURL } from './checkurl';
import { parseArticle } from './htmlparser';
import { generateSummary } from './summariser';
import { botLogger } from './logger';
import { errorHandler } from './errorHandler';

const bot = new Bot(config.telegramToken);

// Rate limiting
const userRequestTimes = new Map<number, number[]>();
const rateLimitWindow = 60000;
const maxRequests = 5;
const cleanupInterval = 5 * 60 * 1000;

function checkRateLimit(userId: number): boolean {
    const now = Date.now();
    const userTimes = userRequestTimes.get(userId) || [];
    const recentTimes = userTimes.filter((time) => now - time < rateLimitWindow);

    if (recentTimes.length >= maxRequests) {
        botLogger.warn({ userId }, 'Rate limit exceeded');
        return false;
    }

    recentTimes.push(now);
    userRequestTimes.set(userId, recentTimes);
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [userId, times] of userRequestTimes.entries()) {
        const recentTimes = times.filter((time) => now - time < rateLimitWindow);
        if (recentTimes.length === 0) {
            userRequestTimes.delete(userId);
        }
    }
}, cleanupInterval);

function validateRequest(ctx: Context, url: string): string | null {
    try {
        if (!isValidURL(url)) return '❌ Invalid URL provided.';
        if (!normalizeSupportedURL(url)) {
            botLogger.info(
                { userId: ctx.from?.id, username: ctx.from?.username, url },
                'Unsupported domain',
            );
            return '❌ This domain is not supported. Only RFE/RL websites are supported.';
        }
    } catch {
        botLogger.info({ userId: ctx.from?.id, username: ctx.from?.username, url }, 'Invalid URL');
        return '❌ Invalid URL provided.';
    }

    if (!ctx.from?.id) {
        botLogger.warn('Cannot identify user');
        return '❌ Cannot identify user.';
    }

    if (!checkRateLimit(ctx.from.id)) {
        botLogger.warn({ userId: ctx.from.id }, 'Rate limit hit');
        return '⏳ Please wait a moment before sending another request.';
    }

    if (!ctx.chat) return '❌ Cannot identify chat.';
    const allowedChats = config.allowedChats;
    if (allowedChats.length > 0 && !allowedChats.includes(ctx.chat.id)) {
        botLogger.warn(
            { userId: ctx.from.id, chatId: ctx.chat.id },
            'Message from disallowed chat',
        );
        return '❌ This bot is not available in this chat.';
    }

    return null;
}

async function processURL(ctx: Context, url: string): Promise<void> {
    if (!ctx.chat) return;
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    botLogger.info({ userId, username, url }, 'Received URL request');

    const errorMessage = validateRequest(ctx, url);
    if (errorMessage) {
        botLogger.debug({ userId, username, errorMessage }, 'Validation failed');
        await ctx.reply(errorMessage);
        return;
    }

    url = normalizeSupportedURL(url)!.toString();
    const statusMsg = await ctx.reply('🔄 Processing article...');

    try {
        const result: MirrorURLResult = await generateMirrorURL(url);

        if (!result.success) {
            botLogger.warn(
                { userId, username, url, error: result.error },
                'Mirror generation failed',
            );
            let finalMessage: string;
            switch (result.error) {
                case 'not_found':
                    finalMessage = '❌ Article not found (404).';
                    break;
                case 'invalid_url':
                    finalMessage = '❌ Invalid URL format.';
                    break;
                case 'unsupported_domain':
                    finalMessage = '❌ Domain not supported.';
                    break;
                default:
                    finalMessage = '❌ Unable to generate mirror URL.';
            }
            await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, finalMessage);
            return;
        }

        const mirrorUrl = result.url;
        const linkLabel =
            result.kind === 'smart'
                ? '🔗 Smart link'
                : result.kind === 'mirror'
                  ? '✅ Mirror URL'
                  : '🔗 Original URL';
        const linkNotice = [
            result.notice,
            result.kind === 'original'
                ? '⚠️ No working smart link or mirror could be verified. This original link may be blocked in your region.'
                : undefined,
        ]
            .filter(Boolean)
            .join('\n');
        const linkMessage = `${linkLabel}:\n\n${mirrorUrl}${linkNotice ? `\n\n${linkNotice}` : ''}`;
        botLogger.info({ userId, username, kind: result.kind }, 'Article link prepared');

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '📖 Parsing article...');
        const article = await parseArticle(result.sourceUrl);

        if (!article) {
            botLogger.warn({ userId, username, url }, 'Article parsing failed');
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                `${linkMessage}\n\n⚠️ Could not parse article.`,
            );
            return;
        }

        botLogger.info({ userId, username, title: article.title }, 'Article parsed successfully');

        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            '🤖 Generating summaries...',
        );
        const summary = await generateSummary(article.title, article.body);

        if (!summary) {
            botLogger.warn({ userId, username, url }, 'Summary generation failed');
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                `${linkMessage}\n\n⚠️ Could not generate summaries.`,
            );
            return;
        }

        botLogger.info({ userId, username, url }, 'Summary generated successfully');

        const finalMessage =
            `📘 Facebook:\n${summary.forFacebook}\n\n${mirrorUrl}\n\n` +
            `🦅 Twitter:\n${summary.forTwitter}\n\n${mirrorUrl}` +
            (linkNotice ? `\n\n${linkNotice}` : '');

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, finalMessage);
    } catch (error) {
        botLogger.error({ err: error, userId, username, url }, 'Processing error');
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            '❌ Processing error occurred.',
        );
    }
}

// Commands
bot.command('start', async (ctx) => {
    botLogger.info({ userId: ctx.from?.id, username: ctx.from?.username }, '/start command');
    await ctx.reply(
        'Welcome! 👋\n\n' +
            "Send a supported RFE/RL article URL for a smart link and summaries. If link generation fails, I'll return the original link.\n\n" +
            'Commands:\n' +
            '/mirror <url> - Generate smart link\n' +
            '/help - Show help',
    );
});

bot.command('help', async (ctx) => {
    botLogger.info({ userId: ctx.from?.id, username: ctx.from?.username }, '/help command');
    await ctx.reply(
        'Send a supported RFE/RL article link. I’ll generate a smart link and create summaries. Archived Mashaal and Ekho Kavkaza articles are supported; original links may require a VPN.',
    );
});

bot.command('mirror', async (ctx) => {
    botLogger.info({ userId: ctx.from?.id, username: ctx.from?.username }, '/mirror command');
    const url = ctx.match?.toString().trim();
    if (!url) {
        await ctx.reply(
            'Please provide a URL.\n\nExample: /mirror https://www.svoboda.org/a/article',
        );
        return;
    }
    await processURL(ctx, url);
});

bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        botLogger.info(
            { userId: ctx.from?.id, username: ctx.from?.username, text },
            'Detected URL in message',
        );
        await processURL(ctx, urlMatch[0]);
    }
});

errorHandler(bot);

bot.start({ onStart: () => botLogger.info('✅ [Svobobot] is running...') }).catch((error) => {
    botLogger.fatal({ err: error }, 'Bot startup failed');
    process.exit(1);
});
