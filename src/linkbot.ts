import { Bot } from 'grammy';
import { config } from './config';
import { generateMirrorURL, MirrorURLResult } from './urlGenerator';
import { domains } from './domains';
import { parseArticle } from './htmlparser';
import { generateSummary } from './summariser';

const bot = new Bot(config.telegramToken);

// Rate limiting
const userRequestTimes = new Map<number, number[]>();
const rateLimitWindow = 60000;
const maxRequests = 5;
const cleanupInterval = 5 * 60 * 1000;

function checkRateLimit(userId: number): boolean {
    const now = Date.now();
    const userTimes = userRequestTimes.get(userId) || [];
    const recentTimes = userTimes.filter(time => now - time < rateLimitWindow);

    if (recentTimes.length >= maxRequests) {
        return false;
    }

    recentTimes.push(now);
    userRequestTimes.set(userId, recentTimes);
    return true;
};

setInterval(() => {
    const now = Date.now();
    for (const [userId, times] of userRequestTimes.entries()) {
        const recentTimes = times.filter(time => now - time < rateLimitWindow);
        recentTimes.length === 0 ? userRequestTimes.delete(userId) : userRequestTimes.set(userId, recentTimes);
    }
}, cleanupInterval);

function validateRequest(ctx: any, url: string): string | null {
    try {
        const urlObject = new URL(url);
        if (!domains[urlObject.hostname]) {
            return '❌ This domain is not supported. Only RFE/RL Russian Service websites are supported.';
        }
    } catch {
        return '❌ Invalid URL provided.';
    }

    if (!checkRateLimit(ctx.from.id)) {
        return '⏳ Please wait a moment before sending another request.';
    }

    const allowedChats = config.allowedChats;
    if (allowedChats.length > 0 && !allowedChats.includes(ctx.chat.id)) {
        return '❌ This bot is not available in this chat.';
    }

    return null;
};

// async function processURL(ctx: any, url: string): Promise<void> {
//     const errorMessage = validateRequest(ctx, url);
//     if (errorMessage) {
//         await ctx.reply(errorMessage);
//         return;
//     }

//     const statusMsg = await ctx.reply('🔄 Generating mirror URL...');

//     try {
//         const result: MirrorURLResult = await generateMirrorURL(url);

//         let finalMessage: string;

//         if (result.success) {
//             finalMessage = `✅ Mirror URL:\n\n${result.url}`;
//         } else {
//             switch (result.error) {
//                 case 'not_found':
//                     finalMessage = "❌ There is no article (404). You don't need to save it from censorship.";
//                     break;
//                 case 'invalid_url':
//                     finalMessage = '❌ Invalid URL format.';
//                     break;
//                 case 'unsupported_domain':
//                     finalMessage = '❌ This domain is not supported. Only RFE/RL Russian Service websites are supported.';
//                     break;
//                 case 'generation_failure':
//                 default:
//                     finalMessage = '❌ Unable to generate mirror URL due to an API error. Please try again.';
//                     break;
//             }
//         }

//         await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, finalMessage);
//     } catch (error) {
//         console.error('Error:', error);
//         await ctx.api.editMessageText(
//             ctx.chat.id,
//             statusMsg.message_id,
//             '❌ An error occurred while generating the mirror URL.'
//         );
//     }
// };

async function processURL(ctx: any, url: string): Promise<void> {
    const errorMessage = validateRequest(ctx, url);
    if (errorMessage) {
        await ctx.reply(errorMessage);
        return;
    }

    const statusMsg = await ctx.reply('🔄 Processing article...');

    try {
        const result: MirrorURLResult = await generateMirrorURL(url);

        if (!result.success) {
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

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '📖 Parsing article...');
        const article = await parseArticle(url);

        if (!article) {
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                `✅ Mirror URL:\n\n${mirrorUrl}\n\n⚠️ Could not parse article.`
            );
            return;
        }

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '🤖 Generating summaries...');
        const summary = await generateSummary(article.title, article.body);

        if (!summary) {
            await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                `✅ Mirror URL:\n\n${mirrorUrl}\n\n⚠️ Could not generate summaries.`
            );
            return;
        }

        const finalMessage = `📘 Facebook:\n${summary.forFacebook}\n\n🐦 Twitter:\n${summary.forTwitter}\n\n🔗 Mirror:\n${mirrorUrl}`;

        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, finalMessage);

    } catch (error) {
        console.error('Error:', error);
        await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            '❌ Processing error occurred.'
        );
    }
};

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