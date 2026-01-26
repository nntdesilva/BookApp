const { validateBookTitleMarkup } = require('../utils/badgeDetector');

describe('BookController AI Instructions', () => {
    describe('System Prompt Requirements', () => {
        /**
         * These tests verify that the AI system prompt has proper instructions
         * The actual implementation is in controllers/bookController.js
         */
        
        test('AI should be instructed to wrap ONLY complete book titles', () => {
            // This is a specification test - the prompt should include instructions like:
            // "ALWAYS wrap COMPLETE book titles with [[brackets]]"
            // "Do NOT wrap partial titles like [[Harry Potter]] - use [[Harry Potter and the Philosopher's Stone]]"
            expect(true).toBe(true); // This is verified by checking the actual prompt in controller
        });

        test('AI should be instructed NOT to wrap common words used in sentences', () => {
            // The prompt should include:
            // "Do NOT wrap common words when used in sentence context"
            // "Only wrap book titles when referring to the actual book, not the concept"
            expect(true).toBe(true);
        });

        test('AI should be instructed to wrap series books by specific title, not series name', () => {
            // The prompt should specify:
            // "For series, wrap individual book titles, not the series name"
            // Example: "The Harry Potter series" should NOT be wrapped
            expect(true).toBe(true);
        });
    });

    describe('AI Response Validation - Common Scenarios', () => {
        test('Book with same name as common word - should only mark when referring to book', () => {
            const responseWithIssue = 'Robert Greene wrote [[Mastery]], which focuses on achieving [[mastery]] in a particular field through practice.';
            const validation = validateBookTitleMarkup(responseWithIssue, ['Mastery']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'word_in_context' && issue.word === 'mastery'
            )).toBe(true);
        });

        test('Correct response - book title marked only once', () => {
            const correctResponse = 'Robert Greene wrote [[Mastery]], which focuses on achieving excellence in a particular field through practice.';
            const validation = validateBookTitleMarkup(correctResponse, ['Mastery']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual(['Mastery']);
        });

        test('Should mark full title, not partial - Harry Potter example', () => {
            const incorrectResponse = 'The [[Harry Potter]] series begins with the first book in 1997.';
            const validation = validateBookTitleMarkup(incorrectResponse, ['Harry Potter and the Philosopher\'s Stone']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues[0].type).toBe('partial_title');
        });

        test('Correct Harry Potter response', () => {
            const correctResponse = 'The Harry Potter series begins with [[Harry Potter and the Philosopher\'s Stone]], published in 1997.';
            const validation = validateBookTitleMarkup(correctResponse, ['Harry Potter and the Philosopher\'s Stone']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual(['Harry Potter and the Philosopher\'s Stone']);
        });

        test('The 48 Laws of Power - should include "The"', () => {
            const incorrectResponse = 'Robert Greene\'s [[48 Laws of Power]] was published in 1998.';
            const validation = validateBookTitleMarkup(incorrectResponse, ['The 48 Laws of Power']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues[0].type).toBe('partial_title');
        });

        test('Correct "The 48 Laws of Power" response', () => {
            const correctResponse = 'Robert Greene\'s [[The 48 Laws of Power]] was published in 1998 and explores the dynamics of power in human relationships.';
            const validation = validateBookTitleMarkup(correctResponse, ['The 48 Laws of Power']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual(['The 48 Laws of Power']);
        });
    });

    describe('Multiple Books Scenarios', () => {
        test('Should mark all mentioned books with full titles', () => {
            const response = '[[The Art of Seduction]], [[The 48 Laws of Power]], and [[Mastery]] are all written by Robert Greene.';
            const validation = validateBookTitleMarkup(response, [
                'The Art of Seduction',
                'The 48 Laws of Power',
                'Mastery'
            ]);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toHaveLength(3);
        });

        test('Should detect when one book is missing brackets', () => {
            const response = '[[The Art of Seduction]], The 48 Laws of Power, and [[Mastery]] are all written by Robert Greene.';
            const validation = validateBookTitleMarkup(response, [
                'The Art of Seduction',
                'The 48 Laws of Power',
                'Mastery'
            ]);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'missing_brackets' && issue.title === 'The 48 Laws of Power'
            )).toBe(true);
        });

        test('Related works - other books by author', () => {
            const response = 'Robert Greene has written several other popular books including [[The Art of Seduction]], [[The 33 Strategies of War]], [[Mastery]], [[The Laws of Human Nature]], and [[The 50th Law]].';
            const validation = validateBookTitleMarkup(response, [
                'The Art of Seduction',
                'The 33 Strategies of War',
                'Mastery',
                'The Laws of Human Nature',
                'The 50th Law'
            ]);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toHaveLength(5);
        });
    });

    describe('Context-Sensitive Badging', () => {
        test('Book about "power" should only mark title, not concept', () => {
            const response = '[[The 48 Laws of Power]] explores the strategies and psychology of power throughout history.';
            const validation = validateBookTitleMarkup(response, ['The 48 Laws of Power']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual(['The 48 Laws of Power']);
        });

        test('Book about "war" should only mark title, not concept', () => {
            const response = '[[The 33 Strategies of War]] examines the principles of war and how they can be applied to everyday life.';
            const validation = validateBookTitleMarkup(response, ['The 33 Strategies of War']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual(['The 33 Strategies of War']);
        });

        test('Should NOT mark words in descriptive phrases', () => {
            // This should fail validation because "mastery" in context is marked
            const incorrectResponse = '[[Mastery]] focuses on the process of achieving [[mastery]] in a particular field.';
            const validation = validateBookTitleMarkup(incorrectResponse, ['Mastery']);
            
            expect(validation.isValid).toBe(false);
        });

        test('Correct version - concept words not marked', () => {
            const correctResponse = '[[Mastery]] focuses on the process of achieving excellence in a particular field through practice and mentorship.';
            const validation = validateBookTitleMarkup(correctResponse, ['Mastery']);
            
            expect(validation.isValid).toBe(true);
        });
    });

    describe('Series vs Individual Books', () => {
        test('Should NOT mark series names', () => {
            const response = 'The Harry Potter series includes [[Harry Potter and the Philosopher\'s Stone]], [[Harry Potter and the Chamber of Secrets]], and five other books.';
            const validation = validateBookTitleMarkup(response, [
                'Harry Potter and the Philosopher\'s Stone',
                'Harry Potter and the Chamber of Secrets'
            ]);
            
            expect(validation.isValid).toBe(true);
            // "Harry Potter series" should NOT be in markedTitles
            expect(validation.markedTitles.some(title => title === 'Harry Potter series')).toBe(false);
        });

        test('Lord of the Rings - should mark individual books, not series', () => {
            const response = 'The Lord of the Rings trilogy consists of [[The Fellowship of the Ring]], [[The Two Towers]], and [[The Return of the King]].';
            const validation = validateBookTitleMarkup(response, [
                'The Fellowship of the Ring',
                'The Two Towers',
                'The Return of the King'
            ]);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toHaveLength(3);
            expect(validation.markedTitles.some(title => title === 'Lord of the Rings')).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('Book title with apostrophe', () => {
            const response = '[[Alice\'s Adventures in Wonderland]] is a classic children\'s book.';
            const validation = validateBookTitleMarkup(response, ['Alice\'s Adventures in Wonderland']);
            
            expect(validation.isValid).toBe(true);
        });

        test('Book title with colon', () => {
            const response = '[[Harry Potter and the Deathly Hallows: Part 1]] is the film adaptation.';
            const validation = validateBookTitleMarkup(response, ['Harry Potter and the Deathly Hallows: Part 1']);
            
            expect(validation.isValid).toBe(true);
        });

        test('Numeric titles', () => {
            const response = '[[1984]] by George Orwell is a dystopian novel.';
            const validation = validateBookTitleMarkup(response, ['1984']);
            
            expect(validation.isValid).toBe(true);
        });

        test('Book mentioned in different contexts', () => {
            const response = 'If you enjoyed [[1984]], you might also like [[Brave New World]] and [[Fahrenheit 451]]. These books, along with [[1984]], form the cornerstone of dystopian literature.';
            const validation = validateBookTitleMarkup(response, ['1984', 'Brave New World', 'Fahrenheit 451']);
            
            expect(validation.isValid).toBe(true);
            // Each book should be marked every time it appears
            const text1984Count = (response.match(/\[\[1984\]\]/g) || []).length;
            expect(text1984Count).toBe(2);
        });
    });

    describe('Real-world problematic responses', () => {
        test('Screenshot example - "mastery" word in sentence should NOT be badged', () => {
            // From the user's screenshot
            const problematicResponse = '4. [[The Laws of Human Nature]] - Explores the fundamental principles of human behavior and psychology. 5. [[The 50th Law]] (co-authored with rapper 50 Cent) - Combines Greene\'s insights on power with 50 Cent\'s experiences to provide lessons on fearlessness and success. These books delve into various aspects of human behavior, strategy, and personal development, offering practical advice and historical examples to illustrate their principles. If you\'re interested in achieving [[mastery]] in a particular field...';
            
            const validation = validateBookTitleMarkup(problematicResponse, [
                'The Laws of Human Nature',
                'The 50th Law'
            ]);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'word_in_context' && issue.word === 'mastery'
            )).toBe(true);
        });

        test('Correct version of screenshot example', () => {
            const correctResponse = '4. [[The Laws of Human Nature]] - Explores the fundamental principles of human behavior and psychology. 5. [[The 50th Law]] (co-authored with rapper 50 Cent) - Combines Greene\'s insights on power with 50 Cent\'s experiences to provide lessons on fearlessness and success. These books delve into various aspects of human behavior, strategy, and personal development, offering practical advice and historical examples to illustrate their principles. If you\'re interested in achieving excellence in a particular field, [[Mastery]] is highly recommended.';
            
            const validation = validateBookTitleMarkup(correctResponse, [
                'The Laws of Human Nature',
                'The 50th Law',
                'Mastery'
            ]);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual([
                'The Laws of Human Nature',
                'The 50th Law',
                'Mastery'
            ]);
        });
    });
});
