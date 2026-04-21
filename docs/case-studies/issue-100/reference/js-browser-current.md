📝 Loaded 2 variables from .lenv
🔍 [ENGINE DETECTION] {
  hasEval: true,
  hasEvalAll: true,
  locatorType: 'function',
  contextType: 'undefined',
  hasContext: false
}
🔍 [ENGINE DETECTION] Detected: puppeteer
# Markdown Feature Test Document

This document tests Markdown features that survive round-trip conversion through DOCX and Google Docs. Each section demonstrates a specific feature.

---

## 1. Headings

The lines above and below demonstrate heading levels H1 through H6.

### Heading level 3

#### Heading level 4

##### Heading level 5

###### Heading level 6

---

## 2. Inline Formatting

This section tests inline text styling:

- **This text is bold** — two asterisks on each side
- *This text is italic* — one asterisk on each side
- ***This text is bold and italic*** — three asterisks on each side
- ~~This text has strikethrough~~ — two tildes on each side

---

## 3. Paragraphs

This is the first paragraph. It contains multiple sentences to demonstrate normal paragraph text flow.

This is the second paragraph. It is separate from the first one.

---

## 4. Blockquotes

This section tests blockquotes:

> This is a single-level blockquote. It represents quoted text from another source.
>
> This is a multi-paragraph blockquote.
>
> This is the second paragraph inside the same blockquote.

---

## 5. Unordered Lists

This section tests bullet lists:

- First item
- Second item
- Third item

Nested unordered list:

- Parent item 1

  - Child item 1a
  - Child item 1b

    - Grandchild item 1b-i
    - Grandchild item 1b-ii

  - Child item 1c

- Parent item 2
- Parent item 3

---

## 6. Ordered Lists

This section tests numbered lists:

1. First item
2. Second item
3. Third item

Nested ordered list:

1. Parent item 1

  - Child item 1.1
  - Child item 1.2

    - Grandchild item 1.2.1
    - Grandchild item 1.2.2

  - Child item 1.3

2. Parent item 2
3. Parent item 3

---

## 7. Mixed Lists

This section tests ordered and unordered lists combined:

1. First ordered item

  - Unordered child A
  - Unordered child B

2. Second ordered item

  1. Ordered child 2.1
  2. Ordered child 2.2

3. Third ordered item

---

## 8. Tables

### Simple table

| Feature |  | Supported |  | Notes |
| --- | --- | --- | --- | --- |
| Bold |  | Yes |  | Using double asterisks |
| Italic |  | Yes |  | Using single asterisks |
| Strikethrough |  | Yes |  | Using double tildes |

### Table with alignment

| Left-aligned |  | Center-aligned |  | Right-aligned |
| --- | --- | --- | --- | --- |
| Left 1 |  | Center 1 |  | Right 1 |
| Left 2 |  | Center 2 |  | Right 2 |
| Left 3 |  | Center 3 |  | Right 3 |

### Table with formatted content

| Column A |  | Column B |  | Column C |
| --- | --- | --- | --- | --- |
| **Bold text** |  | *Italic text* |  | Normal text |
| ~~Strikethrough~~ |  | [Link](https://example.com) |  | ***Bold italic*** |
| Text with **mixed** *formatting* |  | Simple text |  | Last cell |

---

## 9. Links

This section tests hyperlinks:

- [Regular link](https://example.com)
- [Link with **bold** text](https://example.com)

---

## 10. Images

This section tests image embedding. Each image is a solid color rectangle for easy visual verification.

Blue rectangle (200x100):

![Blue rectangle](https://docs.google.com/docs-images-rt/ABaEjg1y9qE4NTZk-U_YdnXrKmIEkj_jGTOBr2S7kQQ9plQw4Dqz0tiEQ94SN3OHVoFRyc8M9wD7L4yxJQxZkrXqI7uYf1RkqKgTkgTudGYSliZg9VJCEUSMa1FR7lykYbCO52hr_OmDJwojWK7XBOdUBXB7l7dckQ=s2048)

Red rectangle (300x150):

![Red rectangle](https://docs.google.com/docs-images-rt/ABaEjg0J02jDH3lTpGtWm_dP6JulWlLtDhy24QytLidi1upuu9ZipOej6QizriLlfrCO30dexeG1wgvLEUSP_u7Z4GGBGLm-z_QOrV49D0dxXUuD6WKRcW5ja7-jNtVtZyjypiQmwpIg7v4MTBOKUl07_y2jPJmmeB5_=s2048)

Green square (150x150):

![Green square](https://docs.google.com/docs-images-rt/ABaEjg0-MP4pz5bmVNpRtMO7ToKmy0yAoCbryqAHjZF0aMY122dwwgFCdahWhCQOXOgkov83r7d85For-LucYUiJzCzqp7GJh-fEnc2kHykMn8BwtlMjH9kWH0kPUo8oI1GwYsp1FljIBP7UrOavb3wXOQ50bXdvJA=s2048)

Yellow square (150x150):

![Yellow square](https://docs.google.com/docs-images-rt/ABaEjg1PHZfGf3u_2bSt5B0JGEzsD1ryu-WcXcvySNPSB9FgBNx1mKTYwW0egPcEvatRXcboQXgUOKoL6u6MHzZZLoqvp_LXyqG8Oi9jpTkFkLrxSJIVINBKn5s6GsRZyq0cqV4-n0Y4iB9-T4g-U7pI1z_twNMKoVZ6=s2048)

---

## 11. Horizontal Rules

The lines between sections are horizontal rules. They should appear as visible separators.

---

## 12. Special Characters

This section tests special characters and symbols:

- Em dash: —
- En dash: –
- Ellipsis: …
- Copyright: ©
- Trademark: ™
- Registered: ®
- Degree: 90°
- Arrows: ← → ↑ ↓
- Math symbols: ± × ÷ ≠ ≤ ≥ ≈
- Currency: € £ ¥ ₽
- Quotes: "double curly" and 'single curly'
- Emoji: 🚀 ✅ ❌ ⚠️ 📝

---

## 13. Nested Formatting Edge Cases

This section tests nesting combinations that commonly break:

- **Bold text with *italic inside* and back to bold**
- *Italic with **bold inside** and back to italic*

---

## 14. Empty and Minimal Table Content

Empty table cells:

| A |  | B |  | C |
| --- | --- | --- | --- | --- |
|  | x |  |  |  |
| y |  |  | z |  |

Single-character cells:

| 1 |  | 2 |  | 3 |
| --- | --- | --- | --- | --- |
| a |  | b |  | c |

---

*End of Markdown Feature Test Document*
