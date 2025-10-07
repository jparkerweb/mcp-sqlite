# Changelog

All notable changes to the MCP SQLite Server will be documented in this file.

## [Unreleased]

### ✨ Added

- Project scaffolding and DX improvements
    - Moved server entry to `src/mcp-sqlite-server.js`
    - Added Jest test suite with coverage reports
    - Added ESLint and Prettier configurations
    - Added Husky and lint-staged pre-commit checks
    - Added GitHub Issue/PR templates and workflows

### 📝 Docs

- Expanded `README.md` with setup, usage examples, and contribution guidelines
- Added `CONTRIBUTING.md`

### 📦 Updated

- Package scripts for linting, formatting, cleaning, and prepare hooks
- `package.json` entries (e.g., `files`, `bin`) to reflect new layout

## [1.0.7] - 2025-06-02

### 📦 Updated

- Added a "description" parameter to each tool definitions for better Agent selection

### 🐛 Fixed

- Resolved a know validation issue with VS Code that requires stricter JSON schema validation

## [1.0.0] - 2025-04-05

### ✨ Added

- Initial release of MCP SQLite Server
- Complete set of CRUD operations:
    - `create_record` - Insert data into tables
    - `read_records` - Query records with filtering, limit and offset
    - `update_records` - Modify existing records with conditions
    - `delete_records` - Remove records matching conditions
- Database exploration tools:
    - `list_tables` - List all tables in the database
    - `get_table_schema` - Get column information for tables
    - `db_info` - Get database file metadata
- Custom SQL query execution with the `query` tool
- Support for relative and absolute database paths
- Detailed error reporting for all operations
- Comprehensive JSON response formatting
- Full documentation in README.md
