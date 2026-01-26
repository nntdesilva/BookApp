# Smart Badging Feature - Sequence Diagram

This diagram illustrates how the smart badging system ensures that only complete book titles are badged, and common words used in sentences are NOT badged.

## Overview

The smart badging feature uses a two-stage approach:
1. **AI Stage**: OpenAI marks book titles with `[[double brackets]]`
2. **Frontend Stage**: JavaScript converts `[[markers]]` to visual badges

The validation ensures:
- ✅ Only FULL book titles are marked (e.g., `[[Harry Potter and the Philosopher's Stone]]`)
- ✅ Words in context are NOT marked (e.g., "achieving mastery" - word "mastery" stays unmarked)
- ✅ Series names are NOT marked (e.g., "Harry Potter series" - only individual books)

---

## Sequence Diagram

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User   │     │ Frontend │     │   Backend   │     │  OpenAI API  │     │ Validation  │
│ Browser │     │   (EJS)  │     │ Controller  │     │   (GPT-3.5)  │     │   Utility   │
└────┬────┘     └─────┬────┘     └──────┬──────┘     └──────┬───────┘     └──────┬──────┘
     │                │                  │                   │                    │
     │                │                  │                   │                    │
     │  1. Search "Mastery"              │                   │                    │
     ├───────────────>│                  │                   │                    │
     │                │                  │                   │                    │
     │                │  2. POST /search │                   │                    │
     │                │  { bookName: "Mastery" }             │                    │
     │                ├─────────────────>│                   │                    │
     │                │                  │                   │                    │
     │                │                  │  3. Get Full Title Request            │
     │                │                  │  "You are a book title identifier.    │
     │                │                  │   Return ONLY the COMPLETE book       │
     │                │                  │   title, nothing else."               │
     │                │                  ├──────────────────>│                    │
     │                │                  │                   │                    │
     │                │                  │  4. Full Title    │                    │
     │                │                  │  "Mastery"        │                    │
     │                │                  │<──────────────────┤                    │
     │                │                  │                   │                    │
     │                │                  │  5. Book Info Request with Enhanced   │
     │                │                  │     System Prompt:                     │
     │                │                  │                   │                    │
     │                │                  │  SYSTEM PROMPT:   │                    │
     │                │                  │  "You MUST wrap every book title      │
     │                │                  │   in [[double brackets]]"              │
     │                │                  │                   │                    │
     │                │                  │  RULES:           │                    │
     │                │                  │  1. ALWAYS wrap COMPLETE titles       │
     │                │                  │     [[The 48 Laws of Power]]          │
     │                │                  │     NOT [[48 Laws of Power]]          │
     │                │                  │                   │                    │
     │                │                  │  2. DO NOT wrap partial titles        │
     │                │                  │     [[Harry Potter]] ✗                │
     │                │                  │     [[Harry Potter and the            │
     │                │                  │       Philosopher's Stone]] ✓         │
     │                │                  │                   │                    │
     │                │                  │  3. DO NOT wrap words in context      │
     │                │                  │     "achieving [[mastery]]" ✗         │
     │                │                  │     "achieving excellence" ✓          │
     │                │                  │                   │                    │
     │                │                  │  4. DO NOT wrap series names          │
     │                │                  │     "Harry Potter series" ✗           │
     │                │                  │                   │                    │
     │                │                  │  USER: "Tell me about Mastery"        │
     │                │                  ├──────────────────>│                    │
     │                │                  │                   │                    │
     │                │                  │                   │ 6. AI Processes   │
     │                │                  │                   │    with Rules     │
     │                │                  │                   │    - Identifies   │
     │                │                  │                   │      book titles  │
     │                │                  │                   │    - Checks if    │
     │                │                  │                   │      complete     │
     │                │                  │                   │    - Avoids words │
     │                │                  │                   │      in context   │
     │                │                  │                   │                    │
     │                │                  │  7. Response with │                    │
     │                │                  │     Marked Titles │                    │
     │                │                  │  "[[Mastery]] is a book by Robert     │
     │                │                  │   Greene that focuses on achieving     │
     │                │                  │   excellence in a particular field     │
     │                │                  │   through practice and mentorship."    │
     │                │                  │<──────────────────┤                    │
     │                │                  │                   │                    │
     │                │                  │  ✓ Note: Only book title [[Mastery]]  │
     │                │                  │    is marked, NOT the concept words    │
     │                │                  │    "achieving" or "excellence"         │
     │                │                  │                   │                    │
     │                │  8. Render with  │                   │                    │
     │                │     Raw Response │                   │                    │
     │                │<─────────────────┤                   │                    │
     │                │                  │                   │                    │
     │  9. Display    │                  │                   │                    │
     │<───────────────┤                  │                   │                    │
     │                │                  │                   │                    │
     │ Page shows:    │                  │                   │                    │
     │ "[[Mastery]] is a book..."        │                   │                    │
     │                │                  │                   │                    │
     │                │ 10. Client-side JavaScript Executes  │                    │
     │                │     addBookNameBadges()              │                    │
     │                │                  │                   │                    │
     │                │  Function:       │                   │                    │
     │                │  - Finds [[...]] patterns            │                    │
     │                │  - Converts to <span class="book-name-badge">            │
     │                │  - Preserves all other text as-is    │                    │
     │                │                  │                   │                    │
     │ 11. Final Display:                │                   │                    │
     │ [Mastery] is a book by Robert     │                   │                    │
     │ Greene that focuses on achieving  │                   │                    │
     │ excellence in a particular field  │                   │                    │
     │                │                  │                   │                    │
     │ (where [Mastery] = styled badge)  │                   │                    │
     │                │                  │                   │                    │
     │                │                  │                   │                    │
     │ 12. User Asks Follow-up:          │                   │                    │
     │     "What other books did he write?"                  │                    │
     ├───────────────>│                  │                   │                    │
     │                │                  │                   │                    │
     │                │ 13. POST /chat   │                   │                    │
     │                │  { message: "..." }                  │                    │
     │                ├─────────────────>│                   │                    │
     │                │                  │                   │                    │
     │                │                  │ 14. Chat Request  │                    │
     │                │                  │     (with context)│                    │
     │                │                  ├──────────────────>│                    │
     │                │                  │                   │                    │
     │                │                  │ 15. Response:     │                    │
     │                │                  │  "Robert Greene has written several    │
     │                │                  │   other books including:               │
     │                │                  │   [[The Art of Seduction]],           │
     │                │                  │   [[The 33 Strategies of War]],       │
     │                │                  │   [[The 48 Laws of Power]],           │
     │                │                  │   [[The Laws of Human Nature]], and   │
     │                │                  │   [[The 50th Law]]."                  │
     │                │                  │<──────────────────┤                    │
     │                │                  │                   │                    │
     │                │ 16. JSON Response│                   │                    │
     │                │<─────────────────┤                   │                    │
     │                │                  │                   │                    │
     │                │ 17. appendMessage() calls            │                    │
     │                │     addBookNameBadges()              │                    │
     │                │                  │                   │                    │
     │ 18. Chat shows:│                  │                   │                    │
     │ Robert Greene has written:        │                   │                    │
     │ [The Art of Seduction]            │                   │                    │
     │ [The 33 Strategies of War]        │                   │                    │
     │ [The 48 Laws of Power]            │                   │                    │
     │ [The Laws of Human Nature]        │                   │                    │
     │ [The 50th Law]                    │                   │                    │
     │<───────────────┤                  │                   │                    │
     │                │                  │                   │                    │
     │ (All 5 books shown as badges)     │                   │                    │
     │                │                  │                   │                    │
     
     
═══════════════════════════════════════════════════════════════════════════════
                            VALIDATION FLOW (Testing)
═══════════════════════════════════════════════════════════════════════════════

                                                  ┌─────────────┐
                                                  │ Validation  │
                                                  │   Utility   │
                                                  └──────┬──────┘
                                                         │
     ┌───────────────────────────────────────────────────┤
     │                                                   │
     │  validateBookTitleMarkup()                        │
     │  - Checks AI responses                            │
     │  - Ensures proper title marking                   │
     │                                                   │
     │  TEST 1: Full vs Partial Titles                   │
     │  ─────────────────────────────                    │
     │  Input: "[[Harry Potter]] is a series"            │
     │  Expected: ['Harry Potter and the                 │
     │             Philosopher's Stone']                 │
     │                                                   │
     │  Result: ✗ INVALID                                │
     │  Issue: { type: 'partial_title',                  │
     │          title: 'Harry Potter',                   │
     │          fullTitle: 'Harry Potter and the         │
     │                     Philosopher's Stone' }        │
     │                                                   │
     │                                                   │
     │  TEST 2: Context-Sensitive Words                  │
     │  ────────────────────────────────                 │
     │  Input: "[[Mastery]] focuses on                   │
     │          achieving [[mastery]]"                   │
     │  Expected: ['Mastery']                            │
     │                                                   │
     │  Algorithm:                                       │
     │  1. Extract all marked titles:                    │
     │     ['Mastery', 'mastery']                        │
     │                                                   │
     │  2. Check 'Mastery':                              │
     │     - Is common word? Yes                         │
     │     - Context before: "focuses on"                │
     │     - Context after: "focuses on achieving"       │
     │     - Immediately after noun phrase? No           │
     │     → ✓ Valid (book title at start)               │
     │                                                   │
     │  3. Check 'mastery':                              │
     │     - Is common word? Yes                         │
     │     - Context before: "achieving"                 │
     │     - Ends with noun indicator? Yes               │
     │     → ✗ INVALID (word in context)                 │
     │                                                   │
     │  Result: ✗ INVALID                                │
     │  Issue: { type: 'word_in_context',                │
     │          word: 'mastery',                         │
     │          message: 'Common word used in            │
     │                    sentence context' }            │
     │                                                   │
     │                                                   │
     │  TEST 3: Multiple Books                           │
     │  ───────────────────────                          │
     │  Input: "[[The Art of Seduction]],                │
     │          [[The 48 Laws of Power]], and            │
     │          [[Mastery]] are by Greene"               │
     │  Expected: ['The Art of Seduction',               │
     │            'The 48 Laws of Power',                │
     │            'Mastery']                             │
     │                                                   │
     │  Result: ✓ VALID                                  │
     │  All titles marked correctly                      │
     │                                                   │
     │                                                   │
     │  TEST 4: Series Names                             │
     │  ─────────────────                                │
     │  Input: "The Harry Potter series includes         │
     │          [[Harry Potter and the                   │
     │            Philosopher's Stone]]"                 │
     │                                                   │
     │  Check:                                           │
     │  - "Harry Potter series" marked? No ✓             │
     │  - Individual book marked? Yes ✓                  │
     │                                                   │
     │  Result: ✓ VALID                                  │
     │                                                   │
     └───────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. AI System Prompt (Backend)

**Location**: `controllers/bookController.js`

**Purpose**: Instruct OpenAI to mark book titles correctly

**Key Rules**:
```javascript
1. ALWAYS wrap COMPLETE book titles
   ✓ [[Harry Potter and the Philosopher's Stone]]
   ✗ [[Harry Potter]]

2. DO NOT wrap partial titles
   ✓ [[The 48 Laws of Power]]
   ✗ [[48 Laws of Power]]

3. DO NOT wrap words in sentence context
   ✓ "[[Mastery]] focuses on achieving excellence"
   ✗ "[[Mastery]] focuses on achieving [[mastery]]"

4. DO NOT wrap series names
   ✓ "The Harry Potter series includes [[book name]]"
   ✗ "The [[Harry Potter series]] includes..."

5. DO NOT wrap authors, genres, publishers
```

### 2. Badge Conversion (Frontend)

**Location**: `views/books/index.ejs`

**Function**: `addBookNameBadges(text)`

**Process**:
```javascript
Input:  "[[Mastery]] is a book by Robert Greene"
Regex:  /\[\[([^\]]+)\]\]/g
Match:  [[Mastery]]
Extract: "Mastery"
Output: "<span class='book-name-badge'>Mastery</span> is a book..."
```

**Responsibility**: 
- ONLY converts `[[markers]]` to badges
- Does NOT decide what should be marked
- Preserves all other text as-is

### 3. Validation Utility (Backend/Testing)

**Location**: `utils/badgeDetector.js`

**Function**: `validateBookTitleMarkup(text, expectedTitles)`

**Purpose**: Ensure AI responses follow rules

**Detection Algorithm**:

```
For each marked title:
  1. Is it a common word? (mastery, power, war, etc.)
     └─> Yes: Check context
         │
         ├─> Check text immediately before marked word
         │   Example: "achieving [[mastery]]"
         │            └────────┘
         │            This part checked
         │
         ├─> Does it end with noun indicator?
         │   (achieving, through, in a, process of, etc.)
         │   └─> Yes: FLAG AS ERROR (word in context)
         │   └─> No: OK (likely book title)
         │
     └─> No: OK (not a problematic word)
  
  2. Is it a partial title?
     └─> Compare with expected full titles
         Example: Marked: "Harry Potter"
                 Expected: "Harry Potter and the Philosopher's Stone"
         └─> Partial match? FLAG AS ERROR
  
  3. Is it missing "The"?
     └─> Expected: "The 48 Laws of Power"
         Marked: "48 Laws of Power"
         └─> FLAG AS ERROR
```

---

## Context Detection Examples

### ✓ VALID Cases

```
1. [[Mastery]] is a book by Robert Greene
   └─> Book title at sentence start ✓

2. [[Mastery]] focuses on achieving excellence
   └─> "achieving" appears later, not before [[Mastery]] ✓

3. Robert Greene wrote [[The 48 Laws of Power]]
   └─> Complete title with "The" ✓

4. Read [[1984]] and [[Animal Farm]]
   └─> Multiple complete titles ✓

5. The series includes [[Harry Potter and the Philosopher's Stone]]
   └─> Series name not marked, individual book is ✓
```

### ✗ INVALID Cases

```
1. achieving [[mastery]] in a field
            └────────┘
   └─> Word immediately follows noun indicator ✗

2. [[Harry Potter]] is a series
   └─> Partial title (missing full name) ✗

3. [[48 Laws of Power]] by Greene
   └─> Missing "The" prefix ✗

4. the dynamics of [[power]] in society
                   └─────┘
   └─> Word used in sentence context ✗

5. The [[Harry Potter series]] includes...
   └─> Series name marked (should be individual books) ✗
```

---

## Data Flow Summary

```
User Input
    ↓
Backend Controller
    ↓
OpenAI API (with enhanced prompt)
    ↓
AI Response with [[markers]]
    ↓
Frontend Receives Response
    ↓
JavaScript: addBookNameBadges()
    ↓
Convert [[markers]] to <span> badges
    ↓
Display to User

                    ↓ (parallel)
                    
Validation (Testing)
    ↓
Check for:
  • Partial titles
  • Words in context
  • Missing "The"
  • Series names
    ↓
Report Issues or ✓ Pass
```

---

## Key Benefits

1. **Precise Control**: AI handles detection logic, frontend just renders
2. **Context-Aware**: Distinguishes "mastery" (word) from [[Mastery]] (book)
3. **Complete Titles**: Ensures full book names, not partial
4. **Testable**: Comprehensive validation catches errors
5. **Maintainable**: Clear separation of concerns

---

## Testing Coverage

✅ **28 Test Cases** ensure:
- Full titles only (not partial)
- No context words badged
- Series names excluded
- Multiple books handled
- Edge cases covered
- Real-world scenarios validated

See `TEST_RESULTS_SUMMARY.md` for detailed test results.

---

## Files Involved

| File | Purpose |
|------|---------|
| `controllers/bookController.js` | Enhanced AI prompts |
| `views/books/index.ejs` | Badge conversion JS |
| `utils/badgeDetector.js` | Validation utilities |
| `__tests__/badgeDetector.test.js` | Badge detection tests |
| `__tests__/bookController.test.js` | Controller tests |
| `manual-test-validation.js` | Standalone test runner |

---

## Next Steps

1. Run tests: `node manual-test-validation.js`
2. Test in browser with real queries
3. Monitor for edge cases
4. Add more test cases as needed

---

*Generated: 2026-01-26*
*All 28 tests passing ✅*
