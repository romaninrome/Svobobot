# Service status and mirror availability

Last reviewed: September 6, 2026. This is a dated snapshot, not a guarantee of current availability.

## Closures and consolidation

RFE/RL's [April 28 announcement](https://about.rferl.org/article/rfe-rl-implements-strategic-reforms/) confirms:

| Change                                                                 | Date           | Effect on this bot                                                                              |
| ---------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| Bulgarian, Romanian, North Macedonia services and Radio Mashaal closed | March 31, 2026 | Only Mashaal was in this bot's allowlist. Keep its archived articles and show a closure notice. |
| Ekho Kavkaza closed                                                    | May 1, 2026    | Keep archived articles and show a closure notice. The Georgian-language service continues.      |
| Svoboda, Current Time, Azatliq, and Marsho operations merged           | May 1, 2026    | Keep all four brands' domains; the announcement says their brands and languages continue.       |

The Hungarian service ceased operations in November 2025, according to [RFE/RL's history](https://about.rferl.org/our-history/). It was not in this bot's allowlist. The [official site directory](https://www.svoboda.org/navigation/allsites) also lists Votvot as archived; it was not supported here either.

Mashaal's [final message](https://www.mashaalradio.com/a/radio-mashaal-closure-final-message/33720022.html) explicitly preserves the website as an archive. Closing a newsroom is not a reason to reject its historical article URLs. The bot retains Mashaal and Ekho Kavkaza and labels their content as archived.

## Observed redirects

The public homepage checks found these destinations:

| Original host(s)                                                                              | Destination                   |
| --------------------------------------------------------------------------------------------- | ----------------------------- |
| `www.severreal.org`                                                                           | `www.svoboda.org/severrealii` |
| `www.sibreal.org`                                                                             | `www.svoboda.org/sibreal`     |
| `www.idelreal.org`                                                                            | `www.svoboda.org/idel`        |
| `www.kavkazr.com`                                                                             | `www.svoboda.org/caucasus`    |
| `rus.azattyq.org`, `rus.azattyk.org`, `rus.ozodi.org`, `rus.azathabar.com`, `rus.ozodlik.org` | `www.azattyqasia.org`         |

These are observed homepage redirects, not inferred article-path mappings. The bot follows the supplied URL's actual redirect and uses a supported destination for shortening and parsing. Old domains remain accepted; `www.azattyqasia.org` and its bare alias are now accepted too. No static mirror is invented for the new host.

## Mirror audit and behavior

The [saved audit](domain-audit-2026-09-06.json) checked all 31 previously configured original hosts and 31 CloudFront mirror hosts with bounded HTTPS HEAD requests. All original homepages returned HTTP 200 after redirects. All mirror hosts failed DNS resolution. Public Google DNS checks for the Svoboda and Mashaal mirror hostnames also returned no A records.

This does not establish that every article exists, that all mirrors are permanently retired, or that the services themselves have closed. It establishes that the stored mirror list could not deliver working links during this check. No replacement static CloudFront endpoints were verified. The publisher SmartURL API was subsequently verified, as described below.

The old mirror values remain candidate addresses for compatibility, but the bot now checks the generated candidate before returning it. Failed or inconclusive checks produce an original link with a notice that it may be blocked. Publisher `smarturl.click` links remain SmartURL links even when they resolve to the original publisher from this connection. Other short links resolving to a supported publisher are treated as original links. An HTTP check from the bot cannot guarantee regional accessibility.

### Working SmartURL integration

The publisher's [RFE/RL Mirror URL extension](https://chromewebstore.google.com/detail/rferl-mirror-url/hlaliabonlpoffciggfinjkekeiehlfj) identifies `https://smarturl.click/link?url=<encoded URL>` as its API. It uses the `Authorization` header and reads the JSON `url` field. The bot previously called the configured `rferl.link` endpoint and expected `short_url`; that request returned HTTP 404 in the live check.

The updated application, using the existing local API credential, generated `https://smarturl.click/VRag7` on September 6, 2026. A GET opened the original article with HTTP 200 and the parser extracted a title and body. SmartURL returned HTTP 405 for HEAD, so generated links now use GET validation and the response body is cancelled after checking headers. Original URL checks also retry GET on HEAD 405.

This verifies generation and article retrieval from the test connection only. Regional routing and censorship bypass have not been verified. The bot labels these results as smart links rather than claiming they are independently verified mirrors.

A configured shortening API can supply a current candidate, which is checked too. Refresh static mappings only from a trusted publisher source. Re-run public endpoint checks with:

```sh
bun run check:domains
```

This command makes public network requests, reports redirects and failures as JSON, and does not use Telegram, Gemini, or shortening API credentials. Unit tests remain offline (`bun run test`).
