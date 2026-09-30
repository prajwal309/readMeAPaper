#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/prajwal309/readMeAPaper.git"
COMMIT_MESSAGE="${1:-Update readMeAPaper}"

echo "==> Preparing readMeAPaper commit..."

# Initialize Git if this directory is not already a repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "==> Initializing Git repository..."
    git init
fi

# Add origin if it doesn't exist.
# If origin exists but points elsewhere, stop rather than accidentally
# pushing this project to the wrong repository.
if git remote get-url origin >/dev/null 2>&1; then
    CURRENT_REMOTE="$(git remote get-url origin)"

    if [[ "$CURRENT_REMOTE" != "$REPO_URL" && \
          "$CURRENT_REMOTE" != "git@github.com:prajwal309/readMeAPaper.git" ]]; then
        echo "ERROR: 'origin' currently points to:"
        echo "  $CURRENT_REMOTE"
        echo
        echo "Expected:"
        echo "  $REPO_URL"
        echo
        echo "Fix it with:"
        echo "  git remote set-url origin $REPO_URL"
        exit 1
    fi
else
    echo "==> Adding GitHub remote..."
    git remote add origin "$REPO_URL"
fi

# Stage all new, modified, and deleted files
echo "==> Staging files..."
git add -A

# Don't create an empty commit
if git diff --cached --quiet; then
    echo "==> No changes to commit."
    exit 0
fi

echo "==> Files being committed:"
git status --short

echo
echo "==> Creating commit..."
git commit -m "$COMMIT_MESSAGE"

# Determine current branch
BRANCH="$(git branch --show-current)"

# New repository may not yet have a branch name
if [[ -z "$BRANCH" ]]; then
    BRANCH="main"
    git branch -M main
fi

echo
echo "==> Pushing branch '$BRANCH' to GitHub..."
git push -u origin "$BRANCH"

echo
echo "✓ Successfully committed and pushed to:"
echo "  https://github.com/prajwal309/readMeAPaper"