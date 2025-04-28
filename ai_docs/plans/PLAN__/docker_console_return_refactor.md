# Revised Plan: Refactor `executeDockerConsoleCommand` Return Format

**Objective:** Modify the `executeDockerConsoleCommand` function in `src/index.ts` to *always* return an object `{ stdout: string, stderr: string, exitCode: number }`. Create a new helper function to handle the logic of formatting this object into the final MCP response, returning only `stdout` on clean success, or full details otherwise.

**Previous Plan:** The initial plan involved `executeDockerConsoleCommand` returning different types (string or object). This was revised based on user feedback.

**Revised Detailed Plan:**

1.  **Refactor `executeDockerConsoleCommand` (Lines 21-63):**
    *   Update function signature to clearly return `Promise<{ stdout: string, stderr: string, exitCode: number }>`.
    *   **`try` block (Success):**
        *   After `await execAsync(...)`, always return the full object: `return { stdout, stderr, exitCode: 0 };`
    *   **`catch` block (Failure):**
        *   Extract `stdout`, `stderr`, `exitCode` from the `error` object (use default `exitCode: 1` if `error.code` is missing).
        *   Always return the full object: `return { stdout, stderr, exitCode };`

2.  **Create New Helper Function `formatDockerResultToMcpResponse`:**
    *   Place this function likely before the `CallToolRequestSchema` handler.
    *   Signature: `function formatDockerResultToMcpResponse(result: { stdout: string, stderr: string, exitCode: number }): McpToolResult { ... }` (Assuming `McpToolResult` is the correct type for the return value of the handler).
    *   **Logic:**
        *   Check for clean success: `if (result.exitCode === 0 && !result.stderr)`
        *   If true: Return `{ content: [{ type: "text", text: result.stdout }], isError: false };`
        *   If false (error or stderr): Format detailed message `const message = \`Exit Code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}\`;` and return `{ content: [{ type: "text", text: message }], isError: true };`

3.  **Refactor `CallToolRequestSchema` Handler (Lines 143-186):**
    *   **`execute_console_command` case:**
        ```typescript
        const result = await executeDockerConsoleCommand(request.params.arguments.command);
        return formatDockerResultToMcpResponse(result);
        ```
    *   **`command_help` case:**
        ```typescript
        const result = await executeDockerConsoleCommand(`${request.params.arguments.commandName} --help`);
        return formatDockerResultToMcpResponse(result);
        ```
    *   **`list_commands` case:**
        ```typescript
        const result = await executeDockerConsoleCommand("list --format=json");
        // Special handling for JSON parsing on clean success
        if (result.exitCode === 0 && !result.stderr) {
          try {
            JSON.parse(result.stdout); // Validate
            return { content: [{ type: "text", text: result.stdout }], isError: false }; // Return raw stdout
          } catch (parseError: any) {
            console.error("Failed to parse list_commands output as JSON:", parseError);
            const message = `Failed to parse JSON output:\n${parseError.message}\n\nRaw Output:\n${result.stdout}`;
            return { content: [{ type: "text", text: message }], isError: true }; // Return specific parse error
          }
        } else {
          // Handle errors or stderr using the standard helper
          return formatDockerResultToMcpResponse(result);
        }
        ```

**Revised Mermaid Diagram:**

```mermaid
graph TD
    subgraph executeDockerConsoleCommand (Always returns object)
        A[Start] --> B{execAsync};
        B -- Success --> C[Set exitCode = 0];
        B -- Failure (error) --> D[Extract stdout, stderr, exitCode from error];
        C --> E[Return {stdout, stderr, exitCode}];
        D --> E;
    end

    subgraph formatDockerResultToMcpResponse (New Helper)
        F[Input: {stdout, stderr, exitCode}] --> G{exitCode === 0 AND stderr empty?};
        G -- Yes --> H[Format Success MCP Response (stdout only)];
        G -- No --> I[Format Error MCP Response (exitCode, stdout, stderr)];
        H --> J[Return MCP Response];
        I --> J;
    end

    subgraph CallToolRequestSchema Handler
        K[Call executeDockerConsoleCommand] --> L[Receive result object];
        L --> M{Tool is list_commands?};
        M -- No --> N[Call formatDockerResultToMcpResponse(result)];
        M -- Yes --> O{result.exitCode === 0 AND result.stderr empty?};
        O -- No --> N; // Handle error/stderr case using the helper
        O -- Yes --> P{Try JSON.parse(result.stdout)?};
        P -- Success --> Q[Format Success MCP Response (stdout only)];
        P -- Failure --> R[Format JSON Parse Error MCP Response];
        N --> Z[Return MCP Response];
        Q --> Z;
        R --> Z;
    end

    style E fill:#ccffff,stroke:#333,stroke-width:2px
    style H fill:#ccffcc,stroke:#333,stroke-width:2px
    style I fill:#ffcccc,stroke:#333,stroke-width:2px
    style Q fill:#ccffcc,stroke:#333,stroke-width:2px
    style R fill:#ffcccc,stroke:#333,stroke-width:2px