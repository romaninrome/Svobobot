export const config = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
    apiUrl: process.env.API_URL || '',
    authToken: process.env.AUTH_TOKEN || '',
    allowedChats: process.env.ALLOWED_CHAT_IDS?.split(',').map(Number) || []
};