#!/usr/bin/env bash
set -euo pipefail

REPO_PATH_DEFAULT="YOUR_GH_USER/YOUR_REPO"
PKG_NAME_DEFAULT="PACKAGE_NAME_HERE"

read -rp "GitHub repo path (e.g. youruser/yourrepo) [${REPO_PATH_DEFAULT}]: " GH_REPO
GH_REPO=${GH_REPO:-$REPO_PATH_DEFAULT}

if [ -f package.json ]; then
  PKG_NAME=$(node -e "try{console.log(require('./package.json').name||'') }catch{console.log('') }")
else
  PKG_NAME=""
fi
if [ -z "$PKG_NAME" ]; then
  read -rp "Package name [${PKG_NAME_DEFAULT}]: " PKG_NAME
  PKG_NAME=${PKG_NAME:-$PKG_NAME_DEFAULT}
fi

files=( ".changeset/config.json" ".changeset/initial-setup.md" )
for f in "${files[@]}"; do
  if [ -f "$f" ]; then
    sed -i.bak "s#YOUR_GH_USER/YOUR_REPO#${GH_REPO}#g" "$f"
    sed -i.bak "s#PACKAGE_NAME_HERE#${PKG_NAME}#g" "$f"
    rm -f "${f}.bak"
  fi
done

echo "✅ Replaced placeholders."

if [ ! -d ".husky/_" ]; then
  bunx husky init
fi

bun add -d changesets commitizen cz-git commitlint @commitlint/config-conventional @changesets/changelog-github husky lint-staged >/dev/null

echo "🎉 Setup complete."
