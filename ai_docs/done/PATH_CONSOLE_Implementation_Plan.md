# Implementation Plan: Introduce PATH_CONSOLE Environment Variable

This plan outlines the steps to introduce a new environment variable `PATH_CONSOLE` to the `docker-console-server` MCP server, allowing configuration of the console executable path within the target Docker container.

## 1. Modify Server Logic (`src/index.ts`)

*   **Read Environment Variable:** Access `process.env.PATH_CONSOLE` within the `CallToolRequestSchema` handler.
*   **Set Default Value:** If `PATH_CONSOLE` is not set or is empty, use the default value `/www/bin/console`. Store the determined path (either from the environment variable or the default) in a local variable (e.g., `consolePath`).
*   **Update Command Construction:** Modify the line constructing the `docker exec` command (currently around line 86) to use the `consolePath` variable instead of the hardcoded `bin/console`.
    *   *Current:* `docker exec ${process.env.CONTAINER_NAME} bin/console ${consoleCommand}`
    *   *Proposed:* `docker exec ${process.env.CONTAINER_NAME} ${consolePath} ${consoleCommand}`
*   **Update Tool Description (Optional but Recommended):** Modify the description for the `execute_console_command` tool (around line 42) to reflect the configurable path and mention the default.
    *   *Suggestion:* `Execute a command using the console script (default: /www/bin/console) inside the docker container "${process.env.CONTAINER_NAME ?? 'error-missing-env-CONTAINER_NAME'}"`

## 2. Update Documentation (`README.md`)

*   **Add to Environment Variables Section:** Document the new `PATH_CONSOLE` variable under the existing `CONTAINER_NAME` entry (around line 47). Explain its purpose (specifying the path to the console executable within the container) and state its default value (`/www/bin/console`).
*   **Update Configuration Examples:** Add `PATH_CONSOLE` to the `env` block in both the `claude_desktop_config.json` example (around line 61) and the RooCode example (around line 78). Show it commented out or set to the default to illustrate how it *could* be overridden.

## 3. Update Project Summary (`PROJECT_SUMMARY.md`)

*   **Modify Execution Flow Section:** Update the description of the `docker exec` command (around line 17) to reflect the use of `PATH_CONSOLE` and its default value.
    *   *Example Update:* "Executes `docker exec ${CONTAINER_NAME} ${PATH_CONSOLE:-/www/bin/console} [command]` (Requires `CONTAINER_NAME` env var; `PATH_CONSOLE` defaults to `/www/bin/console`)"

## 4. Testing Strategy (Conceptual)

*   **Default Path Test:** Run the server without setting `PATH_CONSOLE` and execute a command. Verify the `docker exec` command uses `/www/bin/console` (e.g., by checking server logs).
*   **Custom Path Test:** Run the server with `PATH_CONSOLE` set to a different valid path (e.g., `/app/myconsole`). Execute a command and verify the `docker exec` command uses the custom path.
*   **Error Handling:** Ensure the server still correctly handles a missing `CONTAINER_NAME` environment variable.
*   **Command Execution:** Verify that commands are still executed successfully in both default and custom path scenarios (assuming the paths and commands are valid within the target container).

## 5. Implementation Handoff

*   Switch to a suitable mode (e.g., "Code") to implement the changes outlined in steps 1, 2, and 3.

## Visual Plan (Mermaid Diagram)

```mermaid
graph TD
    A["Start: Introduce PATH_CONSOLE"] --> B{"Analyze src/index.ts"}
    B --> C["Identify hardcoded 'bin/console'"]
    C --> D["Modify code: Read PATH_CONSOLE w/ default"]
    D --> E["Update docker exec command"]
    D --> F["Update tool description (optional)"]

    A --> G{"Analyze README.md"}
    G --> H["Doc: Add PATH_CONSOLE to Env Vars"]
    G --> I["Doc: Update config examples"]

    A --> P{"Analyze PROJECT_SUMMARY.md"}
    P --> Q["Doc: Update Execution Flow section"]

    E --> J["Testing: Default Path"]
    E --> K["Testing: Custom Path"]

    H --> L["Documentation Complete"]
    I --> L
    Q --> L

    J --> M{"Plan Complete"}
    K --> M
    L --> M
    F --> M

    M --> N["Request User Approval"]
    N -- Approved --> O["Switch to Code Mode"]

    classDef code fill:#f9f,stroke:#333,stroke-width:2px
    classDef doc fill:#f9f,stroke:#333,stroke-width:2px
    classDef optional fill:#ccf,stroke:#333,stroke-width:1px
    classDef test fill:#cfc,stroke:#333,stroke-width:1px
    classDef final fill:#lightgrey,stroke:#333,stroke-width:2px

    class D,E,H,I,Q code
    class F optional
    class J,K,L test
    class O final