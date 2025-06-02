# Docker Console MCP Server

## Core Purpose
Secure execution bridge for running Symfony console commands via Model Context Protocol (MCP) v0.6.0. Operates in 'docker' or 'local' mode via `EXECUTION_MODE` env var. Docker mode uses `CONTAINER_NAME` (required) to specify target container with strict input validation.

## Key Components
- **MCP Server Core**
  - @modelcontextprotocol/sdk@0.6.0
  - Bidirectional stdio transport with SIGINT handling
  - Single endpoint: `execute_console_command`
  - Automatic connection cleanup on shutdown

- **Command Execution**
  - Execution depends on `EXECUTION_MODE` (default "docker"):
    - **Docker Mode:** `docker exec ${CONTAINER_NAME} ${PATH_CONSOLE:-/www/bin/console} [command]`
      (Requires `CONTAINER_NAME`; `PATH_CONSOLE` is in-container path)
    - **Local Mode:** `${PATH_CONSOLE} [command]`
      (Requires `PATH_CONSOLE` as host path/command)
  - Sanitizes input against ``;&|`$()`` (blocks command injection)
  - Combines stdout/stderr streams
  - Error detection from exit code **and** stderr presence

## Security
- Input sanitization regex: ``/[;&|`$()]/g``
- Docker container isolation with strict process namespace
- Defense-in-depth measures:
  - File permissions: `chmod 755 build/index.js`
  - Separate I/O streams for control/data plane
  - Process lifecycle management with SIGINT handler
  - File system hardening for build artifacts

## Protocol
**Request:**
```json
{
  "name": "execute_console_command",
  "description": "Execute console in container specified by CONTAINER_NAME",
  "inputSchema": {
    "properties": {
      "command": {
        "type": "string",
        "pattern": "^[^;&|`$()]+$"
      }
    },
    "required": ["command"]
  }
}
```

**Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "string"
  }],
  "isError": true  // Non-zero exit code or stderr detected
}
```

## Operational Details
- **Logging**: All operations to stderr
  - Command audit: `Executing: ${command}`
  - Error prefix: `[MCP Error]`
- **Error Codes**:
  - 404: `MethodNotFound`
  - 400: `InvalidCommand` (validation failure)
  - 500: `ExecutionError` (command failure)
- **Signal Handling**: Graceful shutdown via SIGINT

## Development
- **Build Chain**:
  - TypeScript 5.3 → ES2022
  - Node.js 20 ESM modules
  - Output: `build/index.js` (executable)
- **Scripts**:
  - `watch`: Rebuild on file changes
  - `test`: Run validation tests
  - `inspect`: `npx @modelcontextprotocol/inspector`

## Execution Flow
1. Receive MCP request via stdio
2. Validate/sanitize input parameters
3. Verify CONTAINER_NAME is set
4. Construct Docker command
5. Execute and capture combined output
6. Return formatted JSON response
7. Log diagnostics to stderr
