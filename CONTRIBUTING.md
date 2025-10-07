# Contributing to MCP SQLite Server

First off, thank you for considering contributing to MCP SQLite Server! It's people like you that make this project better for everyone.

## 🤝 Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct (see CODE_OF_CONDUCT.md).

## 🚀 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, commands, etc.)
- **Describe the behavior you observed** and what you expected
- **Include your environment details** (Node version, OS, etc.)

**Bug Report Template:**

```markdown
**Description:**
A clear description of the bug.

**Steps to Reproduce:**

1. Step one
2. Step two
3. See error

**Expected Behavior:**
What you expected to happen.

**Actual Behavior:**
What actually happened.

**Environment:**

- Node Version:
- OS:
- MCP SQLite Version:
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List any similar features** in other projects if applicable

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the coding standards
3. **Add tests** for any new functionality
4. **Ensure all tests pass** by running `npm test`
5. **Update documentation** if needed
6. **Write a clear commit message** following our commit conventions

#### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md following the existing format
3. The PR will be merged once you have the sign-off of a maintainer

## 💻 Development Setup

### Prerequisites

- Node.js >= 14.0.0
- npm or yarn

### Setup Instructions

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mcp-sqlite.git
cd mcp-sqlite

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Test with MCP Inspector
npm run test:mcp
```

## 📝 Coding Standards

### Code Style

This project uses ESLint for code quality. Please ensure your code follows the existing style:

```bash
# Check for linting errors
npx eslint src/

# Auto-fix linting errors
npx eslint src/ --fix
```

**Key Style Guidelines:**

- Use single quotes for strings
- Use 4 spaces for indentation
- Use semicolons
- Use meaningful variable and function names
- Add comments for complex logic

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(query): add support for transaction handling
fix(schema): resolve issue with table schema parsing
docs(readme): update installation instructions
test(crud): add tests for delete operation
```

### Testing

- Write unit tests for all new functionality
- Ensure existing tests pass before submitting PR
- Aim for high test coverage (>80%)
- Use descriptive test names

```javascript
// Good test name
test('should return all records when no conditions provided', () => {
    // test implementation
});

// Bad test name
test('test1', () => {
    // test implementation
});
```

## 🏗️ Project Structure

```
mcp-sqlite/
├── src/
│   └── mcp-sqlite-server.js    # Main server implementation
├── test/                    # Test files
│   ├── setup.js            # Test setup
│   ├── test-utils.js       # Test utilities
│   └── *.test.js           # Test files
├── README.md               # Project documentation
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # This file
└── package.json            # Project metadata
```

## 📋 Testing Checklist

Before submitting your PR, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Code follows style guidelines (`npx eslint`)
- [ ] New functionality has tests
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Commit messages follow conventions
- [ ] No console.log() or debug code remains

## 🐛 Debugging

### Testing with MCP Inspector

```bash
npm run test:mcp
```

This will start the MCP Inspector where you can interactively test tools.

### Running Specific Tests

```bash
# Run specific test file
npm test -- sqlite-handler.test.js

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## 📚 Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [SQLite3 Node.js Documentation](https://github.com/TryGhost/node-sqlite3)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 🎯 Good First Issues

Look for issues labeled `good first issue` - these are great starting points for new contributors!

## 💬 Questions?

Feel free to:

- Open an issue with the `question` label
- Reach out to the maintainers
- Check existing discussions

## 🙏 Recognition

Contributors will be recognized in:

- GitHub contributors page
- Release notes (for significant contributions)
- Project README (for major features)

Thank you for contributing! 🎉
