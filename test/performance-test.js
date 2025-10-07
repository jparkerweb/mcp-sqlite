#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

/**
 * Performance Testing Suite for MCP SQLite Server
 * Tests the improvements in descriptions and response formatting
 */

class PerformanceTester {
    constructor() {
        this.results = {
            responseParsing: {},
            errorHandling: {},
            clientSimulation: {},
            metadataExtraction: {},
        };
    }

    /**
     * Test response parsing performance
     */
    async testResponseParsing() {
        console.log('🧪 Testing Response Parsing Performance...\n');

        // Simulate old format responses
        const oldFormatResponses = {
            query: JSON.stringify([
                { id: 1, name: 'test' },
                { id: 2, name: 'test2' },
            ]),
            listTables: JSON.stringify([{ name: 'users' }, { name: 'orders' }]),
            error: 'Error: SQLITE_ERROR: no such table: nonexistent',
        };

        // Simulate new format responses
        const newFormatResponses = {
            query: JSON.stringify({
                success: true,
                data: [
                    { id: 1, name: 'test' },
                    { id: 2, name: 'test2' },
                ],
                rowCount: 2,
                timestamp: new Date().toISOString(),
            }),
            listTables: JSON.stringify({
                success: true,
                data: [{ name: 'users' }, { name: 'orders' }],
                tableCount: 2,
                message: '2 table(s) found',
                timestamp: new Date().toISOString(),
            }),
            error: JSON.stringify({
                success: false,
                error: 'SQLITE_ERROR: no such table: nonexistent',
                errorType: 'SQLITE_ERROR',
                timestamp: new Date().toISOString(),
            }),
        };

        const iterations = 10000;

        // Test old format parsing
        const oldParseTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            try {
                JSON.parse(oldFormatResponses.query);
                JSON.parse(oldFormatResponses.listTables);
                // Old error format - no JSON parsing needed
                oldFormatResponses.error.includes('Error:');
            } catch (e) {
                // Handle parsing errors
            }
            const end = performance.now();
            oldParseTimes.push(end - start);
        }

        // Test new format parsing
        const newParseTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            try {
                const queryResult = JSON.parse(newFormatResponses.query);
                const listResult = JSON.parse(newFormatResponses.listTables);
                const errorResult = JSON.parse(newFormatResponses.error);

                // Extract metadata (simulating client usage)
                const queryMetadata = {
                    success: queryResult.success,
                    rowCount: queryResult.rowCount,
                    timestamp: queryResult.timestamp,
                };
                const listMetadata = {
                    success: listResult.success,
                    tableCount: listResult.tableCount,
                    message: listResult.message,
                };
                const errorMetadata = {
                    success: errorResult.success,
                    errorType: errorResult.errorType,
                };
            } catch (e) {
                // Handle parsing errors
            }
            const end = performance.now();
            newParseTimes.push(end - start);
        }

        const oldAvgTime = oldParseTimes.reduce((a, b) => a + b, 0) / oldParseTimes.length;
        const newAvgTime = newParseTimes.reduce((a, b) => a + b, 0) / newParseTimes.length;

        this.results.responseParsing = {
            oldFormat: {
                averageTime: oldAvgTime,
                iterations: iterations,
            },
            newFormat: {
                averageTime: newAvgTime,
                iterations: iterations,
            },
            improvement: {
                timeDifference: oldAvgTime - newAvgTime,
                percentageImprovement: (((oldAvgTime - newAvgTime) / oldAvgTime) * 100).toFixed(2),
            },
        };

        console.log('📊 Response Parsing Results:');
        console.log(`   Old Format Average: ${oldAvgTime.toFixed(4)}ms`);
        console.log(`   New Format Average: ${newAvgTime.toFixed(4)}ms`);
        console.log(
            `   Improvement: ${this.results.responseParsing.improvement.percentageImprovement}% faster\n`
        );
    }

    /**
     * Test error handling improvements
     */
    async testErrorHandling() {
        console.log('🔍 Testing Error Handling Improvements...\n');

        const testErrors = [
            { code: 'SQLITE_ERROR', message: 'no such table: users' },
            { code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed: users.email' },
            { code: 'SQLITE_MISUSE', message: 'misuse of aggregate function' },
        ];

        const iterations = 1000;

        // Test old error handling (string parsing)
        const oldErrorTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            testErrors.forEach(error => {
                const errorString = `Error: ${error.message}`;
                // Simulate old error parsing
                const isError = errorString.startsWith('Error:');
                const message = errorString.replace('Error: ', '');
                // No structured error type extraction
            });
            const end = performance.now();
            oldErrorTimes.push(end - start);
        }

        // Test new error handling (structured JSON)
        const newErrorTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            testErrors.forEach(error => {
                const errorResponse = {
                    success: false,
                    error: error.message,
                    errorType: error.code,
                    timestamp: new Date().toISOString(),
                };
                const errorJson = JSON.stringify(errorResponse);
                const parsed = JSON.parse(errorJson);

                // Simulate client error handling
                if (!parsed.success) {
                    const errorType = parsed.errorType;
                    const errorMessage = parsed.error;
                    const timestamp = parsed.timestamp;
                    // Client can now handle different error types programmatically
                }
            });
            const end = performance.now();
            newErrorTimes.push(end - start);
        }

        const oldAvgTime = oldErrorTimes.reduce((a, b) => a + b, 0) / oldErrorTimes.length;
        const newAvgTime = newErrorTimes.reduce((a, b) => a + b, 0) / newErrorTimes.length;

        this.results.errorHandling = {
            oldFormat: {
                averageTime: oldAvgTime,
                iterations: iterations,
            },
            newFormat: {
                averageTime: newAvgTime,
                iterations: iterations,
            },
            improvement: {
                timeDifference: oldAvgTime - newAvgTime,
                percentageImprovement: (((oldAvgTime - newAvgTime) / oldAvgTime) * 100).toFixed(2),
            },
        };

        console.log('📊 Error Handling Results:');
        console.log(`   Old Format Average: ${oldAvgTime.toFixed(4)}ms`);
        console.log(`   New Format Average: ${newAvgTime.toFixed(4)}ms`);
        console.log(
            `   Improvement: ${this.results.errorHandling.improvement.percentageImprovement}% faster\n`
        );
    }

    /**
     * Test client simulation scenarios
     */
    async testClientSimulation() {
        console.log('🎯 Testing Client Simulation Scenarios...\n');

        const scenarios = [
            {
                name: 'Database Discovery',
                operations: ['db_info', 'list_tables', 'get_table_schema'],
            },
            {
                name: 'Data Retrieval',
                operations: ['read_records', 'read_records', 'read_records'],
            },
            {
                name: 'Error Recovery',
                operations: ['query', 'error_handling', 'fallback_query'],
            },
        ];

        const iterations = 100;

        scenarios.forEach(scenario => {
            console.log(`   Testing: ${scenario.name}`);

            // Simulate old client behavior
            const oldTimes = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();

                scenario.operations.forEach(op => {
                    // Old client would need to parse unstructured responses
                    // and make assumptions about data format
                    if (op === 'db_info') {
                        // Simulate parsing old db_info response
                        const response = JSON.stringify({
                            dbPath: '/path/to/db',
                            exists: true,
                            size: 1024,
                            tableCount: 5,
                        });
                        const parsed = JSON.parse(response);
                        // Client needs to know structure beforehand
                    }
                });

                const end = performance.now();
                oldTimes.push(end - start);
            }

            // Simulate new client behavior
            const newTimes = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();

                scenario.operations.forEach(op => {
                    // New client can rely on consistent response structure
                    if (op === 'db_info') {
                        const response = JSON.stringify({
                            success: true,
                            data: {
                                dbPath: '/path/to/db',
                                exists: true,
                                size: 1024,
                                tableCount: 5,
                            },
                            timestamp: new Date().toISOString(),
                        });
                        const parsed = JSON.parse(response);

                        // Client can programmatically handle success/failure
                        if (parsed.success) {
                            const data = parsed.data;
                            const timestamp = parsed.timestamp;
                            // Structured handling
                        }
                    }
                });

                const end = performance.now();
                newTimes.push(end - start);
            }

            const oldAvg = oldTimes.reduce((a, b) => a + b, 0) / oldTimes.length;
            const newAvg = newTimes.reduce((a, b) => a + b, 0) / newTimes.length;

            this.results.clientSimulation[scenario.name] = {
                oldFormat: { averageTime: oldAvg },
                newFormat: { averageTime: newAvg },
                improvement: {
                    percentageImprovement: (((oldAvg - newAvg) / oldAvg) * 100).toFixed(2),
                },
            };

            console.log(
                `     Old: ${oldAvg.toFixed(4)}ms | New: ${newAvg.toFixed(4)}ms | Improvement: ${(((oldAvg - newAvg) / oldAvg) * 100).toFixed(2)}%\n`
            );
        });
    }

    /**
     * Test metadata extraction performance
     */
    async testMetadataExtraction() {
        console.log('📈 Testing Metadata Extraction Performance...\n');

        const iterations = 5000;

        // Test extracting metadata from old format
        const oldMetadataTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();

            // Simulate old format - no structured metadata
            const queryResponse = JSON.stringify([{ id: 1 }, { id: 2 }]);
            const parsed = JSON.parse(queryResponse);

            // Client has to calculate metadata manually
            const rowCount = parsed.length;
            const hasData = parsed.length > 0;
            const timestamp = new Date().toISOString(); // Client generates

            const end = performance.now();
            oldMetadataTimes.push(end - start);
        }

        // Test extracting metadata from new format
        const newMetadataTimes = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();

            // Simulate new format - structured metadata included
            const queryResponse = JSON.stringify({
                success: true,
                data: [{ id: 1 }, { id: 2 }],
                rowCount: 2,
                timestamp: new Date().toISOString(),
            });
            const parsed = JSON.parse(queryResponse);

            // Client can directly access metadata
            const success = parsed.success;
            const rowCount = parsed.rowCount;
            const timestamp = parsed.timestamp;
            const hasData = parsed.data && parsed.data.length > 0;

            const end = performance.now();
            newMetadataTimes.push(end - start);
        }

        const oldAvgTime = oldMetadataTimes.reduce((a, b) => a + b, 0) / oldMetadataTimes.length;
        const newAvgTime = newMetadataTimes.reduce((a, b) => a + b, 0) / newMetadataTimes.length;

        this.results.metadataExtraction = {
            oldFormat: {
                averageTime: oldAvgTime,
                iterations: iterations,
            },
            newFormat: {
                averageTime: newAvgTime,
                iterations: iterations,
            },
            improvement: {
                timeDifference: oldAvgTime - newAvgTime,
                percentageImprovement: (((oldAvgTime - newAvgTime) / oldAvgTime) * 100).toFixed(2),
            },
        };

        console.log('📊 Metadata Extraction Results:');
        console.log(`   Old Format Average: ${oldAvgTime.toFixed(4)}ms`);
        console.log(`   New Format Average: ${newAvgTime.toFixed(4)}ms`);
        console.log(
            `   Improvement: ${this.results.metadataExtraction.improvement.percentageImprovement}% faster\n`
        );
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        console.log('📋 PERFORMANCE TEST REPORT');
        console.log('='.repeat(50));

        const overallImprovements = [];

        Object.keys(this.results).forEach(testType => {
            const result = this.results[testType];
            console.log(`\n🔬 ${testType.toUpperCase()}:`);

            if (result.improvement) {
                console.log(
                    `   Performance Improvement: ${result.improvement.percentageImprovement}%`
                );
                overallImprovements.push(parseFloat(result.improvement.percentageImprovement));
            } else if (typeof result === 'object') {
                Object.keys(result).forEach(scenario => {
                    if (result[scenario].improvement) {
                        console.log(
                            `   ${scenario}: ${result[scenario].improvement.percentageImprovement}%`
                        );
                        overallImprovements.push(
                            parseFloat(result[scenario].improvement.percentageImprovement)
                        );
                    }
                });
            }
        });

        const avgImprovement =
            overallImprovements.reduce((a, b) => a + b, 0) / overallImprovements.length;

        console.log('\n🎯 OVERALL RESULTS:');
        console.log(`   Average Performance Improvement: ${avgImprovement.toFixed(2)}%`);
        console.log(`   Tests Completed: ${Object.keys(this.results).length}`);
        console.log(`   Scenarios Tested: ${overallImprovements.length}`);

        // Save detailed results
        const reportPath = path.join(__dirname, 'performance-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        return this.results;
    }

    /**
     * Run all performance tests
     */
    async runAllTests() {
        console.log('🚀 Starting MCP SQLite Server Performance Tests\n');
        console.log('Testing improvements in descriptions and response formatting...\n');

        await this.testResponseParsing();
        await this.testErrorHandling();
        await this.testClientSimulation();
        await this.testMetadataExtraction();

        return this.generateReport();
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new PerformanceTester();
    tester.runAllTests().catch(console.error);
}

module.exports = PerformanceTester;
