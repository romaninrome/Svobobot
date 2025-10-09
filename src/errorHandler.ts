import { Context, GrammyError, HttpError, Bot } from 'grammy';
import { botLogger } from './logger';

export function errorHandler(bot: Bot<Context>) {
    bot.catch((err) => {
        const ctx = err.ctx;
        const userId = ctx.from?.id;
        const username = ctx.from?.username;
        const updateId = (ctx.update as any)?.update_id;

        if (err.error instanceof GrammyError) {
            botLogger.error(
                { userId, username, updateId, description: err.error.description },
                'Telegram API error',
            );
        } else if (err.error instanceof HttpError) {
            botLogger.error(
                { userId, username, updateId, message: err.error.message },
                'Network error contacting Telegram',
            );
        } else {
            botLogger.error(
                { userId, username, updateId, err: err.error },
                'Unhandled error in bot middleware',
            );
        }

        if (ctx.chat?.id) {
            ctx.reply('❌ An unexpected error occurred. Please try again later.').catch(() => {});
        }
    });
}
