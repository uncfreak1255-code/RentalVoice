# Codex Desktop workflow for Rental Voice

Last updated: 2026-04-05

## What is true in this repo

- `/Users/sawbeck/Projects/RentalVoice` is the sync checkout.
- Local `main` is not the place to do feature work.
- `guardrail-preflight` fails on root `main` by design because `main` is protected.
- Safe implementation work belongs on `codex/*` branches in isolated worktrees.
- Current observed safe worktrees already live under `/Users/sawbeck/.codex/worktrees/`.

## What "Create permanent worktree" is for

In Codex Desktop, "Create permanent worktree" is the safe way to give one thread its own long-lived workbench.

Use it when:

- the thread will touch code
- you may come back to the thread later
- you want a real branch you can commit from
- you do not want the thread drifting back to dirty root `main`

What it protects you from:

- giant accidental commits from the root checkout
- mixing unrelated unstaged files into the task
- losing track of which branch the thread actually belongs to

Practical translation:

- root `main` = filing cabinet
- permanent worktree = workbench
- commit dialog = shipping label

Do not pack the filing cabinet because the shipping label popped up.

## What `using-superpowers` does and does not do

`using-superpowers` is a process rule. It tells the agent to check and use the right skills before acting.

It does:

- force skill checking
- push the agent toward the right workflow skill
- reduce random ad hoc behavior

It does not:

- move the thread off `main`
- create a safe feature branch by itself
- clean a dirty checkout
- stop a bad commit dialog from showing the wrong diff

For this repo, the actual safety stack is:

1. `using-superpowers` to force workflow discipline
2. `using-git-worktrees` to create isolated workspace
3. `/Users/sawbeck/bin/guardrail-preflight` to verify branch safety
4. commit only from the feature worktree, never root `main`

If you expect `using-superpowers` alone to handle git safety, that is like expecting a checklist to buckle the seatbelt for you.

## Rental Voice default workflow

1. Start in `/Users/sawbeck/Projects/RentalVoice`.
2. Treat root `main` as sync-only.
3. For any real task, create or reuse a permanent worktree on a `codex/*` branch.
4. Run `/Users/sawbeck/bin/guardrail-preflight` inside that worktree.
5. Do the work there.
6. Verify there.
7. Commit there.
8. Push and PR from there.
9. After merge, clean up the worktree.

## What to do in Codex Desktop

If a thread is just discussion:

- staying on root is fine

If a thread will edit files:

- use "Create permanent worktree"
- or ask the agent to create a worktree before editing

If the commit dialog says `main`:

- stop
- do not commit
- check which checkout the thread is attached to

If `Include unstaged` is on:

- assume danger until proven otherwise

If the diff size looks absurd for the task:

- stop
- you are probably looking at the wrong checkout

## Observable red flags from current repo state

These are not hypothetical. They exist right now.

- Root checkout `/Users/sawbeck/Projects/RentalVoice` is dirty on `main`.
- `guardrail-preflight` fails on root `main` because the branch is protected.
- There are multiple temporary detached worktrees under `/Users/sawbeck/.codex/worktrees/`.
- There is also a real feature worktree at `/Users/sawbeck/.codex/worktrees/rv-draft-telemetry/RentalVoice` on `codex/draft-telemetry`.

That means the app can show you a commit dialog from the wrong place if you do not pin the thread to the right worktree.

## Simple personal rule set

- Never commit from a dialog that says `main`.
- Never trust a huge diff just because it appeared in the current thread.
- Never assume "this session" equals "this branch".
- For code work, one thread should belong to one worktree.
- If you are unsure, ask for `git status`, current branch, and worktree path before committing.

## Minimum commands worth remembering

Check where you really are:

```bash
pwd
git status --short --branch
git worktree list
```

Verify the branch is safe:

```bash
/Users/sawbeck/bin/guardrail-preflight
```

## Bottom line

Use "Create permanent worktree" for any thread that is going to edit code seriously.

`using-superpowers` helps the agent choose the right workflow.
It is not the workflow.
