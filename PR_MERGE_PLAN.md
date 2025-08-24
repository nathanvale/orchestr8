# PR Merge Plan - @orchestr8 Repository

## Current PR Status

- **PR #1** (`npm-publishing-distribution`): ❌ CI failing - Prettier formatting issue
- **PR #3** (`e2e-publishing-validation`): ✅ CI passing
- **PR #4** (`husky-lint-staged-integration`): ✅ CI passing

## Important Notes

- PR #4 includes ALL commits from PR #1 plus additional changes
- PR #3 is independent with only 1 commit
- All PRs branch from the same main commit (464bedd)

---

## Option A: Clean Merge Strategy (Recommended)

### Phase 1: Merge PR #4 First

- [ ] 1. Switch to `husky-lint-staged-integration` branch

  ```bash
  git checkout husky-lint-staged-integration
  ```

- [ ] 2. Verify CI is still passing

  ```bash
  gh pr checks 4
  ```

- [ ] 3. Merge PR #4 into main

  ```bash
  gh pr merge 4 --squash --delete-branch
  ```

- [ ] 4. Pull latest main
  ```bash
  git checkout main
  git pull origin main
  ```

### Phase 2: Close PR #1 (Already Included in PR #4)

- [ ] 5. Close PR #1 without merging (changes already in main via PR #4)

  ```bash
  gh pr close 1 --comment "Changes merged via PR #4"
  ```

- [ ] 6. Delete the local and remote branch
  ```bash
  git branch -D npm-publishing-distribution
  git push origin --delete npm-publishing-distribution
  ```

### Phase 3: Rebase and Merge PR #3

- [ ] 7. Checkout `e2e-publishing-validation` branch

  ```bash
  git checkout e2e-publishing-validation
  ```

- [ ] 8. Rebase onto latest main

  ```bash
  git rebase main
  ```

- [ ] 9. Resolve any conflicts if they exist
  - Check for conflicts: `git status`
  - If conflicts exist:
    - Fix conflicts in each file
    - `git add <fixed-files>`
    - `git rebase --continue`

- [ ] 10. Force push the rebased branch

  ```bash
  git push --force-with-lease origin e2e-publishing-validation
  ```

- [ ] 11. Wait for CI to pass

  ```bash
  gh pr checks 3 --watch
  ```

- [ ] 12. Merge PR #3

  ```bash
  gh pr merge 3 --squash --delete-branch
  ```

- [ ] 13. Update main locally
  ```bash
  git checkout main
  git pull origin main
  ```

---

## Option B: Fix All PRs First Then Merge

### Phase 1: Fix PR #1

- [ ] 1. Checkout `npm-publishing-distribution`

  ```bash
  git checkout npm-publishing-distribution
  ```

- [ ] 2. Fix Prettier formatting

  ```bash
  cd packages/testing
  npx prettier --write src/benchmark-utils.ts
  ```

- [ ] 3. Commit and push fix

  ```bash
  git add src/benchmark-utils.ts
  git commit -m "Fix Prettier formatting in benchmark-utils.ts"
  git push origin npm-publishing-distribution
  ```

- [ ] 4. Wait for CI to pass

  ```bash
  gh pr checks 1 --watch
  ```

- [ ] 5. Merge PR #1
  ```bash
  gh pr merge 1 --squash --delete-branch
  ```

### Phase 2: Rebase PR #3

- [ ] 6. Checkout and rebase PR #3

  ```bash
  git checkout e2e-publishing-validation
  git rebase main
  ```

- [ ] 7. Push rebased branch

  ```bash
  git push --force-with-lease origin e2e-publishing-validation
  ```

- [ ] 8. Wait for CI and merge
  ```bash
  gh pr checks 3 --watch
  gh pr merge 3 --squash --delete-branch
  ```

### Phase 3: Rebase PR #4

- [ ] 9. Checkout PR #4

  ```bash
  git checkout husky-lint-staged-integration
  ```

- [ ] 10. Rebase onto main (will remove duplicate commits from PR #1)

  ```bash
  git rebase main
  ```

- [ ] 11. Resolve conflicts
  - Likely conflicts in:
    - `packages/testing/src/benchmark-utils.ts`
    - `packages/schema/src/validation/simple-benchmark.test.ts`
  - Keep the versions with performance flags

- [ ] 12. Push rebased branch

  ```bash
  git push --force-with-lease origin husky-lint-staged-integration
  ```

- [ ] 13. Wait for CI and merge
  ```bash
  gh pr checks 4 --watch
  gh pr merge 4 --squash --delete-branch
  ```

---

## Post-Merge Checklist

- [ ] Verify all PRs are closed

  ```bash
  gh pr list
  ```

- [ ] Clean up local branches

  ```bash
  git checkout main
  git branch -D npm-publishing-distribution
  git branch -D e2e-publishing-validation
  git branch -D husky-lint-staged-integration
  ```

- [ ] Verify main CI is green

  ```bash
  gh run list --branch main --limit 1
  ```

- [ ] Run full validation locally
  ```bash
  git pull origin main
  pnpm install
  pnpm check
  ```

---

## Rollback Plan (If Issues Arise)

If any merge causes problems:

1. Revert the problematic merge commit

   ```bash
   git revert <merge-commit-hash>
   git push origin main
   ```

2. Re-open the PR by restoring the branch

   ```bash
   git checkout -b <branch-name> <last-commit-before-merge>
   git push origin <branch-name>
   ```

3. Fix the issues and try again

---

## Notes for Decision Making

**Why Option A is Recommended:**

- Simpler: PR #4 already has all of PR #1's changes
- Faster: Only need to merge 2 PRs instead of 3
- Less risk: PR #4 CI is already passing
- Cleaner history: Fewer merge commits

**When to Use Option B:**

- If you want to preserve the individual PR history
- If PR #1 has important commit messages you want to keep
- If you prefer smaller, incremental merges

---

## Commands Quick Reference

```bash
# Check PR status
gh pr list
gh pr checks <pr-number>

# Merge PR
gh pr merge <pr-number> --squash --delete-branch

# Rebase branch
git checkout <branch>
git rebase main
git push --force-with-lease origin <branch>

# Clean up
git branch -D <branch-name>
git push origin --delete <branch-name>
```
