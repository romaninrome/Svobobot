# Svobobot 🤖

Telegram bot for RFE/RL articles: generates mirror URLs and AI summaries for restricted regions.

## Features

- 🔗 Mirror URL generation with fallback
- 📝 AI summaries for Facebook/Twitter
- 📰 Full article parsing
- ✅ 404 checking before processing
- 🌍 31 supported domains

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=xxx
GEMINI_API_KEY=xxx

# Optional
API_URL=https://your-api.com
AUTH_TOKEN=xxx
ALLOWED_CHAT_IDS=123,456 (remove this if you make it public)
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
test-domains.test.ts  # Domain health checker
```

## Licence

MIT © 2024 Roman Mohuczy

## Acknowledgements

- Built with [grammY](https://grammy.dev/)

---

*"Overengineering is a mortal sin"*