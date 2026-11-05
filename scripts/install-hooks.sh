#!/bin/sh
# Turns on this clone's hooks: tests and the personal-data scan before each commit, and the scan before each push.
set -e
cd "$(git rev-parse --show-toplevel)"
chmod +x .githooks/*
git config core.hooksPath .githooks
echo "Hooks installed. The scan reads scan-terms.txt from your data folder (see docs/data-layout.md)."
