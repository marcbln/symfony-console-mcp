# Implementation Checklist: Add Local Execution Mode

## Phase 1: Core Logic Modifications (`src/index.ts`)

**File:** `src/index.ts`

-   [ ] **Step 1.1: Rename `executeDockerConsoleCommand` and its type**
    -   [ ] Rename function `executeDockerConsoleCommand` to `executeConsoleCommand`.
    -   [ ] Rename type `DockerExecResult` to `ConsoleExecResult`.
    -   [ ] Update all usages of `DockerExecResult` type to `ConsoleExecResult` (including `formatDockerResultToMcpResponse` parameter).
-   [ ] **Step 1.2: Modify `executeConsoleCommand` for Dual Mode Execution**
    -   [ ] Read `process.env.EXECUTION_MODE`, default to `"docker"`.
    -   [ ] Keep existing `commandArgs` sanitization (`/[;&|`$()]/.test(commandArgs)`).
    -   [ ] Implement `if/else if/else` block for `executionMode`:
        -   [ ] **"docker" mode:**
            -   [ ] Check for `process.env.CONTAINER_NAME`; throw error if missing.
            -   [ ] Define `consolePathInContainer` using `process.env.PATH_CONSOLE` or default `'/www/bin/console'`.
            -   [ ] Construct `fullCommand` using `docker exec ...`.
        -   [ ] **"local" mode:**
            -   [ ] Define `consolePathLocal` using `process.env.PATH_CONSOLE`.
            -   [ ] Throw error if `consolePathLocal` is missing.
            -   [ ] Construct `fullCommand` using `${consolePathLocal} ${commandArgs}`.
        -   [ ] **else (unsupported mode):**
            -   [ ] Throw error for unsupported `EXECUTION_MODE`.
    -   [ ] Update `console.error` logging within `try/catch` to include `executionMode` and use `fullCommand`.
    -   [ ] Ensure `try/catch` block for `execAsync(fullCommand)` correctly returns `ConsoleExecResult` structure.
-   [ ] **Step 1.3: Update Calls to the Renamed Execution Function**
    -   [ ] In `CallToolRequestSchema` handler:
        -   [ ] Update call for `execute_console_command` case to `executeConsoleCommand(...)`.
        -   [ ] Update call for `list_commands` case to `executeConsoleCommand(...)`.
        -   [ ] Update call for `command_help` case to `executeConsoleCommand(...)`.
-   [ ] **Step 1.4: Update `formatDockerResultToMcpResponse` function signature**
    -   [ ] Change parameter type from `DockerExecResult` to `ConsoleExecResult`.
    -   [ ] (Optional: Consider renaming function to `formatConsoleResultToMcpResponse` and update call sites if done).
-   [ ] **Step 1.5: Update Server Description**
    -   [ ] In `Server` constructor, modify the `description` property to reflect dual-mode capability and relevant environment variables.
-   [ ] **Step 1.6: Update Tool Descriptions in `ListToolsRequestSchema`**
    -   [ ] For `execute_console_command`: Update description to mention `EXECUTION_MODE`, `CONTAINER_NAME` (docker), and `PATH_CONSOLE` (both modes).
    -   [ ] For `list_commands`: Update description to be more generic, referencing `PATH_CONSOLE` and `EXECUTION_MODE`.
    -   [ ] For `command_help`: Update description similarly to `list_commands`.

## Phase 2: Documentation Updates (`README.md`)

**File:** `README.md`

-   [ ] **Step 2.1: Add `EXECUTION_MODE` to Environment Variables Section**
    -   [ ] Add documentation for `EXECUTION_MODE` (optional, "docker" (default), "local").
    -   [ ] Explain behavior and requirements for each mode.
-   [ ] **Step 2.2: Update `PATH_CONSOLE` and `CONTAINER_NAME` Descriptions**
    -   [ ] Modify `CONTAINER_NAME` description: required for "docker" mode, ignored for "local".
    -   [ ] Modify `PATH_CONSOLE` description: path in container for "docker" mode (optional, default), path on host for "local" mode (required).
-   [ ] **Step 2.3: Add Configuration Example for Local Execution**
    -   [ ] Add a new JSON configuration example demonstrating `EXECUTION_MODE="local"`.

## Phase 3: Project Summary Updates

**Files:** `ai_docs/PROJECT_SUMMARY_A.md` and `ai_docs/PROJECT_SUMMARY_B.md`

-   [ ] **Step 3.1: Update `ai_docs/PROJECT_SUMMARY_A.md`**
    -   [ ] "Core Purpose": Mention dual execution capability and `EXECUTION_MODE`.
    -   [ ] "Command Execution": Describe command structure for both "docker" and "local" modes, referencing relevant env vars.
    -   [ ] Review other sections for necessary adjustments.
-   [ ] **Step 3.2: Update `ai_docs/PROJECT_SUMMARY_B.md`**
    -   [ ] Apply similar updates as in `PROJECT_SUMMARY_A.md` ("Core Purpose", "Command Execution").

## Final Review & Build

-   [ ] All file modifications saved.
-   [ ] Server builds successfully (`npm run build`).
-   [ ] (Conceptual) Test scenarios pass (see Testing Guidance in the main plan).
