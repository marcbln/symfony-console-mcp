# Docker Console MCP Server

## Purpose
Provides a secure bridge for executing commands in Docker containers via the Model Context Protocol (MCP). Specifically handles `bin/console` commands in the container specified by CONTAINER_NAME environment variable through a stdio interface.

## Core Components
- **MCP Server Implementation**  
  Uses `@modelcontextprotocol/sdk` (v0.6.0) with:
  - Stdio transport (`StdioServerTransport`)
  - Tool-oriented architecture
  - Async command execution
  - Error handling with `McpError` codes

## Execution Flow
1. Accepts MCP requests via stdio
2. Validates/sanitizes Docker commands
3. Executes `docker exec ${CONTAINER_NAME} ${PATH_CONSOLE:-/www/bin/console} [command]` (CONTAINER_NAME environment variable required; PATH_CONSOLE defaults to /www/bin/console)
4. Returns combined stdout/stderr through MCP
5. Implements proper signal handling (SIGINT)

## Key Interfaces
```typescript
interface ConsoleCommand {
  command: string;  // bin/console arguments
}

interface ExecutionResult {
  content: Array<{ type: "text", text: string }>;
  isError: boolean;
}
```

## Security
- Basic command sanitization against `;&|` etc.
- Error isolation patterns
- Permission hardening (`chmod 755` in build)

## Error Handling
- Structured error codes (`ErrorCode.InvalidParams`)
- Combined stdout/stderr reporting
- Error logging with `[MCP Error]` prefix

## Dev Environment
- TypeScript 5.3 + Node 20 ES modules
- Build output: `build/index.js`
- Watch mode: `npm run watch`
- Production build: `npm run build`

## Observability
- All operational logs to stderr
- Command audit trail (`Executing: ...`)
- Error stack traces
