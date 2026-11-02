#!/bin/sh
# Project-local Firebase CLI; never defaults to a production project implicitly.
set -eu
cd "$(dirname "$0")"
firebase_runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if ! command -v node >/dev/null 2>&1 && [ -x "$firebase_runtime/node" ]; then
 export PATH="$firebase_runtime:$PATH"
fi
exec node node_modules/firebase-tools/lib/bin/firebase.js "$@"
