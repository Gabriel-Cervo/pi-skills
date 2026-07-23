import { basename } from "node:path";
import {
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	sliceByColumn,
	truncateToWidth,
	visibleWidth,
	type Component,
	type OverlayHandle,
	type OverlayOptions,
	type TUI,
} from "@earendil-works/pi-tui";

interface GitState {
	branch?: string;
	changed: number;
	untracked: number;
}

// ── petit chat ───────────────────────────────────────────────────────────────

const CHAT_WIDTH = 11;
const CHAT_HEIGHT = 3;
const GEOMETRY_HOOK_KEY = Symbol.for("pi.petit-chat.current-frame-geometry");

const PETIT_CHAT = [
	"  ⡠⣒⠄  ⡔⢄⠔⡄",
	" ⢸⠸⣀⡔⢉⠱⣃⡢⣂⡣",
	"  ⠉⠒⠣⠤⠵⠤⠬⠮⠆",
] as const;

type GeometryListener = (lines: string[], termWidth: number, termHeight: number) => void;
type CompositeOverlays = (lines: string[], termWidth: number, termHeight: number) => string[];

interface GeometryHookState {
	original: CompositeOverlays;
	wrapper: CompositeOverlays;
	listeners: Set<GeometryListener>;
}

interface TuiRuntime {
	compositeOverlays?: CompositeOverlays;
	[key: symbol]: unknown;
}

class PetitChatOverlay implements Component {
	private borderPrefix: string;

	constructor(private readonly theme: Theme) {
		this.borderPrefix = theme.fg("borderMuted", "──");
	}

	setBorderPrefix(prefix: string): void {
		this.borderPrefix = prefix;
	}

	render(width: number): string[] {
		return PETIT_CHAT.map((line, index) => {
			if (index === PETIT_CHAT.length - 1) {
				const merged = this.borderPrefix + this.theme.fg("text", line.slice(2));
				return truncateToWidth(merged, width, "");
			}
			return truncateToWidth(this.theme.fg("text", line), width, "");
		});
	}

	invalidate(): void {}
}

class PetitChatOverlayHost implements Component {
	private readonly overlay: PetitChatOverlay;
	private readonly handle: OverlayHandle;
	private readonly uninstallGeometryHook: () => void;
	private readonly options: OverlayOptions = {
		nonCapturing: true,
		anchor: "bottom-right",
		width: CHAT_WIDTH,
		maxHeight: CHAT_HEIGHT,
		margin: { right: 2 },
		visible: (termWidth, termHeight) =>
			this.geometrySupported && termWidth >= 32 && termHeight >= 10,
	};
	private disposed = false;
	private geometrySupported = false;
	private overlayHidden = false;

	constructor(
		private readonly tui: TUI,
		theme: Theme,
	) {
		this.overlay = new PetitChatOverlay(theme);
		const uninstall = installGeometryHook(tui, (lines, width, height) => {
			this.syncPosition(lines, width, height);
		});
		this.geometrySupported = uninstall !== undefined;
		this.uninstallGeometryHook = uninstall ?? (() => {});
		this.handle = tui.showOverlay(this.overlay, this.options);
	}

	render(): string[] {
		return [];
	}

	invalidate(): void {
		this.overlay.invalidate();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.handle.hide();
		this.uninstallGeometryHook();
	}

	private syncPosition(lines: string[], termWidth: number, termHeight: number): void {
		const viewportStart = Math.max(0, lines.length - termHeight);
		const borderRows: number[] = [];
		for (let row = viewportStart; row < lines.length; row++) {
			const plain = stripTerminalSequences(lines[row] ?? "").trim();
			if (isEditorBorderCandidate(plain, termWidth)) borderRows.push(row);
		}

		const maxBorderDistance = Math.max(5, Math.floor(termHeight * 0.3)) + 1;
		const editorBottomLogicalRow = borderRows.at(-1);
		let editorTopLogicalRow: number | undefined;
		if (editorBottomLogicalRow !== undefined) {
			for (let index = borderRows.length - 2; index >= 0; index--) {
				const candidate = borderRows[index]!;
				const distance = editorBottomLogicalRow - candidate;
				if (distance >= 2 && distance <= maxBorderDistance) {
					editorTopLogicalRow = candidate;
					break;
				}
				if (distance > maxBorderDistance) break;
			}
		}
		if (editorTopLogicalRow === undefined) {
			this.setOverlayHidden(true);
			return;
		}

		this.setOverlayHidden(false);
		const editorTopRow = editorTopLogicalRow - viewportStart;
		this.overlay.setBorderPrefix(sliceByColumn(lines[editorTopLogicalRow]!, 0, 2, true));
		this.options.row = Math.max(0, editorTopRow - CHAT_HEIGHT + 1);
	}

	private setOverlayHidden(hidden: boolean): void {
		if (this.overlayHidden === hidden) return;
		this.overlayHidden = hidden;
		this.handle.setHidden(hidden);
	}
}

function installGeometryHook(tui: TUI, listener: GeometryListener): (() => void) | undefined {
	const runtime = tui as unknown as TuiRuntime;
	let state = runtime[GEOMETRY_HOOK_KEY] as GeometryHookState | undefined;

	if (!state && typeof runtime.compositeOverlays !== "function") return undefined;

	if (!state) {
		const original = runtime.compositeOverlays!;
		const listeners = new Set<GeometryListener>();
		const wrapper: CompositeOverlays = (lines, termWidth, termHeight) => {
			for (const current of [...listeners]) {
				try {
					current(lines, termWidth, termHeight);
				} catch {
					listeners.delete(current);
				}
			}
			return original.call(runtime, lines, termWidth, termHeight);
		};
		state = { original, wrapper, listeners };
		runtime[GEOMETRY_HOOK_KEY] = state;
		runtime.compositeOverlays = wrapper;
	}

	state.listeners.add(listener);
	const installedState = state;
	return () => {
		installedState.listeners.delete(listener);
		if (installedState.listeners.size > 0) return;
		if (runtime.compositeOverlays !== installedState.wrapper) return;

		runtime.compositeOverlays = installedState.original;
		if (runtime[GEOMETRY_HOOK_KEY] === installedState) {
			delete runtime[GEOMETRY_HOOK_KEY];
		}
	};
}

function isEditorBorderCandidate(value: string, termWidth: number): boolean {
	if (visibleWidth(value) < termWidth - 2) return false;
	// Default pi border, scrollback indicators, and powerline-style borders
	// (which start with ── followed by segment content).
	return (
		/^─+$/.test(value) ||
		/^─── [↑↓] \d+ more ─*$/.test(value) ||
		/^──[^─]/.test(value)
	);
}

function stripTerminalSequences(value: string): string {
	return value
		.replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
		.replace(/\u001b_[^\u0007]*(?:\u0007|\u001b\\)/g, "")
		.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
		.replace(/[\r\n]/g, "");
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

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let git: GitState = { changed: 0, untracked: 0 };
	let activeTui: TUI | undefined;
	let activeCtx: ExtensionContext | undefined;
	let petitChatHost: PetitChatOverlayHost | undefined;
	let working = false;
	let spinnerIndex = 0;
	let spinnerTimer: ReturnType<typeof setInterval> | undefined;
	let refreshingGit = false;
	let refreshQueued = false;
	const spinnerFrames = ["✦", "✧", "·", "✧"];

	const requestRender = () => {
		activeTui?.requestRender();
		petitChatHost?.invalidate();
	};

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

		// Install petit chat overlay using the same widget key so the standalone
		// extension stays compatible (no double-install if both are loaded).
		ctx.ui.setWidget(
			"petit-chat-overlay-host",
			(tui, theme) => {
				petitChatHost = new PetitChatOverlayHost(tui, theme);
				return petitChatHost;
			},
			{ placement: "aboveEditor" },
		);

		// Status bar is rendered above the editor (top of screen) instead of
		// in the default bottom footer.
		ctx.ui.setWidget(
			"status-bar",
			(tui, theme) => {
				activeTui = tui;

				return {
					dispose() {},
					invalidate() {},
					render(width: number): string[] {
						const PAD = 1;
						const inner = width - PAD * 2;
						if (inner <= 0) return [];

						const padLeft = " ".repeat(PAD);
						const padRight = " ".repeat(PAD);

						const theme = ctx.ui.theme;
						const usage = ctx.getContextUsage();
						const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow;
						const percent = usage?.percent == null ? "0.0" : usage.percent.toFixed(1);
						const context = contextWindow ? `${percent}% / ${Math.round(contextWindow / 1000)}k` : `${percent}%`;
						const thinking = pi.getThinkingLevel();
						const directory = basename(ctx.cwd) || ctx.cwd;

						const leftParts: string[] = [];

						if (working) {
							leftParts.push(theme.fg("accent", spinnerFrames[spinnerIndex]));
						}

						leftParts.push(theme.fg("customMessageLabel", compactModelName(ctx)));
						leftParts.push(theme.fg(
							thinking === "off" ? "thinkingOff" : `thinking${thinking[0]!.toUpperCase()}${thinking.slice(1)}` as "thinkingHigh",
							`thinking: ${thinking}`
						));
						leftParts.push(theme.fg("dim", `~/${directory}`));

						if (git.branch) {
							let gitText = ` ${git.branch}`;
							if (git.changed) gitText += ` *${git.changed}`;
							if (git.untracked) gitText += ` ?${git.untracked}`;
							leftParts.push(theme.fg("warning", gitText));
						}

						const left = leftParts.join(theme.fg("dim", "  ·  "));
						const right = theme.fg("muted", context);
						const leftWidth = visibleWidth(left);
						const rightWidth = visibleWidth(right);

						// Single line if it fits
						if (leftWidth + rightWidth + 2 <= inner) {
							const spacer = " ".repeat(inner - leftWidth - rightWidth);
							return [truncateToWidth(padLeft + left + spacer + right + padRight, width)];
						}

						// Wrap to two lines: left on line 1, context right-aligned on line 2
						return [
							truncateToWidth(padLeft + left + padRight, width),
							truncateToWidth(padLeft + " ".repeat(Math.max(0, inner - rightWidth)) + right + padRight, width),
						];
					},
				};
			},
			{ placement: "aboveEditor" },
		);

		void refreshGit();
	};

	const uninstall = (ctx: ExtensionContext) => {
		ctx.ui.setWidget("status-bar", undefined);
		ctx.ui.setWidget("petit-chat-overlay-host", undefined);
		ctx.ui.setWorkingVisible(true);
		petitChatHost?.dispose();
		petitChatHost = undefined;
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

	pi.registerCommand("custom-footer", {
		description: "Toggle the custom editor footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) install(ctx);
			else uninstall(ctx);
			ctx.ui.notify(`Custom footer ${enabled ? "enabled" : "disabled"}`, "info");
		},
	});
}
