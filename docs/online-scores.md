# Online high scores

Version1.0.6 enables Firebase online scores with preserved device scores and automatic device-list fallback. Firebase rules/indexes are installed; this is an online feature, not offline installation support. Existing optional Node/JSON server support is retained for other installations.

## Player behavior

Online combines imported and new scores; This device remains separate. Historical provenance remains internal. New results save locally and enter a persistent online queue; a queued result is not yet a confirmed online save. Retry/reopening/foreground return resumes pending work. Eligible existing nicknames and records sync automatically without deleting the originals or requiring import/sync buttons. Unreadable/invalid records are preserved, not overwritten or guessed.

Historical scores retain their stored total/date; missing timing/bonus is shown as unknown. This route has a120second current deadline; earlier untimed or up-to180second records belong only to Historical. New records require a completed beer delivery (except the established shortcut) and the existing score formula. Current score/physics rules, remembered-name entry and device score clearing are unchanged.

Legitimate scores rank by descending total, then claimed finish time and stable ID. The combined view shows the earliest five claimed shortcut dates across both sources. New online shortcut submissions still have five centrally reserved acceptance slots; the fixed-10000score always comes after legitimate scores. Browser clocks and reported gameplay are not proof of honest play.

Previously saved local-only opt-outs remain respected; choosing Online re-enables automatic sync. The device tab is a view, not a sync switch. Previously shared records remain shared. Local clear does not delete online records or the pending outbox. See the in-game Privacy & migration page for disclosure and owner contact/deletion guidance.

## Installation and security

Use Firebase Spark, anonymous Authentication (auto-cleanup off), Firestore Standard/default database. No Google Analytics SDK initialization, Cloud Functions, paid backup/TTL service, dedicated server or offline PWA is added. The Firebase Web config in `public/game-config.json` is public configuration, not an administrative key.

`firebase/firestore.rules` is default-deny and limits access to this game's paths. It enforces types/fields, ownership/private receipts, immutable scores, component-based new-score totals, beer/deadline, per-UID pacing and rolling24hour limits (60new/100historical), and atomic live shortcut slots. Rules tests run against local emulators. Only signed-in anonymous clients may read bounded public board queries. Private installation/receipt data cannot be listed or read by other clients; owner reporting uses separate administrative access. No client can clear the shared board.

These are casual-hobby protections. New anonymous identities can bypass per-UID limits; they do not provide strong global rate limits or authoritative gameplay verification. App Check is not configured/enforced in this batch. Consider it separately before broad promotion, without silently enabling billing. Quota failure falls back to local/pending rather than a paid upgrade.

Database paths are under `games/beer-run`; boards are `live` and `historical`. `receipts`, `budgets`, `slots`, `installations` are private operational collections. This game's rules must be merged with existing rules if a Firebase project also hosts another game; never overwrite another game's access policy blindly.

Deploy only the reviewed Firestore rules/indexes to the intended project. The checked-in Firebase CLI configuration has no Hosting target and no default project alias; supply `--project seth-happens` explicitly. Do not upload emulator/test state. Once indexes are ready, change only `onlineScores.enabled` to true in approved game configuration and release the reviewed game build through its normal process. Do not put service-account credentials in browser files.

## Validation and reporting

Dependencies install with `pnpm install --frozen-lockfile`. Run `pnpm test` and `pnpm build`. Java21+ is needed only for the Firestore emulator; it is not needed by players. Run Firebase emulators with `--project demo-seth-happens`, then `pnpm test:firebase`. For a separate local UI preview use `VITE_SCORE_EMULATOR=1 pnpm dev -- --port 5176`; this override is development-only and routes Auth/Firestore to loopback emulators, never production.

`pnpm scores:report` is an owner-only local summary using Application Default Credentials (e.g. an existing local `gcloud auth application-default login`), not a service running on Pages. Never share an admin key to run it. With `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` it reads only the demo emulator. It prints aggregate observed-installation/migration/duplicate/failure/new-online-use counts, not private IDs or nicknames. Actual imported totals are derived from stored score documents; reported conversion/error state is best-effort client data, not audited analytics or unique-person counts. Browsers that never reconnect cannot be counted.

Review private diagnostics for manual removal after90days; there is no automated retention job. Keep owner backups separately before deleting shared data. No broader Player & Device Statistics or sessions/device profiling is included.

## Loading and incremental sync

The record book opens immediately. Saved Online results appear while a server refresh runs; without a cache, an unsuccessful server read falls back to the clearly labelled device list after eight seconds. Every opening defaults to Online, and choosing This device during that visit is respected.

Migration has a durable change checkpoint. Unchanged legacy storage is not reparsed/re-enqueued on later startups; changed records and interrupted submissions recover idempotently. Confirmed acknowledgments and below-cutoff decisions remain terminal. Independent board queries run together, concurrent identical requests share one operation, and cache writes/private status reporting never block showing scores or submitting the next result. Timed-out submissions remain pending because the underlying Firebase operation may still complete; stable IDs protect retries.

Before normal-score uploads, the client reads up to 25 normal entries per source and computes the combined top-25 cutoff, including date/ID ties. The cutoff is reused for a minute and updated with acknowledged runs. Nonqualifying candidates remain on the device without repeated upload attempts. This is an admission optimization, not server-enforced retention: existing immutable online documents are not pruned by this release. Full bounded retention and distinct-name shortcut ranking remain separate work.
