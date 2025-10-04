import { Bot } from 'grammy';
import { config } from './config';
import { generateMirrorURL } from './urlGenerator';
import { domains } from './domains';

const bot = new Bot(config.telegramToken);

// Rate limiting
const userRequestTimes = new Map<number, number[]>();
const rateLimitWindow = 60000; // 1 minute
const maxRequests = 5;
const cleanupInterval = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(userId: number): boolean {
    const now = Date.now();
    const userTimes = userRequestTimes.get(userId) || [];
    const recentTimes = userTimes.filter(time => now - time < rateLimitWindow);

    if (recentTimes.length >= maxRequests

    ) {
        return false; // Rate limited
    }

    recentTimes.push(now);
    userRequestTimes.set(userId, recentTimes);
    return true; // OK to proceed
};

// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, times] of userRequestTimes.entries()) {
        const recentTimes = times.filter(time => now - time < rateLimitWindow);
        recentTimes.length === 0 ? userRequestTimes.delete(userId) : userRequestTimes.set(userId, recentTimes);
    }
}, cleanupInterval);

function validateRequest(ctx: any, url: string): string | null {
    // Validate URL format
    try {
        const urlObject = new URL(url);
        if (!domains[urlObject.hostname]) {
            return '❌ This domain is not supported. Only RFE/RL websites are supported.';
        }
    } catch {
        return '❌ Invalid URL provided.';
    }

    // Check rate limit
    if (!checkRateLimit(ctx.from.id)) {
        return '⏳ Please wait a moment before sending another request.';
    }

    // Check whitelist
    const allowedChats = config.allowedChats;
    if (allowedChats.length > 0 && !allowedChats.includes(ctx.chat.id)) {
        return '❌ This bot is not available in this chat.';
    }

    return null; // All checks passed
};

async function processURL(ctx: any, url: string): Promise<void> {
    const errorMessage = validateRequest(ctx, url);
    if (errorMessage) {
        await ctx.reply(errorMessage);
        return;
    }

    const statusMsg = await ctx.reply('🔄 Generating mirror URL...');

    try {
        const mirrorURL = await generateMirrorURL(url);
        const message = mirrorURL
            ? `✅ Mirror URL:\n\n${mirrorURL}`
            : '❌ Unable to generate mirror URL. Make sure you\'re using a supported RFE/RL domain.';

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, message);
    } catch (error) {
        console.error('Error:', error);
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            '❌ An error occurred while generating the mirror URL.'
        );
    }
};

// Commands
bot.command('start', (ctx) => {
    ctx.reply(
        'Welcome! 👋\n\n' +
        'Send me any RFE/RL URL and I\'ll generate a mirror link for you.\n\n' +
        'Commands:\n' +
        '/mirror <url> - Generate mirror URL\n' +
        '/help - Show help'
    );
});

bot.command('help', (ctx) => {
    ctx.reply(
        'Just send me a URL from any RFE/RL website and I\'ll create a mirror link that works in restricted regions.\n\n' +
        'Supported sites:\n' +
        '• www.svoboda.org\n' +
        '• www.sibreal.org\n' +
        '• www.severreal.org\n' +
        '• www.kavkazr.com'
    );
});

bot.command('mirror', async (ctx) => {
    const url = ctx.match?.toString().trim();
    if (!url) {
        await ctx.reply('Please provide a URL.\n\nExample: /mirror https://www.svoboda.org/a/article');
        return;
    }
    await processURL(ctx, url);
});

// Handle URLs sent directly
bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        await processURL(ctx, urlMatch[0]);
    }
});

bot.start();
console.log('✅ Bot is running...');