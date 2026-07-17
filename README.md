# Pi Skills

A collection of skills for [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent), compatible with Claude Code, Codex CLI, Amp, and Droid.

## Installation

### pi-coding-agent

```bash
# User-level (available in all projects)
git clone https://github.com/Gabriel-Cervo/pi-skills ~/.pi/agent/skills/pi-skills

# Or project-level
git clone https://github.com/Gabriel-Cervo/pi-skills .pi/skills/pi-skills
```

### Claude Code

Claude Code only looks one level deep for `SKILL.md` files, so symlink individual skills:

```bash
git clone https://github.com/Gabriel-Cervo/pi-skills ~/pi-skills

mkdir -p ~/.claude/skills
ln -s ~/pi-skills/good-writing ~/.claude/skills/good-writing
ln -s ~/pi-skills/grilling ~/.claude/skills/grilling
ln -s ~/pi-skills/grill-me ~/.claude/skills/grill-me
ln -s ~/pi-skills/handoff ~/.claude/skills/handoff
ln -s ~/pi-skills/writing-great-skills ~/.claude/skills/writing-great-skills
```

### Codex CLI

```bash
git clone https://github.com/Gabriel-Cervo/pi-skills ~/.codex/skills/pi-skills
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
