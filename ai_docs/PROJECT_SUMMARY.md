# Docker Console MCP Server

## Core Purpose
Secure execution bridge for running Symfony console commands in the "cm-www" Docker container via Model Context Protocol (MCP).

## Key Components
- **MCP Server Core**
  - `@modelcontextprotocol/sdk@0.6.0`
  - Stdio transport with SIGINT handling
  - Single tool interface: `execute_console_command`
  
- **Command Execution**
  ```typescript
  `docker exec cm-www bin/console ${sanitizedCommand}`
  ```
  - Sanitizes input against `;&|``$()`
  - Combines stdout/stderr streams
  - Error detection from stderr presence

## Security Architecture
- Input sanitization regex: `/[;&|`$()]/`
- Execution isolation through Docker
- Process hardening:
  ```json
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('build/index.js', '755')\""
  }
  ```

## Protocol Interfaces
**Tool Definition**
```typescript
{
  name: "execute_console_command",
  description: "Execute bin/console in cm-www container",
  inputSchema: {
    properties: { command: { type: "string" } },
    required: ["command"]
  }
}
```

**Response Structure**
```typescript
{
  content: Array<{ type: "text", text: string }>,
  isError: boolean // true if stderr present
}
```

## Operational Characteristics
- **Logging**: All ops to stderr
  - Command audit: `Executing: ...`
  - Error prefix: `[MCP Error]`
- **Signals**: Graceful SIGINT shutdown
- **Error Codes**:
  - `MethodNotFound` (404)
  - `InvalidParams` (400)

## Development Profile
- **Build Chain**:
  - TypeScript 5.3 → ES2022
  - Node 20 ESM modules
  - Output: `build/index.js` (chmod 755)
- **Scripts**:
  - Watch: `npm run watch`
  - Inspector: `npx @modelcontextprotocol/inspector`

## Execution Flow
1. MCP request via stdio
2. Validate/sanitize input
3. Construct Docker command
4. Execute & capture combined output
5. Return formatted response
6. Log diagnostics to stderr
