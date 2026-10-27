# Shared leaderboard deployment

Every game deployment needs its own score API and persistent SQLite database. All players of that deployment share those scores; independently hosted copies should use separate databases. A separate This PC list preserves browser scores. Old browser scores are not uploaded; only new submitted runs attempt both lists.

## Run the server

Use Node 24 LTS. No extra dependencies are needed.

Set these server environment variables:

- `DB_PATH`: absolute path on persistent storage, e.g. `/var/lib/seth/scores.sqlite`.
- `ALLOWED_ORIGINS`: comma-separated game origins, e.g. `https://natsteff.github.io` (no path or trailing slash).
- `HOST`: bind address; defaults to `127.0.0.1`. Set `0.0.0.0` when required by the hosting platform.
- `PORT`: defaults to `8787`.
- `CLEAR_PASSWORD_HASH`: PBKDF2-SHA256 verifier, 210000 iterations, salt `seth-scores-clear-v1`, 32 bytes encoded as lowercase hex. Store as a server secret. The existing configured verifier can be copied from the legacy `verifyClearPassword` function in `src/scores.mjs`; the plaintext password is not needed or included in browser code.

Run `pnpm scores:server`. Put the service behind HTTPS. Mount persistent storage, back it up, and run one instance against the database. Do not put the database in the public game directory. Without the clear secret, reads/saves work and clearing stays disabled.

## Connect the game

Build with `VITE_SCORE_API_URL=https://your-score-host.example/api/scores pnpm build`.
This is a public endpoint URL, not a credential. Use that deployment's own API URL. For a game and API behind the same reverse proxy, use `/api/scores`. Proxy those routes to the score server and serve the built game normally. GitHub Pages needs a separately hosted score service because it cannot execute the server.

Missing API configuration or network failure displays a server error; the independent local save still runs. Failed submissions stay in memory for retry while the page remains open. Reloading loses a pending server submission; any successful local save remains in the browser.

## Behavior and limits

The API assigns timestamps, validates run fields, recalculates scores, deduplicates run IDs, and centrally enforces the first-five shortcut limit. Write requests are limited to 20 per minute per direct client address, including clear attempts. Configure any reverse proxy limits accordingly; forwarded client-IP headers are deliberately not trusted. Inputs remain client-reported, so this casual leaderboard does not prove that a run was played honestly.

GET `/api/scores` lists records. POST to that path submits a run. POST `/api/scores/clear` accepts a JSON password, verifies it server-side and clears records. Origin allowlisting applies to browser callers; it is not authentication. All responses disable caching.
