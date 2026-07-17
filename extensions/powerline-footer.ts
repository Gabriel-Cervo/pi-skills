import { basename } from "node:path";
import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Component, EditorTheme, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

interface GitState {
	branch?: string;
	changed: number;
	untracked: number;
}

class EmptyFooter implements Component {
	render(): string[] {
		return [];
	}

	invalidate(): void {}
}

function compactModelName(ctx: ExtensionContext): string {
	if (!ctx.model) return "No model";

	let name = ctx.model.name || ctx.model.id;
	name = name
		.replace(/^claude[ -]+/i, "")
		.replace(/\b20\d{6}\b/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return name || ctx.model.id;
}

function providerGlyph(provider?: string): string {
	switch (provider) {
		case "anthropic":
			return "✿";
		case "openai":
		case "openai-codex":
			return "◆";
		case "google":
		case "google-gemini-cli":
			return "✦";
		default:
			return "●";
	}
}

function parseGitStatus(output: string): GitState {
	const lines = output.split("\n").filter(Boolean);
	const header = lines[0]?.startsWith("## ") ? lines.shift()!.slice(3) : "";
	let branch = header.split("...")[0]?.replace(/^No commits yet on /, "").trim();
	if (!branch || branch === "HEAD (no branch)") branch = "detached";

	let changed = 0;
	let untracked = 0;
	for (const line of lines) {
		if (line.startsWith("??")) untracked++;
		else if (!line.startsWith("!!")) changed++;
	}
	return { branch, changed, untracked };
}

function fitTopBorder(
	segments: string[],
	width: number,
	border: (text: string) => string,
): string {
	if (width <= 0) return "";
	if (width === 1) return border("─");

	const prefix = border("╭─");
	const suffix = border("─");
	const kept = [...segments];
	const joiner = border(" ❯ ");
	const contentWidth = () => visibleWidth(kept.join(joiner));

	while (kept.length > 1 && visibleWidth(prefix) + contentWidth() + visibleWidth(suffix) + 1 > width) {
		kept.pop();
	}

	const available = Math.max(0, width - visibleWidth(prefix) - visibleWidth(suffix));
	const content = truncateToWidth(kept.join(joiner), available, "");
	const fill = "─".repeat(Math.max(0, width - visibleWidth(prefix) - visibleWidth(content) - visibleWidth(suffix)));
	return truncateToWidth(prefix + content + border(fill) + suffix, width, "");
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let git: GitState = { changed: 0, untracked: 0 };
	let activeTui: TUI | undefined;
	let activeCtx: ExtensionContext | undefined;
	let working = false;
	let spinnerIndex = 0;
	let spinnerTimer: ReturnType<typeof setInterval> | undefined;
	let refreshingGit = false;
	let refreshQueued = false;
	const spinnerFrames = ["✦", "✧", "·", "✧"];

	const requestRender = () => activeTui?.requestRender();

	const stopSpinner = () => {
		if (spinnerTimer) clearInterval(spinnerTimer);
		spinnerTimer = undefined;
	};

	const refreshGit = async () => {
		const ctx = activeCtx;
		if (!ctx) return;
		if (refreshingGit) {
			refreshQueued = true;
			return;
		}
		refreshingGit = true;
		try {
			const result = await pi.exec("git", ["status", "--porcelain=v1", "--branch"], {
				cwd: ctx.cwd,
				timeout: 3000,
			});
			git = result.code === 0 ? parseGitStatus(result.stdout) : { changed: 0, untracked: 0 };
		} catch {
			git = { changed: 0, untracked: 0 };
		} finally {
			refreshingGit = false;
			requestRender();
			if (refreshQueued) {
				refreshQueued = false;
				void refreshGit();
			}
		}
	};

	const install = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		activeCtx = ctx;
		ctx.ui.setWorkingVisible(false);
		ctx.ui.setFooter(() => new EmptyFooter());

		class PowerlineEditor extends CustomEditor {
			constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) {
				super(tui, theme, keybindings, { paddingX: 1 });
				activeTui = tui;
			}

			render(width: number): string[] {
				const lines = super.render(width);
				if (lines.length === 0) return lines;

				const theme = ctx.ui.theme;
				const usage = ctx.getContextUsage();
				const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow;
				const percent = usage?.percent == null ? "0.0" : usage.percent.toFixed(1);
				const context = contextWindow ? `${percent}%/${Math.round(contextWindow / 1000)}k` : `${percent}%`;
				const thinking = pi.getThinkingLevel();
				const directory = basename(ctx.cwd) || ctx.cwd;

				const segments = [
					theme.fg("warning", theme.bold(" π ")),
					theme.fg("customMessageLabel", ` ${providerGlyph(ctx.model?.provider)} ${compactModelName(ctx)} `),
					theme.fg(thinking === "off" ? "thinkingOff" : `thinking${thinking[0]!.toUpperCase()}${thinking.slice(1)}` as "thinkingHigh", ` thinking:${thinking} `),
					theme.fg("accent", ` 📁 ${directory} `),
				];

				if (git.branch) {
					let gitText = `  ${git.branch}`;
					if (git.changed) gitText += ` *${git.changed}`;
					if (git.untracked) gitText += ` ?${git.untracked}`;
					segments.push(theme.fg("warning", ` ${gitText} `));
				}

				segments.push(theme.fg("muted", ` ◧ ${context} `));
				if (working) segments.push(theme.fg("accent", ` ${spinnerFrames[spinnerIndex]} `));

				lines[0] = fitTopBorder(segments, width, (text) => this.borderColor(text));
				return lines;
			}
		}

		ctx.ui.setEditorComponent((tui, theme, keybindings) => new PowerlineEditor(tui, theme, keybindings));
		void refreshGit();
	};

	const uninstall = (ctx: ExtensionContext) => {
		ctx.ui.setEditorComponent(undefined);
		ctx.ui.setFooter(undefined);
		ctx.ui.setWorkingVisible(true);
		activeTui = undefined;
	};

	pi.on("session_start", (_event, ctx) => {
		if (enabled) install(ctx);
	});

	pi.on("agent_start", () => {
		working = true;
		stopSpinner();
		spinnerTimer = setInterval(() => {
			spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
			requestRender();
		}, 140);
		requestRender();
	});

	pi.on("agent_settled", () => {
		working = false;
		stopSpinner();
		requestRender();
		void refreshGit();
	});

	pi.on("model_select", () => requestRender());
	pi.on("thinking_level_select", () => requestRender());
	pi.on("tool_execution_end", () => void refreshGit());

	pi.on("session_shutdown", () => {
		stopSpinner();
		activeTui = undefined;
		activeCtx = undefined;
	});

	pi.registerCommand("powerline-footer", {
		description: "Toggle the image-inspired powerline editor footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) install(ctx);
			else uninstall(ctx);
			ctx.ui.notify(`Powerline footer ${enabled ? "enabled" : "disabled"}`, "info");
		},
	});
}
