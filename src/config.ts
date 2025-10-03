import dotenv from 'dotenv';

dotenv.config();

export const config = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
    apiUrl: process.env.API_URL || '',
    authToken: process.env.AUTH_TOKEN || ''
};