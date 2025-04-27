# Plan: Add `list_commands` and `command_help` Tools to Docker Console Server

This plan outlines the steps to add two new tools (`list_commands` and `command_help`) to the existing MCP server (`docker-console-server`).

## Goals

1.  Expose a `list_commands` tool that executes `bin/console list --format=json` inside the specified Docker container.
2.  Expose a `command_help` tool that executes `bin/console {commandName} --help` inside the specified Docker container.
3.  Refactor the command execution logic into a reusable helper function for maintainability.

## Implementation Steps

1.  **Define New Tools in `ListToolsRequestSchema` Handler (`src/index.ts`):**
    *   Modify the handler (around line 37) to include definitions for the two new tools alongside `execute_console_command`.
    *   `list_commands`:
        *   Description: "Lists available console commands using `bin/console list --format=json`."
        *   `inputSchema`: `{ type: "object", properties: {} }` (no arguments).
    *   `command_help`:
        *   Description: "Gets help for a specific console command using `bin/console {commandName} --help`."
        *   `inputSchema`: `{ type: "object", properties: { commandName: { type: "string", description: "The name of the command to get help for." } }, required: ["commandName"] }`.

2.  **Create Reusable Command Execution Helper Function (`src/index.ts`):**
    *   Define a new async function, e.g., `executeDockerConsoleCommand(commandArgs: string)`.
    *   This function will encapsulate the logic currently in the `CallToolRequestSchema` handler (lines 83-116):
        *   Accept `commandArgs` (e.g., `"list --format=json"`, `"cache:clear"`, `"debug:router --help"`).
        *   Perform basic sanitization on `commandArgs` (similar to lines 79-81, but adapted for general args). *Caution: Ensure sanitization is robust enough for the different command structures.*
        *   Check for `process.env.CONTAINER_NAME`.
        *   Construct the full `docker exec` command: `docker exec ${process.env.CONTAINER_NAME} ${process.env.PATH_CONSOLE || '/www/bin/console'} ${commandArgs}`.
        *   Execute using `execAsync`.
        *   Handle errors (`try/catch`), logging, and formatting the result (`stdout`/`stderr`) into the standard MCP tool response structure (`{ content: [{ type: "text", text: ... }], isError: boolean }`).

3.  **Update `CallToolRequestSchema` Handler (`src/index.ts`):**
    *   Refactor the handler (around line 67) to use a conditional structure (`if/else if` or `switch`) based on `request.params.name`.
    *   **`execute_console_command` case:**
        *   Keep existing argument validation (`isValidExecArgs`).
        *   Call `executeDockerConsoleCommand(request.params.arguments.command)`.
    *   **`list_commands` case:**
        *   No specific argument validation needed.
        *   Call `executeDockerConsoleCommand("list --format=json")`.
    *   **`command_help` case:**
        *   Add a new validation function (e.g., `isValidHelpArgs`) for `{ commandName: string }`.
        *   Call `executeDockerConsoleCommand(\`${request.params.arguments.commandName} --help\`)`.
    *   **Default case:** Throw `McpError(ErrorCode.MethodNotFound, ...)` for unknown tools.

## Diagram

```mermaid
subgraph Define_Tools [Define Tools]
    A[ListTools Handler] --> B(Add 'list_commands' definition);
    A --> C(Add 'command_help' definition);
end

subgraph Handle_Tool_Calls [Handle Tool Calls]
    D[CallTool Handler] --> E{Tool Name?};
    E -- execute_console_command --> F[Validate 'command' arg];
    E -- list_commands --> G[No args needed];
    E -- command_help --> H[Validate 'commandName' arg];
    E -- other --> I[Error: Unknown Tool];

    F --> J(Construct args: `args.command`);
    G --> K(Construct args: `"list --format=json"`);
    H --> L(Construct args: `args.commandName + " --help"`);

    J --> M{Call executeDockerConsoleCommand};
    K --> M;
    L --> M;
end

subgraph Execution_Helper [Execution Helper]
    N[executeDockerConsoleCommand(args)] --> O[Sanitize args];
    O --> P[Check ENV VARS];
    P --> Q[Build `docker exec` command];
    Q --> R[Execute command];
    R --> S[Handle stdout/stderr/errors];
    S --> T[Format MCP Response];
end

M --> T;
T --> U[Return MCP Response];
I --> U;
```

