module.exports = {
    env: {
        node: true,
        es6: true,
    },
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'commonjs',
    },
    rules: {
        'no-console': 'off', // Allow console statements for server logging
        'no-unused-vars': 'warn',
        'no-undef': 'error',
        semi: ['error', 'always'],
        quotes: 'off', // Handled by Prettier
        indent: 'off', // Handled by Prettier
    },
    overrides: [
        {
            files: ['test/**/*.js'],
            env: {
                node: true,
                es6: true,
                jest: true,
            },
            rules: {
                'no-console': 'off',
                'no-unused-vars': 'warn',
            },
        },
    ],
};
