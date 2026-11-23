# Go live: the easiest ways

## A. On your computer (free, 2 minutes)
Install Node 20+ from nodejs.org, then double-click `start.bat` (Windows) or `start.command` (Mac). Paste your Anthropic API key when asked. The page opens at http://localhost:3000. It only runs while that window is open.

## B. Always on, on the internet (about $7 a month)
1. Make a free GitHub account and a new private repository. Upload everything in this folder (not `.env`, not `node_modules`).
2. Make a Render account (render.com), choose New > Blueprint, and pick that repository. Render reads `render.yaml`.
3. When asked, paste your ANTHROPIC_API_KEY. Leave the Google and Meta boxes empty until you have them.
4. Wait for the deploy. Open the address Render gives you (it starts with https://). In Render > Environment, copy ADMIN_TOKEN and paste it when the page asks.

## Put the agents to work
- Click **Team review**. The five agents read your numbers and write proposals. Nothing launches or spends money until you press approve.
- Auto-pause rules (Ad planner) check your campaigns every RULES_INTERVAL_MIN minutes once switched on, and can only pause.
- Add your affiliate links first (Dashboard), so the agents have something to work with.
