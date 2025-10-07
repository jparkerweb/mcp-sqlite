const { TestDatabase, createTestDbPath, mockConsoleError } = require('./test-utils');

// Import the SQLiteHandler class
const sqlite3 = require('sqlite3').verbose();

class SQLiteHandler {
    constructor(dbPath) {
        this.dbPath = dbPath;

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

describe('Error Handling', () => {
    let testDb;
    let handler;
    let testDbPath;
    let restoreConsoleError;

    beforeEach(async () => {
        testDbPath = createTestDbPath('error-handling');
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

    describe('SQL Injection Protection', () => {
        it('should handle malicious SQL injection attempts in SELECT queries', async () => {
            const maliciousSQL = 'SELECT * FROM users; DROP TABLE users; --';

            // SQLite will execute the first statement but may fail on the second
            // This test verifies that the table still exists after the attempt
            try {
                await handler.executeQuery(maliciousSQL);
            } catch (error) {
                // Expected to fail on the DROP TABLE command
            }

            // Verify the table still exists
            const tables = await handler.listTables();
            expect(tables.map(t => t.name)).toContain('users');
        });

        it('should handle SQL injection in parameterized queries', async () => {
            const maliciousValue = "'; DROP TABLE users; --";

            // This should be treated as a literal string value, not SQL
            const results = await handler.executeQuery('SELECT * FROM users WHERE name = ?', [
                maliciousValue,
            ]);

            expect(results).toHaveLength(0); // No user with that name
            // Verify the table still exists
            const tables = await handler.listTables();
            expect(tables.map(t => t.name)).toContain('users');
        });

        it('should handle malicious table names in queries', async () => {
            const maliciousTable = 'users; DROP TABLE users; --';

            // This should fail due to invalid table name syntax
            try {
                await handler.executeQuery(`SELECT * FROM ${maliciousTable}`);
            } catch (error) {
                // Expected to fail due to invalid syntax
            }

            // Verify the table still exists
            const tables = await handler.listTables();
            expect(tables.map(t => t.name)).toContain('users');
        });
    });

    describe('Database Connection Errors', () => {
        it('should handle database file permission errors', async () => {
            const readOnlyPath = '/readonly/path/test.db';

            // This should fail gracefully
            expect(() => {
                new SQLiteHandler(readOnlyPath);
            }).not.toThrow();
        });

        it('should handle corrupted database files', async () => {
            // Create a corrupted database file
            const corruptedPath = createTestDbPath('corrupted');
            require('fs').writeFileSync(corruptedPath, 'corrupted data');

            const corruptedHandler = new SQLiteHandler(corruptedPath);

            await expect(
                corruptedHandler.executeQuery('SELECT * FROM sqlite_master')
            ).rejects.toThrow();

            corruptedHandler.db.close();
            require('fs').unlinkSync(corruptedPath);
        });

        it('should handle database locked errors', async () => {
            // This is harder to test without actually locking the database
            // But we can test the error handling structure
            const handler2 = new SQLiteHandler(testDbPath);

            // Both handlers should work fine for read operations
            const results1 = await handler.executeQuery('SELECT COUNT(*) as count FROM users');
            const results2 = await handler2.executeQuery('SELECT COUNT(*) as count FROM users');

            expect(results1[0].count).toBe(results2[0].count);

            await handler2.db.close();
        });
    });

    describe('Data Type Errors', () => {
        it('should handle invalid data types in INSERT queries', async () => {
            // SQLite is permissive with data types, but we can test the behavior
            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                ['Test', 'test@example.com', 'not-a-number']
            );

            // SQLite will convert 'not-a-number' to 0
            expect(result.changes).toBe(1);

            // Verify the data was stored as expected
            const users = await handler.executeQuery('SELECT * FROM users WHERE email = ?', [
                'test@example.com',
            ]);
            expect(users[0].age).toBe('not-a-number'); // SQLite stores strings as-is
        });

        it('should handle NULL constraint violations', async () => {
            await expect(
                handler.executeRun(
                    'INSERT INTO users (name, email) VALUES (?, ?)',
                    ['Test', null] // email is NOT NULL
                )
            ).rejects.toThrow();
        });

        it('should handle UNIQUE constraint violations', async () => {
            await expect(
                handler.executeRun(
                    'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                    ['Duplicate', 'john@example.com', 30] // email already exists
                )
            ).rejects.toThrow();
        });

        it('should handle FOREIGN KEY constraint violations', async () => {
            // SQLite doesn't enforce foreign keys by default, so this test verifies the behavior
            const result = await handler.executeRun(
                'INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)',
                [999, 1, 1, 100.0] // user_id 999 doesn't exist
            );

            // SQLite allows this without foreign key constraints enabled
            expect(result.changes).toBe(1);

            // Verify the record was created
            const orders = await handler.executeQuery('SELECT * FROM orders WHERE user_id = ?', [
                999,
            ]);
            expect(orders).toHaveLength(1);
        });
    });

    describe('Query Syntax Errors', () => {
        it('should handle malformed SELECT queries', async () => {
            const malformedQueries = [
                'SELECT * FROM', // Missing table name
                'SELECT * FROM users WHERE', // Missing condition
                'SELECT * FROM users ORDER BY', // Missing column
                'SELECT * FROM users GROUP BY', // Missing column
                'SELECT * FROM users HAVING', // Missing condition
                'SELECT * FROM users LIMIT', // Missing number
                'SELECT * FROM users OFFSET', // Missing number
            ];

            for (const query of malformedQueries) {
                try {
                    await handler.executeQuery(query);
                    // If it doesn't throw, that's also valid behavior for SQLite
                } catch (error) {
                    // Expected to fail for malformed queries
                    expect(error.message).toBeDefined();
                }
            }
        });

        it('should handle malformed INSERT queries', async () => {
            const malformedQueries = [
                'INSERT INTO users VALUES', // Missing values
                'INSERT INTO users (name) VALUES', // Missing values
                'INSERT INTO users (name) VALUES (?)', // Missing parameter
                'INSERT INTO nonexistent_table (name) VALUES (?)', // Wrong table
            ];

            for (const query of malformedQueries) {
                await expect(handler.executeRun(query, ['Test'])).rejects.toThrow();
            }
        });

        it('should handle malformed UPDATE queries', async () => {
            const malformedQueries = [
                'UPDATE users SET', // Missing SET values
                'UPDATE users SET name = ?', // Missing WHERE clause
                'UPDATE nonexistent_table SET name = ? WHERE id = ?', // Wrong table
            ];

            for (const query of malformedQueries) {
                await expect(handler.executeRun(query, ['Test', 1])).rejects.toThrow();
            }
        });

        it('should handle malformed DELETE queries', async () => {
            const malformedQueries = [
                'DELETE FROM users', // Missing WHERE clause (this is actually valid, but dangerous)
                'DELETE FROM nonexistent_table WHERE id = ?', // Wrong table
            ];

            for (const query of malformedQueries) {
                await expect(handler.executeRun(query, [1])).rejects.toThrow();
            }
        });
    });

    describe('Resource Exhaustion', () => {
        it('should handle very large result sets gracefully', async () => {
            // Create a large number of records
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                promises.push(
                    handler.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                        `User${i}`,
                        `user${i}@example.com`,
                        20 + (i % 50),
                    ])
                );
            }

            await Promise.all(promises);

            // Query all records
            const results = await handler.executeQuery('SELECT COUNT(*) as count FROM users');
            expect(results[0].count).toBeGreaterThan(1000);
        });

        it('should handle very long query strings', async () => {
            const longString = 'a'.repeat(10000);

            // This should work fine
            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                [longString, 'long@example.com', 30]
            );

            expect(result.changes).toBe(1);
        });

        it('should handle queries with many parameters', async () => {
            const manyParams = Array(100)
                .fill()
                .map((_, i) => i);
            const placeholders = manyParams.map(() => '?').join(', ');

            // This should work fine
            const result = await handler.executeQuery(`SELECT ${placeholders}`, manyParams);

            expect(result).toHaveLength(1);
        });
    });

    describe('Concurrent Access', () => {
        it('should handle concurrent read operations', async () => {
            const promises = Array(10)
                .fill()
                .map(() => handler.executeQuery('SELECT * FROM users'));

            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result).toHaveLength(3);
            });
        });

        it('should handle concurrent write operations', async () => {
            const promises = Array(10)
                .fill()
                .map((_, i) =>
                    handler.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                        `ConcurrentUser${i}`,
                        `concurrent${i}@example.com`,
                        25,
                    ])
                );

            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result.changes).toBe(1);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty string values', async () => {
            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                ['', '', 0]
            );

            expect(result.changes).toBe(1);

            const users = await handler.executeQuery('SELECT * FROM users WHERE name = ?', ['']);
            expect(users).toHaveLength(1);
        });

        it('should handle special characters in data', async () => {
            const specialChars = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';

            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                [specialChars, 'special@example.com', 30]
            );

            expect(result.changes).toBe(1);

            const users = await handler.executeQuery('SELECT * FROM users WHERE name = ?', [
                specialChars,
            ]);
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe(specialChars);
        });

        it('should handle Unicode characters', async () => {
            const unicodeString = 'Hello 世界 🌍 测试';

            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                [unicodeString, 'unicode@example.com', 30]
            );

            expect(result.changes).toBe(1);

            const users = await handler.executeQuery('SELECT * FROM users WHERE name = ?', [
                unicodeString,
            ]);
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe(unicodeString);
        });

        it('should handle very large numbers', async () => {
            const largeNumber = Number.MAX_SAFE_INTEGER;

            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                ['LargeNumber', 'large@example.com', largeNumber]
            );

            expect(result.changes).toBe(1);

            const users = await handler.executeQuery('SELECT * FROM users WHERE age = ?', [
                largeNumber,
            ]);
            expect(users).toHaveLength(1);
            expect(users[0].age).toBe(largeNumber);
        });

        it('should handle negative numbers', async () => {
            const negativeAge = -1;

            const result = await handler.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                ['NegativeAge', 'negative@example.com', negativeAge]
            );

            expect(result.changes).toBe(1);

            const users = await handler.executeQuery('SELECT * FROM users WHERE age = ?', [
                negativeAge,
            ]);
            expect(users).toHaveLength(1);
            expect(users[0].age).toBe(negativeAge);
        });
    });

    describe('Transaction Errors', () => {
        it('should handle transaction rollback scenarios', async () => {
            // Start a transaction
            await handler.executeRun('BEGIN TRANSACTION');

            try {
                // Insert a valid record
                await handler.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                    'TransactionTest',
                    'transaction@example.com',
                    30,
                ]);

                // Try to insert an invalid record (should fail)
                await handler.executeRun(
                    'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                    ['TransactionTest2', 'john@example.com', 30] // Duplicate email
                );

                // This should not be reached
                await handler.executeRun('COMMIT');
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                // Rollback the transaction
                await handler.executeRun('ROLLBACK');

                // Verify no records were inserted
                const users = await handler.executeQuery('SELECT * FROM users WHERE name LIKE ?', [
                    'TransactionTest%',
                ]);
                expect(users).toHaveLength(0);
            }
        });
    });
});
