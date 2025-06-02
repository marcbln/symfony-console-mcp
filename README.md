# docker-console-server MCP Server

mkdir -p /home/marc/.local/share/Roo-Code/MCP &amp;&amp; cd /home/marc/.local/share/Roo-Code/MCP &amp;&amp; npx -y @modelcontextprotocol/create-server docker-console-server

This is a TypeScript-based MCP server that implements a simple notes system. It demonstrates core MCP concepts by providing:

- Resources representing text notes with URIs and metadata
- Tools for creating new notes
- Prompts for generating summaries of notes

## Features

### Resources
- List and access notes via `note://` URIs
- Each note has a title, content and metadata
- Plain text mime type for simple content access

### Tools
- `create_note` - Create new text notes
  - Takes title and content as required parameters
  - Stores note in server state

### Prompts
- `summarize_notes` - Generate a summary of all stored notes
  - Includes all note contents as embedded resources
  - Returns structured prompt for LLM summarization

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

### Environment Variables
- `EXECUTION_MODE` (optional): Specifies where commands are executed.
  - `"docker"` (default): Executes commands in a Docker container. `CONTAINER_NAME` is required. `PATH_CONSOLE` refers to the path inside the container.
  - `"local"`: Executes commands on the host machine. `PATH_CONSOLE` is required and must be the full path or command to the console executable on the host (e.g., `php /path/to/app/bin/console` or `/usr/local/bin/myconsole`). `CONTAINER_NAME` is ignored in this mode.
- `CONTAINER_NAME`: The name of the Docker container to connect to. Required if `EXECUTION_MODE` is "docker" (or not set). Ignored if `EXECUTION_MODE` is "local".
- `PATH_CONSOLE`: Path to the console executable.
  - If `EXECUTION_MODE` is "docker" (or not set): Path inside the container (optional, default: `/www/bin/console`).
  - If `EXECUTION_MODE` is "local": Path on the host machine (required, e.g., `php /path/to/your-project/bin/console`).

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docker-console-server": {
      "command": "/path/to/docker-console-server/build/index.js"
    },
    "env": {
      "CONTAINER_NAME": "mf-www"
    }
  }
}
```
### RooCode Configuration
Example configuration showing environment variable usage:

#### Docker Execution Mode (Default)
```json
{
    "mcpServers": {
         // ...
        "docker-console-server": {
            "command": "node",
            "args":    [
                "/home/marc/devel/mcp-servers/docker-console-server-roo/build/index.js"
            ],
            "env":     {
                "CONTAINER_NAME": "mf-www"
            }
        }
    }
}
```

#### Local Execution Mode
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

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
