import { Bot } from 'grammy';
import { config } from './config';
import { generateMirrorURL } from './urlGenerator';
import { domains } from './domains';

const bot = new Bot(config.telegramToken);

// Rate limiting
const userRequestTimes = new Map<number, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 5; // 5 requests per minute

function isRateLimited(userId: number): boolean {
    const now = Date.now();
    const userTimes = userRequestTimes.get(userId) || [];

    // Remove timestamps older than the window
    const recentTimes = userTimes.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentTimes.length >= MAX_REQUESTS) {
        return true;
    }

    recentTimes.push(now);
    userRequestTimes.set(userId, recentTimes);
    return false;
}

function shouldProcessURL(ctx: any, url: string): { process: boolean; reason?: string } {
    // Check if URL is from supported domain
    try {
        const urlObject = new URL(url);
        if (!domains[urlObject.hostname]) {
            return { process: false, reason: 'unsupported_domain' };
        }
    } catch {
        return { process: false, reason: 'invalid_url' };
    }

    // Check rate limit
    if (isRateLimited(ctx.from.id)) {
        return { process: false, reason: 'rate_limited' };
    }

    // Check whitelist if configured
    const allowedChats = (config as any).allowedChats;
    if (allowedChats && Array.isArray(allowedChats) && allowedChats.length > 0 && !allowedChats.includes(ctx.chat.id)) {
        return { process: false, reason: 'chat_not_allowed' };
    }

    return { process: true };
}

// Command: /start
bot.command('start', (ctx) => {
    ctx.reply(
        'Welcome! 👋\n\n' +
        'Send me any RFE/RL URL and I\'ll generate a mirror link for you.\n\n' +
        'Commands:\n' +
        '/mirror <url> - Generate mirror URL\n' +
        '/help - Show help'
    );
});

// Command: /help
bot.command('help', (ctx) => {
    ctx.reply(
        'Just send me a URL from any RFE/RL website and I\'ll create a mirror link that works in restricted regions.\n\n' +
        'Supported sites:\n' +
        '• www.svoboda.org\n' +
        '• www.sibreal.org\n' +
        '• www.severreal.org\n' +
        '• www.kavkazr.com\n'
    );
});

// Command: /mirror <url>
bot.command('mirror', async (ctx) => {
    const url = ctx.match?.toString().trim();

    if (!url) {
        await ctx.reply('Please provide a URL.\n\nExample: /mirror https://www.svoboda.org/a/article');
        return;
    }

    // Check if should process
    const { process, reason } = shouldProcessURL(ctx, url);

    if (!process) {
        if (reason === 'rate_limited') {
            await ctx.reply('⏳ Please wait a moment before sending another request.');
        } else if (reason === 'unsupported_domain') {
            await ctx.reply('❌ This domain is not supported. Only RFE/RL websites are supported.');
        } else if (reason === 'chat_not_allowed') {
            await ctx.reply('❌ This bot is not available in this chat.');
        } else {
            await ctx.reply('❌ Invalid URL provided.');
        }
        return;
    }

    const statusMsg = await ctx.reply('🔄 Generating mirror URL...');

    try {
        const mirrorURL = await generateMirrorURL(url);

        if (mirrorURL) {
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                `✅ Mirror URL generated:\n\n${mirrorURL}`
            );
        } else {
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                '❌ Unable to generate mirror URL. Make sure you\'re using a supported RFE/RL domain.'
            );
        }
    } catch (error) {
        console.error('Error:', error);
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            '❌ An error occurred while generating the mirror URL.'
        );
    }
});

// Handle any URL sent directly (without command)
bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;

    // Ignore if it's a command
    if (text.startsWith('/')) return;

    // Check if message contains a URL
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex);

    if (urls && urls.length > 0) {
        const url = urls[0];

        // Check if should process
        const { process, reason } = shouldProcessURL(ctx, url);

        if (!process) {
            if (reason === 'rate_limited') {
                await ctx.reply('⏳ Please wait a moment before sending another request.');
            } else if (reason === 'unsupported_domain') {
                await ctx.reply('❌ This domain is not supported. Only RFE/RL websites are supported.\n\nSupported sites:\n• www.svoboda.org\n• www.sibreal.org\n• www.severreal.org\n• www.kavkazr.com');
            } else if (reason === 'chat_not_allowed') {
                await ctx.reply('❌ This bot is not available in this chat.');
            }
            return;
        };

        const statusMsg = await ctx.reply('🔄 Generating mirror URL...');

        try {
            const mirrorURL = await generateMirrorURL(url);

            if (mirrorURL) {
                await ctx.api.editMessageText(
                    ctx.chat.id,
                    statusMsg.message_id,
                    `✅ Mirror URL:\n\n${mirrorURL}`
                );
            } else {
                await ctx.api.editMessageText(
                    ctx.chat.id,
                    statusMsg.message_id,
                    '❌ This domain is not supported. Only RFE/RL websites are supported.'
                );
            }
        } catch (error) {
            console.error('Error:', error);
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                '❌ An error occurred while generating the mirror URL.'
            );
        }
    }
});

// Start the bot
bot.start();

console.log('✅ Bot is running...');