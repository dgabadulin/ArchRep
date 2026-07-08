#!/bin/sh
set -e
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --msg-filter "sed -e '/^Co-authored-by: Cursor /d' -e '/^Made-with: Cursor/d'" -- --all
rm -rf .git/refs/original/
