# Shared leaderboard deployment

Server-enabled deployments need their own score API and persistent JSON text file. All players of that deployment share those scores; independently hosted copies should use separate score files. A separate This PC list preserves browser scores. Old browser records sync automatically when server scores are enabled. New submitted runs attempt both lists.

## Run the server

Use Node 24 LTS. No extra dependencies or database are needed.

Set these server environment variables:

- `SCORE_FILE`: absolute path on persistent storage, e.g. `/var/lib/seth/high-scores.json`.
- `ALLOWED_ORIGINS`: comma-separated game origins, e.g. `https://natsteff.github.io` (no path or trailing slash).
- `HOST`: bind address; defaults to `127.0.0.1`. Set `0.0.0.0` when required by the hosting platform.
- `PORT`: defaults to `8787`.
- `CLEAR_PASSWORD_HASH`: PBKDF2-SHA256 verifier, 210000 iterations, salt `seth-scores-clear-v1`, 32 bytes encoded as lowercase hex. Store as a server secret. The existing configured verifier can be copied from the legacy `verifyClearPassword` function in `src/scores.mjs`; the plaintext password is not needed or included in browser code.

Run `pnpm scores:server`. Put the service behind HTTPS. Mount persistent storage, back it up, and run one instance against the score file. Do not put the score file in the public game directory. With the default password protection, missing clear secret leaves clearing disabled while reads/saves work. Owners may explicitly set `clearPasswordRequired:false` in `server/config.json` to allow password-free shared clearing; an explicit confirmation is then still required. This is separate from frontend `game-config.json`, whose setting affects local browser records only. GitHub Pages hostnames never bypass shared-server authentication.

## Connect the game

Edit `public/game-config.json` before building (or the deployed `game-config.json` without rebuilding):

```json
{
  "serverHighScores": true,
  "scoreApiUrl": "https://your-score-host.example/api/scores"
}
```

The default is `false`: local High Scores opens directly, no list selector, server request or server warning. This is the correct configuration for the GitHub Pages Play Now version. GitHub Pages cannot run the score-saving service.

The URL is public, not a credential. Each deployment should use its own endpoint and score file. With a same-origin reverse proxy, use `/api/scores`, proxy those routes to the score server, and serve the built game normally. Build with `pnpm build`. Configuration load failure safely defaults to local-only mode.

Missing API configuration or network failure displays a server error; the independent local save still runs. Failed submissions stay in memory for retry while the page remains open. Reloading loses a pending server submission; any successful local save remains in the browser.

## Behavior and limits

The API assigns timestamps, validates run fields, recalculates scores, deduplicates run IDs, and centrally enforces the first-five shortcut limit. Write requests are limited to 20 per minute per direct client address, including clear attempts. Configure any reverse proxy limits accordingly; forwarded client-IP headers are deliberately not trusted. Inputs remain client-reported, so this casual leaderboard does not prove that a run was played honestly.

Old browser records sync on load, High Scores open and browser reconnect. Imports are idempotent by run ID; local records remain unchanged. Untimed legacy scores retain their validated historical score/date and no timer bonus.

GET `/api/scores` lists records. POST to that path submits a run. POST `/api/scores/import` imports one legacy record. POST `/api/scores/clear` accepts a JSON password, verifies it server-side and clears records by default. With explicit server opt-out, send `{ "confirm": true }` instead; GET metadata reports whether a password is required. Origin allowlisting applies to browser callers; it is not authentication. All responses disable caching.
