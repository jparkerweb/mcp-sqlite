# 🐇 MCP SQLite Server

[![npm version](https://badge.fury.io/js/mcp-sqlite.svg)](https://badge.fury.io/js/mcp-sqlite)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![Downloads](https://img.shields.io/npm/dm/mcp-sqlite.svg)](https://www.npmjs.com/package/mcp-sqlite)

This is a Model Context Protocol (MCP) server that provides comprehensive SQLite database interaction capabilities.

![cursor-settings](https://raw.githubusercontent.com/jparkerweb/mcp-sqlite/refs/heads/main/.readme/mcp-sqlite.jpg)

#### Maintained by

<a href="https://www.equilllabs.com">
  <img src="https://raw.githubusercontent.com/jparkerweb/eQuill-Labs/refs/heads/main/src/static/images/logo-text-outline.png" alt="eQuill Labs" height="32">
</a>

## Features

- Complete CRUD operations (Create, Read, Update, Delete)
- Database exploration and introspection
- Execute custom SQL queries

## Setup

Define the command in your IDE's MCP Server settings:

e.g. `Cursor`:

```json
{
    "mcpServers": {
        "MCP SQLite Server": {
            "command": "npx",
            "args": ["-y", "mcp-sqlite", "<path-to-your-sqlite-database.db>"]
        }
    }
}
```

e.g. `VSCode`:

```json
{
    "servers": {
        "MCP SQLite Server": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "mcp-sqlite", "<path-to-your-sqlite-database.db>"]
        }
    }
}
```

![cursor-settings](https://raw.githubusercontent.com/jparkerweb/mcp-sqlite/refs/heads/main/.readme/cursor-mcp-settings.jpg)

Your database path must be provided as an argument.

## Available Tools

### Database Information

#### db_info

Get detailed information about the connected database.

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "db_info",
        "arguments": {}
    }
}
```

#### list_tables

List all tables in the database.

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "list_tables",
        "arguments": {}
    }
}
```

#### get_table_schema

Get detailed information about a table's schema.

Parameters:

- `tableName` (string): Name of the table

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "get_table_schema",
        "arguments": {
            "tableName": "users"
        }
    }
}
```

### CRUD Operations

#### create_record

Insert a new record into a table.

Parameters:

- `table` (string): Name of the table
- `data` (object): Record data as key-value pairs

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "create_record",
        "arguments": {
            "table": "users",
            "data": {
                "name": "John Doe",
                "email": "john@example.com",
                "age": 30
            }
        }
    }
}
```

#### read_records

Query records from a table with optional filtering.

Parameters:

- `table` (string): Name of the table
- `conditions` (object, optional): Filter conditions as key-value pairs
- `limit` (number, optional): Maximum number of records to return
- `offset` (number, optional): Number of records to skip

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "read_records",
        "arguments": {
            "table": "users",
            "conditions": {
                "age": 30
            },
            "limit": 10,
            "offset": 0
        }
    }
}
```

#### update_records

Update records in a table that match specified conditions.

Parameters:

- `table` (string): Name of the table
- `data` (object): New values as key-value pairs
- `conditions` (object): Filter conditions as key-value pairs

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "update_records",
        "arguments": {
            "table": "users",
            "data": {
                "email": "john.updated@example.com"
            },
            "conditions": {
                "id": 1
            }
        }
    }
}
```

#### delete_records

Delete records from a table that match specified conditions.

Parameters:

- `table` (string): Name of the table
- `conditions` (object): Filter conditions as key-value pairs

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "delete_records",
        "arguments": {
            "table": "users",
            "conditions": {
                "id": 1
            }
        }
    }
}
```

### Custom Queries

#### query

Execute a custom SQL query against the connected SQLite database.

Parameters:

- `sql` (string): The SQL query to execute
- `values` (array, optional): Array of parameter values to use in the query

Example:

```json
{
    "method": "tools/call",
    "params": {
        "name": "query",
        "arguments": {
            "sql": "SELECT * FROM users WHERE id = ?",
            "values": [1]
        }
    }
}
```

## Built with

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [sqlite3](https://github.com/TryGhost/node-sqlite3)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

### Development

```bash
# Clone the repository
git clone https://github.com/jparkerweb/mcp-sqlite.git
cd mcp-sqlite

# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

### Reporting Issues

Found a bug? Please report it using our [Issue Template](.github/ISSUE_TEMPLATE/bug_report.md).

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security

Please see our [Security Policy](SECURITY.md) for information about reporting security vulnerabilities.

## 📞 Support

- **Documentation**: [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/jparkerweb/mcp-sqlite/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jparkerweb/mcp-sqlite/discussions)

## Appreciation

If you enjoy this library please consider sending me a tip to support my work 😀

### [🍵 tip me here](https://ko-fi.com/jparkerweb)
