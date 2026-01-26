# Testing Guide for BookApp

## Overview

This document describes the comprehensive unit tests created to address book title badge detection issues.

## Issues Addressed

The tests cover three main problems:

1. **Partial Titles**: Only complete book titles should be badged
   - ❌ Wrong: `[[Harry Potter]]`
   - ✅ Correct: `[[Harry Potter and the Philosopher's Stone]]`

2. **Context-Sensitive Words**: Common words that are also book titles should NOT be badged when used in sentences
   - ❌ Wrong: `"[[Mastery]] focuses on achieving [[mastery]]"` (word "mastery" is incorrectly badged)
   - ✅ Correct: `"[[Mastery]] focuses on achieving excellence"` (only book title is badged)

3. **Consistency**: All book titles should be consistently badged throughout responses

## Prerequisites

Before running tests, you need to fix the npm permission issue:

```bash
sudo chown -R $(whoami) "/Users/navodanilakshi/.npm"
```

Then install dependencies:

```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test badgeDetector.test.js
npm test bookController.test.js
```

## Test Structure

### 1. Badge Detector Tests (`__tests__/badgeDetector.test.js`)

Tests for the utility function that converts `[[BookTitle]]` markers to badge spans.

**Test Categories:**
- Basic functionality (converting marked titles to badges)
- Full vs Partial titles validation
- Context-sensitive detection (words vs book titles)
- Edge cases (special characters, multiple books, etc.)
- Series vs individual books

**Key Test Cases:**

#### Full vs Partial Titles
```javascript
// Should detect partial title as incorrect
const text = '[[Harry Potter]] is a series';
validateBookTitleMarkup(text, ['Harry Potter and the Philosopher\'s Stone']);
// Returns: { isValid: false, issues: [{ type: 'partial_title', ... }] }
```

#### Context-Sensitive Words
```javascript
// Should detect "mastery" used in context as incorrect
const text = '[[Mastery]] focuses on achieving [[mastery]]';
validateBookTitleMarkup(text, ['Mastery']);
// Returns: { isValid: false, issues: [{ type: 'word_in_context', ... }] }
```

### 2. Controller Tests (`__tests__/bookController.test.js`)

Tests for AI prompt instructions and response validation.

**Test Categories:**
- AI System Prompt Requirements
- Common scenarios (partial titles, context words)
- Multiple books scenarios
- Context-sensitive badging
- Series vs individual books
- Real-world problematic responses

**Key Test Cases:**

#### Screenshot Issue - "mastery" in sentence
```javascript
// From user's screenshot - this should fail validation
const problematic = 'achieving [[mastery]] in a particular field';
// "mastery" here is used as a word, not the book title

// Correct version
const correct = 'achieving excellence in a particular field. [[Mastery]] is highly recommended.';
```

#### Partial Title Detection
```javascript
// Should fail - partial title
'[[48 Laws of Power]]' // Missing "The"

// Should pass - full title
'[[The 48 Laws of Power]]'
```

## Utility Functions

### `addBookNameBadges(text)`
Converts `[[BookTitle]]` markers to HTML badge spans.

```javascript
const result = addBookNameBadges('Read [[1984]] by Orwell');
// Returns: 'Read <span class="book-name-badge">1984</span> by Orwell'
```

### `validateBookTitleMarkup(text, expectedFullTitles)`
Validates if AI response properly marks book titles.

```javascript
const validation = validateBookTitleMarkup(
    '[[Harry Potter]] is great',
    ['Harry Potter and the Philosopher\'s Stone']
);
// Returns: {
//   isValid: false,
//   markedTitles: ['Harry Potter'],
//   issues: [{ type: 'partial_title', ... }]
// }
```

### `extractMarkedTitles(text)`
Extracts all marked titles from text.

```javascript
const titles = extractMarkedTitles('Read [[1984]] and [[Animal Farm]]');
// Returns: ['1984', 'Animal Farm']
```

## Expected Test Results

All tests should pass after the improvements made to:

1. **AI System Prompt** (`controllers/bookController.js`)
   - Enhanced instructions to only wrap complete titles
   - Explicit rules against wrapping words in sentence context
   - Clear examples of correct vs incorrect markup

2. **Frontend Function** (`views/books/index.ejs`)
   - Improved documentation about function responsibility
   - Clear separation: function processes brackets, AI decides what to bracket

3. **Utility Module** (`utils/badgeDetector.js`)
   - Reusable functions for testing and validation
   - Context-aware validation logic

## Test Coverage

The test suite includes **40+ test cases** covering:

- ✅ Full title detection (not partial)
- ✅ Context-sensitive word detection
- ✅ Series name vs individual book titles
- ✅ Multiple books in one response
- ✅ Special characters and edge cases
- ✅ Real-world problematic scenarios

## Continuous Integration

To integrate these tests into CI/CD:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
- name: Check coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests fail due to npm permissions
```bash
sudo chown -R $(whoami) "/Users/navodanilakshi/.npm"
npm install
```

### Jest not found
```bash
npm install --save-dev jest @types/jest
```

### Tests timeout
Increase timeout in package.json:
```json
"jest": {
  "testTimeout": 10000
}
```

## Contributing

When adding new test cases:

1. Identify the edge case or issue
2. Add test case to appropriate describe block
3. Run tests to ensure it fails (red)
4. Implement fix
5. Run tests to ensure it passes (green)
6. Refactor if needed

## References

- Jest Documentation: https://jestjs.io/
- Test file locations:
  - `__tests__/badgeDetector.test.js`
  - `__tests__/bookController.test.js`
- Utility module: `utils/badgeDetector.js`
