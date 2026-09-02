# Raid-Helper Attendance Bot

Discord bot that syncs sign-ups from the Raid-Helper premium API and computes attendance
rankings, individual trends, and dropout alerts for a single guild.

## How it works

- Polls the Raid-Helper API (`GET /servers/{id}/events`, `GET /events/{id}`) on a schedule and
  stores every event + sign-up locally in SQLite.
- Tracks guild membership via the Discord gateway (join/leave), so rankings account for
  newcomers (grace period) and departed members (never deleted from history, just excluded
  from current rankings).
- Computes, once a day, a stats snapshot for the current period (week/month/rolling window,
  configurable) and keeps the previous period's snapshot frozen for trend comparisons.
- Exposes `/top`, `/flop`, `/stats`, `/dropouts` and an admin `/sync` command.

See [`.env.example`](./.env.example) for every configuration option.

## Local development

```bash
npm install
cp .env.example .env   # fill in the values below
npm run deploy-commands
npm start
```

You need, at minimum:
- A Discord application + bot (Discord Developer Portal): `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`.
  Invite it to your guild with the `applications.commands` and `bot` scopes, and the
  `Manage Guild`-gated `/sync` command requires the bot to see guild members
  (enable the **Server Members Intent** in the bot's settings).
- `DISCORD_GUILD_ID`: the target guild's id.
- A Raid-Helper server API key: run `/apikey` in your Discord server (requires Raid-Helper
  Premium) to get `RAIDHELPER_API_KEY`, and `RAIDHELPER_SERVER_ID` is your guild id as well.

## Deployment: GitHub + Portainer

The bot is not built locally — Portainer builds and runs it directly from this GitHub repo.

1. Push this repo to GitHub.
2. In Portainer: **Stacks → Add stack → Repository**.
   - Repository URL: this repo's URL.
   - Reference: `refs/heads/main` (or your default branch).
   - Compose path: `docker-compose.yml`.
   - If the repo is private, provide a GitHub personal access token (`repo` scope) as the Git
     credentials.
3. In the stack's **Environment variables** section, set every variable listed in
   [`.env.example`](./.env.example) with your real values. Do **not** commit a `.env` file —
   secrets live only in Portainer's stack configuration.
4. Deploy the stack. Portainer clones the repo, builds the image (`Dockerfile`), and starts the
   container with a named volume for the SQLite database.
5. On first boot, the bot runs a full backfill of Raid-Helper's event history before switching
   to incremental polling — this can take a while depending on how many events exist.

### Redeploying after a `git push`

Pick one, depending on how hands-off you want this:
- **Manual**: click "Pull and redeploy" on the stack in Portainer after every push.
- **Webhook**: enable the stack's redeploy webhook in Portainer and add it as a webhook on the
  GitHub repo (triggers on push).
- **Polling**: Portainer's GitOps polling interval on the stack, if you prefer periodic checks
  over instant webhooks.

Start with the manual option; switch to the webhook once the bot is stable.
