#!/usr/bin/env node

/**
 * Client Simulation Test for MCP SQLite Server
 * Demonstrates practical benefits of improved descriptions and response formatting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Constants
const REQUEST_TIMEOUT_MS = 5000;

class ClientSimulator {
    constructor() {
        this.serverProcess = null;
        this.testResults = {
            usability: {},
            errorHandling: {},
            performance: {},
        };
    }

    /**
     * Start the MCP SQLite server for testing
     */
    async startServer() {
        return new Promise((resolve, reject) => {
            console.log('🚀 Starting MCP SQLite Server...');

            // Create a test database
            const testDbPath = path.join(__dirname, 'test-database.db');
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }

            this.serverProcess = spawn('node', ['../src/mcp-sqlite-server.js', testDbPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.serverProcess.on('error', err => {
                console.error('Failed to start server:', err);
                reject(err);
            });

            // Wait a moment for server to start
            setTimeout(() => {
                console.log('✅ Server started successfully\n');
                resolve();
            }, 1000);
        });
    }

    /**
     * Stop the server
     */
    async stopServer() {
        if (this.serverProcess) {
            this.serverProcess.kill();
            console.log('🛑 Server stopped\n');
        }
    }

    /**
     * Send MCP request to server
     */
    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            let responseData = '';

            const timeout = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, REQUEST_TIMEOUT_MS);

            this.serverProcess.stdout.on('data', data => {
                responseData += data.toString();

                try {
                    const lines = responseData.split('\n').filter(line => line.trim());
                    const lastLine = lines[lines.length - 1];
                    const response = JSON.parse(lastLine);

                    if (response.id === request.id) {
                        clearTimeout(timeout);
                        resolve(response);
                    }
                } catch (e) {
                    // Continue waiting for complete response
                }
            });

            this.serverProcess.stderr.on('data', data => {
                console.error('Server error:', data.toString());
            });

            // Send the request
            this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    /**
     * Test usability improvements
     */
    async testUsability() {
        console.log('🎯 Testing Usability Improvements...\n');

        // Test 1: Tool discovery and understanding
        console.log('1. Testing tool discovery...');
        const listToolsRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
        };

        try {
            const toolsResponse = await this.sendRequest(listToolsRequest);
            const tools = toolsResponse.result.tools;

            console.log(`   ✅ Found ${tools.length} tools`);

            // Analyze tool descriptions
            const descriptionAnalysis = {
                totalTools: tools.length,
                toolsWithDetailedDescriptions: 0,
                toolsWithParameterDescriptions: 0,
                toolsWithPerformanceHints: 0,
            };

            tools.forEach(tool => {
                const description = tool.description;

                // Check for detailed descriptions
                if (description.length > 100) {
                    descriptionAnalysis.toolsWithDetailedDescriptions++;
                }

                // Check for parameter descriptions
                if (tool.inputSchema && tool.inputSchema.properties) {
                    const hasParamDescriptions = Object.values(tool.inputSchema.properties).some(
                        param => param.description
                    );
                    if (hasParamDescriptions) {
                        descriptionAnalysis.toolsWithParameterDescriptions++;
                    }
                }

                // Check for performance hints
                if (
                    description.toLowerCase().includes('performance') ||
                    description.toLowerCase().includes('tip')
                ) {
                    descriptionAnalysis.toolsWithPerformanceHints++;
                }
            });

            this.testResults.usability.descriptionAnalysis = descriptionAnalysis;

            console.log('   📊 Description Analysis:');
            console.log(
                `      Detailed descriptions: ${descriptionAnalysis.toolsWithDetailedDescriptions}/${descriptionAnalysis.totalTools}`
            );
            console.log(
                `      Parameter descriptions: ${descriptionAnalysis.toolsWithParameterDescriptions}/${descriptionAnalysis.totalTools}`
            );
            console.log(
                `      Performance hints: ${descriptionAnalysis.toolsWithPerformanceHints}/${descriptionAnalysis.totalTools}\n`
            );
        } catch (error) {
            console.error('   ❌ Tool discovery failed:', error.message);
        }

        // Test 2: Response format consistency
        console.log('2. Testing response format consistency...');

        try {
            // Create test table
            const createTableRequest = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                    name: 'query',
                    arguments: {
                        sql: 'CREATE TABLE test_users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)',
                    },
                },
            };

            const createResponse = await this.sendRequest(createTableRequest);
            console.log('   ✅ Test table created');

            // Test different operations to check response consistency
            const operations = [
                {
                    name: 'list_tables',
                    request: {
                        jsonrpc: '2.0',
                        id: 3,
                        method: 'tools/call',
                        params: { name: 'list_tables', arguments: {} },
                    },
                },
                {
                    name: 'get_table_schema',
                    request: {
                        jsonrpc: '2.0',
                        id: 4,
                        method: 'tools/call',
                        params: {
                            name: 'get_table_schema',
                            arguments: { tableName: 'test_users' },
                        },
                    },
                },
                {
                    name: 'create_record',
                    request: {
                        jsonrpc: '2.0',
                        id: 5,
                        method: 'tools/call',
                        params: {
                            name: 'create_record',
                            arguments: {
                                table: 'test_users',
                                data: { name: 'John Doe', email: 'john@example.com' },
                            },
                        },
                    },
                },
            ];

            const responseAnalysis = {
                consistentStructure: 0,
                hasMetadata: 0,
                hasTimestamps: 0,
                totalOperations: operations.length,
            };

            for (const op of operations) {
                const response = await this.sendRequest(op.request);
                const content = response.result.content[0].text;
                const parsed = JSON.parse(content);

                // Check for consistent structure
                if (parsed.success !== undefined && parsed.timestamp !== undefined) {
                    responseAnalysis.consistentStructure++;
                }

                // Check for metadata
                if (parsed.success !== undefined) {
                    responseAnalysis.hasMetadata++;
                }

                // Check for timestamps
                if (parsed.timestamp !== undefined) {
                    responseAnalysis.hasTimestamps++;
                }

                console.log(`   ✅ ${op.name}: ${parsed.success ? 'Success' : 'Failed'}`);
            }

            this.testResults.usability.responseAnalysis = responseAnalysis;

            console.log('   📊 Response Analysis:');
            console.log(
                `      Consistent structure: ${responseAnalysis.consistentStructure}/${responseAnalysis.totalOperations}`
            );
            console.log(
                `      Has metadata: ${responseAnalysis.hasMetadata}/${responseAnalysis.totalOperations}`
            );
            console.log(
                `      Has timestamps: ${responseAnalysis.hasTimestamps}/${responseAnalysis.totalOperations}\n`
            );
        } catch (error) {
            console.error('   ❌ Response consistency test failed:', error.message);
        }
    }

    /**
     * Test error handling improvements
     */
    async testErrorHandling() {
        console.log('🔍 Testing Error Handling Improvements...\n');

        const errorTests = [
            {
                name: 'Non-existent table',
                request: {
                    jsonrpc: '2.0',
                    id: 6,
                    method: 'tools/call',
                    params: {
                        name: 'read_records',
                        arguments: { table: 'nonexistent_table' },
                    },
                },
            },
            {
                name: 'Invalid SQL',
                request: {
                    jsonrpc: '2.0',
                    id: 7,
                    method: 'tools/call',
                    params: {
                        name: 'query',
                        arguments: { sql: 'INVALID SQL SYNTAX' },
                    },
                },
            },
            {
                name: 'Constraint violation',
                request: {
                    jsonrpc: '2.0',
                    id: 8,
                    method: 'tools/call',
                    params: {
                        name: 'create_record',
                        arguments: {
                            table: 'test_users',
                            data: { id: 1, name: 'Duplicate', email: 'duplicate@example.com' },
                        },
                    },
                },
            },
        ];

        const errorAnalysis = {
            structuredErrors: 0,
            hasErrorTypes: 0,
            hasTimestamps: 0,
            totalErrors: errorTests.length,
        };

        for (const test of errorTests) {
            try {
                const response = await this.sendRequest(test.request);
                const content = response.result.content[0].text;
                const parsed = JSON.parse(content);

                console.log(`   Testing: ${test.name}`);

                if (!parsed.success) {
                    console.log(`   ✅ Error handled: ${parsed.error}`);

                    // Check for structured error format
                    if (parsed.success === false && parsed.error && parsed.timestamp) {
                        errorAnalysis.structuredErrors++;
                    }

                    if (parsed.errorType) {
                        errorAnalysis.hasErrorTypes++;
                        console.log(`      Error type: ${parsed.errorType}`);
                    }

                    if (parsed.timestamp) {
                        errorAnalysis.hasTimestamps++;
                    }
                } else {
                    console.log('   ⚠️  Expected error but got success');
                }
            } catch (error) {
                console.log(`   ❌ Test failed: ${error.message}`);
            }
        }

        this.testResults.errorHandling = errorAnalysis;

        console.log('\n📊 Error Handling Analysis:');
        console.log(
            `   Structured errors: ${errorAnalysis.structuredErrors}/${errorAnalysis.totalErrors}`
        );
        console.log(
            `   Has error types: ${errorAnalysis.hasErrorTypes}/${errorAnalysis.totalErrors}`
        );
        console.log(
            `   Has timestamps: ${errorAnalysis.hasTimestamps}/${errorAnalysis.totalErrors}\n`
        );
    }

    /**
     * Test performance improvements
     */
    async testPerformance() {
        console.log('⚡ Testing Performance Improvements...\n');

        const performanceTests = [
            {
                name: 'Bulk data operations',
                operations: 100,
                test: async () => {
                    const start = Date.now();

                    // Insert multiple records
                    for (let i = 0; i < 10; i++) {
                        await this.sendRequest({
                            jsonrpc: '2.0',
                            id: 100 + i,
                            method: 'tools/call',
                            params: {
                                name: 'create_record',
                                arguments: {
                                    table: 'test_users',
                                    data: { name: `User ${i}`, email: `user${i}@example.com` },
                                },
                            },
                        });
                    }

                    const end = Date.now();
                    return end - start;
                },
            },
            {
                name: 'Metadata extraction',
                operations: 50,
                test: async () => {
                    const start = Date.now();

                    // Read records and extract metadata
                    const response = await this.sendRequest({
                        jsonrpc: '2.0',
                        id: 200,
                        method: 'tools/call',
                        params: {
                            name: 'read_records',
                            arguments: { table: 'test_users', limit: 10 },
                        },
                    });

                    const content = response.result.content[0].text;
                    const parsed = JSON.parse(content);

                    // Extract metadata (simulating client usage)
                    const metadata = {
                        success: parsed.success,
                        rowCount: parsed.rowCount,
                        timestamp: parsed.timestamp,
                        hasData: parsed.data && parsed.data.length > 0,
                    };

                    const end = Date.now();
                    return end - start;
                },
            },
        ];

        const performanceResults = {};

        for (const test of performanceTests) {
            console.log(`   Testing: ${test.name}`);

            const times = [];
            for (let i = 0; i < test.operations; i++) {
                try {
                    const time = await test.test();
                    times.push(time);
                } catch (error) {
                    console.log(`   ⚠️  Operation ${i} failed: ${error.message}`);
                }
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);

            performanceResults[test.name] = {
                averageTime: avgTime,
                minTime: minTime,
                maxTime: maxTime,
                operations: test.operations,
                successfulOperations: times.length,
            };

            console.log(
                `   ✅ Average: ${avgTime.toFixed(2)}ms | Min: ${minTime}ms | Max: ${maxTime}ms`
            );
        }

        this.testResults.performance = performanceResults;
        console.log('');
    }

    /**
     * Generate comprehensive test report
     */
    generateReport() {
        console.log('📋 CLIENT SIMULATION TEST REPORT');
        console.log('='.repeat(50));

        // Usability report
        if (this.testResults.usability.descriptionAnalysis) {
            const desc = this.testResults.usability.descriptionAnalysis;
            console.log('\n🎯 USABILITY IMPROVEMENTS:');
            console.log(
                `   Tool Descriptions: ${desc.toolsWithDetailedDescriptions}/${desc.totalTools} tools have detailed descriptions`
            );
            console.log(
                `   Parameter Descriptions: ${desc.toolsWithParameterDescriptions}/${desc.totalTools} tools have parameter descriptions`
            );
            console.log(
                `   Performance Hints: ${desc.toolsWithPerformanceHints}/${desc.totalTools} tools include performance hints`
            );
        }

        if (this.testResults.usability.responseAnalysis) {
            const resp = this.testResults.usability.responseAnalysis;
            console.log(
                `   Response Consistency: ${resp.consistentStructure}/${resp.totalOperations} responses have consistent structure`
            );
            console.log(
                `   Metadata Availability: ${resp.hasMetadata}/${resp.totalOperations} responses include metadata`
            );
            console.log(
                `   Timestamp Availability: ${resp.hasTimestamps}/${resp.totalOperations} responses include timestamps`
            );
        }

        // Error handling report
        if (this.testResults.errorHandling) {
            const err = this.testResults.errorHandling;
            console.log('\n🔍 ERROR HANDLING IMPROVEMENTS:');
            console.log(
                `   Structured Errors: ${err.structuredErrors}/${err.totalErrors} errors are properly structured`
            );
            console.log(
                `   Error Types: ${err.hasErrorTypes}/${err.totalErrors} errors include error type information`
            );
            console.log(
                `   Error Timestamps: ${err.hasTimestamps}/${err.totalErrors} errors include timestamps`
            );
        }

        // Performance report
        if (this.testResults.performance) {
            console.log('\n⚡ PERFORMANCE IMPROVEMENTS:');
            Object.keys(this.testResults.performance).forEach(testName => {
                const result = this.testResults.performance[testName];
                console.log(
                    `   ${testName}: ${result.averageTime.toFixed(2)}ms average (${result.successfulOperations}/${result.operations} successful)`
                );
            });
        }

        // Save detailed results
        const reportPath = path.join(__dirname, 'client-simulation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        return this.testResults;
    }

    /**
     * Run all client simulation tests
     */
    async runAllTests() {
        try {
            await this.startServer();
            await this.testUsability();
            await this.testErrorHandling();
            await this.testPerformance();
            return this.generateReport();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        } finally {
            await this.stopServer();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const simulator = new ClientSimulator();
    simulator.runAllTests().catch(console.error);
}

module.exports = ClientSimulator;
