#!/usr/bin/env node
/**
 * Gemini-CLI bridge for cc-gemini-plugin:gemini-agent.
 *
 * Wraps `gemini` CLI calls so the agent can invoke Gemini for adversarial
 * code-review without sandbox issues invoking the binary directly.
 *
 * Contract (matches what cc-gemini-plugin:gemini-agent expects):
 *   node scripts/gemini-bridge.js --files=<comma-separated-paths> \
 *                                 --model=<gemini-model-id> \
 *                                 --format=<text|json> \
 *                                 -- "<task-prompt>"
 *
 * Args:
 *   --files       Comma-separated absolute paths to inline as @-references
 *                 in the prompt. Optional.
 *   --dirs        Comma-separated absolute directory paths. Optional.
 *   --model       Gemini model id (default: gemini-2.5-pro).
 *   --format      Output format (default: text). Currently passed through.
 *   --            Sentinel; everything after is the task prompt.
 *
 * Stdout: Gemini response (raw stdout of `gemini -p ...`).
 * Stderr: errors / non-fatal warnings.
 * Exit:   0 on success, non-zero on failure.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

function parseArgs(argv) {
  const out = { files: [], dirs: [], model: "gemini-2.5-pro", format: "text", task: "" };
  let sawSentinel = false;
  const taskParts = [];
  for (const arg of argv) {
    if (sawSentinel) {
      taskParts.push(arg);
      continue;
    }
    if (arg === "--") {
      sawSentinel = true;
      continue;
    }
    if (arg.startsWith("--files=")) {
      out.files = arg
        .slice("--files=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--dirs=")) {
      out.dirs = arg
        .slice("--dirs=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--model=")) {
      out.model = arg.slice("--model=".length).trim();
    } else if (arg.startsWith("--format=")) {
      out.format = arg.slice("--format=".length).trim();
    }
  }
  out.task = taskParts.join(" ").trim();
  return out;
}

function buildPrompt({ files, dirs, task }) {
  const lines = [];
  if (dirs.length > 0) {
    lines.push("Relevant directories:");
    for (const d of dirs) {
      if (fs.existsSync(d)) lines.push(`  ${d}`);
    }
    lines.push("");
  }
  if (files.length > 0) {
    lines.push("Files to consider (full content available via Read):");
    for (const f of files) {
      if (fs.existsSync(f)) lines.push(`  ${f}`);
    }
    lines.push("");
  }
  lines.push(task);
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.task) {
    process.stderr.write("gemini-bridge: empty task — pass prompt after `--`\n");
    process.exit(2);
  }
  const prompt = buildPrompt(args);
  // Gemini CLI: `gemini -m <model> -p <prompt>` non-interactive mode.
  // GEMINI_CLI_TRUST_WORKSPACE=true bypasses trusted-folders prompt for
  // headless invocation (Trust-gate ist für interactive UI gedacht).
  const cliArgs = ["-m", args.model, "-p", prompt];
  const result = spawnSync("gemini", cliArgs, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: "true" },
  });
  if (result.error) {
    process.stderr.write(`gemini-bridge: spawn failed: ${result.error.message}\n`);
    process.exit(3);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 0);
}

main();
