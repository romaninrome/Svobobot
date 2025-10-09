import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

const pinoOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    base: {
        bot: 'svobobot'
    }
};

if (!isProd) {
    pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,bot',
        },
    };
} else {
    pinoOptions.transport = {
        target: 'pino/file',
        options: {
            destination: './logs/svobobot.log',
            mkdir: true,
        },
    };
}

export const botLogger = pino(pinoOptions);

