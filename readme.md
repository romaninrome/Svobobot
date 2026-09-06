# Svobobot 🤖

Telegram bot for RFE/RL articles — generates publisher SmartURL links and creates AI summaries for audiences in restricted regions.

## 📋 Overview

Svobobot helps circumvent censorship by:

- 🔗 Generating publisher SmartURL links, with an explicit original-link fallback
- ✍️ Creating AI summaries optimised for social media (Facebook & X)  
- 📰 Parsing articles from supported RFE/RL domains, including archived services
- ✅ Validating links before processing (404 checking)

## 🧩 Environment Variables

Set these in a `.env` file in the project root.  
The bot will not start without valid `TELEGRAM_BOT_TOKEN` and `GEMINI_API_KEY`.

```env
# Required
TELEGRAM_BOT_TOKEN=xxx     # Telegram bot token from @BotFather
GEMINI_API_KEY=xxx         # Google Gemini API key for summaries

# Optional API endpoints and restrictions
API_URL=https://smarturl.click/link
AUTH_TOKEN=xxx             # Credential for the SmartURL API
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

`bun.lock` is the dependency lockfile. Tests use mocked services and do not send Telegram messages or make paid AI requests. `API_URL` is the complete endpoint (default: `https://smarturl.click/link`); set `AUTH_TOKEN` to your publisher API credential. The API returns a JSON `url` field. An explicitly empty `API_URL` disables the provider and tries legacy static candidates, all of which failed DNS checks in September 2026. Leave `ALLOWED_CHAT_IDS` empty to allow all chats, or supply comma-separated numeric chat IDs.

Bare domains such as `svoboda.org` are accepted when their `www` host is supported. Confirmed 404 responses are rejected. Generated links are checked with GET, since SmartURL rejects HEAD requests. Publisher SmartURL links are preserved even if they redirect to the original site from the bot’s location; this does not prove censorship bypass elsewhere. If no candidate is reachable, the bot labels the result as an original link that may be blocked. Article requests time out after 10 seconds and summary requests after 30 seconds.

A live check on September 6, 2026, using the application code and an existing API credential successfully generated [a SmartURL article link](https://smarturl.click/VRag7), opened the article, and extracted its title and body. This verified generation and retrieval from the test connection, not accessibility inside censored networks.

## 🚀 Usage

Send a supported RFE/RL article URL to the bot or use:

```
/mirror <url>
```

Supported domains include:

- svoboda.org  
- sibreal.org  
- severreal.org  
- kavkazr.com  
- currenttime.tv  
- da.azadiradio.com / pa.azadiradio.com
- radiotavisupleba.ge  
- radiofarda.com  
- azattyqasia.org
- mashaalradio.com / ekhokavkaza.com (archives)

The exact allowlist is in [src/domains.ts](src/domains.ts). Domain aliases and language subdomains are not separate services. See [service status](docs/service-status.md) for closures, migrations, and the September 2026 mirror audit.

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
