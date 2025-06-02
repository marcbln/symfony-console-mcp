# Plan: Add Local Execution Mode to Docker Console MCP Server

**Objective:** Modify the existing Docker Console MCP server to support running console commands directly on the local host machine, in addition to the current Docker execution. This will be controlled by a new environment variable `EXECUTION_MODE`.

**Overview of Changes:**

1.  **Core Logic (`src/index.ts`):**
    *   Introduce logic to read an `EXECUTION_MODE` environment variable (defaulting to "docker").
    *   Rename `executeDockerConsoleCommand` to `executeConsoleCommand`.
    *   Modify `executeConsoleCommand` to build and execute commands based on `EXECUTION_MODE`:
        *   If "docker": a `docker exec` command (existing behavior, `CONTAINER_NAME` required).
        *   If "local": a direct command execution on the host (`PATH_CONSOLE` required as the executable path).
    *   Update server and tool descriptions to reflect this new dual capability.
2.  **Documentation (`README.md`):**
    *   Document the new `EXECUTION_MODE` environment variable.
    *   Clarify how `PATH_CONSOLE` and `CONTAINER_NAME` are used in each mode.
    *   Add configuration examples for local execution.
3.  **Project Summaries (`ai_docs/PROJECT_SUMMARY_A.md`, `ai_docs/PROJECT_SUMMARY_B.md`):**
    *   Update relevant sections to include information about `EXECUTION_MODE` and local execution.

---

## Detailed Steps

### Phase 1: Core Logic Modifications (`src/index.ts`)

**File:** `src/index.ts`

**Step 1.1: Rename `executeDockerConsoleCommand` and its type**
   - **Action:** Rename the function `executeDockerConsoleCommand` (approx. line 21) to `executeConsoleCommand`.
   - **Action:** Rename the type `DockerExecResult` (approx. line 15) to `ConsoleExecResult`. Update all usages of this type (function return type and `formatDockerResultToMcpResponse` parameter type).
   - **Reasoning:** The function will now handle more than just Docker execution.

**Step 1.2: Modify `executeConsoleCommand` for Dual Mode Execution**
   - **Locate:** The newly renamed `executeConsoleCommand` function.
   - **Action:** Implement the following logic:
     ```typescript
     // At the beginning of the function
     const executionMode = process.env.EXECUTION_MODE || "docker"; // Default to "docker"

     // Keep the existing commandArgs sanitization, it's important for both modes
     if (/[;&|`$()]/.test(commandArgs)) {
         throw new McpError(ErrorCode.InvalidParams, 'Invalid characters detected in command arguments.');
     }

     let fullCommand: string;

     if (executionMode === "docker") {
         if (!process.env.CONTAINER_NAME) {
             throw new Error('CONTAINER_NAME environment variable is required for docker execution mode.');
         }
         const consolePathInContainer = process.env.PATH_CONSOLE || '/www/bin/console';
         fullCommand = `docker exec ${process.env.CONTAINER_NAME} ${consolePathInContainer} ${commandArgs}`;
     } else if (executionMode === "local") {
         const consolePathLocal = process.env.PATH_CONSOLE;
         if (!consolePathLocal) {
             // PATH_CONSOLE is essential for local mode to know what to execute.
             throw new Error('PATH_CONSOLE environment variable is required for local execution mode (e.g., "php /path/to/bin/console" or "/usr/local/bin/mycommand").');
         }
         // commandArgs is already sanitized above.
         // Construct the command for local execution.
         fullCommand = `${consolePathLocal} ${commandArgs}`;
     } else {
         throw new Error(`Unsupported EXECUTION_MODE: "${executionMode}". Supported modes are "docker" or "local".`);
     }

     // Modify logging in the try/catch block to include executionMode
     try {
         // OLD: console.error(`Executing: ${fullDockerCommand}`);
         // NEW:
         console.error(`Executing (mode: ${executionMode}): ${fullCommand}`);
         const { stdout, stderr } = await execAsync(fullCommand);
         return { stdout, stderr, exitCode: 0 };
     } catch (error: any) {
         // OLD: console.error(`Error executing command: ${error}`);
         // NEW:
         console.error(`Error executing command (mode: ${executionMode}): ${error}`);
         const stdout = error.stdout || '';
         const stderr = error.stderr || '';
         const exitCode = typeof error.code === 'number' ? error.code : 1;
         return { stdout, stderr, exitCode };
     }
     ```
   - **Note:** Ensure the rest of the function (error handling, return structure) remains compatible with the `ConsoleExecResult` type.

**Step 1.3: Update Calls to the Renamed Execution Function**
   - **Locate:** The `CallToolRequestSchema` handler (approx. line 143).
   - **Action:** Update all calls from `executeDockerConsoleCommand(...)` to `executeConsoleCommand(...)`.
     - Example for `execute_console_command` case (approx. line 149):
       ```typescript
       // OLD: const result = await executeDockerConsoleCommand(request.params.arguments.command);
       // NEW:
       const result = await executeConsoleCommand(request.params.arguments.command);
       ```
     - Apply similar changes for `list_commands` (approx. line 153) and `command_help` (approx. line 170) cases.

**Step 1.4: Update `formatDockerResultToMcpResponse` function signature**
   - **Locate:** The `formatDockerResultToMcpResponse` function (approx. line 123).
   - **Action:** Update its parameter type from `DockerExecResult` to `ConsoleExecResult`.
     ```typescript
     // OLD: function formatDockerResultToMcpResponse(result: DockerExecResult) {
     // NEW:
     function formatDockerResultToMcpResponse(result: ConsoleExecResult) { // Renamed type
     ```
   - **Consider Renaming:** While not strictly necessary for functionality, consider renaming `formatDockerResultToMcpResponse` to `formatConsoleResultToMcpResponse` for consistency, though this is lower priority. If renamed, update its call sites in the `CallToolRequestSchema` handler. (For this plan, we will assume it is *not* renamed to minimize changes unless explicitly decided otherwise).

**Step 1.5: Update Server Description**
   - **Locate:** The `Server` constructor (approx. line 53).
   - **Action:** Modify the `description` property:
     ```typescript
     // OLD: description: "Execute console commands inside a docker container specified by CONTAINER_NAME with PATH_CONSOLE for executable path",
     // NEW:
     description: "Executes console commands either locally or inside a docker container. Configured by EXECUTION_MODE, CONTAINER_NAME (for docker mode), and PATH_CONSOLE.",
     ```

**Step 1.6: Update Tool Descriptions in `ListToolsRequestSchema`**
   - **Locate:** The `ListToolsRequestSchema` handler (approx. line 70).
   - **Action:** Modify the descriptions for each tool to reflect the dual-mode capability and environment variable usage.
     - For `execute_console_command` (approx. line 75):
       ```typescript
       // OLD: description: `Execute a command using console script (${process.env.PATH_CONSOLE || '/www/bin/console'}) inside docker container "${process.env.CONTAINER_NAME || 'error-missing-env-CONTAINER_NAME'}"`,
       // NEW (example, adjust as needed for conciseness and clarity):
       description: `Executes a console command. Current server EXECUTION_MODE: "${process.env.EXECUTION_MODE || 'docker'}". ` +
                    `In "docker" mode, uses container "${process.env.CONTAINER_NAME || '(CONTAINER_NAME not set)'}" and console path "${process.env.PATH_CONSOLE || '/www/bin/console'}". ` +
                    `In "local" mode, uses host console path "${process.env.PATH_CONSOLE || '(PATH_CONSOLE not set)'}" (PATH_CONSOLE is required for local mode).`,
       ```
     - For `list_commands` (approx. line 89):
       ```typescript
       // OLD: description: "Lists available console commands using `bin/console list --format=json`.",
       // NEW:
       description: "Lists available console commands (e.g., using `PATH_CONSOLE list --format=json`). Behavior depends on EXECUTION_MODE and PATH_CONSOLE.",
       ```
     - For `command_help` (approx. line 93):
       ```typescript
       // OLD: description: "Gets help for a specific console command using `bin/console {commandName} --help`.",
       // NEW:
       description: "Gets help for a specific console command (e.g., using `PATH_CONSOLE {commandName} --help`). Behavior depends on EXECUTION_MODE and PATH_CONSOLE.",
       ```

### Phase 2: Documentation Updates (`README.md`)

**File:** `README.md`

**Step 2.1: Add `EXECUTION_MODE` to Environment Variables Section**
   - **Locate:** The "Environment Variables" section (approx. line 45).
   - **Action:** Add documentation for `EXECUTION_MODE` *before* `CONTAINER_NAME`.
     ```markdown
     - `EXECUTION_MODE` (optional): Specifies where commands are executed.
       - `"docker"` (default): Executes commands in a Docker container. `CONTAINER_NAME` is required. `PATH_CONSOLE` refers to the path inside the container.
       - `"local"`: Executes commands on the host machine. `PATH_CONSOLE` is required and must be the full path or command to the console executable on the host (e.g., `php /path/to/app/bin/console` or `/usr/local/bin/myconsole`). `CONTAINER_NAME` is ignored in this mode.
     ```

**Step 2.2: Update `PATH_CONSOLE` and `CONTAINER_NAME` Descriptions**
   - **Action:** Modify the existing descriptions for `PATH_CONSOLE` and `CONTAINER_NAME` to clarify their role based on `EXECUTION_MODE`.
     - For `CONTAINER_NAME`:
       ```markdown
       // OLD: - `CONTAINER_NAME` (required): The name of the Docker container to connect to
       // NEW:
       - `CONTAINER_NAME`: The name of the Docker container to connect to. Required if `EXECUTION_MODE` is "docker" (or not set). Ignored if `EXECUTION_MODE` is "local".
       ```
     - For `PATH_CONSOLE`:
       ```markdown
       // OLD: - `PATH_CONSOLE` (optional): Path to the console executable inside the container (default: /www/bin/console)
       // NEW:
       - `PATH_CONSOLE`: Path to the console executable.
         - If `EXECUTION_MODE` is "docker" (or not set): Path inside the container (optional, default: `/www/bin/console`).
         - If `EXECUTION_MODE` is "local": Path on the host machine (required, e.g., `php /path/to/your-project/bin/console`).
       ```

**Step 2.3: Add Configuration Example for Local Execution**
   - **Locate:** The "RooCode Configuration" or a similar section for configuration examples (approx. line 70 or create a new subsection).
   - **Action:** Add a new example demonstrating `EXECUTION_MODE="local"`.
     ```json
     ### Example: Local Execution Mode (RooCode / claude_desktop_config.json)

     You can configure another instance of the server (or modify an existing one) to run commands locally:

     ```json
     {
         "mcpServers": {
              // ... other servers ...
             "my-local-console": {
                 "command": "node", // Or the direct path to your built index.js
                 "args":    [
                     "/path/to/your/docker-console-server/build/index.js"
                 ],
                 "env":     {
                     "EXECUTION_MODE": "local",
                     "PATH_CONSOLE": "php /home/user/my_project/bin/console" // Example: PHP Symfony console
                     // "CONTAINER_NAME" would be ignored here
                 }
             }
         }
     }
     ```

### Phase 3: Project Summary Updates

**Files:** `ai_docs/PROJECT_SUMMARY_A.md` and `ai_docs/PROJECT_SUMMARY_B.md`

**Step 3.1: Update `ai_docs/PROJECT_SUMMARY_A.md`**
   - **Locate:** "Core Purpose" section.
     - **Action:** Mention the dual execution capability.
       Example: "...via Model Context Protocol (MCP) v0.6.0. Operates in 'docker' or 'local' mode via `EXECUTION_MODE` env var. Docker mode uses `CONTAINER_NAME`..."
   - **Locate:** "Command Execution" section.
     - **Action:** Update the command representation to show conditional logic or describe both modes.
       Example:
       ```
       - Execution depends on `EXECUTION_MODE` (default "docker"):
         - **Docker Mode:** `docker exec ${CONTAINER_NAME} ${PATH_CONSOLE:-/www/bin/console} [command]`
           (Requires `CONTAINER_NAME`; `PATH_CONSOLE` is in-container path)
         - **Local Mode:** `${PATH_CONSOLE} [command]`
           (Requires `PATH_CONSOLE` as host path/command)
       ```
   - **Review:** Other sections like "Security" or "Operational Details" for any implications, though primary changes are above.

**Step 3.2: Update `ai_docs/PROJECT_SUMMARY_B.md`**
   - **Action:** Apply similar updates as in `PROJECT_SUMMARY_A.md` to ensure consistency. Focus on "Core Purpose" and "Command Execution" sections.

---

## Testing Guidance (for AI Validation)

After implementation, the AI should conceptually (or actually, if capable) verify:

1.  **Docker Mode (Backward Compatibility):**
    *   Server starts and runs commands correctly with `EXECUTION_MODE` unset (defaults to "docker"). `CONTAINER_NAME` and (optional) `PATH_CONSOLE` (for in-container path) are respected.
    *   Server starts and runs commands correctly with `EXECUTION_MODE="docker"`.
    *   Error if `CONTAINER_NAME` is missing when in "docker" mode.
2.  **Local Mode:**
    *   Server starts and runs commands correctly with `EXECUTION_MODE="local"` and a valid `PATH_CONSOLE` (for host path).
    *   Error if `PATH_CONSOLE` is missing when in "local" mode.
    *   `CONTAINER_NAME` (if set) is ignored.
3.  **Invalid Configuration:**
    *   Error if `EXECUTION_MODE` is set to an unsupported value.
4.  **Command Execution & Sanitization:**
    *   Valid commands execute successfully in both modes.
    *   Commands with invalid characters (e.g., `;`, `|`, `&`) are rejected with an `McpError` (InvalidParams) in both modes, as per existing sanitization.
5.  **Tool Functionality:**
    *   `execute_console_command`, `list_commands`, and `command_help` tools work as expected in both execution modes.
    *   Descriptions reflect the current configuration.

---

**Final Review:**
Ensure all file modifications are saved, and the server can be built (`npm run build`) and run without errors (other than those intentionally thrown for configuration issues).
