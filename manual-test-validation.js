/**
 * Manual Test Validation Script
 * Run this with: node manual-test-validation.js
 * 
 * This script validates the badge detection logic without requiring Jest installation
 */

const { addBookNameBadges, validateBookTitleMarkup, extractMarkedTitles } = require('./utils/badgeDetector');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`${colors.green}✓${colors.reset} ${testName}`);
        return true;
    } else {
        failedTests++;
        console.log(`${colors.red}✗${colors.reset} ${testName}`);
        return false;
    }
}

function assertDeepEqual(actual, expected, testName) {
    const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
    return assert(isEqual, testName + (isEqual ? '' : `\n  Expected: ${JSON.stringify(expected)}\n  Got: ${JSON.stringify(actual)}`));
}

function testSection(title) {
    console.log(`\n${colors.bold}${colors.blue}${title}${colors.reset}`);
}

function printSummary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${colors.bold}Test Summary${colors.reset}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total: ${totalTests}`);
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
    
    if (failedTests === 0) {
        console.log(`\n${colors.green}${colors.bold}✅ All tests passed!${colors.reset}`);
    } else {
        console.log(`\n${colors.red}${colors.bold}❌ ${failedTests} test(s) failed${colors.reset}`);
    }
    console.log(`${'='.repeat(60)}\n`);
}

// Run tests
console.log(`${colors.bold}BookApp Badge Detection - Manual Test Validation${colors.reset}`);
console.log(`${'='.repeat(60)}`);

// Test 1: Basic Badge Conversion
testSection('Test 1: Basic Badge Conversion');
{
    const input = '[[The 48 Laws of Power]] is a book about strategy.';
    const expected = '<span class="book-name-badge">The 48 Laws of Power</span> is a book about strategy.';
    const result = addBookNameBadges(input);
    assert(result === expected, 'Should convert [[BookTitle]] to badge span');
}

// Test 2: Multiple Books
testSection('Test 2: Multiple Books');
{
    const input = 'Read [[1984]] and [[Animal Farm]] by George Orwell.';
    const result = addBookNameBadges(input);
    const badgeCount = (result.match(/book-name-badge/g) || []).length;
    assert(badgeCount === 2, 'Should handle multiple book titles');
}

// Test 3: Full Title Detection
testSection('Test 3: Full vs Partial Titles');
{
    // Test partial title detection
    const partialText = '[[Harry Potter]] is a series.';
    const validation = validateBookTitleMarkup(partialText, ['Harry Potter and the Philosopher\'s Stone']);
    assert(!validation.isValid, 'Should detect partial title as invalid');
    assert(validation.issues.length > 0 && validation.issues[0].type === 'partial_title', 'Should identify issue as partial_title');
    
    // Test full title
    const fullText = '[[Harry Potter and the Philosopher\'s Stone]] is the first book.';
    const validationFull = validateBookTitleMarkup(fullText, ['Harry Potter and the Philosopher\'s Stone']);
    assert(validationFull.isValid, 'Should accept full title');
}

// Test 4: Context-Sensitive Words
testSection('Test 4: Context-Sensitive Words (Critical Issue from Screenshot)');
{
    // The problematic case from user's screenshot
    const problematicText = '[[Mastery]] focuses on achieving [[mastery]] in a particular field.';
    const validation = validateBookTitleMarkup(problematicText, ['Mastery']);
    assert(!validation.isValid, 'Should detect "mastery" word in context as invalid');
    assert(
        validation.issues.some(issue => issue.type === 'word_in_context' && issue.word === 'mastery'),
        'Should identify "mastery" as word_in_context issue'
    );
    
    // The correct version
    const correctText = '[[Mastery]] focuses on achieving excellence in a particular field.';
    const validationCorrect = validateBookTitleMarkup(correctText, ['Mastery']);
    assert(validationCorrect.isValid, 'Should accept correct version without word in context');
}

// Test 5: "The" Prefix in Titles
testSection('Test 5: Complete Titles with "The" Prefix');
{
    // Missing "The"
    const withoutThe = '[[48 Laws of Power]] was published in 1998.';
    const validation = validateBookTitleMarkup(withoutThe, ['The 48 Laws of Power']);
    assert(!validation.isValid, 'Should detect missing "The" as partial title');
    
    // With "The"
    const withThe = '[[The 48 Laws of Power]] was published in 1998.';
    const validationFull = validateBookTitleMarkup(withThe, ['The 48 Laws of Power']);
    assert(validationFull.isValid, 'Should accept full title with "The"');
}

// Test 6: Series vs Individual Books
testSection('Test 6: Series Names vs Individual Book Titles');
{
    const text = 'The Harry Potter series includes [[Harry Potter and the Philosopher\'s Stone]].';
    const validation = validateBookTitleMarkup(text, ['Harry Potter and the Philosopher\'s Stone']);
    assert(validation.isValid, 'Should accept individual book title, not series name');
    assert(!validation.markedTitles.includes('Harry Potter series'), 'Should NOT mark series name');
}

// Test 7: Extract Marked Titles
testSection('Test 7: Extract Marked Titles');
{
    const text = 'Read [[1984]], [[Animal Farm]], and [[Brave New World]].';
    const titles = extractMarkedTitles(text);
    assertDeepEqual(titles, ['1984', 'Animal Farm', 'Brave New World'], 'Should extract all marked titles');
}

// Test 8: Common Words That Are Also Book Titles
testSection('Test 8: Common Words vs Book Titles');
{
    const text = '[[The 48 Laws of Power]] discusses the dynamics of power in society.';
    const result = addBookNameBadges(text);
    const badgeCount = (result.match(/book-name-badge/g) || []).length;
    assert(badgeCount === 1, 'Should only badge book title, not "power" in sentence');
    assert(result.includes('dynamics of power'), 'Should preserve "power" as regular word in sentence');
}

// Test 9: Real-World Screenshot Example
testSection('Test 9: Real-World Screenshot Example');
{
    const problematic = '[[The Laws of Human Nature]] explores principles. If you\'re interested in achieving [[mastery]] in a field...';
    const validation = validateBookTitleMarkup(problematic, ['The Laws of Human Nature']);
    assert(!validation.isValid, 'Should detect word "mastery" used in context as invalid');
    
    const correct = '[[The Laws of Human Nature]] explores principles. If you\'re interested in achieving excellence in a field, [[Mastery]] is recommended.';
    const validationCorrect = validateBookTitleMarkup(correct, ['The Laws of Human Nature', 'Mastery']);
    assert(validationCorrect.isValid, 'Should accept correct version with proper book title reference');
}

// Test 10: Multiple Occurrences of Same Book
testSection('Test 10: Multiple Occurrences of Same Book');
{
    const text = 'Read [[1984]]. After reading [[1984]], you\'ll appreciate Orwell more.';
    const titles = extractMarkedTitles(text);
    assert(titles.length === 2, 'Should extract both occurrences');
    assert(titles[0] === '1984' && titles[1] === '1984', 'Both should be same title');
}

// Test 11: Edge Cases - Special Characters
testSection('Test 11: Edge Cases - Special Characters');
{
    const text = '[[Alice\'s Adventures in Wonderland]] is a classic.';
    const result = addBookNameBadges(text);
    assert(result.includes('book-name-badge">Alice\'s Adventures in Wonderland</span>'), 'Should handle apostrophes');
}

// Test 12: Empty and Null Cases
testSection('Test 12: Empty and Null Cases');
{
    assert(addBookNameBadges(null) === null, 'Should handle null');
    assert(addBookNameBadges('') === '', 'Should handle empty string');
    assertDeepEqual(extractMarkedTitles(null), [], 'Should return empty array for null');
}

// Test 13: No Marked Titles
testSection('Test 13: No Marked Titles');
{
    const text = 'This text has no book titles marked.';
    const result = addBookNameBadges(text);
    assert(result === text, 'Should return original text when no markers');
    assertDeepEqual(extractMarkedTitles(text), [], 'Should return empty array when no markers');
}

// Test 14: Consecutive Book Titles
testSection('Test 14: Consecutive Book Titles');
{
    const text = '[[1984]][[Animal Farm]][[Brave New World]]';
    const result = addBookNameBadges(text);
    const badgeCount = (result.match(/book-name-badge/g) || []).length;
    assert(badgeCount === 3, 'Should handle consecutive book titles');
}

// Test 15: War/Power/Mastery Context Detection
testSection('Test 15: Multiple Context-Sensitive Words');
{
    // War in context
    const warText = '[[The 33 Strategies of War]] examines principles of [[war]].';
    const warValidation = validateBookTitleMarkup(warText, ['The 33 Strategies of War']);
    assert(!warValidation.isValid, 'Should detect "war" in context');
    
    // Power in context
    const powerText = 'This book explores the dynamics of [[power]].';
    const powerValidation = validateBookTitleMarkup(powerText, []);
    assert(!powerValidation.isValid, 'Should detect "power" in context');
}

// Print final summary
printSummary();

// Exit with appropriate code
process.exit(failedTests > 0 ? 1 : 0);
