# last-mile-dev

A diff-based memory generator for AI coding tools. It learns your coding preferences from the edits you make to AI-generated code.

When an AI tool writes code for you, you rarely ship it as-is. You rename a variable, flatten a nested conditional, swap `any` for `unknown`, reorder the imports. These edits encode real preferences, but the AI never sees them. Next time, it makes the same choices you just fixed.

AI coding tools take instructions from static rule files. last-mile-dev generates those rules automatically by diffing AI-generated code against what you actually commit and extracting recurring patterns from the delta. One-time changes get filtered out. Preferences that recur across multiple commits get promoted into a portable code style profile you can feed back into any AI tool.

Static rules can also drift from actual behavior. What you think you prefer and what you actually do can diverge. And static files don't update themselves when your preferences shift. last-mile-dev's confidence scoring handles this: patterns you haven't reinforced in 90 days decay and drop out of exports.

The overall concept comes from [last-mile](https://github.com/dvelton/last-mile), which does the same thing for prose.

## How it works

```
AI writes code ──> You snapshot it ──> You edit and commit
                                             │
                                             ▼
                          last-mile-dev diffs the AI version
                          against what you committed, extracts
                          patterns, and updates your profile
                                             │
                                             ▼
                        Profile feeds back into your AI tools
                        as copilot-instructions.md or CLAUDE.md
```

A pattern only becomes a rule after it appears consistently across multiple commits. One-time changes (bug fixes, context-specific edits) stay below the threshold. Recurring edits (you always flatten nested conditionals, you always use `import type`) get promoted.

## Setup

```bash
git clone https://github.com/dvelton/last-mile-dev.git
cd last-mile-dev
npm install
npm run build
npm link
```

Then in any project:

```bash
cd your-project
last-mile-dev init
```

This creates a `.last-mile-dev/` directory in your repo (auto-added to `.gitignore`) and installs a git post-commit hook.

## Usage

### 1. Snapshot AI-generated code

After an AI tool creates or modifies files, snapshot them:

```bash
last-mile-dev snapshot src/auth.ts src/utils.ts
```

This saves a copy of the AI's version. You can also use watch mode to auto-snapshot:

```bash
last-mile-dev watch
```

### 2. Edit and commit normally

Make whatever changes you want to the code. Commit when ready. The post-commit hook automatically detects which snapshots match the committed files.

### 3. Learn from your edits

```bash
# See what patterns were detected (read-only)
last-mile-dev learn

# Save patterns and update your profile
last-mile-dev learn --apply
```

### 4. Export for your AI tools

```bash
# GitHub Copilot
last-mile-dev profile --export copilot-instructions

# Claude Code
last-mile-dev profile --export claude
```

### 5. Check status

```bash
last-mile-dev status
```

## The code style profile

The profile is a plain markdown file containing rules extracted from your actual edits. After a few dozen snapshots, it might look like:

```markdown
# Code Style Profile
*Based on 14 commits across 8 snapshots*

## Syntax Preferences
- Use arrow function expressions (`const fn = () => {}`) instead of function declarations.
- Prefer object destructuring over repeated property access.
- Use template literals instead of string concatenation.

## Control Flow
- Use early returns (guard clauses) instead of nested if/else blocks.
  Check for the error case and return early, keeping the main logic
  at the top indentation level.

## Type System
- Use `unknown` instead of `any`. Narrow the type with type guards before using the value.
- Use `import type` when importing types that are not used as values.
- Add explicit return type annotations to functions, especially exported ones.

## Error Handling
- Never use empty catch blocks. At minimum, log the error or add a comment
  explaining why it is intentionally ignored.
- When rethrowing or wrapping errors, include the original error as `cause`.
```

Because the profile is just markdown, it works with any AI tool. The `--export` command formats it for specific tools, but the rules are the same.

## What it detects

last-mile-dev ships with detectors for common coding patterns:

**Formatting**: semicolons, quote style, trailing commas

**Imports**: `import type` usage, import ordering/grouping

**Type system**: `unknown` over `any`, `type` vs `interface`, explicit return types, `as const`, explicit type annotations

**Syntax**: arrow functions vs declarations, destructuring, optional chaining, nullish coalescing, template literals, object shorthand

**Control flow**: guard clauses, early returns

**Error handling**: empty catch blocks, error cause chaining

**Async**: `async/await` over `.then()` chains

**Naming**: boolean prefixes (`is`, `has`, `can`)

**Comments**: removing redundant comments, adding JSDoc

**Structure**: named exports over default exports

## How confidence works

A pattern needs to clear three thresholds before becoming a rule:

1. At least 3 occurrences (you made the same kind of edit three times)
2. Across at least 2 different commits (not just one big refactor)
3. A confidence score above 0.6 (factoring in support count, commit spread, and recency)

Patterns that haven't been seen in 90 days are marked stale and excluded from exports.

This filtering solves the main problem with learning from code edits: many edits are bug fixes, not style preferences. Bug fixes are one-off. Style preferences recur.

## Storage

Everything lives in `.last-mile-dev/` at the root of your repo:

```
.last-mile-dev/
├── meta.json          # learning statistics
├── patterns.json      # extracted patterns with frequency data
├── profile.md         # the generated code style profile
└── snapshots/         # AI-generated file versions
    └── 2026-04-16T12-03-22_a1b2c3/
        ├── manifest.json
        └── files/
            └── src__auth.ts.ai
```

The `.last-mile-dev/` directory is added to `.gitignore` during init. Your patterns and profile are local to your machine.

## CLI reference

```
last-mile-dev init                             Initialize in current git repo
last-mile-dev snapshot <files...>              Snapshot AI-generated file state
last-mile-dev learn                            Show detected patterns (read-only)
last-mile-dev learn --apply                    Save patterns and update profile
last-mile-dev profile                          Show current code style profile
last-mile-dev profile --raw                    Output raw markdown
last-mile-dev profile --reset                  Reset the profile
last-mile-dev profile --export <format>        Export as copilot-instructions or claude
last-mile-dev status                           Show learning statistics
last-mile-dev watch                            Watch for changes and auto-snapshot
```

## Integrating with AI tools

### GitHub Copilot CLI / Copilot in VS Code

After running `last-mile-dev profile --export copilot-instructions`, your learned preferences are written to `.github/copilot-instructions.md`, which Copilot reads automatically.

### Claude Code

Run `last-mile-dev profile --export claude` to generate a `CLAUDE.md` file that Claude Code reads at session start.

### Other tools

Run `last-mile-dev profile --raw` and pipe or paste the output into any tool that accepts custom instructions.

## Language support

Currently supports TypeScript, JavaScript, and Python file detection. The pattern detectors focus on TypeScript/JavaScript patterns. Python-specific detectors are planned.

The architecture uses file-extension-based language detection and language-aware pattern extraction, making it straightforward to add detectors for additional languages.

## License

MIT
