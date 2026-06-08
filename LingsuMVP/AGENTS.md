# Project Codex Instructions

## Collaboration Rules
- After every feature slice, update `docs/mvp-development-plan.md`.
- After every feature slice, report how to test it in clear steps.
- Keep MVP features real and connected. Avoid fake placeholders that look finished.
- Respect existing dirty worktree changes. Do not revert unrelated files.

## Token-Saving Workflow
- Prefer `codegraph context` and `codegraph affected` before reading large files.
- Use `rg -n -e ...` for precise searches.
- Read only relevant function ranges or nearby code instead of whole files.
- Update only the current slice's documentation lines instead of rereading or rewriting the full plan.
- Validate with targeted commands and summarize results instead of pasting large diffs.

## UI / UX Preferences
- UI must not overlap, clip Chinese text, hide buttons, or block clicks.
- MVP test UI can be simple, but it must be logically organized and usable.
- Keep controls compact and clear. Avoid putting long descriptions in dense operational screens.
- Put detailed role descriptions and skill text in role detail/roster views, not formation or battle controls.

## Lingsu MVP Domain Boundaries
- `角色阁` owns character attributes, recruited roster, star-up, team formation, and skill inspection.
- `招贤阁` owns recruitment.
- `灵素图谱` must read the actual formation and use it in battle.
- `商店`, `背包`, and `任务榜` should keep their responsibilities separate.

## Verification Habit
- Run `codegraph affected` on changed core files when possible.
- Run `git diff --check -- <changed files>` before reporting completion.
- If Unity compile/play-mode verification was not run, say so directly.
