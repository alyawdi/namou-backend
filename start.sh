#!/bin/sh
# Container entrypoint. Kept as a file rather than an inline shell chain because
# platforms differ in how they re-quote a command string (Render turns
# `sh -c "a && b"` into one argv entry, which then isn't found).
set -e

node dist/db/migrate.js

# Idempotent: the demo user upserts and the catalogue is skipped if present.
# Needed on every boot where the database starts empty (no persistent disk).
node dist/db/seed.js

exec node dist/server.js
