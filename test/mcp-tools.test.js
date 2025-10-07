const { TestDatabase, createTestDbPath, mockConsoleError } = require('./test-utils');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { existsSync, statSync } = require('node:fs');
const { z } = require('zod');
const path = require('path');

// Import the SQLiteHandler class (we'll need to extract it from the main file)
const sqlite3 = require('sqlite3').verbose();

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

// Mock MCP Server for testing
class MockMcpServer {
    constructor() {
        this.tools = new Map();
    }

    tool(name, description, schema, handler) {
        this.tools.set(name, {
            description,
            schema,
            handler,
        });
    }

    async callTool(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }
        return await tool.handler(args);
    }
}

describe('MCP Server Tools', () => {
    let testDb;
    let handler;
    let server;
    let testDbPath;
    let restoreConsoleError;

    beforeEach(async () => {
        testDbPath = createTestDbPath('mcp-tools');
        testDb = new TestDatabase(testDbPath);
        await testDb.createTestDatabase();
        await testDb.setupTestData();

        handler = new SQLiteHandler(testDbPath);
        server = new MockMcpServer();
        restoreConsoleError = mockConsoleError();

        // Register all the tools
        setupMcpTools(server, handler, testDbPath);
    });

    afterEach(async () => {
        restoreConsoleError();
        await testDb.close();
        testDb.cleanup();
    });

    describe('db_info tool', () => {
        it('should return database information for existing database', async () => {
            const result = await server.callTool('db_info', {});

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');

            const info = JSON.parse(result.content[0].text);
            expect(info.dbPath).toBe(testDbPath);
            expect(info.exists).toBe(true);
            expect(info.size).toBeGreaterThan(0);
            expect(info.tableCount).toBe(3);
            expect(info.lastModified).toBeDefined();
        });

        it('should handle non-existent database', async () => {
            // Now that SQLiteHandler handles invalid paths gracefully, this test should work
            const nonExistentPath = '/path/to/nonexistent.db';
            const nonExistentHandler = new SQLiteHandler(nonExistentPath);
            const nonExistentServer = new MockMcpServer();
            setupMcpTools(nonExistentServer, nonExistentHandler, nonExistentPath);

            const result = await nonExistentServer.callTool('db_info', {});

            expect(result.content).toHaveLength(1);
            const info = JSON.parse(result.content[0].text);
            expect(info.exists).toBe(false);
            expect(info.size).toBe(0);
            expect(info.lastModified).toBeNull();
        });
    });

    describe('query tool', () => {
        it('should execute SELECT queries', async () => {
            const result = await server.callTool('query', {
                sql: 'SELECT * FROM users WHERE age > ?',
                values: [30],
            });

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');

            const data = JSON.parse(result.content[0].text);
            expect(data).toHaveLength(1);
            expect(data[0].name).toBe('Bob Johnson');
        });

        it('should execute queries without parameters', async () => {
            const result = await server.callTool('query', {
                sql: 'SELECT COUNT(*) as count FROM users',
            });

            const data = JSON.parse(result.content[0].text);
            expect(data[0].count).toBe(3);
        });

        it('should handle invalid SQL queries', async () => {
            const result = await server.callTool('query', {
                sql: 'INVALID SQL QUERY',
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error:');
        });

        it('should handle complex queries with multiple parameters', async () => {
            const result = await server.callTool('query', {
                sql: 'SELECT * FROM users WHERE age BETWEEN ? AND ? AND name LIKE ?',
                values: [20, 35, '%John%'],
            });

            const data = JSON.parse(result.content[0].text);
            expect(data.length).toBeGreaterThan(0);
            expect(data.some(user => user.name === 'John Doe')).toBe(true);
        });
    });

    describe('list_tables tool', () => {
        it('should return list of tables', async () => {
            const result = await server.callTool('list_tables', {});

            expect(result.content).toHaveLength(1);
            const tables = JSON.parse(result.content[0].text);
            expect(tables).toHaveLength(3);
            expect(tables.map(t => t.name)).toEqual(
                expect.arrayContaining(['users', 'products', 'orders'])
            );
        });

        it('should handle empty database', async () => {
            const emptyDbPath = createTestDbPath('empty-db');
            const emptyDb = new TestDatabase(emptyDbPath);
            await emptyDb.createTestDatabase();

            const emptyHandler = new SQLiteHandler(emptyDbPath);
            const emptyServer = new MockMcpServer();
            setupMcpTools(emptyServer, emptyHandler, emptyDbPath);

            const result = await emptyServer.callTool('list_tables', {});

            const response = JSON.parse(result.content[0].text);
            expect(response.message).toBe('No tables found in database');
            expect(response.exists).toBe(true);

            await emptyDb.close();
            emptyDb.cleanup();
        });
    });

    describe('get_table_schema tool', () => {
        it('should return schema for existing table', async () => {
            const result = await server.callTool('get_table_schema', {
                tableName: 'users',
            });

            expect(result.content).toHaveLength(1);
            const schema = JSON.parse(result.content[0].text);
            expect(schema).toHaveLength(5);
            expect(schema[0].name).toBe('id');
            expect(schema[0].type).toBe('INTEGER');
            expect(schema[0].pk).toBe(1);
        });

        it('should handle non-existent table', async () => {
            const result = await server.callTool('get_table_schema', {
                tableName: 'nonexistent_table',
            });

            expect(result.content).toHaveLength(1);
            const schema = JSON.parse(result.content[0].text);
            expect(schema).toHaveLength(0); // SQLite returns empty array for non-existent tables
        });
    });

    describe('create_record tool', () => {
        it('should create a new record', async () => {
            const result = await server.callTool('create_record', {
                table: 'users',
                data: {
                    name: 'Test User',
                    email: 'test@example.com',
                    age: 28,
                },
            });

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);
            expect(response.message).toBe('Record created successfully');
            expect(response.insertedId).toBeGreaterThan(0);

            // Verify the record was created
            const verifyResult = await server.callTool('query', {
                sql: 'SELECT * FROM users WHERE email = ?',
                values: ['test@example.com'],
            });
            const users = JSON.parse(verifyResult.content[0].text);
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe('Test User');
        });

        it('should handle invalid table name', async () => {
            const result = await server.callTool('create_record', {
                table: 'nonexistent_table',
                data: { name: 'Test' },
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error creating record:');
        });

        it('should handle constraint violations', async () => {
            const result = await server.callTool('create_record', {
                table: 'users',
                data: {
                    name: 'Duplicate Email',
                    email: 'john@example.com', // This email already exists
                    age: 25,
                },
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error creating record:');
        });
    });

    describe('read_records tool', () => {
        it('should read all records without conditions', async () => {
            const result = await server.callTool('read_records', {
                table: 'users',
            });

            expect(result.content).toHaveLength(1);
            const users = JSON.parse(result.content[0].text);
            expect(users).toHaveLength(3);
        });

        it('should read records with conditions', async () => {
            const result = await server.callTool('read_records', {
                table: 'users',
                conditions: { age: 30 },
            });

            const users = JSON.parse(result.content[0].text);
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe('John Doe');
        });

        it('should read records with limit', async () => {
            const result = await server.callTool('read_records', {
                table: 'users',
                limit: 2,
            });

            const users = JSON.parse(result.content[0].text);
            expect(users).toHaveLength(2);
        });

        it('should read records with limit and offset', async () => {
            const result = await server.callTool('read_records', {
                table: 'users',
                limit: 1,
                offset: 1,
            });

            const users = JSON.parse(result.content[0].text);
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe('Jane Smith');
        });

        it('should read records with multiple conditions', async () => {
            const result = await server.callTool('read_records', {
                table: 'users',
                conditions: { age: 25, name: 'Jane Smith' },
            });

            const users = JSON.parse(result.content[0].text);
            expect(users).toHaveLength(1);
            expect(users[0].email).toBe('jane@example.com');
        });
    });

    describe('update_records tool', () => {
        it('should update records with conditions', async () => {
            const result = await server.callTool('update_records', {
                table: 'users',
                data: { age: 31 },
                conditions: { name: 'John Doe' },
            });

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);
            expect(response.message).toBe('Records updated successfully');
            expect(response.rowsAffected).toBe(1);

            // Verify the update
            const verifyResult = await server.callTool('query', {
                sql: 'SELECT age FROM users WHERE name = ?',
                values: ['John Doe'],
            });
            const users = JSON.parse(verifyResult.content[0].text);
            expect(users[0].age).toBe(31);
        });

        it('should update multiple records', async () => {
            const result = await server.callTool('update_records', {
                table: 'users',
                data: { age: 30 },
                conditions: { age: 25 },
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.rowsAffected).toBe(1);
        });

        it('should handle non-existent records', async () => {
            const result = await server.callTool('update_records', {
                table: 'users',
                data: { age: 50 },
                conditions: { name: 'Non Existent' },
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.rowsAffected).toBe(0);
        });
    });

    describe('delete_records tool', () => {
        it('should delete records with conditions', async () => {
            const result = await server.callTool('delete_records', {
                table: 'users',
                conditions: { name: 'Bob Johnson' },
            });

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);
            expect(response.message).toBe('Records deleted successfully');
            expect(response.rowsAffected).toBe(1);

            // Verify the deletion
            const verifyResult = await server.callTool('query', {
                sql: 'SELECT COUNT(*) as count FROM users',
            });
            const count = JSON.parse(verifyResult.content[0].text);
            expect(count[0].count).toBe(2);
        });

        it('should handle non-existent records', async () => {
            const result = await server.callTool('delete_records', {
                table: 'users',
                conditions: { name: 'Non Existent' },
            });

            const response = JSON.parse(result.content[0].text);
            expect(response.rowsAffected).toBe(0);
        });

        it('should handle invalid table name', async () => {
            const result = await server.callTool('delete_records', {
                table: 'nonexistent_table',
                conditions: { id: 1 },
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Error deleting records:');
        });
    });
});

// Helper function to setup MCP tools (extracted from main file)
function setupMcpTools(server, handler, absoluteDbPath) {
    // Add a database info tool for debugging
    server.tool(
        'db_info',
        'Get information about the SQLite database including path, existence, size, and table count',
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

                // Get table count (only if database exists and is accessible)
                let tableCount = 0;
                try {
                    const tableCountResult = await handler.executeQuery(
                        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                    );
                    tableCount = tableCountResult[0].count;
                } catch (error) {
                    // Database may not be accessible
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
        'Execute a raw SQL query against the database with optional parameter values',
        {
            sql: z.string(),
            values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
        },
        async ({ sql, values }) => {
            try {
                const results = await handler.executeQuery(sql, values);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`,
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
        'List all user tables in the SQLite database (excludes system tables)',
        {},
        async () => {
            try {
                const tables = await handler.listTables();

                if (tables.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(
                                    {
                                        message: 'No tables found in database',
                                        dbPath: absoluteDbPath,
                                        exists: existsSync(absoluteDbPath),
                                        size: existsSync(absoluteDbPath)
                                            ? statSync(absoluteDbPath).size
                                            : 0,
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                    };
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(tables, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error listing tables: ${error.message}`,
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
        'Get the schema information for a specific table including column details',
        {
            tableName: z.string(),
        },
        async ({ tableName }) => {
            try {
                const schema = await handler.getTableSchema(tableName);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(schema, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error getting schema: ${error.message}`,
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
        'Insert a new record into a table with specified data',
        {
            table: z.string(),
            data: z.record(z.any()),
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
                                    message: 'Record created successfully',
                                    insertedId: result.lastID,
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
                            text: `Error creating record: ${error.message}`,
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
        'Read records from a table with optional conditions, limit, and offset',
        {
            table: z.string(),
            conditions: z.record(z.any()).optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
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
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error reading records: ${error.message}`,
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
        'Update records in a table based on specified conditions',
        {
            table: z.string(),
            data: z.record(z.any()),
            conditions: z.record(z.any()),
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
                                    message: 'Records updated successfully',
                                    rowsAffected: result.changes,
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
                            text: `Error updating records: ${error.message}`,
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
        'Delete records from a table based on specified conditions',
        {
            table: z.string(),
            conditions: z.record(z.any()),
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
                                    message: 'Records deleted successfully',
                                    rowsAffected: result.changes,
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
                            text: `Error deleting records: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
}
