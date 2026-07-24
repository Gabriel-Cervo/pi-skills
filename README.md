# Pi Skills & Extensions

A collection of skills and extensions for [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Skills are compatible with Claude Code, Codex CLI, Amp, and Droid.

## Installation

### pi-coding-agent

```bash
# Install as a pi package (recommended)
pi install git:github.com/Gabriel-Cervo/pi-skills

# Or clone manually and point pi at it
git clone https://github.com/Gabriel-Cervo/pi-skills ~/pi-skills
# Then add to ~/.pi/agent/settings.json:
# { "packages": ["~/pi-skills"] }
```

### Claude Code

Claude Code only looks one level deep for `SKILL.md` files, so symlink individual skills:

```bash
git clone https://github.com/Gabriel-Cervo/pi-skills ~/pi-skills

mkdir -p ~/.claude/skills
ln -s ~/pi-skills/skills/good-writing ~/.claude/skills/good-writing
ln -s ~/pi-skills/skills/grilling ~/.claude/skills/grilling
ln -s ~/pi-skills/skills/grill-me ~/.claude/skills/grill-me
ln -s ~/pi-skills/skills/handoff ~/.claude/skills/handoff
ln -s ~/pi-skills/skills/herdr ~/.claude/skills/herdr
ln -s ~/pi-skills/skills/librarian ~/.claude/skills/librarian
ln -s ~/pi-skills/skills/writing-great-skills ~/.claude/skills/writing-great-skills
```

### Codex CLI

```bash
git clone https://github.com/Gabriel-Cervo/pi-skills ~/pi-skills
# Skills are in ~/pi-skills/skills/ — add that directory to your Codex skills config
```

### Project configuration

The repository includes shared project settings in [.pi/settings.json](.pi/settings.json). Pi also discovers the Tokyo Night Moon theme from [.pi](.pi).

Installing this repository as a Pi package also installs and loads [Pi-Herdr-Subagents](https://github.com/Gabriel-Cervo/Pi-Herdr-Subagents) through its bundled package dependency. The bundled package provides the `Agent`, `get_subagent_result`, and `steer_subagent` tools, the `/agents` manager, and its Herdr skill. `.pi/settings.json` is project-local configuration and is not required for package installation.

Pi-Herdr-Subagents supports interactive Herdr panes plus headless Pi and Claude foreground/background execution. Write-capable runs receive dedicated Git worktrees. Interactive sibling panes use compact two-pane column packing, and live runs appear in Pi's footer with `Ctrl+Shift+A` quick management.

Pane execution requires [Herdr](https://herdr.dev) and its Pi integration:

```bash
herdr integration install pi
herdr integration status
```

Headless definitions do not open Herdr panes. See the [Pi-Herdr-Subagents README](https://github.com/Gabriel-Cervo/Pi-Herdr-Subagents#readme) for agent creation, model and harness editing, automatic tests, worktree handoff, and safety details.

## Available Skills

| Skill | Description |
|-------|-------------|
| [good-writing](skills/good-writing/SKILL.md) | Write clear, human-sounding prose and cite sources with links |
| [grilling](skills/grilling/SKILL.md) | Relentlessly interview the user about a plan, decision, or idea |
| [grill-me](skills/grill-me/SKILL.md) | Wrapper that loads the grilling skill to run the session |
| [handoff](skills/handoff/SKILL.md) | Compact the current conversation into a handoff document for another agent |
| [librarian](skills/librarian/SKILL.md) | Research open-source libraries with evidence-backed answers and GitHub permalinks |
| [writing-great-skills](skills/writing-great-skills/SKILL.md) | Reference for writing and editing skills well |
| [herdr](skills/herdr/SKILL.md) | Safely inspect and control Herdr panes, agents, workspaces, and worktrees |

## Available Extensions

| Extension | Description |
|-----------|-------------|
| [permission-gate](extensions/permission-gate.ts) | Prompts for confirmation before running dangerous bash commands (rm -rf, sudo, chmod 777) |
| [Pi-Herdr-Subagents](https://github.com/Gabriel-Cervo/Pi-Herdr-Subagents) | Pi and Claude subagents with interactive or headless execution, isolated Git worktrees, compact pane packing, smart background joins, agent creation/edit/testing, and live footer management |

## Themes

| Theme | Description |
|-------|-------------|
| [tokyonight-moon](.pi/themes/tokyonight-moon.json) | Tokyo Night Moon color theme for the Pi TUI |

## License

MIT
