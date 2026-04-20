[]()

Markdown Feature Test Document
==========

This document tests Markdown features that survive round-trip conversion through DOCX and Google Docs. Each section demonstrates a specific feature.

---

[]()

1. Headings
----------

The lines above and below demonstrate heading levels H1 through H6.

[]()

### Heading level 3 ###

[]()

#### Heading level 4 ####

[]()

##### Heading level 5 #####

[]()

###### Heading level 6 ######

---

[]()

2. Inline Formatting
----------

This section tests inline text styling:

* This text is bold&nbsp;— two asterisks on each side
* This text is italic&nbsp;— one asterisk on each side
* This text is bold and italic&nbsp;— three asterisks on each side
* This text has strikethrough&nbsp;— two tildes on each side

---

[]()

3. Paragraphs
----------

This is the first paragraph. It contains multiple sentences to demonstrate normal paragraph text flow.

This is the second paragraph. It is separate from the first one.

---

[]()

4. Blockquotes
----------

This section tests blockquotes:

This is a single-level blockquote. It represents quoted text from another source.

This is a multi-paragraph blockquote.

This is the second paragraph inside the same blockquote.

---

[]()

5. Unordered Lists
----------

This section tests bullet lists:

* First item
* Second item
* Third item

Nested unordered list:

* Parent item 1

* Child item 1a
* Child item 1b

* Grandchild item 1b-i
* Grandchild item 1b-ii

* Child item 1c

* Parent item 2
* Parent item 3

---

[]()

6. Ordered Lists
----------

This section tests numbered lists:

1. First item
2. Second item
3. Third item

Nested ordered list:

1. Parent item 1

1. Child item 1.1
2. Child item 1.2

1. Grandchild item 1.2.1
2. Grandchild item 1.2.2

1. Child item 1.3

1. Parent item 2
2. Parent item 3

---

[]()

7. Mixed Lists
----------

This section tests ordered and unordered lists combined:

1. First ordered item

* Unordered child A
* Unordered child B

1. Second ordered item

1. Ordered child 2.1
2. Ordered child 2.2

1. Third ordered item

---

[]()

8. Tables
----------

[]()

### Simple table ###

|   Feature   |Supported|        Notes         |
|-------------|---------|----------------------|
|    Bold     |   Yes   |Using double asterisks|
|   Italic    |   Yes   |Using single asterisks|
|Strikethrough|   Yes   | Using double tildes  |
[]()

### Table with alignment ###

|Left-aligned|Center-aligned|Right-aligned|
|------------|--------------|-------------|
|   Left 1   |   Center 1   |   Right 1   |
|   Left 2   |   Center 2   |   Right 2   |
|   Left 3   |   Center 3   |   Right 3   |
[]()

### Table with formatted content ###

|         Column A         |                                                             Column B                                                             | Column C  |
|--------------------------|----------------------------------------------------------------------------------------------------------------------------------|-----------|
|        Bold text         |                                                           Italic text                                                            |Normal text|
|      Strikethrough       |[Link](https://www.google.com/url?q=https://example.com&sa=D&source=editors&ust=1776696675565022&usg=AOvVaw1TUyN7qOg7I7sNkrBqz7g4)|Bold italic|
|Text with mixed&nbsp;formatting|                                                           Simple text                                                            | Last cell |

---

[]()

9. Links
----------

This section tests hyperlinks:

* [Regular link](https://www.google.com/url?q=https://example.com&sa=D&source=editors&ust=1776696675566017&usg=AOvVaw24OvoxFcbGgypTTCbZVvsr)
* [Link with ](https://www.google.com/url?q=https://example.com&sa=D&source=editors&ust=1776696675566125&usg=AOvVaw1sVNFbxvbOsy8Mgv6e11vD)[bold](https://www.google.com/url?q=https://example.com&sa=D&source=editors&ust=1776696675566174&usg=AOvVaw1FlrcnzILs76Sjs44P88x-)[&nbsp;text](https://www.google.com/url?q=https://example.com&sa=D&source=editors&ust=1776696675566215&usg=AOvVaw2874z-bEuMklmJQSAJc4Ze)

---

[]()

10. Images
----------

This section tests image embedding. Each image is a solid color rectangle for easy visual verification.

Blue rectangle (200x100):

![Blue rectangle](images/image-01.png "")

Red rectangle (300x150):

![Red rectangle](images/image-02.png "")

Green square (150x150):

![Green square](images/image-03.png "")

Yellow square (150x150):

![Yellow square](images/image-04.png "")

---

[]()

11. Horizontal Rules
----------

The lines between sections are horizontal rules. They should appear as visible separators.

---

[]()

12. Special Characters
----------

This section tests special characters and symbols:

* Em dash: —
* En dash: –
* Ellipsis: …
* Copyright: ©
* Trademark: ™
* Registered: ®
* Degree: 90°
* Arrows: ← → ↑ ↓
* Math symbols: ± × ÷ ≠ ≤ ≥ ≈
* Currency: € £ ¥ ₽
* Quotes: "double curly" and 'single curly'
* Emoji: 🚀 ✅ ❌ ⚠️ 📝

---

[]()

13. Nested Formatting Edge Cases
----------

This section tests nesting combinations that commonly break:

* Bold text with italic inside&nbsp;and back to bold
* Italic with bold inside&nbsp;and back to italic

---

[]()

14. Empty and Minimal Table Content
----------

Empty table cells:

| A | B | C |
|---|---|---|
|   | x |   |
| y |   | z |

Single-character cells:

| 1 | 2 | 3 |
|---|---|---|
| a | b | c |

---

End of Markdown Feature Test Document
