# Svobobot 🤖

Telegram bot for RFE/RL articles: generates mirror URLs and AI summaries for restricted regions.

## 📋 Overview

Svobobot helps circumvent censorship by:

- 🔗 Mirror URL generation for blocked RFE/RL content
- Generating AI summaries optimised for social media (Facebook & X)
- 📰 Full article parsing from 30+ RFE/RL domains
- Validating URLs before processing (404 checking)

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=xxx
GEMINI_API_KEY=xxx

# Optional
API_URL=https://your-api.com
AUTH_TOKEN=xxx
ALLOWED_CHAT_IDS=123,456 (Telegram chat IDs. Remove this if you make it public)
```

## Usage

Send any RFE/RL URL to the bot or use `/mirror <url>`

Supported domains:

- svoboda.org
- sibreal.org
- severreal.org
- kavkazr.com
- currenttime.tv
- azadiradio.com
- radiotavisupleba.ge
- radiofarda.com
- And 23 more RFE/RL services

## Project Structure

```
linkbot.ts        # Main bot
urlGenerator.ts   # Mirror generation
htmlparser.ts     # Article extraction
summariser.ts     # AI summaries
checkurl.ts       # URL validation
config.ts         # Config
domains.ts        # Domain mappings
.env.example      # API keys file mock-up
```

## Licence

MIT © 2025 Roman Mohuczy

## Acknowledgements

- Built with [grammY](https://grammy.dev/)
- Logging with [Pino](https://getpino.io/)

---

_The only security of all is in a free press, the force of public opinion cannot be resisted, when permitted freely to be expressed_
