import { randomUUID } from 'crypto';
import { spawn, spawnSync } from 'child_process';

/* @agentic-dev-library/control - ESM Build */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/core/security.ts
function sanitizeError(error) {
  const message = error instanceof Error ? error.message : error;
  const tokenPatterns = [
    // GitHub tokens: ghp_, gho_, ghu_, ghs_, ghr_
    /gh[pous]_[A-Za-z0-9_]{36,}/g,
    // GitHub fine-grained tokens: github_pat_
    /github_pat_[A-Za-z0-9_]{82}/g,
    // Anthropic API keys: sk-ant-
    /sk-ant-[A-Za-z0-9_-]{95,}/g,
    // OpenAI API keys: sk-
    /sk-[A-Za-z0-9]{48,}/g,
    // Generic API key patterns
    /[A-Za-z0-9_-]{32,}/g
  ];
  let sanitized = message;
  for (const pattern of tokenPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED_TOKEN]");
  }
  return sanitized;
}
__name(sanitizeError, "sanitizeError");

// src/core/subprocess.ts
function safeSpawnSync(command, args = [], options = {}) {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("Command must be a non-empty string");
  }
  if (!Array.isArray(args)) {
    throw new Error("Arguments must be an array");
  }
  const safeOptions = {
    ...options,
    shell: false,
    // Explicitly disable shell to prevent injection
    encoding: "utf-8"
  };
  try {
    const result = spawnSync(command, args, safeOptions);
    return {
      success: result.status === 0,
      stdout: result.stdout?.toString() ?? "",
      stderr: result.stderr?.toString() ?? "",
      code: result.status
    };
  } catch (error) {
    const sanitizedError = sanitizeError(error instanceof Error ? error.message : String(error));
    throw new Error(`Command execution failed: ${sanitizedError}`);
  }
}
__name(safeSpawnSync, "safeSpawnSync");
function safeSpawn(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof command !== "string" || command.trim() === "") {
      reject(new Error("Command must be a non-empty string"));
      return;
    }
    if (!Array.isArray(args)) {
      reject(new Error("Arguments must be an array"));
      return;
    }
    const safeOptions = {
      ...options,
      shell: false
      // Explicitly disable shell to prevent injection
    };
    const child = spawn(command, args, safeOptions);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        code
      });
    });
    child.on("error", (error) => {
      const sanitizedError = sanitizeError(error.message);
      reject(new Error(`Command execution failed: ${sanitizedError}`));
    });
  });
}
__name(safeSpawn, "safeSpawn");
function validateCommandArgs(args) {
  for (const arg of args) {
    if (typeof arg !== "string") {
      throw new Error("All command arguments must be strings");
    }
    if (arg.includes("\n") || arg.includes("\r")) {
      throw new Error("Command arguments cannot contain newline characters");
    }
    if (arg.includes("\0")) {
      throw new Error("Command arguments cannot contain null bytes");
    }
  }
}
__name(validateCommandArgs, "validateCommandArgs");
function safeDockerCommand(args, options = {}) {
  validateCommandArgs(args);
  const allowedDockerCommands = [
    "build",
    "run",
    "exec",
    "ps",
    "images",
    "pull",
    "push",
    "start",
    "stop",
    "restart",
    "rm",
    "rmi",
    "logs",
    "inspect",
    "create",
    "cp",
    "stats",
    "top",
    "version",
    "info"
  ];
  const firstArg = args[0];
  if (!firstArg || !allowedDockerCommands.includes(firstArg)) {
    throw new Error(`Docker command not allowed: ${firstArg ?? "(empty)"}`);
  }
  return safeSpawnSync("docker", args, options);
}
__name(safeDockerCommand, "safeDockerCommand");

// src/sandbox/container.ts
var ContainerManager = class {
  static {
    __name(this, "ContainerManager");
  }
  async create(config) {
    const containerId = `agentic-sandbox-${randomUUID().slice(0, 8)}`;
    const dockerArgs = [
      "create",
      "--name",
      containerId,
      "--rm",
      "--workdir",
      "/workspace",
      "-v",
      `${config.workspace}:/workspace:ro`,
      "-v",
      `${config.outputDir}:/output`
    ];
    if (config.memory) {
      dockerArgs.push("-m", `${config.memory}m`);
    }
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        dockerArgs.push("-e", `${key}=${value}`);
      }
    }
    const image = this.getImageForRuntime(config.runtime);
    dockerArgs.push(image);
    const result = safeDockerCommand(dockerArgs);
    if (!result.success) {
      throw new Error(`Failed to create container: ${result.stderr}`);
    }
    return containerId;
  }
  async start(containerId) {
    const result = safeDockerCommand(["start", containerId]);
    if (!result.success) {
      throw new Error(`Failed to start container ${containerId}: ${result.stderr}`);
    }
  }
  async stop(containerId) {
    const result = safeDockerCommand(["stop", containerId]);
    if (!result.success) {
      console.warn(`Warning: Could not stop container ${containerId}: ${result.stderr}`);
    }
  }
  async remove(containerId) {
    const result = safeDockerCommand(["rm", "-f", containerId]);
    if (!result.success) {
      console.warn(`Warning: Could not remove container ${containerId}: ${result.stderr}`);
    }
  }
  async exec(containerId, command) {
    const startTime = Date.now();
    const dockerArgs = ["exec", containerId, ...command];
    try {
      const result = await safeSpawn("docker", dockerArgs);
      const duration = Date.now() - startTime;
      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.code || 0,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration
      };
    }
  }
  async logs(containerId) {
    const result = safeDockerCommand(["logs", containerId]);
    if (!result.success) {
      throw new Error(`Failed to get logs for container ${containerId}: ${result.stderr}`);
    }
    return result.stdout;
  }
  getImageForRuntime(runtime) {
    switch (runtime) {
      case "claude":
      case "cursor":
        return "jbcom/agentic-control:latest";
      case "custom":
        return "jbcom/agentic-control:latest";
      default:
        return "jbcom/agentic-control:latest";
    }
  }
};

// src/sandbox/runtime/claude.ts
var ClaudeRuntime = class {
  static {
    __name(this, "ClaudeRuntime");
  }
  name = "claude";
  image = "jbcom/agentic-control:latest";
  prepareCommand(prompt, options) {
    const command = ["npx", "@anthropic-ai/claude-agent-sdk", "query", "--prompt", prompt];
    if (options.timeout) {
      command.push("--timeout", options.timeout.toString());
    }
    return command;
  }
  parseOutput(stdout, stderr) {
    try {
      const parsed = JSON.parse(stdout);
      return {
        result: parsed.result || stdout,
        files: parsed.files || [],
        error: stderr || parsed.error
      };
    } catch {
      return {
        result: stdout,
        files: [],
        error: stderr
      };
    }
  }
  async validateEnvironment() {
    return !!process.env.ANTHROPIC_API_KEY;
  }
};

// src/sandbox/runtime/cursor.ts
var CursorRuntime = class {
  static {
    __name(this, "CursorRuntime");
  }
  name = "cursor";
  image = "jbcom/agentic-control:latest";
  prepareCommand(prompt, options) {
    const command = ["cursor-agent", "run", "--task", prompt];
    if (options.timeout) {
      command.push("--timeout", options.timeout.toString());
    }
    return command;
  }
  parseOutput(stdout, stderr) {
    try {
      const parsed = JSON.parse(stdout);
      return {
        result: parsed.result || stdout,
        files: parsed.files || [],
        error: stderr || parsed.error
      };
    } catch {
      return {
        result: stdout,
        files: [],
        error: stderr
      };
    }
  }
  async validateEnvironment() {
    return !!process.env.CURSOR_API_KEY;
  }
};

// src/sandbox/executor.ts
var SandboxExecutor = class {
  static {
    __name(this, "SandboxExecutor");
  }
  containerManager;
  runtimes;
  constructor() {
    this.containerManager = new ContainerManager();
    this.runtimes = /* @__PURE__ */ new Map([
      ["claude", new ClaudeRuntime()],
      ["cursor", new CursorRuntime()]
    ]);
  }
  async execute(options) {
    const runtime = this.runtimes.get(options.runtime);
    if (!runtime) {
      throw new Error(`Unknown runtime: ${options.runtime}`);
    }
    const isValid = await runtime.validateEnvironment();
    if (!isValid) {
      throw new Error(`Environment validation failed for runtime: ${options.runtime}`);
    }
    const containerId = await this.containerManager.create({
      runtime: options.runtime,
      workspace: options.workspace,
      outputDir: options.outputDir,
      memory: options.memory,
      timeout: options.timeout,
      env: options.env
    });
    try {
      await this.containerManager.start(containerId);
      const command = runtime.prepareCommand(options.prompt, {
        timeout: options.timeout,
        memory: options.memory,
        env: options.env
      });
      const result = await this.containerManager.exec(containerId, command);
      if (result.success && result.output) {
        const parsed = runtime.parseOutput(result.output, result.error || "");
        return {
          ...result,
          output: JSON.stringify(parsed)
        };
      }
      return result;
    } finally {
      await this.containerManager.stop(containerId);
      await this.containerManager.remove(containerId);
    }
  }
  async executeFleet(options) {
    const promises = options.map((option) => this.execute(option));
    return Promise.all(promises);
  }
};

export { ClaudeRuntime, ContainerManager, CursorRuntime, SandboxExecutor };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map