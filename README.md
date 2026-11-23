See GO-LIVE.md for the easiest ways to run this, on your computer or always on in the cloud.

# Quick start (one click)

1. Install Node 20 or newer from https://nodejs.org (once).
2. Windows: double-click `start.bat`. Mac: double-click `start.command` (if it will not open, right-click, Open). Linux: run `./start.sh`.
3. The first time it creates your `.env`, makes a random admin token, asks for your Anthropic API key (press Enter to skip) and installs. Then it opens http://localhost:3000.
4. Paste the admin token it printed when the page asks. Stop with Ctrl+C. Run the same file again any time.

The manual steps are below if you prefer them.

# Commission Desk backend

Counts real clicks on your affiliate links, records sales from your network's postbacks, and creates and manages campaigns in your own Google Ads and Meta ad accounts through their official APIs. Everything it creates starts **paused**, and no daily budget above `MAX_DAILY_BUDGET` is accepted.

It also serves the Commission Desk web page from `public/index.html` (affiliate dashboard, promo writer, ad planner).

## What it does not do

It does not generate clicks, impressions, signups or fake accounts. Ad networks and affiliate programs detect that and close accounts, usually with unpaid commissions. All numbers here come from real visitors and real network reports.

## Setup

1. Install Node 20 or newer, then in this folder run `npm install`.
2. Copy `.env.example` to `.env` and fill it in (steps below). Never commit `.env`.
3. Run `npm start`, then open `http://localhost:3000`.

### Google Ads

1. In a Google Ads manager account, open API Center and apply for a **developer token**. Test-level access only works with test accounts; apply for Basic access to use a real account.
2. In Google Cloud, create an OAuth client (Desktop app), enable the Google Ads API, and generate a **refresh token** for the Google account that can access your ads account.
3. Put the token, client ID, client secret, refresh token and your customer ID (digits only) in `.env`.
4. Set `GOOGLE_ADS_API_VERSION` to a version that is currently supported. Google retires old versions on a schedule: https://developers.google.com/google-ads/api/docs/sunset-dates
5. If a launch call fails asking for the EU political advertising declaration, set `GOOGLE_ADS_SEND_EU_POLITICAL_FIELD=true`.

### Meta

1. Create an app at developers.facebook.com, add the Marketing API, and create a **system user token** with `ads_management` and `ads_read` for your ad account.
2. Put the token, `META_AD_ACCOUNT_ID` (starts with `act_`) and `META_PAGE_ID` in `.env`.
3. Set `META_GRAPH_VERSION` to a current version: https://developers.facebook.com/docs/graph-api/changelog/versions

## Tracking your links

Add a link, then use the tracked URL in your content, ads and emails.

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"slug":"hosting","name":"Hosting plan","program":"Example Hosting","url":"https://example.com/go/hosting?ref=YOURID"}'
```

Send people to `https://yourdomain.com/go/hosting`. Visitors are counted (obvious crawlers are skipped) and redirected. Any `utm_*` parameters on the tracked URL are passed through.

Sales: in your affiliate network, set the server-to-server postback to
`https://yourdomain.com/postback?slug=hosting&amount={commission}&secret=YOUR_POSTBACK_SECRET`
and replace `{commission}` with that network's commission macro. Networks that do not support postbacks need manual entry in the web page.

Read your numbers: `GET /api/links` (clicks, sales, revenue, conversion rate, earnings per click).

## Running ads

All `/api` calls need the header `Authorization: Bearer <ADMIN_TOKEN>`.

| Call | What it does |
|---|---|
| `GET /api/google/campaigns?range=LAST_7_DAYS` | Spend, clicks, conversions per campaign |
| `POST /api/google/launch` | Creates a paused search campaign with budget, targeting, keywords and a responsive search ad |
| `POST /api/google/campaigns/:id/status` | `{"status":"ENABLED"}` or `{"status":"PAUSED"}` |
| `GET /api/meta/campaigns?range=last_7d` | Spend, clicks, actions per campaign |
| `POST /api/meta/launch` | Creates a paused traffic campaign, ad set, creative and ad |
| `POST /api/meta/campaigns/:id/status` | `{"status":"ACTIVE"}` or `{"status":"PAUSED"}` |

Example Google launch:

```bash
curl -X POST http://localhost:3000/api/google/launch \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Search: hosting",
    "dailyBudget": 15,
    "maxCpc": 0.8,
    "finalUrl": "https://yourdomain.com/go/hosting?utm_source=google&utm_medium=cpc&utm_campaign=hosting",
    "keywords": ["best web hosting for small business"],
    "headlines": ["Hosting for Small Business", "First Month Free", "Fast, Reliable Hosting"],
    "descriptions": ["Fast, reliable hosting with daily backups. See how it works.", "First month free. Made for small business owners. Get started."]
  }'
```

Example Meta launch:

```bash
curl -X POST http://localhost:3000/api/meta/launch \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Feed: hosting","dailyBudget":10,"link":"https://yourdomain.com/go/hosting","message":"Fast, reliable hosting with daily backups.","headline":"Hosting for small business","countries":["US"]}'
```

Review the paused campaign in Google Ads or Ads Manager, then enable it with the status call. If a launch fails partway, the error lists what was already created (`alreadyCreated`) so you can remove it. Platform error messages are passed back unchanged.

Use the **Promo writer** and **Ad planner** tabs in the web page to write the copy and check the budget math first. The copy limits shown there (30-character headlines, 90-character descriptions) match what the Google launch call validates.

## Chat assistant

The page has an **Agents** button. It holds five specialists (Analyst, Copywriter, Planner, Ad manager, Compliance) plus a **Team review** that runs four of them in turn. They only propose: a campaign saved to the planner, ad copy for the launch form, a pause for a live campaign, auto-pause limits. Nothing changes until you press the button on the proposal, and they can never turn a campaign on or raise a budget. They answer questions about your links, campaigns and promo copy using the numbers on the page. On your own site it runs through this server: set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in `.env`, restart, and the button appears. Open the chat and paste your `ADMIN_TOKEN` into the box under it once per browser session. Questions are limited to 20 a minute, and the key never reaches the browser. Without the key the button stays hidden.

## Launching and managing ads from the page

Open the page from your own server (not the copy hosted by Claude). On the **Ad planner** tab, paste your `ADMIN_TOKEN` under "Connect to your server" and press Connect.

- **Launch a campaign:** save a Google Ads or Meta Ads campaign in the planner, choose it in "Launch a campaign", pick an affiliate link, and press Create paused campaign. Budget and click cost come from the planner. "Fill from Promo writer" drafts the copy. Example rows cannot be launched. Clicks can go through your tracked `/go/` link so this server counts them.
- **Live campaigns:** shows 7-day spend, clicks and average click cost, with Pause and Turn on buttons. Turning a campaign on needs a second click to confirm.
- **Auto-pause rules:** the server checks your running campaigns about once an hour (`RULES_INTERVAL_MIN`) and pauses any that break a limit: average click cost, 7-day spend, or spend with no conversions. Rules can only pause. They never turn a campaign on or raise a budget. By default they only touch campaigns launched from this site; you can widen that to every campaign in the connected accounts. "Test now" shows what would be paused and changes nothing. Pauses are logged on the page.
- The no-conversions limit only makes sense if your ad account tracks conversions. Affiliate sales are usually reported by the network, not the ad account, so leave it at 0 otherwise.

These calls change real ad accounts. They have been tested against stand-in responses, not against live Google or Meta accounts, so run your first launch with a small budget and check the result in the ad platform.

## Before you run real ads

- Your ads and landing pages must follow each platform's policies and your affiliate program's rules. Some programs do not allow bidding on their brand name or sending paid traffic straight to the merchant, so a landing page on your own site is often required.
- Disclose affiliate relationships on your pages and in your posts. The promo writer can add the line for you.
- Start with a low `MAX_DAILY_BUDGET` and watch the first days of spend before raising it.

## Deploying

Any Node host works (Render, Railway, Fly.io, a small VPS). Set the `.env` values as environment variables on the host, serve it over HTTPS, and keep `DATA_FILE` on a persistent disk so click and sales counts survive restarts. `/go/:slug` and `/postback` are public by design; everything under `/api` requires the admin token.

## Live candles (Scanner)

In the Scanner tab choose Data, then **Live from Coinbase**. The page asks this server for `/market/candles` (a public, read-only relay of Coinbase Exchange candles, cached 5 seconds, no API key), falling back to calling Coinbase directly. Crypto only (BTC, ETH, SOL, XRP, DOGE, LTC, ADA, AVAX, LINK); Coinbase has no gold or currency pairs. It refreshes every 10 seconds while the Scanner tab is open. It is for viewing and pattern testing only and never places trades.
