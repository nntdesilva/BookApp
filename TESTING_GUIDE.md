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
npm test coloredBadgeDetector.test.js
```

## Test Structure

### Colored Badge Detector Tests (`tests/unit/coloredBadgeDetector.test.js`)

Tests for the AI-powered colored badge classification system.

**Test Categories:**

- Book/Series Analysis (analyzeBookOrSeries)
- Book Title Validation (isActualBookTitle)
- Badge Classification (classifyBookBadges)
- Badge Application and HTML Generation
- Title Extraction
- Title Normalization
- Integration Scenarios

**Key Test Cases:**

#### Badge Classification

```javascript
// CREAM badge for exact searched book
// GREEN badge for books in same series
// ORANGE badge for unrelated books
const classification = await classifyBookBadges(
  aiResponse,
  searchedQuery,
  searchedBook,
  seriesName,
);
```

#### Series Analysis

```javascript
// Analyze if input is series name or book title
const result = await analyzeBookOrSeries("Harry Potter");
// Returns: { isSeries: true, seriesName: "Harry Potter", allBooksInSeries: [...] }
```

## Key Functions

### `analyzeBookOrSeries(input)`

Analyze if input is a series name or book title, and get series information.

```javascript
const result = await analyzeBookOrSeries("Harry Potter");
// Returns: {
//   isSeries: true,
//   seriesName: "Harry Potter",
//   allBooksInSeries: ["Harry Potter and the Philosopher's Stone", ...]
// }
```

### `classifyBookBadges(aiResponse, searchedQuery, searchedBook, seriesName)`

Classify books into badge color categories using AI.

```javascript
const classification = await classifyBookBadges(
  aiResponse,
  "harry potter",
  "Harry Potter and the Philosopher's Stone",
  "Harry Potter",
);
// Returns: {
//   creamBadgeBooks: [...],
//   greenBadgeBooks: [...],
//   orangeBadgeBooks: [...]
// }
```

### `applyColoredBadges(aiResponse, classification)`

Apply colored badge HTML to the AI response.

```javascript
const html = applyColoredBadges(aiResponse, classification);
// Returns HTML with colored badge spans
```

### `extractMarkedTitles(text)`

Extracts all marked titles from text.

```javascript
const titles = extractMarkedTitles("Read [[1984]] and [[Animal Farm]]");
// Returns: ['1984', 'Animal Farm']
```

## Expected Test Results

All tests should pass with the current implementation:

1. **AI System Prompt** (`controllers/bookController.js`)
   - Enhanced instructions to only wrap complete titles
   - Explicit rules against wrapping words in sentence context
   - Clear examples of correct vs incorrect markup

2. **Colored Badge Detection** (`utils/coloredBadgeDetector.js`)
   - AI-powered classification of books into cream/green/orange categories
   - Series and book analysis
   - Fallback handling for quoted titles

3. **Frontend Function** (`views/books/index.ejs`)
   - Client-side badge application
   - Clear separation: function processes brackets, AI decides what to bracket

## Test Coverage

The test suite includes comprehensive test cases covering:

- ✅ Book/Series Analysis (AI-powered)
- ✅ Badge Classification (cream/green/orange)
- ✅ Badge Application and HTML Generation
- ✅ Title Extraction and Normalization
- ✅ Multiple books in one response
- ✅ Special characters and edge cases
- ✅ Real-world integration scenarios

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
- Test file: `tests/unit/coloredBadgeDetector.test.js`
- Main modules:
  - `utils/coloredBadgeDetector.js` - AI-powered badge classification
  - `controllers/bookController.js` - Route handlers with AI prompt engineering
