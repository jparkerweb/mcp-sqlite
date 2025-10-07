#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { existsSync, statSync } = require('node:fs');
const { z } = require('zod');
const path = require('path');

class SQLiteHandler {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.isValid = true;
        this.db = null;
        this.initError = null;
        this.initPromise = null;

        // Create database connection and handle initialization asynchronously
        this.initPromise = new Promise((resolve, reject) => {
            try {
                this.db = new sqlite3.Database(dbPath, err => {
                    if (err) {
                        this.initError = err;
                        this.isValid = false;
                        reject(err);
                    } else {
                        this.isValid = true;
                        resolve();
                    }
                });
            } catch (err) {
                this.initError = err;
                this.isValid = false;
                reject(err);
            }
        });
    }

    // Helper method to check if database is valid
    async checkDatabase() {
        try {
            // Wait for initialization to complete
            await this.initPromise;
        } catch (err) {
            // Initialization failed, this is expected for invalid paths
            throw new Error(`Database not accessible: ${err.message}`);
        }

        if (!this.isValid || !this.db) {
            throw new Error('Database connection not established');
        }
    }

    async executeQuery(sql, values = []) {
        await this.checkDatabase();
        return new Promise((resolve, reject) => {
            this.db.all(sql, values, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async executeRun(sql, values = []) {
        await this.checkDatabase();
        return new Promise((resolve, reject) => {
            this.db.run(sql, values, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes,
                    });
                }
            });
        });
    }

    async listTables() {
        return this.executeQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
    }

    async getTableSchema(tableName) {
        return this.executeQuery(`PRAGMA table_info(${tableName})`);
    }
}

async function main() {
    const dbPath = process.argv[2] || 'mydatabase.db';

    // Resolve to absolute path if relative
    const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
    const handler = new SQLiteHandler(absoluteDbPath);
    const server = new McpServer({
        name: 'mcp-sqlite-server',
        version: '1.0.0',
    });

    // Add a database info tool for debugging
    server.tool(
        'db_info',
        'Get comprehensive information about the SQLite database including path, existence, size, last modified time, and table count. Useful for debugging and monitoring database status. Returns metadata without executing queries against user tables, making it fast and safe for frequent calls.',
        {},
        async () => {
            try {
                const dbExists = existsSync(absoluteDbPath);
                let fileSize = 0;
                let fileStats = null;

                if (dbExists) {
                    fileStats = statSync(absoluteDbPath);
                    fileSize = fileStats.size;
                }

                // Get table count - handle case where database is not accessible
                let tableCount = 0;
                try {
                    const tableCountResult = await handler.executeQuery(
                        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                    );
                    tableCount = tableCountResult[0].count;
                } catch (error) {
                    // Database is not accessible, table count remains 0
                    tableCount = 0;
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    dbPath: absoluteDbPath,
                                    exists: dbExists,
                                    size: fileSize,
                                    lastModified: dbExists ? fileStats.mtime.toString() : null,
                                    tableCount: tableCount,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error getting database info: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // Register SQLite query tool
    server.tool(
        'query',
        "Execute raw SQL queries against the database with optional parameterized values for security. Supports SELECT, INSERT, UPDATE, DELETE, and DDL operations. Use parameterized queries (with 'values' array) to prevent SQL injection. For better performance: use LIMIT clauses for large result sets, create indexes for frequently queried columns, and avoid SELECT * when possible. Returns query results as JSON array.",
        {
            sql: z
                .string()
                .describe(
                    'SQL query string to execute. Use ? placeholders for parameterized queries.'
                ),
            values: z
                .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
                .optional()
                .describe(
                    'Array of parameter values to bind to ? placeholders in the SQL query. Order matters - first ? gets first value, etc.'
                ),
        },
        async ({ sql, values }) => {
            try {
                const results = await handler.executeQuery(sql, values);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    data: results,
                                    rowCount: results.length,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // List Tables
    server.tool(
        'list_tables',
        'List all user-defined tables in the SQLite database, excluding system tables (sqlite_*). Fast operation that queries sqlite_master table. Returns table names as JSON array. Use this before querying specific tables to ensure they exist. Performance tip: This is a lightweight operation suitable for frequent calls.',
        {},
        async () => {
            try {
                const tables = await handler.listTables();

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    data: tables,
                                    tableCount: tables.length,
                                    message:
                                        tables.length === 0
                                            ? 'No tables found in database'
                                            : `${tables.length} table(s) found`,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // Get Table Schema
    server.tool(
        'get_table_schema',
        'Get detailed schema information for a specific table including column names, types, constraints, and nullability. Uses PRAGMA table_info() for fast metadata retrieval. Essential for understanding table structure before performing CRUD operations. Returns column details as JSON array with cid, name, type, notnull, dflt_value, and pk fields.',
        {
            tableName: z
                .string()
                .describe(
                    'Name of the table to get schema information for. Must be an existing user table (not system table).'
                ),
        },
        async ({ tableName }) => {
            try {
                const schema = await handler.getTableSchema(tableName);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    data: schema,
                                    tableName: tableName,
                                    columnCount: schema.length,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    tableName: tableName,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // Create Record
    server.tool(
        'create_record',
        "Insert a new record into a specified table with the provided data. Automatically handles parameterized queries for security. Returns the inserted record's ID and success confirmation. Performance tip: For bulk inserts, consider using the 'query' tool with INSERT statements for better performance. All column names and values are validated against the table schema.",
        {
            table: z
                .string()
                .describe(
                    'Name of the table to insert the record into. Must be an existing user table.'
                ),
            data: z
                .record(z.any())
                .describe(
                    'Object containing column names as keys and their corresponding values. All columns must exist in the target table schema.'
                ),
        },
        async ({ table, data }) => {
            try {
                const columns = Object.keys(data);
                const placeholders = columns.map(() => '?').join(', ');
                const values = Object.values(data);

                const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
                const result = await handler.executeRun(sql, values);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    message: 'Record created successfully',
                                    insertedId: result.lastID,
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // Read Records
    server.tool(
        'read_records',
        'Read records from a table with optional filtering, pagination, and sorting. Supports WHERE conditions, LIMIT for result size control, and OFFSET for pagination. Returns matching records as JSON array. Performance tips: Always use LIMIT for large tables, create indexes on frequently filtered columns, and use specific column names instead of SELECT * when possible. Conditions use exact matches (=) with AND logic.',
        {
            table: z
                .string()
                .describe(
                    'Name of the table to read records from. Must be an existing user table.'
                ),
            conditions: z
                .record(z.any())
                .optional()
                .describe(
                    'Optional object with column names as keys and values to filter by. All conditions are combined with AND logic using exact matches.'
                ),
            limit: z
                .number()
                .optional()
                .describe(
                    'Maximum number of records to return. Recommended for performance, especially with large tables.'
                ),
            offset: z
                .number()
                .optional()
                .describe(
                    'Number of records to skip before returning results. Used with limit for pagination. Must be used with limit.'
                ),
        },
        async ({ table, conditions, limit, offset }) => {
            try {
                let sql = `SELECT * FROM ${table}`;
                const values = [];

                // Add WHERE clause if conditions provided
                if (conditions && Object.keys(conditions).length > 0) {
                    const whereConditions = Object.entries(conditions)
                        .map(([column, value]) => {
                            values.push(value);
                            return `${column} = ?`;
                        })
                        .join(' AND ');

                    sql += ` WHERE ${whereConditions}`;
                }

                // Add LIMIT and OFFSET
                if (limit !== undefined) {
                    sql += ` LIMIT ${limit}`;
                    if (offset !== undefined) {
                        sql += ` OFFSET ${offset}`;
                    }
                }

                const results = await handler.executeQuery(sql, values);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    data: results,
                                    rowCount: results.length,
                                    table: table,
                                    conditions: conditions || {},
                                    limit: limit || null,
                                    offset: offset || null,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // Update Records
    server.tool(
        'update_records',
        'Update existing records in a table based on specified conditions. Uses parameterized queries for security. Returns the number of affected rows. Performance tips: Use specific WHERE conditions to avoid updating unintended records, create indexes on condition columns, and consider using LIMIT in complex scenarios. All conditions use exact matches (=) with AND logic.',
        {
            table: z
                .string()
                .describe(
                    'Name of the table to update records in. Must be an existing user table.'
                ),
            data: z
                .record(z.any())
                .describe(
                    'Object containing column names as keys and their new values. Only specified columns will be updated.'
                ),
            conditions: z
                .record(z.any())
                .describe(
                    'Object with column names as keys and values to identify which records to update. All conditions are combined with AND logic.'
                ),
        },
        async ({ table, data, conditions }) => {
            try {
                // Build SET clause
                const setClause = Object.keys(data)
                    .map(key => `${key} = ?`)
                    .join(', ');
                const setValues = Object.values(data);

                // Build WHERE clause
                const whereClause = Object.keys(conditions)
                    .map(key => `${key} = ?`)
                    .join(' AND ');
                const whereValues = Object.values(conditions);

                const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
                const result = await handler.executeRun(sql, [...setValues, ...whereValues]);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    message: 'Records updated successfully',
                                    rowsAffected: result.changes,
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // Delete Records
    server.tool(
        'delete_records',
        "Delete records from a table based on specified conditions. Uses parameterized queries for security. Returns the number of deleted rows. ⚠️ WARNING: This operation is irreversible. Always test conditions with 'read_records' first. Performance tips: Use specific WHERE conditions, create indexes on condition columns, and consider the impact on related tables with foreign keys.",
        {
            table: z
                .string()
                .describe(
                    'Name of the table to delete records from. Must be an existing user table.'
                ),
            conditions: z
                .record(z.any())
                .describe(
                    'Object with column names as keys and values to identify which records to delete. All conditions are combined with AND logic. ⚠️ Be very specific to avoid unintended deletions.'
                ),
        },
        async ({ table, conditions }) => {
            try {
                // Build WHERE clause
                const whereClause = Object.keys(conditions)
                    .map(key => `${key} = ?`)
                    .join(' AND ');
                const values = Object.values(conditions);

                const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
                const result = await handler.executeRun(sql, values);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    message: 'Records deleted successfully',
                                    rowsAffected: result.changes,
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: false,
                                    error: error.message,
                                    errorType: error.code || 'SQLITE_ERROR',
                                    table: table,
                                    timestamp: new Date().toISOString(),
                                },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main();
