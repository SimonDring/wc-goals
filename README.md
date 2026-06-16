# ⚽ WC 2026 Goals Sweepstake

Auto-updating leaderboard: every team's World Cup goals, and each family member's two
teams combined. Hosted free on GitHub Pages, rebuilt every 15 minutes; an open page
also re-fetches the latest scores every minute (and on tab focus) without a reload.

## One-time deploy (~5 min)

1. **Create a GitHub repo** and push this folder:
   ```bash
   git remote add origin https://github.com/<you>/wc-goals.git
   git branch -M main
   git push -u origin main
   ```
   > The first auto-triggered run will fail (the token isn't set yet) — that's expected,
   > just carry on with the steps below and trigger it manually at the end.
2. **Get a free API token** at https://www.football-data.org/client/register
   → confirm email → copy the token.
3. **Add the token as a secret:** repo → Settings → Secrets and variables → Actions →
   *New repository secret* → name `FOOTBALL_DATA_TOKEN`, paste the token.
4. **Enable Pages:** repo → Settings → Pages → Source = **GitHub Actions**.
5. **Run it:** repo → Actions → *Update goals & deploy* → **Run workflow**.
   When it finishes, your link is at the top of the Pages settings:
   `https://<you>.github.io/wc-goals` — share that in the chat.

After this, the cron updates scores automatically; no further action needed. Goals from a
match appear once it finishes (in-progress games may show 0 until the final whistle), and if
the build ever fails the site keeps showing the last good scores rather than breaking.

## Local preview
```bash
python3 -m http.server 8000 --directory public   # then open http://localhost:8000
FOOTBALL_DATA_TOKEN=xxxx npm run build            # refresh data.json locally
npm test                                          # run unit tests
```

## Changing assignments
Edit `data/assignments.json` (name → two team spellings) and push. If a team shows 0 with a
"no live data yet" note, its spelling didn't match the feed — add an alias in the
`ALIAS_GROUPS` list in `scripts/aggregate.mjs`.
