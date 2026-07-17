# Pi Skills

A collection of skills for [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent), compatible with Claude Code, Codex CLI, Amp, and Droid.

## Installation

### pi-coding-agent

```bash
# User-level (available in all projects)
git clone https://github.com/your-user/Pi-Skills ~/.pi/agent/skills/Pi-Skills

# Or project-level
git clone https://github.com/your-user/Pi-Skills .pi/skills/Pi-Skills
```

### Claude Code

Claude Code only looks one level deep for `SKILL.md` files, so symlink individual skills:

```bash
git clone https://github.com/your-user/Pi-Skills ~/Pi-Skills

mkdir -p ~/.claude/skills
ln -s ~/Pi-Skills/good-writing ~/.claude/skills/good-writing
ln -s ~/Pi-Skills/grilling ~/.claude/skills/grilling
ln -s ~/Pi-Skills/grill-me ~/.claude/skills/grill-me
ln -s ~/Pi-Skills/handoff ~/.claude/skills/handoff
ln -s ~/Pi-Skills/writing-great-skills ~/.claude/skills/writing-great-skills
```

### Codex CLI

```bash
git clone https://github.com/your-user/Pi-Skills ~/.codex/skills/Pi-Skills
```

## Available Skills

| Skill | Description |
|-------|-------------|
| [good-writing](good-writing/SKILL.md) | Write clear, human-sounding prose and cite sources with links |
| [grilling](grilling/SKILL.md) | Relentlessly interview the user about a plan, decision, or idea |
| [grill-me](grill-me/SKILL.md) | Wrapper that loads the grilling skill to run the session |
| [handoff](handoff/SKILL.md) | Compact the current conversation into a handoff document for another agent |
| [writing-great-skills](writing-great-skills/SKILL.md) | Reference for writing and editing skills well |

## License

MIT
