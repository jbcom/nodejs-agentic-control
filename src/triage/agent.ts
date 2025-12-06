/**
 * Agent - Unified AI-powered development agent
 *
 * A single, comprehensive agent that handles all agentic tasks:
 * - Code operations (bash, file editing, git)
 * - MCP integrations (Cursor, GitHub, Context7)
 * - Extended thinking/reasoning
 * - Web search
 * - Structured output
 * - Tool approval for sensitive operations
 *
 * This consolidates CodeAgent, EnhancedAgent, and UnifiedAgent into one class.
 */

import { generateText, generateObject, streamText, tool, stepCountIs, type ToolSet } from 'ai';
import { anthropic, type AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';
import {
    initializeMCPClients,
    getMCPTools,
    closeMCPClients,
    type MCPClientConfig,
    type MCPClients,
} from './mcp-clients.js';
import { validatePath, assessCommandSafety } from './security.js';

// ─────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────

export interface AgentConfig {
    /** Working directory for file operations (sandbox root) */
    workingDirectory?: string;
    /** Maximum steps for multi-step tool calls */
    maxSteps?: number;
    /** MCP client configuration */
    mcp?: MCPClientConfig;
    /** Model to use */
    model?: 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514' | string;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Enable extended thinking/reasoning for complex tasks */
    reasoning?: {
        enabled: boolean;
        /** Token budget for thinking (default: 12000) */
        budgetTokens?: number;
    };
    /** Enable web search capability */
    webSearch?: {
        enabled: boolean;
        /** Max number of searches per request */
        maxUses?: number;
        /** Allowed domains for search */
        allowedDomains?: string[];
        /** Blocked domains */
        blockedDomains?: string[];
    };
    /** Tool approval settings */
    approval?: {
        /** Tools requiring approval before execution */
        requireApproval?: string[];
        /** Callback to handle approval requests */
        onApprovalRequest?: (toolName: string, input: unknown) => Promise<boolean>;
    };
}

export interface AgentResult {
    success: boolean;
    result: string;
    reasoning?: string;
    steps: AgentStep[];
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

export interface AgentStep {
    toolName: string;
    input: unknown;
    output: string;
    timestamp: Date;
    approved?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Structured Output Schemas
// ─────────────────────────────────────────────────────────────────

export const TaskAnalysisSchema = z.object({
    complexity: z.enum(['simple', 'moderate', 'complex']).describe('Task complexity assessment'),
    estimatedSteps: z.number().describe('Estimated number of steps to complete'),
    requiresWebSearch: z.boolean().describe('Whether web search might help'),
    requiresReasoning: z.boolean().describe('Whether extended thinking would help'),
    subtasks: z.array(
        z.object({
            description: z.string(),
            priority: z.enum(['critical', 'high', 'medium', 'low']),
            tools: z.array(z.string()).describe('Tools likely needed'),
        })
    ),
    risks: z.array(z.string()).describe('Potential risks or blockers'),
});

export type TaskAnalysis = z.infer<typeof TaskAnalysisSchema>;

// ─────────────────────────────────────────────────────────────────
// Agent Class
// ─────────────────────────────────────────────────────────────────

export class Agent {
    private config: Required<Omit<AgentConfig, 'mcp' | 'reasoning' | 'webSearch' | 'approval'>> & {
        mcp?: MCPClientConfig;
        reasoning?: AgentConfig['reasoning'];
        webSearch?: AgentConfig['webSearch'];
        approval?: AgentConfig['approval'];
    };
    private mcpClients: MCPClients | null = null;
    private initialized = false;
    /** Promise-based lock to prevent concurrent initialization race conditions */
    private initializationPromise: Promise<void> | null = null;

    constructor(config: AgentConfig = {}) {
        this.config = {
            workingDirectory: config.workingDirectory ?? process.cwd(),
            maxSteps: config.maxSteps ?? 25,
            model: config.model ?? 'claude-sonnet-4-20250514',
            verbose: config.verbose ?? false,
            mcp: config.mcp,
            reasoning: config.reasoning,
            webSearch: config.webSearch,
            approval: config.approval,
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────

    /**
     * Initialize MCP clients and prepare the agent.
     * Thread-safe: concurrent calls will wait for the same initialization to complete.
     */
    async initialize(): Promise<void> {
        // Fast path: already initialized
        if (this.initialized) return;

        // If initialization is in progress, wait for it to complete
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Start initialization and store the promise so concurrent calls can wait
        this.initializationPromise = this.doInitialize();

        try {
            await this.initializationPromise;
        } catch (error) {
            // Reset on failure so retry is possible
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Internal initialization logic - only called once due to promise lock
     */
    private async doInitialize(): Promise<void> {
        this.log('🚀 Initializing Agent...');

        if (this.config.mcp) {
            this.mcpClients = await initializeMCPClients(this.config.mcp);
        }

        this.initialized = true;
        this.log('✅ Agent initialized');
    }

    /**
     * Close all connections and clean up
     */
    async close(): Promise<void> {
        if (this.mcpClients) {
            await closeMCPClients(this.mcpClients);
            this.mcpClients = null;
        }
        this.initialized = false;
    }

    // ─────────────────────────────────────────────────────────────────
    // Core Execution Methods
    // ─────────────────────────────────────────────────────────────────

    /**
     * Execute a task with full tool access
     */
    async execute(
        task: string,
        options?: {
            enableReasoning?: boolean;
            enableWebSearch?: boolean;
        }
    ): Promise<AgentResult> {
        await this.initialize();

        const steps: AgentStep[] = [];
        const recordStep = (
            toolName: string,
            input: unknown,
            output: string,
            approved?: boolean
        ) => {
            steps.push({ toolName, input, output, timestamp: new Date(), approved });
            if (this.config.verbose) {
                console.log(
                    `  🔧 ${toolName}:`,
                    typeof input === 'string'
                        ? input.slice(0, 100)
                        : JSON.stringify(input).slice(0, 100)
                );
            }
        };

        // Build tool set
        const tools = await this.buildToolSet(recordStep);

        // Add web search if enabled
        if ((options?.enableWebSearch ?? this.config.webSearch?.enabled) && this.config.webSearch) {
            const webSearchTool = anthropic.tools.webSearch_20250305({
                maxUses: this.config.webSearch.maxUses ?? 5,
                allowedDomains: this.config.webSearch.allowedDomains,
                blockedDomains: this.config.webSearch.blockedDomains,
            });
            (tools as Record<string, unknown>).web_search = webSearchTool;
        }

        // Build provider options
        const providerOptions: { anthropic?: AnthropicProviderOptions } = {};

        if ((options?.enableReasoning ?? this.config.reasoning?.enabled) && this.config.reasoning) {
            providerOptions.anthropic = {
                thinking: {
                    type: 'enabled',
                    budgetTokens: this.config.reasoning.budgetTokens ?? 12000,
                },
            };
        }

        try {
            const result = await generateText({
                model: anthropic(this.config.model),
                tools,
                stopWhen: stepCountIs(this.config.maxSteps),
                system: this.getSystemPrompt(),
                prompt: task,
                providerOptions:
                    Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
            });

            return {
                success: true,
                result: result.text,
                reasoning: result.reasoning?.map((r) => r.text).join('\n'),
                steps,
                usage: result.usage
                    ? {
                          inputTokens: result.usage.inputTokens ?? 0,
                          outputTokens: result.usage.outputTokens ?? 0,
                          totalTokens: result.usage.totalTokens ?? 0,
                      }
                    : undefined,
            };
        } catch (error) {
            return {
                success: false,
                result: error instanceof Error ? error.message : String(error),
                steps,
            };
        }
    }

    /**
     * Execute a task with streaming output.
     * Note: Currently only yields text chunks. Reasoning chunks are not yet supported
     * by the streaming API even when extended thinking is enabled.
     */
    async *stream(task: string): AsyncGenerator<{ type: 'text'; content: string }> {
        await this.initialize();

        const steps: AgentStep[] = [];
        const recordStep = (toolName: string, input: unknown, output: string) => {
            steps.push({ toolName, input, output, timestamp: new Date() });
        };

        const tools = await this.buildToolSet(recordStep);

        // Build provider options for reasoning
        const providerOptions: { anthropic?: AnthropicProviderOptions } = {};
        if (this.config.reasoning?.enabled) {
            providerOptions.anthropic = {
                thinking: {
                    type: 'enabled',
                    budgetTokens: this.config.reasoning.budgetTokens ?? 12000,
                },
            };
        }

        const result = streamText({
            model: anthropic(this.config.model),
            tools,
            stopWhen: stepCountIs(this.config.maxSteps),
            system: this.getSystemPrompt(),
            prompt: task,
            providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
        });

        for await (const chunk of result.textStream) {
            yield { type: 'text', content: chunk };
        }
    }

    /**
     * Execute with structured output - combine tool use with schema-constrained response
     */
    async executeWithOutput<T extends z.ZodTypeAny>(
        task: string,
        outputSchema: T
    ): Promise<{
        success: boolean;
        output?: z.infer<T>;
        error?: string;
        steps: AgentStep[];
        usage?: AgentResult['usage'];
    }> {
        await this.initialize();

        const steps: AgentStep[] = [];
        const recordStep = (toolName: string, input: unknown, output: string) => {
            steps.push({ toolName, input, output, timestamp: new Date() });
        };

        const tools = await this.buildToolSet(recordStep);

        try {
            // First, use tools to gather information
            const gatherResult = await generateText({
                model: anthropic(this.config.model),
                tools,
                stopWhen: stepCountIs(Math.floor(this.config.maxSteps / 2)),
                system: this.getSystemPrompt(),
                prompt: task,
            });

            // Then, generate structured output
            const structured = await generateObject({
                model: anthropic(this.config.model),
                schema: outputSchema,
                prompt: `Based on this information, provide a structured response:

${gatherResult.text}

Original task: ${task}`,
            });

            return {
                success: true,
                output: structured.object as z.infer<T>,
                steps,
                usage: gatherResult.usage
                    ? {
                          inputTokens: gatherResult.usage.inputTokens ?? 0,
                          outputTokens: gatherResult.usage.outputTokens ?? 0,
                          totalTokens: gatherResult.usage.totalTokens ?? 0,
                      }
                    : undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                steps,
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Task Analysis
    // ─────────────────────────────────────────────────────────────────

    /**
     * Analyze a task before executing to determine optimal approach
     */
    async analyzeTask(task: string): Promise<TaskAnalysis> {
        const analysis = await generateObject({
            model: anthropic(this.config.model),
            schema: TaskAnalysisSchema,
            prompt: `Analyze this task and provide a structured assessment:

Task: ${task}

Consider:
1. How complex is this task?
2. How many steps might it take?
3. Would web search help gather current information?
4. Would extended thinking/reasoning help with complex logic?
5. What are the subtasks and their priorities?
6. What are potential risks or blockers?`,
        });

        return analysis.object;
    }

    // ─────────────────────────────────────────────────────────────────
    // Convenience Methods
    // ─────────────────────────────────────────────────────────────────

    /**
     * Fix a specific file based on feedback
     */
    async fixFile(
        filePath: string,
        feedback: string,
        suggestion?: string
    ): Promise<{
        success: boolean;
        result: string;
        diff?: string;
    }> {
        const task = suggestion
            ? `Fix the file ${filePath} based on this feedback:
${feedback}

Apply this suggested change:
${suggestion}`
            : `Fix the file ${filePath} based on this feedback:
${feedback}

Analyze the file, understand the issue, and make the appropriate fix.`;

        const result = await this.execute(task);

        // Get diff if we made changes
        let diff: string | undefined;
        if (result.success) {
            try {
                diff = execFileSync('git', ['diff', filePath], {
                    cwd: this.config.workingDirectory,
                    encoding: 'utf-8',
                });
            } catch {
                // No diff available
            }
        }

        return {
            success: result.success,
            result: result.result,
            diff,
        };
    }

    /**
     * Run tests and fix failures
     */
    async fixTests(testCommand: string = 'npm test'): Promise<{
        success: boolean;
        result: string;
        iterations: number;
    }> {
        const task = `Run the tests with "${testCommand}" and fix any failures.

Process:
1. Run the test command
2. If tests fail, analyze the failure
3. Fix the code causing the failure
4. Re-run tests
5. Repeat until all tests pass or you've tried 5 times`;

        const result = await this.execute(task);

        // Count iterations from steps
        const testRuns = result.steps.filter(
            (s) =>
                s.toolName === 'bash' &&
                typeof s.input === 'object' &&
                s.input !== null &&
                'command' in s.input &&
                String(s.input.command).includes('test')
        ).length;

        return {
            success: result.success,
            result: result.result,
            iterations: testRuns,
        };
    }

    /**
     * Commit changes with a message
     */
    async commitChanges(message: string): Promise<{
        success: boolean;
        commitSha?: string;
    }> {
        const result = await this.execute(
            `Stage all changes and commit with message: "${message}"
      
Use these commands:
1. git add -A
2. git commit -m "${message}"
3. Output the commit SHA`
        );

        // Extract commit SHA from steps
        const commitStep = result.steps.find(
            (s) => s.toolName === 'bash' && s.output.includes('commit')
        );

        let commitSha: string | undefined;
        if (commitStep) {
            const shaMatch = commitStep.output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
            if (shaMatch) {
                commitSha = shaMatch[1];
            }
        }

        return {
            success: result.success,
            commitSha,
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // Tool Building
    // ─────────────────────────────────────────────────────────────────

    /**
     * Build the complete tool set
     */
    private async buildToolSet(
        recordStep: (name: string, input: unknown, output: string, approved?: boolean) => void
    ): Promise<ToolSet> {
        const requiresApproval = (toolName: string): boolean => {
            return this.config.approval?.requireApproval?.includes(toolName) ?? false;
        };

        const checkApproval = async (toolName: string, input: unknown): Promise<boolean> => {
            if (!requiresApproval(toolName)) return true;
            if (!this.config.approval?.onApprovalRequest) return true;
            return this.config.approval.onApprovalRequest(toolName, input);
        };

        // Bash tool with security checks
        const bashTool = anthropic.tools.bash_20250124({
            execute: async ({ command, restart }) => {
                if (restart) {
                    recordStep('bash', { restart: true }, 'Shell restarted');
                    return 'Shell restarted';
                }

                // Assess command safety
                const safety = assessCommandSafety(command);
                const needsApproval = requiresApproval('bash') || !safety.safe;

                if (needsApproval) {
                    const approved = await checkApproval('bash', { command, risks: safety.risks });
                    if (!approved) {
                        recordStep('bash', { command }, 'Command rejected by approval', false);
                        return 'Command rejected by approval policy';
                    }
                }

                try {
                    const output = execSync(command, {
                        cwd: this.config.workingDirectory,
                        encoding: 'utf-8',
                        maxBuffer: 10 * 1024 * 1024,
                        timeout: 120000,
                    });

                    recordStep('bash', { command }, output, true);
                    return output;
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    recordStep('bash', { command }, `Error: ${errorMsg}`);
                    return `Error: ${errorMsg}`;
                }
            },
        });

        // Text editor tool with path validation
        const textEditorTool = anthropic.tools.textEditor_20250124({
            execute: async ({
                command,
                path,
                file_text,
                insert_line,
                new_str,
                old_str,
                view_range,
            }) => {
                // Security: Validate path to prevent path traversal attacks
                const pathValidation = validatePath(path, this.config.workingDirectory);
                if (!pathValidation.valid) {
                    recordStep(
                        'str_replace_editor',
                        { command, path },
                        `Security Error: ${pathValidation.error}`
                    );
                    return `Security Error: ${pathValidation.error}`;
                }
                const fullPath = pathValidation.resolvedPath;

                try {
                    let result: string;

                    switch (command) {
                        case 'view': {
                            if (!existsSync(fullPath)) {
                                result = `Error: File not found: ${path}`;
                            } else {
                                const content = readFileSync(fullPath, 'utf-8');
                                const lines = content.split('\n');

                                if (view_range && view_range.length === 2) {
                                    const [start, end] = view_range;
                                    const selectedLines = lines.slice(start - 1, end);
                                    result = selectedLines
                                        .map((line, i) => `${start + i}: ${line}`)
                                        .join('\n');
                                } else {
                                    result = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
                                }
                            }
                            break;
                        }

                        case 'create': {
                            if (!file_text) {
                                result = 'Error: file_text is required for create command';
                            } else {
                                const dir = dirname(fullPath);
                                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                                writeFileSync(fullPath, file_text);
                                result = `Created file: ${path}`;
                            }
                            break;
                        }

                        case 'str_replace': {
                            if (!old_str || new_str === undefined) {
                                result = 'Error: old_str and new_str are required for str_replace';
                            } else if (!existsSync(fullPath)) {
                                result = `Error: File not found: ${path}`;
                            } else {
                                const content = readFileSync(fullPath, 'utf-8');
                                if (!content.includes(old_str)) {
                                    result = `Error: old_str not found in file`;
                                } else {
                                    const newContent = content.replace(old_str, new_str);
                                    writeFileSync(fullPath, newContent);
                                    result = `Replaced text in ${path}`;
                                }
                            }
                            break;
                        }

                        case 'insert': {
                            if (insert_line === undefined || new_str === undefined) {
                                result = 'Error: insert_line and new_str are required for insert';
                            } else if (!existsSync(fullPath)) {
                                result = `Error: File not found: ${path}`;
                            } else {
                                const content = readFileSync(fullPath, 'utf-8');
                                const lines = content.split('\n');
                                lines.splice(insert_line, 0, new_str);
                                writeFileSync(fullPath, lines.join('\n'));
                                result = `Inserted text at line ${insert_line} in ${path}`;
                            }
                            break;
                        }

                        default:
                            result = `Unknown command: ${command}`;
                    }

                    recordStep('str_replace_editor', { command, path }, result);
                    return result;
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    recordStep('str_replace_editor', { command, path }, `Error: ${errorMsg}`);
                    return `Error: ${errorMsg}`;
                }
            },
        });

        const tools: ToolSet = {
            bash: bashTool,
            str_replace_editor: textEditorTool,
        } as ToolSet;

        // Git status tool
        tools.git_status = tool({
            description:
                'Get current git status including branch, staged files, and modified files',
            inputSchema: z.object({}),
            execute: async () => {
                try {
                    const status = execSync('git status --porcelain -b', {
                        cwd: this.config.workingDirectory,
                        encoding: 'utf-8',
                    });
                    recordStep('git_status', {}, status);
                    return status;
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    recordStep('git_status', {}, `Error: ${msg}`);
                    return `Error: ${msg}`;
                }
            },
        });

        // Git diff tool with path validation
        tools.git_diff = tool({
            description: 'Get git diff for staged or unstaged changes',
            inputSchema: z.object({
                staged: z.boolean().optional().describe('Show staged changes only'),
                file: z.string().optional().describe('Specific file to diff'),
            }),
            execute: async ({ staged, file }) => {
                try {
                    const args = staged ? ['--cached'] : [];
                    if (file) {
                        // Security: Validate file path
                        const pathValidation = validatePath(file, this.config.workingDirectory);
                        if (!pathValidation.valid) {
                            recordStep(
                                'git_diff',
                                { staged, file },
                                `Security Error: ${pathValidation.error}`
                            );
                            return `Security Error: ${pathValidation.error}`;
                        }
                        // Use -- to separate paths from options (git best practice)
                        args.push('--', file);
                    }
                    const diff = execSync(`git diff ${args.join(' ')}`, {
                        cwd: this.config.workingDirectory,
                        encoding: 'utf-8',
                    });
                    recordStep('git_diff', { staged, file }, diff || '(no changes)');
                    return diff || '(no changes)';
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    recordStep('git_diff', { staged, file }, `Error: ${msg}`);
                    return `Error: ${msg}`;
                }
            },
        });

        // File delete tool with approval and path validation
        tools.delete_file = tool({
            description: 'Delete a file (may require approval)',
            inputSchema: z.object({
                path: z.string().describe('Path to the file to delete'),
            }),
            execute: async ({ path }) => {
                // Security: Validate path to prevent path traversal attacks
                const pathValidation = validatePath(path, this.config.workingDirectory);
                if (!pathValidation.valid) {
                    recordStep(
                        'delete_file',
                        { path },
                        `Security Error: ${pathValidation.error}`,
                        false
                    );
                    return `Security Error: ${pathValidation.error}`;
                }
                const fullPath = pathValidation.resolvedPath;

                // Always check approval for delete operations
                const approved = await checkApproval('delete_file', { path });
                if (!approved) {
                    recordStep('delete_file', { path }, 'Delete rejected by approval', false);
                    return 'Delete operation rejected by approval policy';
                }

                try {
                    if (!existsSync(fullPath)) {
                        recordStep('delete_file', { path }, `File not found: ${path}`);
                        return `File not found: ${path}`;
                    }
                    unlinkSync(fullPath);
                    recordStep('delete_file', { path }, `Deleted: ${path}`, true);
                    return `Successfully deleted: ${path}`;
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    recordStep('delete_file', { path }, `Error: ${msg}`);
                    return `Error: ${msg}`;
                }
            },
        });

        // Add MCP tools if available
        if (this.mcpClients) {
            const mcpTools = await getMCPTools(this.mcpClients);
            Object.assign(tools, mcpTools);
        }

        return tools as ToolSet;
    }

    // ─────────────────────────────────────────────────────────────────
    // System Prompt
    // ─────────────────────────────────────────────────────────────────

    /**
     * Get the system prompt for the agent
     */
    private getSystemPrompt(): string {
        const features: string[] = [];

        if (this.config.reasoning?.enabled) {
            features.push('- Extended thinking enabled for complex reasoning');
        }
        if (this.config.webSearch?.enabled) {
            features.push('- Web search available for current information');
        }
        if (this.mcpClients) {
            features.push('- MCP integrations (Cursor, GitHub, Context7) available');
        }

        return `You are an expert software development agent with access to powerful tools.

## Your Capabilities

### Code Operations (Anthropic Tools)
- **bash**: Execute shell commands for git, tests, builds, etc.
- **str_replace_editor**: View and edit files with precision
- **delete_file**: Delete files (may require approval)

### Git Utilities
- **git_status**: Quick git status check
- **git_diff**: View changes in working directory

${features.length > 0 ? `### Special Features\n${features.join('\n')}` : ''}

### MCP Integrations (when available)
- **Cursor Agent MCP**: Spawn and manage background agents
- **GitHub MCP**: PR/issue management, code search
- **Context7 MCP**: Up-to-date library documentation

## Working Directory
${this.config.workingDirectory}

## Guidelines

1. **Be thorough**: Verify your changes work before reporting success
2. **Use appropriate tools**: Prefer MCP tools for GitHub operations
3. **Handle errors gracefully**: Try to understand and fix failures
4. **Document your actions**: Explain what you're doing
5. **Test your changes**: Run tests and linting after code changes
${this.config.approval?.requireApproval?.length ? '\n6. **Respect approval policies**: Some operations require user approval' : ''}

## When Triaging PRs
1. First understand the current state (CI status, feedback, changes)
2. Identify all blockers and unaddressed feedback
3. Fix issues systematically, starting with CI failures
4. Commit and push changes
5. Verify CI passes after your changes`;
    }

    private log(message: string): void {
        if (this.config.verbose) {
            console.log(message);
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Run a one-shot task with the agent
 */
export async function runTask(task: string, config?: AgentConfig): Promise<AgentResult> {
    const agent = new Agent(config);
    try {
        return await agent.execute(task);
    } finally {
        await agent.close();
    }
}

/**
 * Run a task with pre-analysis to determine optimal configuration
 */
export async function runSmartTask(
    task: string,
    config?: Omit<AgentConfig, 'reasoning' | 'webSearch'>
): Promise<AgentResult> {
    const agent = new Agent({
        ...config,
        reasoning: { enabled: false }, // Disable for analysis
        webSearch: { enabled: false },
    });

    try {
        // First, analyze the task
        const analysis = await agent.analyzeTask(task);

        console.log(`📊 Task Analysis:`);
        console.log(`   Complexity: ${analysis.complexity}`);
        console.log(`   Estimated steps: ${analysis.estimatedSteps}`);
        console.log(`   Needs reasoning: ${analysis.requiresReasoning}`);
        console.log(`   Needs web search: ${analysis.requiresWebSearch}`);

        // Execute with optimal settings
        return await agent.execute(task, {
            enableReasoning: analysis.requiresReasoning,
            enableWebSearch: analysis.requiresWebSearch,
        });
    } finally {
        await agent.close();
    }
}
