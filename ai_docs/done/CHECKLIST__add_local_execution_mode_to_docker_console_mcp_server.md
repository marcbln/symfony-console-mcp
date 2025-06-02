# Implementation Checklist: Add Local Execution Mode

## Phase 1: Core Logic Modifications (`src/index.ts`)

**File:** `src/index.ts`

-   [x] **Step 1.1: Rename `executeDockerConsoleCommand` and its type**
    -   [x] Rename function `executeDockerConsoleCommand` to `executeConsoleCommand`.
    -   [x] Rename type `DockerExecResult` to `ConsoleExecResult`.
    -   [x] Update all usages of `DockerExecResult` type to `ConsoleExecResult` (including `formatDockerResultToMcpResponse` parameter).
-   [x] **Step 1.2: Modify `executeConsoleCommand` for Dual Mode Execution**
    -   [x] Read `process.env.EXECUTION_MODE`, default to `"docker"`.
    -   [x] Keep existing `commandArgs` sanitization (`/[;&|`$()]/.test(commandArgs)`).
    -   [x] Implement `if/else if/else` block for `executionMode`:
        -   [x] **"docker" mode:**
            -   [x] Check for `process.env.CONTAINER_NAME`; throw error if missing.
            -   [x] Define `consolePathInContainer` using `process.env.PATH_CONSOLE` or default `'/www/bin/console'`.
            -   [x] Construct `fullCommand` using `docker exec ...`.
        -   [x] **"local" mode:**
            -   [x] Define `consolePathLocal` using `process.env.PATH_CONSOLE`.
            -   [x] Throw error if `consolePathLocal` is missing.
            -   [x] Construct `fullCommand` using `${consolePathLocal} ${commandArgs}`.
        -   [x] **else (unsupported mode):**
            -   [x] Throw error for unsupported `EXECUTION_MODE`.
    -   [x] Update `console.error` logging within `try/catch` to include `executionMode` and use `fullCommand`.
    -   [x] Ensure `try/catch` block for `execAsync(fullCommand)` correctly returns `ConsoleExecResult` structure.
-   [x] **Step 1.3: Update Calls to the Renamed Execution Function**
    -   [x] In `CallToolRequestSchema` handler:
        -   [x] Update call for `execute_console_command` case to `executeConsoleCommand(...)`.
        -   [x] Update call for `list_commands` case to `executeConsoleCommand(...)`.
        -   [x] Update call for `command_help` case to `executeConsoleCommand(...)`.
-   [x] **Step 1.4: Update `formatDockerResultToMcpResponse` function signature**
    -   [x] Change parameter type from `DockerExecResult` to `ConsoleExecResult`.
    -   [x] (Optional: Consider renaming function to `formatConsoleResultToMcpResponse` and update call sites if done).
-   [x] **Step 1.5: Update Server Description**
    -   [x] In `Server` constructor, modify the `description` property to reflect dual-mode capability and relevant environment variables.
-   [x] **Step 1.6: Update Tool Descriptions in `ListToolsRequestSchema`**
    -   [x] For `execute_console_command`: Update description to mention `EXECUTION_MODE`, `CONTAINER_NAME` (docker), and `PATH_CONSOLE` (both modes).
    -   [x] For `list_commands`: Update description to be more generic, referencing `PATH_CONSOLE` and `EXECUTION_MODE`.
    -   [x] For `command_help`: Update description similarly to `list_commands`.

## Phase 2: Documentation Updates (`README.md`)

**File:** `README.md`

-   [x] **Step 2.1: Add `EXECUTION_MODE` to Environment Variables Section**
    -   [x] Add documentation for `EXECUTION_MODE` (optional, "docker" (default), "local").
    -   [x] Explain behavior and requirements for each mode.
-   [x] **Step 2.2: Update `PATH_CONSOLE` and `CONTAINER_NAME` Descriptions**
    -   [x] Modify `CONTAINER_NAME` description: required for "docker" mode, ignored for "local".
    -   [x] Modify `PATH_CONSOLE` description: path in container for "docker" mode (optional, default), path on host for "local" mode (required).
-   [x] **Step 2.3: Add Configuration Example for Local Execution**
    -   [x] Add a new JSON configuration example demonstrating `EXECUTION_MODE="local"`.

## Phase 3: Project Summary Updates

**Files:** `ai_docs/PROJECT_SUMMARY_A.md` and `ai_docs/PROJECT_SUMMARY_B.md`

-   [x] **Step 3.1: Update `ai_docs/PROJECT_SUMMARY_A.md`**
    -   [x] "Core Purpose": Mention dual execution capability and `EXECUTION_MODE`.
    -   [x] "Command Execution": Describe command structure for both "docker" and "local" modes, referencing relevant env vars.
    -   [x] Review other sections for necessary adjustments.
-   [x] **Step 3.2: Update `ai_docs/PROJECT_SUMMARY_B.md`**
    -   [x] Apply similar updates as in `PROJECT_SUMMARY_A.md` ("Core Purpose", "Command Execution").

## Final Review & Build

-   [x] All file modifications saved.
-   [x] Server builds successfully (`npm run build`).
-   [x] (Conceptual) Test scenarios pass (see Testing Guidance in the main plan).
