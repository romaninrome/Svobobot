import { Bot } from 'grammy';
import { config } from './config';
import { generateMirrorURL } from './urlGenerator';

const bot = new Bot(config.telegramToken);

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
    const url = ctx.match;

    if (!url) {
        await ctx.reply('Please provide a URL.\n\nExample: /mirror https://www.rferl.org/a/article');
        return;
    }

    const statusMsg = await ctx.reply('🔄 Generating mirror URL...');

    try {
        const mirrorURL = await generateMirrorURL(url.toString());

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