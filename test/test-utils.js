const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * Test utilities for creating and managing test databases
 */
class TestDatabase {
    constructor(testDbPath) {
        this.dbPath = testDbPath;
        this.db = null;
    }

    /**
     * Create a new test database with sample data
     */
    async createTestDatabase() {
        return new Promise((resolve, reject) => {
            // Remove existing test database if it exists
            if (fs.existsSync(this.dbPath)) {
                fs.unlinkSync(this.dbPath);
            }

            this.db = new sqlite3.Database(this.dbPath, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Setup test tables and data
     */
    async setupTestData() {
        const queries = [
            // Create users table
            `CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                age INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Create products table
            `CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                category TEXT,
                in_stock BOOLEAN DEFAULT 1
            )`,

            // Create orders table
            `CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                product_id INTEGER,
                quantity INTEGER NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )`,
        ];

        for (const query of queries) {
            await this.executeQuery(query);
        }

        // Insert sample data
        const insertQueries = [
            `INSERT INTO users (name, email, age) VALUES 
                ('John Doe', 'john@example.com', 30),
                ('Jane Smith', 'jane@example.com', 25),
                ('Bob Johnson', 'bob@example.com', 35)`,

            `INSERT INTO products (name, price, category, in_stock) VALUES 
                ('Laptop', 999.99, 'Electronics', 1),
                ('Mouse', 29.99, 'Electronics', 1),
                ('Keyboard', 79.99, 'Electronics', 0),
                ('Book', 19.99, 'Education', 1)`,

            `INSERT INTO orders (user_id, product_id, quantity, total) VALUES 
                (1, 1, 1, 999.99),
                (1, 2, 2, 59.98),
                (2, 1, 1, 999.99),
                (3, 4, 3, 59.97)`,
        ];

        for (const query of insertQueries) {
            await this.executeQuery(query);
        }
    }

    /**
     * Execute a query on the test database
     */
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

    /**
     * Execute a run query on the test database
     */
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

    /**
     * Close the database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close(err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Clean up test database file
     */
    cleanup() {
        if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
        }
    }

    /**
     * Get database file stats
     */
    getStats() {
        if (fs.existsSync(this.dbPath)) {
            return fs.statSync(this.dbPath);
        }
        return null;
    }
}

/**
 * Create a temporary test database path
 */
function createTestDbPath(testName) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    return path.join(__dirname, `test-${testName}-${timestamp}-${randomId}.db`);
}

/**
 * Mock console.error to prevent test output pollution
 */
function mockConsoleError() {
    const originalError = console.error;
    console.error = jest.fn();
    return () => {
        console.error = originalError;
    };
}

module.exports = {
    TestDatabase,
    createTestDbPath,
    mockConsoleError,
};
