# Svobobot 🤖

Telegram bot for RFE/RL articles — generates mirror URLs and AI summaries for audiences in restricted regions.

## 📋 Overview

Svobobot helps circumvent censorship by:

- 🔗 Generating mirror URLs for blocked RFE/RL content  
- ✍️ Creating AI summaries optimised for social media (Facebook & X)  
- 📰 Parsing full articles from 30+ RFE/RL domains  
- ✅ Validating links before processing (404 checking)

## 🧩 Environment Variables

Set these in a `.env` file in the project root.  
The bot will not start without valid `TELEGRAM_BOT_TOKEN` and `GEMINI_API_KEY`.

```env
# Required
TELEGRAM_BOT_TOKEN=xxx     # Telegram bot token from @BotFather
GEMINI_API_KEY=xxx         # Google Gemini API key for summaries

# Optional API endpoints and restrictions
API_URL=https://your-api.com
AUTH_TOKEN=xxx
ALLOWED_CHAT_IDS=123,456   # Telegram chat IDs allowed to use the bot (comma-separated)

# Development & logging
NODE_ENV=development        # Use 'production' when deploying
LOG_LEVEL=debug             # Options: fatal, error, warn, info, debug, trace
```

💡 If deploying with Bun or Docker, these variables can be set directly via the environment.

## Setup and checks

Install [Bun](https://bun.sh), then run:

```sh
bun install --frozen-lockfile
cp .env.example .env
# Fill in your credentials in .env before starting.
bun run typecheck
bun run test
bun start
```

`bun.lock` is the dependency lockfile. Tests use mocked services and do not send Telegram messages or make paid AI requests. `API_URL` and `AUTH_TOKEN` can be left empty to generate mirror links directly. Leave `ALLOWED_CHAT_IDS` empty to allow all chats, or supply comma-separated numeric chat IDs.

Bare domains such as `svoboda.org` are accepted when their `www` host is supported. Confirmed 404 responses are rejected; other network failures still allow a mirror link. Article requests time out after 10 seconds and summary requests after 30 seconds.

## 🚀 Usage

Send any RFE/RL URL to the bot or use:

```
/mirror <url>
```

Supported domains include:

- svoboda.org  
- sibreal.org  
- severreal.org  
- kavkazr.com  
- currenttime.tv  
- azadiradio.com  
- radiotavisupleba.ge  
- radiofarda.com  
- …and 23 other RFE/RL websites.

## 🗂 Project Structure

```
linkbot.ts        # Main bot logic
urlGenerator.ts   # Mirror generation
htmlparser.ts     # Article extraction
summariser.ts     # AI summaries
checkurl.ts       # URL validation
config.ts         # Configuration
domains.ts        # Domain mappings
errorHandler.ts   # Main bot error handling
logger.ts         # Pino-based logger
.env.example      # Example environment file
```

## 📄 Licence

MIT © 2025 Roman Mohuczy

## 🙏 Acknowledgements

- Built with [grammY](https://grammy.dev/)  
- Logging with [Pino](https://getpino.io/)
- Inspired by the RFE/RL Mirror URL Chrome Extension (GPL v3) by Mikhail Ageev.

---

_“The only security of all is in a free press; the force of public opinion cannot be resisted when permitted freely to be expressed.” — Thomas Jefferson_
