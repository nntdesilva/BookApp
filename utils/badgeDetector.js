/**
 * Utility function to convert GPT-marked book titles to badges
 * This function should ONLY badge text that is explicitly marked with [[double brackets]]
 * 
 * Rules:
 * 1. Only badge content within [[double brackets]]
 * 2. Do NOT badge partial titles or common words used in sentences
 * 3. Preserve the exact text within brackets (including any special characters)
 * 4. Multiple book titles should each get their own badge
 */
function addBookNameBadges(text) {
    if (!text) return text;
    
    // Replace [[BookTitle]] markers with badge spans
    // This regex matches double brackets with any content inside
    const regex = /\[\[([^\]]+)\]\]/g;
    
    return text.replace(regex, (match, title) => {
        // Convert the marked title to a badge
        return `<span class="book-name-badge">${title}</span>`;
    });
}

/**
 * Validates if the AI response properly marks book titles
 * Returns validation results with issues found
 */
function validateBookTitleMarkup(text, expectedFullTitles = []) {
    const issues = [];
    
    // Extract all marked titles from the text
    const markedTitles = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        markedTitles.push(match[1]);
    }
    
    // Check if any expected full titles are missing brackets
    for (const fullTitle of expectedFullTitles) {
        const hasExactMatch = markedTitles.some(marked => marked === fullTitle);
        const hasPartialMatch = markedTitles.some(marked => 
            fullTitle.toLowerCase().includes(marked.toLowerCase()) && marked !== fullTitle
        );
        
        if (!hasExactMatch && !hasPartialMatch) {
            issues.push({
                type: 'missing_brackets',
                title: fullTitle,
                message: `Book title "${fullTitle}" is not marked with brackets`
            });
        } else if (hasPartialMatch && !hasExactMatch) {
            const partial = markedTitles.find(marked => 
                fullTitle.toLowerCase().includes(marked.toLowerCase()) && marked !== fullTitle
            );
            issues.push({
                type: 'partial_title',
                title: partial,
                fullTitle: fullTitle,
                message: `Only partial title "${partial}" is marked instead of full title "${fullTitle}"`
            });
        }
    }
    
    // Check for common words that shouldn't be badged when used in sentence context
    const commonWords = ['mastery', 'power', 'war', 'love', 'peace', 'freedom', 'justice', 'nature'];
    for (const marked of markedTitles) {
        const markedLower = marked.toLowerCase();
        if (commonWords.includes(markedLower)) {
            // Check if this is a legitimate book title or just a word in context
            const isExpectedTitle = expectedFullTitles.some(title => 
                title.toLowerCase() === markedLower
            );
            
            // Look at the surrounding context in the original text
            const bracketIndex = text.indexOf(`[[${marked}]]`);
            if (bracketIndex >= 0) {
                // Get the text immediately before the bracket (last 20 chars)
                const immediateBefore = text.substring(Math.max(0, bracketIndex - 20), bracketIndex).toLowerCase().trim();
                
                // Patterns that indicate the word is being used as a noun (not a book title)
                // The word appears IMMEDIATELY after these phrases
                const nounIndicators = [
                    'achieving',
                    'through',
                    'in a',
                    'process of',
                    'pursuit of',
                    'requires',
                    'involves', 
                    'demands',
                    'art of',
                    'path to',
                    'principles of',
                    'dynamics of',
                    'examines',
                    'explores'
                ];
                
                // Check if any noun indicator appears at the end of immediateBefore
                const isUsedAsNoun = nounIndicators.some(indicator => 
                    immediateBefore.endsWith(indicator)
                );
                
                // If the word is being used as a noun (not as a book title reference)
                if (isUsedAsNoun) {
                    // Even if it's an expected title, if it's used as a noun it's wrong
                    issues.push({
                        type: 'word_in_context',
                        word: marked,
                        message: `Common word "${marked}" is marked but appears to be used in sentence context, not as a book title`
                    });
                }
            }
        }
    }
    
    return {
        isValid: issues.length === 0,
        markedTitles,
        issues
    };
}

/**
 * Extracts all marked titles from text
 */
function extractMarkedTitles(text) {
    if (!text) return [];
    
    const titles = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        titles.push(match[1]);
    }
    
    return titles;
}

module.exports = {
    addBookNameBadges,
    validateBookTitleMarkup,
    extractMarkedTitles
};
