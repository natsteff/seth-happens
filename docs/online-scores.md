# Online high scores

Version1.0.6 enables Firebase online scores with preserved device scores and automatic device-list fallback. Firebase rules/indexes are installed; this is an online feature, not offline installation support. Existing optional Node/JSON server support is retained for other installations.

## Player behavior

Online combines imported and new scores; This device remains separate. Historical provenance remains internal. New results save locally and enter a persistent online queue; a queued result is not yet a confirmed online save. Retry/reopening/foreground return resumes pending work. Eligible existing nicknames and records sync automatically without deleting the originals or requiring import/sync buttons. Unreadable/invalid records are preserved, not overwritten or guessed.

Historical scores retain their stored total/date; missing timing/bonus is shown as unknown. This route has a120second current deadline; earlier untimed or up-to180second records retain historical provenance internally. New records require a completed beer delivery (except the established shortcut) and the existing score formula. Current score/physics rules, remembered-name entry and device score clearing are unchanged.

Legitimate scores rank by descending total, then earliest achievement and stable ID. Five distinct shortcut names appear after legitimate scores with the fixed −10,000 total. Each name’s best run is retained while its original admission date is preserved. Browser clocks and reported gameplay are not proof of honest play.

Previously saved local-only opt-outs remain respected; choosing Online re-enables automatic sync. The device tab is a view, not a sync switch. Previously shared records remain shared. Local clear does not delete online records or the pending outbox. See the in-game Privacy & migration page for disclosure and owner contact/deletion guidance.

## Installation and security

Use Firebase Spark, anonymous Authentication (auto-cleanup off), Firestore Standard/default database. No Google Analytics SDK initialization, Cloud Functions, paid backup/TTL service, dedicated server or offline PWA is added. The Firebase Web config in `public/game-config.json` is public configuration, not an administrative key.

`firebase/firestore.rules` is default-deny and limits access to this game's paths. It enforces types/fields, private metadata ownership, component-based new-score totals, beer/deadline, per-UID pacing and rolling24hour limits (60new/100historical), and bounded transactional record-book changes. Permanent dedup receipts are immutable; clients cannot arbitrarily edit other scores. Rules tests run against local emulators. Only signed-in anonymous clients may read the public record book; legacy board queries are bounded during the upgrade transition. Private installation/receipt data cannot be listed or read by other clients; owner reporting uses separate administrative access. No client can clear the shared board.

These are casual-hobby protections. New anonymous identities can bypass per-UID limits; they do not provide strong global rate limits or authoritative gameplay verification. App Check is not configured/enforced in this batch. Consider it separately before broad promotion, without silently enabling billing. Quota failure falls back to local/pending rather than a paid upgrade.

Database paths are under `games/beer-run`; boards are `live` and `historical`. `receipts`, `budgets`, `slots`, `installations` are private operational collections. This game's rules must be merged with existing rules if a Firebase project also hosts another game; never overwrite another game's access policy blindly.

Deploy only the reviewed Firestore rules/indexes to the intended project. The checked-in Firebase CLI configuration has no Hosting target and no default project alias; supply `--project seth-happens` explicitly. Do not upload emulator/test state. Once indexes are ready, change only `onlineScores.enabled` to true in approved game configuration and release the reviewed game build through its normal process. Do not put service-account credentials in browser files.

## Validation and reporting

Dependencies install with `pnpm install --frozen-lockfile`. Run `pnpm test` and `pnpm build`. Java21+ is needed only for the Firestore emulator; it is not needed by players. Run Firebase emulators with `--project demo-seth-happens`, then `pnpm test:firebase`. For a separate local UI preview use `VITE_SCORE_EMULATOR=1 pnpm dev -- --port 5176`; this override is development-only and routes Auth/Firestore to loopback emulators, never production.

`pnpm scores:report` is an owner-only local summary using Application Default Credentials (e.g. an existing local `gcloud auth application-default login`), not a service running on Pages. Never share an admin key to run it. With `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` it reads only the demo emulator. It prints aggregate observed-installation/migration/duplicate/failure/new-online-use counts, not private IDs or nicknames. Actual imported totals are derived from stored score documents; reported conversion/error state is best-effort client data, not audited analytics or unique-person counts. Browsers that never reconnect cannot be counted.

Review private diagnostics for manual removal after90days; there is no automated retention job. Keep owner backups separately before deleting shared data. No broader Player & Device Statistics or sessions/device profiling is included.

## Bounded record book (prepared locally; activation required)

The active device and shared lists keep 25 normal runs and five distinct shortcut nicknames. The first ten normal scores are shown initially. Normal scores rank by score, then earliest achievement; shortcut names are trimmed/case-insensitive and retain the fastest run, then fewest combined falls/squishes/bumps, then oldest achievement. Known timing outranks unknown legacy timing. Each name’s earliest achievement stays separate from its winning run, preserving first-five-name admission. Stable IDs break remaining ties.

The exact saved run receives a YOUR RUN badge/highlight if listed, including after online acknowledgment. Another run with the same name is never highlighted in its place.

Local compaction preserves the original storage bytes under `seth-happens-scores-v1-before-retention-v2` before pruning; unreadable/conflicting data or backup failures refuse cleanup. The backup is recovery-only and is not automatically re-imported. Pending outbox payloads remain until resolved; terminal jobs compact to metadata receipts and new-run markers lose full score copies. Recovery checkpoints hold hashes, not full-score archives.

The shared book is one transactionally updated document (`games/beer-run/record-book/current`) containing at most 25 normal and five shortcut entries. Immutable `seen-runs` receipts keep only digest/source/time metadata so pruned submissions cannot return through retries. Rules allow only a qualifying insertion/cutoff replacement or a same-name shortcut improvement; other rows/order stay unchanged. Clients cannot clear, arbitrarily delete or bootstrap the book. Budgets still enforce 60 new/100 historical accepted submissions per rolling day with pacing. Reads use one server request and subsequent pages reuse that snapshot.

The record book opens immediately with cached Online data and background refresh; failed reads without cache fall back to the clearly labelled device list after eight seconds. Every opening defaults Online, with deliberate device selection respected for the visit. Migration recovery only processes changed records and pending jobs. Cache writes/status reporting do not block scores; timeout does not claim cancellation or acknowledgment.

### Owner activation / rollback

1. Keep the old release available; prepare/test the new client and rules together. Deploy the reviewed `firestore.rules` to the existing project. Once the bounded book exists these rules freeze old-client legacy writes; old clients retain their local fallback until update.
2. Run a dry run with a new private backup path: `node scripts/migrate-record-book.mjs --firebase-cli --backup /private/path/scores-before-upgrade.json`. This uses the existing local Firebase CLI sign-in; no keys/tokens go in source. ADC also works without `--firebase-cli`.
3. Run with a fresh backup path plus `--apply` for the approved activation. A verified byte-preserving backup precedes any deletion. Seed permanent receipts for every original ID, including dropped records; transactionally recheck the legacy snapshot and create the bounded book. Abort on changed/conflicting records, existing activation or backup failure. Delete only the backed-up legacy score documents after activation; existing private receipts/metrics are preserved. Then publish the new client and verify live results.
4. An interrupted legacy cleanup is safe: the active book is already bounded, and the saved backup identifies remaining old documents. Do not rerun migration over an active book; inspect/resume only those backed-up legacy documents.
5. Recovery: `node scripts/migrate-record-book.mjs --firebase-cli --restore /private/path/scores-before-upgrade.json` previews restoration; add `--apply` to restore absent originals only. Conflicting existing records are refused and the active book remains unchanged. Rolling back the client/rules/book itself requires a separate reviewed operation preserving any post-upgrade submissions.

No live migration/cleanup or publication is implied by preparing this release. Backups must remain private and must never be added to the public repository. The one-time backup and pending submissions are exceptions to active-list bounds; permanent dedup receipts contain no full score payload.
