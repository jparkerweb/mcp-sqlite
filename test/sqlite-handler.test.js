const { TestDatabase, createTestDbPath, mockConsoleError } = require('./test-utils');

// We need to extract the SQLiteHandler class from the main file
// Since it's not exported, we'll create a mock version for testing
const sqlite3 = require('sqlite3').verbose();

class SQLiteHandler {
    constructor(dbPath) {
        this.dbPath = dbPath;

        // Open the database without logging
        this.db = new sqlite3.Database(dbPath, err => {
            if (err) {
                console.error(`Error opening database: ${err.message}`);
            }
        });
    }

    async executeQuery(sql, values = []) {
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

describe('SQLiteHandler', () => {
    let testDb;
    let handler;
    let testDbPath;
    let restoreConsoleError;

    beforeEach(async () => {
        testDbPath = createTestDbPath('sqlite-handler');
        testDb = new TestDatabase(testDbPath);
        await testDb.createTestDatabase();
        await testDb.setupTestData();

        handler = new SQLiteHandler(testDbPath);
        restoreConsoleError = mockConsoleError();
    });

    afterEach(async () => {
        restoreConsoleError();
        await testDb.close();
        testDb.cleanup();
    });

    describe('constructor', () => {
        it('should create a handler with valid database path', () => {
            expect(handler.dbPath).toBe(testDbPath);
            expect(handler.db).toBeDefined();
        });

        it('should handle invalid database path gracefully', () => {
            const invalidPath = '/invalid/path/that/does/not/exist.db';
            expect(() => {
                new SQLiteHandler(invalidPath);
            }).not.toThrow();
        });
    });

    describe('executeQuery', () => {
        it('should execute SELECT queries and return results', async () => {
            const results = await handler.executeQuery('SELECT * FROM users');
            expect(results).toHaveLength(3);
            expect(results[0]).toHaveProperty('id');
            expect(results[0]).toHaveProperty('name');
            expect(results[0]).toHaveProperty('email');
        });

        it('should execute queries with parameters', async () => {
            const results = await handler.executeQuery('SELECT * FROM users WHERE age > ?', [30]);
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('Bob Johnson');
        });

        it('should handle invalid SQL queries', async () => {
            await expect(handler.executeQuery('INVALID SQL QUERY')).rejects.toThrow();
        });

        it('should return empty array for queries with no results', async () => {
            const results = await handler.executeQuery('SELECT * FROM users WHERE age > 100');
            expect(results).toHaveLength(0);
        });
    });

    describe('executeRun', () => {
        it('should execute INSERT queries and return lastID and changes', async () => {
            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                ['Test User', 'test@example.com', 28]
            );

            expect(result).toHaveProperty('lastID');
            expect(result).toHaveProperty('changes');
            expect(result.changes).toBe(1);
            expect(result.lastID).toBeGreaterThan(0);
        });

        it('should execute UPDATE queries and return changes count', async () => {
            const result = await handler.executeRun('UPDATE users SET age = ? WHERE name = ?', [
                31,
                'John Doe',
            ]);

            expect(result.changes).toBe(1);

            // Verify the update worked
            const users = await handler.executeQuery('SELECT * FROM users WHERE name = ?', [
                'John Doe',
            ]);
            expect(users[0].age).toBe(31);
        });

        it('should execute DELETE queries and return changes count', async () => {
            const result = await handler.executeRun('DELETE FROM users WHERE name = ?', [
                'Bob Johnson',
            ]);

            expect(result.changes).toBe(1);

            // Verify the deletion worked
            const users = await handler.executeQuery('SELECT * FROM users');
            expect(users).toHaveLength(2);
        });

        it('should handle invalid SQL in executeRun', async () => {
            await expect(handler.executeRun('INVALID SQL QUERY')).rejects.toThrow();
        });
    });

    describe('listTables', () => {
        it('should return list of user tables', async () => {
            const tables = await handler.listTables();

            expect(tables).toHaveLength(3);
            expect(tables.map(t => t.name)).toEqual(
                expect.arrayContaining(['users', 'products', 'orders'])
            );
        });

        it('should exclude system tables', async () => {
            const tables = await handler.listTables();
            const tableNames = tables.map(t => t.name);

            expect(tableNames).not.toContain('sqlite_master');
            expect(tableNames).not.toContain('sqlite_sequence');
        });
    });

    describe('getTableSchema', () => {
        it('should return schema for existing table', async () => {
            const schema = await handler.getTableSchema('users');

            expect(schema).toHaveLength(5); // id, name, email, age, created_at
            expect(schema[0]).toHaveProperty('name', 'id');
            expect(schema[0]).toHaveProperty('type', 'INTEGER');
            expect(schema[0]).toHaveProperty('pk', 1);

            expect(schema[1]).toHaveProperty('name', 'name');
            expect(schema[1]).toHaveProperty('type', 'TEXT');
            expect(schema[1]).toHaveProperty('notnull', 1);
        });

        it('should handle non-existent table', async () => {
            // SQLite returns empty array for non-existent tables in PRAGMA table_info
            const schema = await handler.getTableSchema('nonexistent_table');
            expect(schema).toHaveLength(0);
        });

        it('should return schema for products table', async () => {
            const schema = await handler.getTableSchema('products');

            expect(schema).toHaveLength(5); // id, name, price, category, in_stock
            expect(schema[2]).toHaveProperty('name', 'price');
            expect(schema[2]).toHaveProperty('type', 'DECIMAL(10,2)');
        });
    });

    describe('complex queries', () => {
        it('should handle JOIN queries', async () => {
            const results = await handler.executeQuery(`
                SELECT u.name, p.name as product_name, o.quantity, o.total
                FROM users u
                JOIN orders o ON u.id = o.user_id
                JOIN products p ON o.product_id = p.id
                ORDER BY u.name
            `);

            expect(results).toHaveLength(4);
            expect(results[0]).toHaveProperty('name');
            expect(results[0]).toHaveProperty('product_name');
            expect(results[0]).toHaveProperty('quantity');
            expect(results[0]).toHaveProperty('total');
        });

        it('should handle aggregate queries', async () => {
            const results = await handler.executeQuery(`
                SELECT 
                    u.name,
                    COUNT(o.id) as order_count,
                    SUM(o.total) as total_spent
                FROM users u
                LEFT JOIN orders o ON u.id = o.user_id
                GROUP BY u.id, u.name
                ORDER BY total_spent DESC
            `);

            expect(results).toHaveLength(3);
            expect(results[0]).toHaveProperty('name');
            expect(results[0]).toHaveProperty('order_count');
            expect(results[0]).toHaveProperty('total_spent');
        });

        it('should handle subqueries', async () => {
            const results = await handler.executeQuery(`
                SELECT name, email, age
                FROM users
                WHERE id IN (
                    SELECT DISTINCT user_id 
                    FROM orders 
                    WHERE total > 50
                )
            `);

            expect(results.length).toBeGreaterThan(0);
            results.forEach(user => {
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('email');
                expect(user).toHaveProperty('age');
            });
        });
    });
});
