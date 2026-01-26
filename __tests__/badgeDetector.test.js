const { addBookNameBadges, validateBookTitleMarkup, extractMarkedTitles } = require('../utils/badgeDetector');

describe('addBookNameBadges', () => {
    describe('Basic functionality', () => {
        test('should convert [[BookTitle]] to badge span', () => {
            const input = '[[The 48 Laws of Power]] is a book about strategy.';
            const expected = '<span class="book-name-badge">The 48 Laws of Power</span> is a book about strategy.';
            expect(addBookNameBadges(input)).toBe(expected);
        });

        test('should handle multiple book titles in one text', () => {
            const input = 'Read [[1984]] and [[Animal Farm]] by George Orwell.';
            const expected = 'Read <span class="book-name-badge">1984</span> and <span class="book-name-badge">Animal Farm</span> by George Orwell.';
            expect(addBookNameBadges(input)).toBe(expected);
        });

        test('should handle text with no marked titles', () => {
            const input = 'This is just plain text with no book titles.';
            expect(addBookNameBadges(input)).toBe(input);
        });

        test('should return original text if null or undefined', () => {
            expect(addBookNameBadges(null)).toBe(null);
            expect(addBookNameBadges(undefined)).toBe(undefined);
            expect(addBookNameBadges('')).toBe('');
        });
    });

    describe('Full vs Partial Titles', () => {
        test('should ONLY badge [[Harry Potter and the Philosopher\'s Stone]], not [[Harry Potter]]', () => {
            const correct = 'The series starts with [[Harry Potter and the Philosopher\'s Stone]].';
            const incorrect = 'The series starts with [[Harry Potter]].';
            
            // Correct version should have the full title badged
            expect(addBookNameBadges(correct)).toContain('book-name-badge">Harry Potter and the Philosopher\'s Stone</span>');
            
            // Incorrect version would badge partial title (which is wrong, but function will process it)
            // The function itself just processes brackets - the AI should provide correct markup
            expect(addBookNameBadges(incorrect)).toContain('book-name-badge">Harry Potter</span>');
        });

        test('should handle full title: [[The Fellowship of the Ring]] not [[Lord of the Rings]]', () => {
            const fullTitle = '[[The Fellowship of the Ring]] is the first book in the Lord of the Rings series.';
            const result = addBookNameBadges(fullTitle);
            expect(result).toContain('book-name-badge">The Fellowship of the Ring</span>');
            expect(result).not.toContain('[[Lord of the Rings]]');
        });

        test('should handle full title with "The": [[The 48 Laws of Power]]', () => {
            const input = 'Robert Greene wrote [[The 48 Laws of Power]] in 1998.';
            const result = addBookNameBadges(input);
            expect(result).toContain('book-name-badge">The 48 Laws of Power</span>');
            expect(result).not.toContain('[[48 Laws of Power]]');
        });
    });

    describe('Context-sensitive: Common words that are also book titles', () => {
        test('should NOT badge "mastery" when used as a common noun in sentence', () => {
            // Correct: book title is marked
            const correctBook = 'Robert Greene wrote [[Mastery]] which focuses on achieving mastery in a field.';
            const result1 = addBookNameBadges(correctBook);
            
            // Should only have ONE badge for the book title
            const badgeCount1 = (result1.match(/book-name-badge/g) || []).length;
            expect(badgeCount1).toBe(1);
            expect(result1).toContain('book-name-badge">Mastery</span>');
            expect(result1).toContain('achieving mastery in'); // Second "mastery" should NOT be badged
        });

        test('should NOT badge common word "power" when used in sentence context', () => {
            const input = '[[The 48 Laws of Power]] discusses the dynamics of power in society.';
            const result = addBookNameBadges(input);
            
            // Should only have ONE badge for the book title
            const badgeCount = (result.match(/book-name-badge/g) || []).length;
            expect(badgeCount).toBe(1);
            expect(result).toContain('dynamics of power'); // "power" in sentence should NOT be badged
        });

        test('should NOT badge "war" when discussing warfare concepts', () => {
            const input = '[[The 33 Strategies of War]] examines principles of war and strategy.';
            const result = addBookNameBadges(input);
            
            const badgeCount = (result.match(/book-name-badge/g) || []).length;
            expect(badgeCount).toBe(1);
            expect(result).toContain('principles of war'); // "war" in context should NOT be badged
        });
    });

    describe('Edge cases', () => {
        test('should handle book titles with special characters', () => {
            const input = 'Check out [[Alice\'s Adventures in Wonderland]].';
            const result = addBookNameBadges(input);
            expect(result).toContain('book-name-badge">Alice\'s Adventures in Wonderland</span>');
        });

        test('should handle book titles with numbers', () => {
            const input = '[[1984]] and [[Fahrenheit 451]] are dystopian novels.';
            const result = addBookNameBadges(input);
            expect(result).toContain('book-name-badge">1984</span>');
            expect(result).toContain('book-name-badge">Fahrenheit 451</span>');
        });

        test('should handle consecutive book titles', () => {
            const input = 'Read [[1984]][[Animal Farm]][[Brave New World]]';
            const result = addBookNameBadges(input);
            const badgeCount = (result.match(/book-name-badge/g) || []).length;
            expect(badgeCount).toBe(3);
        });

        test('should handle book titles at start and end of text', () => {
            const input = '[[To Kill a Mockingbird]] is a classic. Also read [[Pride and Prejudice]]';
            const result = addBookNameBadges(input);
            expect(result).toContain('book-name-badge">To Kill a Mockingbird</span>');
            expect(result).toContain('book-name-badge">Pride and Prejudice</span>');
        });

        test('should NOT create badges for incomplete bracket syntax', () => {
            const input = 'This has [one bracket] and [[proper markup]] and [another].';
            const result = addBookNameBadges(input);
            const badgeCount = (result.match(/book-name-badge/g) || []).length;
            expect(badgeCount).toBe(1);
            expect(result).toContain('[one bracket]');
        });
    });

    describe('Series vs Individual Books', () => {
        test('should NOT badge series name "Harry Potter series"', () => {
            const input = 'The Harry Potter series includes [[Harry Potter and the Philosopher\'s Stone]].';
            const result = addBookNameBadges(input);
            
            // Should only badge the specific book, not "Harry Potter series"
            expect(result).not.toContain('[[Harry Potter series]]');
            expect(result).toContain('book-name-badge">Harry Potter and the Philosopher\'s Stone</span>');
        });

        test('should handle multiple books from same series individually', () => {
            const input = '[[Harry Potter and the Philosopher\'s Stone]], [[Harry Potter and the Chamber of Secrets]], and [[Harry Potter and the Prisoner of Azkaban]] are the first three books.';
            const result = addBookNameBadges(input);
            const badgeCount = (result.match(/book-name-badge/g) || []).length;
            expect(badgeCount).toBe(3);
        });
    });
});

describe('validateBookTitleMarkup', () => {
    describe('Detecting missing brackets', () => {
        test('should detect when full title is not marked with brackets', () => {
            const text = 'The 48 Laws of Power is a book by Robert Greene.';
            const validation = validateBookTitleMarkup(text, ['The 48 Laws of Power']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues).toHaveLength(1);
            expect(validation.issues[0].type).toBe('missing_brackets');
            expect(validation.issues[0].title).toBe('The 48 Laws of Power');
        });

        test('should pass when full title is properly marked', () => {
            const text = '[[The 48 Laws of Power]] is a book by Robert Greene.';
            const validation = validateBookTitleMarkup(text, ['The 48 Laws of Power']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });
    });

    describe('Detecting partial titles', () => {
        test('should detect when only partial title is marked instead of full title', () => {
            const text = '[[Harry Potter]] is a series of books.';
            const validation = validateBookTitleMarkup(text, ['Harry Potter and the Philosopher\'s Stone']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues[0].type).toBe('partial_title');
            expect(validation.issues[0].title).toBe('Harry Potter');
            expect(validation.issues[0].fullTitle).toBe('Harry Potter and the Philosopher\'s Stone');
        });

        test('should detect partial "48 Laws of Power" instead of "The 48 Laws of Power"', () => {
            const text = 'Robert Greene wrote [[48 Laws of Power]].';
            const validation = validateBookTitleMarkup(text, ['The 48 Laws of Power']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues[0].type).toBe('partial_title');
        });
    });

    describe('Detecting words in context (should NOT be badged)', () => {
        test('should detect "mastery" used as common noun', () => {
            const text = '[[Mastery]] focuses on achieving [[mastery]] in a field.';
            const validation = validateBookTitleMarkup(text, ['Mastery']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'word_in_context' && issue.word === 'mastery'
            )).toBe(true);
        });

        test('should detect "power" used in sentence context', () => {
            const text = 'This book explores the dynamics of [[power]] in society.';
            const validation = validateBookTitleMarkup(text, []);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'word_in_context' && issue.word === 'power'
            )).toBe(true);
        });

        test('should detect "war" used in context phrase', () => {
            const text = 'The principles of [[war]] are discussed in this book.';
            const validation = validateBookTitleMarkup(text, []);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'word_in_context' && issue.word === 'war'
            )).toBe(true);
        });

        test('should NOT flag "Mastery" when used ONLY as book title', () => {
            const text = 'Robert Greene wrote [[Mastery]], which was published in 2012.';
            const validation = validateBookTitleMarkup(text, ['Mastery']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });
    });

    describe('Multiple books validation', () => {
        test('should validate multiple properly marked books', () => {
            const text = '[[1984]] and [[Animal Farm]] are both by George Orwell.';
            const validation = validateBookTitleMarkup(text, ['1984', 'Animal Farm']);
            
            expect(validation.isValid).toBe(true);
            expect(validation.markedTitles).toEqual(['1984', 'Animal Farm']);
        });

        test('should detect mix of correct and incorrect markups', () => {
            const text = '[[1984]] and Animal Farm are both by George Orwell.';
            const validation = validateBookTitleMarkup(text, ['1984', 'Animal Farm']);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.some(issue => 
                issue.type === 'missing_brackets' && issue.title === 'Animal Farm'
            )).toBe(true);
        });
    });
});

describe('extractMarkedTitles', () => {
    test('should extract all marked titles from text', () => {
        const text = '[[1984]], [[Animal Farm]], and [[Brave New World]] are dystopian novels.';
        const titles = extractMarkedTitles(text);
        expect(titles).toEqual(['1984', 'Animal Farm', 'Brave New World']);
    });

    test('should return empty array for text with no marked titles', () => {
        const text = 'This text has no marked titles.';
        const titles = extractMarkedTitles(text);
        expect(titles).toEqual([]);
    });

    test('should handle null or undefined', () => {
        expect(extractMarkedTitles(null)).toEqual([]);
        expect(extractMarkedTitles(undefined)).toEqual([]);
    });
});
