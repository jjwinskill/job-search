#!/bin/sh
# Turns on the pre-push personal-data scan for this clone.
set -e
cd "$(git rev-parse --show-toplevel)"
chmod +x .githooks/pre-push
git config core.hooksPath .githooks
echo "Pre-push scan installed. It reads scan-terms.txt from your data folder (see docs/data-layout.md)."
