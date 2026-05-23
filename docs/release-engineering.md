# Release Engineering — Deploy Center

Operational checklist for maintaining the CI / branch-protection / release
process introduced in v3.0 (F-010). Sources of truth:
[Constitution](../../.specify/memory/constitution.md) §Governance and
[spec.md](../../specs/001-v3-foundation/spec.md) FR-037..FR-039.

---

## Branch protection on `main` (one-time setup after first CI green)

**Where**: GitHub → Settings → Branches → "Add rule" / "Edit" for `main`.

| Setting | Value | Rationale |
| ------- | ----- | --------- |
| Branch name pattern | `main` | Production branch |
| Require a pull request before merging | ✅ | Constitution Principle III/VI: review gate |
| Required approving reviews | **1** | Spec FR-039 |
| Dismiss stale pull request approvals when new commits are pushed | ✅ | Forces re-review after force-push or rebase |
| Require status checks to pass before merging | ✅ | Spec FR-037 + FR-039 |
| Require branches to be up to date before merging | ✅ | Avoid silent merge of stale-on-main branch |
| Required status checks | `server`, `client`, `coverage-bypass-check` (from `.github/workflows/ci.yml`) | The three jobs gate merge |
| Require conversation resolution before merging | ✅ | Don't merge with unresolved review comments |
| Require signed commits | optional (recommended) | Tighter authorship audit |
| Require linear history | ✅ | Cleaner `git log`, easier rollback |
| Restrict who can push to matching branches | (leave empty for solo; restrict to maintainers when team grows) | — |
| Allow force pushes | ❌ | Never force-push `main` |
| Allow deletions | ❌ | Never delete `main` |

**Verification**: open a draft PR with a deliberately failing change → confirm
the merge button is disabled until CI is green AND ≥ 1 approval lands.

---

## Coverage-gate bypass workflow (FR-037b)

Bypass exists for **genuine emergencies only** (production hotfix where
adding tests would block the fix). Misuse erodes the constitution.

1. PR author requests bypass in the PR description with rationale.
2. **Repo Admin** (the only role allowed) applies the literal label
   `ci-skip-coverage` to the PR.
3. Re-trigger CI (or push an empty commit).
4. The `coverage-bypass-check` job:
   - Verifies the label exists.
   - Calls `gh api repos/:owner/:repo/collaborators/:actor/permission`
     against the actor who applied the label.
   - Sets job output `skip=true` only if `permission == 'admin'`.
5. The bypass is logged in the CI run summary (`::notice::⚠ Coverage gate
   bypassed by @<actor>`) — visible in the PR Checks tab forever.
6. Author MUST file a follow-up issue tagged `coverage-debt` to add the
   missing tests before the next release.

**Audit**: quarterly, grep CI run summaries for "Coverage gate bypassed"
and confirm every entry has a closed `coverage-debt` issue.

---

## Release tagging procedure (per `tasks.md` T098–T099)

```bash
# RC
git tag v3.0.0-rc.1 -m "v3.0.0 release candidate 1"
git push origin v3.0.0-rc.1

# Smoke retest on staging (~30 min), per specs/001-v3-foundation/quickstart.md.
# If green:

git tag v3.0.0 -m "v3.0 — Foundation release"
git push origin v3.0.0
gh release create v3.0.0 --generate-notes --notes-file server/docs/migration-v2-to-v3.md
```

Post-tag: announce in operator channels; close all `v3.0` milestone issues.

---

## Hotfix branching (post-GA)

```bash
git checkout -b hotfix/v3.0.1 v3.0.0
# cherry-pick fix commits from main
git tag v3.0.1
```

Hotfixes MUST pass the same CI gates as `main` PRs. Constitution coverage
gate is NOT relaxed for hotfixes.
