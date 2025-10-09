import { Bot, Context } from 'grammy';
import { config } from './config';
import { generateMirrorURL, MirrorURLResult } from './urlGenerator';
import { domains } from './domains';
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
        const urlObject = new URL(url);
        if (!domains[urlObject.hostname]) {
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
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    botLogger.info({ userId, username, url }, 'Received URL request');

    const errorMessage = validateRequest(ctx, url);
    if (errorMessage) {
        botLogger.debug({ userId, username, errorMessage }, 'Validation failed');
        await ctx.reply(errorMessage);
        return;
    }

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
        botLogger.info({ userId, username, mirrorUrl }, 'Mirror URL generated');

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '📖 Parsing article...');
        const article = await parseArticle(url);

        if (!article) {
            botLogger.warn({ userId, username, url }, 'Article parsing failed');
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                `✅ Mirror URL:\n\n${mirrorUrl}\n\n⚠️ Could not parse article.`,
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
                `✅ Mirror URL:\n\n${mirrorUrl}\n\n⚠️ Could not generate summaries.`,
            );
            return;
        }

        botLogger.info({ userId, username, url }, 'Summary generated successfully');

        const finalMessage =
            `📘 Facebook:\n${summary.forFacebook}\n\n${mirrorUrl}\n\n` +
            `🦅 Twitter:\n${summary.forTwitter}\n\n${mirrorUrl}`;

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
bot.command('start', (ctx) => {
    botLogger.info({ userId: ctx.from?.id, username: ctx.from?.username }, '/start command');
    ctx.reply(
        'Welcome! 👋\n\n' +
            "Send me any RFE/RL URL and I'll generate a mirror link for you.\n\n" +
            'Commands:\n' +
            '/mirror <url> - Generate mirror URL\n' +
            '/help - Show help',
    );
});

bot.command('help', (ctx) => {
    botLogger.info({ userId: ctx.from?.id, username: ctx.from?.username }, '/help command');
    ctx.reply(
        'Send any RFE/RL link and I’ll create a mirror link that works in restricted regions.',
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

bot.start();
botLogger.info('✅ [Svobobot] is running...');
