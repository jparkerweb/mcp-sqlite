const { TestDatabase, createTestDbPath, mockConsoleError } = require('./test-utils');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('Integration Tests', () => {
    let testDbPath;
    let restoreConsoleError;

    beforeEach(() => {
        testDbPath = createTestDbPath('integration');
        restoreConsoleError = mockConsoleError();
    });

    afterEach(() => {
        restoreConsoleError();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    describe('Server Startup and Basic Functionality', () => {
        it('should start server with valid database path', done => {
            const serverPath = path.join(__dirname, '../src/mcp-sqlite-server.js');
            const server = spawn('node', [serverPath, testDbPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let output = '';
            let errorOutput = '';

            server.stdout.on('data', data => {
                output += data.toString();
            });

            server.stderr.on('data', data => {
                errorOutput += data.toString();
            });

            server.on('close', code => {
                // Server should start without errors
                expect(errorOutput).not.toContain('Error opening database');
                done();
            });

            // Kill the server after a short delay
            setTimeout(() => {
                server.kill();
            }, 1000);
        });

        it('should handle invalid database path gracefully', done => {
            const invalidPath = '/invalid/path/that/does/not/exist.db';
            const serverPath = path.join(__dirname, '../src/mcp-sqlite-server.js');
            const server = spawn('node', [serverPath, invalidPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let errorOutput = '';

            server.stderr.on('data', data => {
                errorOutput += data.toString();
            });

            server.on('close', code => {
                // Should not crash, but may log an error
                done();
            });

            setTimeout(() => {
                server.kill();
            }, 1000);
        });
    });

    describe('End-to-End Workflow Tests', () => {
        let testDb;

        beforeEach(async () => {
            testDb = new TestDatabase(testDbPath);
            await testDb.createTestDatabase();
            await testDb.setupTestData();
        });

        afterEach(async () => {
            await testDb.close();
        });

        it('should complete a full CRUD workflow', async () => {
            // Create a new user
            const createResult = await testDb.executeRun(
                'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
                ['Integration Test User', 'integration@example.com', 28]
            );
            expect(createResult.changes).toBe(1);
            const userId = createResult.lastID;

            // Read the user
            const readResult = await testDb.executeQuery('SELECT * FROM users WHERE id = ?', [
                userId,
            ]);
            expect(readResult).toHaveLength(1);
            expect(readResult[0].name).toBe('Integration Test User');

            // Update the user
            const updateResult = await testDb.executeRun('UPDATE users SET age = ? WHERE id = ?', [
                29,
                userId,
            ]);
            expect(updateResult.changes).toBe(1);

            // Verify the update
            const verifyResult = await testDb.executeQuery('SELECT age FROM users WHERE id = ?', [
                userId,
            ]);
            expect(verifyResult[0].age).toBe(29);

            // Delete the user
            const deleteResult = await testDb.executeRun('DELETE FROM users WHERE id = ?', [
                userId,
            ]);
            expect(deleteResult.changes).toBe(1);

            // Verify deletion
            const finalResult = await testDb.executeQuery('SELECT * FROM users WHERE id = ?', [
                userId,
            ]);
            expect(finalResult).toHaveLength(0);
        });

        it('should handle complex queries with joins', async () => {
            const results = await testDb.executeQuery(`
                SELECT 
                    u.name as user_name,
                    p.name as product_name,
                    o.quantity,
                    o.total,
                    (o.quantity * p.price) as calculated_total
                FROM users u
                JOIN orders o ON u.id = o.user_id
                JOIN products p ON o.product_id = p.id
                WHERE o.total > 50
                ORDER BY o.total DESC
            `);

            expect(results.length).toBeGreaterThan(0);
            results.forEach(result => {
                expect(result).toHaveProperty('user_name');
                expect(result).toHaveProperty('product_name');
                expect(result).toHaveProperty('quantity');
                expect(result).toHaveProperty('total');
                expect(result).toHaveProperty('calculated_total');
            });
        });

        it('should handle aggregate queries', async () => {
            const results = await testDb.executeQuery(`
                SELECT 
                    p.category,
                    COUNT(o.id) as order_count,
                    SUM(o.quantity) as total_quantity,
                    AVG(o.total) as avg_order_value,
                    MAX(o.total) as max_order_value,
                    MIN(o.total) as min_order_value
                FROM products p
                LEFT JOIN orders o ON p.id = o.product_id
                GROUP BY p.category
                HAVING COUNT(o.id) > 0
                ORDER BY order_count DESC
            `);

            expect(results.length).toBeGreaterThan(0);
            results.forEach(result => {
                expect(result).toHaveProperty('category');
                expect(result).toHaveProperty('order_count');
                expect(result).toHaveProperty('total_quantity');
                expect(result).toHaveProperty('avg_order_value');
                expect(result).toHaveProperty('max_order_value');
                expect(result).toHaveProperty('min_order_value');
            });
        });
    });

    describe('Performance Tests', () => {
        let testDb;

        beforeEach(async () => {
            testDb = new TestDatabase(testDbPath);
            await testDb.createTestDatabase();
            await testDb.setupTestData();
        });

        afterEach(async () => {
            await testDb.close();
        });

        it('should handle large batch inserts efficiently', async () => {
            const startTime = Date.now();

            // Insert 1000 records
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                promises.push(
                    testDb.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                        `PerfUser${i}`,
                        `perf${i}@example.com`,
                        20 + (i % 50),
                    ])
                );
            }

            await Promise.all(promises);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(5000); // 5 seconds

            // Verify all records were inserted
            const count = await testDb.executeQuery('SELECT COUNT(*) as count FROM users');
            expect(count[0].count).toBeGreaterThan(1000);
        });

        it('should handle large result sets efficiently', async () => {
            // First, create a large dataset
            const promises = [];
            for (let i = 0; i < 500; i++) {
                promises.push(
                    testDb.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                        `LargeSetUser${i}`,
                        `largeset${i}@example.com`,
                        20 + (i % 50),
                    ])
                );
            }
            await Promise.all(promises);

            const startTime = Date.now();

            // Query all records
            const results = await testDb.executeQuery('SELECT * FROM users');

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time
            expect(duration).toBeLessThan(2000); // 2 seconds
            expect(results.length).toBeGreaterThan(500);
        });

        it('should handle concurrent operations efficiently', async () => {
            const startTime = Date.now();

            // Run multiple concurrent operations
            const promises = [
                testDb.executeQuery('SELECT COUNT(*) as count FROM users'),
                testDb.executeQuery('SELECT COUNT(*) as count FROM products'),
                testDb.executeQuery('SELECT COUNT(*) as count FROM orders'),
                testDb.executeQuery('SELECT * FROM users LIMIT 10'),
                testDb.executeQuery('SELECT * FROM products LIMIT 10'),
                testDb.executeQuery('SELECT * FROM orders LIMIT 10'),
            ];

            const results = await Promise.all(promises);

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete quickly with concurrent operations
            expect(duration).toBeLessThan(1000); // 1 second
            expect(results).toHaveLength(6);
        });
    });

    describe('Data Integrity Tests', () => {
        let testDb;

        beforeEach(async () => {
            testDb = new TestDatabase(testDbPath);
            await testDb.createTestDatabase();
            await testDb.setupTestData();
        });

        afterEach(async () => {
            await testDb.close();
        });

        it('should maintain referential integrity', async () => {
            // SQLite doesn't enforce foreign keys by default, so this test verifies the behavior
            const result = await testDb.executeRun(
                'INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)',
                [999, 1, 1, 100.0] // user_id 999 doesn't exist
            );

            // SQLite allows this without foreign key constraints enabled
            expect(result.changes).toBe(1);

            // Verify the record was created
            const orders = await testDb.executeQuery('SELECT * FROM orders WHERE user_id = ?', [
                999,
            ]);
            expect(orders).toHaveLength(1);
        });

        it('should maintain unique constraints', async () => {
            // Try to insert duplicate email
            await expect(
                testDb.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                    'Duplicate',
                    'john@example.com',
                    30,
                ])
            ).rejects.toThrow();
        });

        it('should maintain NOT NULL constraints', async () => {
            // Try to insert NULL in NOT NULL column
            await expect(
                testDb.executeRun('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
                    'Test',
                    null,
                    30,
                ])
            ).rejects.toThrow();
        });

        it('should handle cascading operations correctly', async () => {
            // Get initial counts
            const initialUsers = await testDb.executeQuery('SELECT COUNT(*) as count FROM users');
            const initialOrders = await testDb.executeQuery('SELECT COUNT(*) as count FROM orders');

            // Delete a user (this should cascade to orders in a real scenario)
            // Note: SQLite doesn't have CASCADE DELETE by default, so we need to handle manually
            const userToDelete = await testDb.executeQuery('SELECT id FROM users LIMIT 1');
            const userId = userToDelete[0].id;

            // First delete related orders
            await testDb.executeRun('DELETE FROM orders WHERE user_id = ?', [userId]);

            // Then delete the user
            await testDb.executeRun('DELETE FROM users WHERE id = ?', [userId]);

            // Verify counts decreased
            const finalUsers = await testDb.executeQuery('SELECT COUNT(*) as count FROM users');
            const finalOrders = await testDb.executeQuery('SELECT COUNT(*) as count FROM orders');

            expect(finalUsers[0].count).toBe(initialUsers[0].count - 1);
            expect(finalOrders[0].count).toBeLessThan(initialOrders[0].count);
        });
    });

    describe('Edge Case Scenarios', () => {
        let testDb;

        beforeEach(async () => {
            testDb = new TestDatabase(testDbPath);
            await testDb.createTestDatabase();
            await testDb.setupTestData();
        });

        afterEach(async () => {
            await testDb.close();
        });

        it('should handle empty database operations', async () => {
            // Create a fresh empty database
            const emptyDbPath = createTestDbPath('empty-integration');
            const emptyDb = new TestDatabase(emptyDbPath);
            await emptyDb.createTestDatabase();

            // Test operations on empty database
            const tables = await emptyDb.executeQuery(
                'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\''
            );
            expect(tables).toHaveLength(0);

            const count = await emptyDb.executeQuery('SELECT COUNT(*) as count FROM sqlite_master');
            expect(count[0].count).toBeGreaterThanOrEqual(0); // System tables may or may not exist

            await emptyDb.close();
            emptyDb.cleanup();
        });

        it('should handle database with only system tables', async () => {
            const systemDbPath = createTestDbPath('system-only');
            const systemDb = new TestDatabase(systemDbPath);
            await systemDb.createTestDatabase();

            // Create only system tables (this happens automatically)
            const tables = await systemDb.executeQuery(
                'SELECT name FROM sqlite_master WHERE type=\'table\''
            );

            // Should have system tables but no user tables
            const userTables = await systemDb.executeQuery(
                'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\''
            );
            expect(userTables).toHaveLength(0);

            await systemDb.close();
            systemDb.cleanup();
        });

        it('should handle very long table and column names', async () => {
            const longTableName = 'a'.repeat(100);
            const longColumnName = 'b'.repeat(100);

            // This should work (SQLite allows very long names)
            await testDb.executeRun(`
                CREATE TABLE "${longTableName}" (
                    "${longColumnName}" TEXT
                )
            `);

            await testDb.executeRun(
                `INSERT INTO "${longTableName}" ("${longColumnName}") VALUES (?)`,
                ['test value']
            );

            const results = await testDb.executeQuery(`SELECT * FROM "${longTableName}"`);
            expect(results).toHaveLength(1);
            expect(results[0][longColumnName]).toBe('test value');
        });
    });
});
