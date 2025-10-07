module.exports = [
    {
        files: ['src/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly',
            },
        },
        rules: {
            'no-console': 'off', // Allow console statements for server logging
            'no-unused-vars': 'warn',
            'no-undef': 'error',
            semi: ['error', 'always'],
            quotes: ['error', 'single'],
            indent: ['error', 4],
        },
    },
    
];
