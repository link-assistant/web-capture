# Market Analysis Report: 13 May 2025

This report analyzes open-source projects similar to "web-capture," a microservice for capturing web content in HTML, Markdown, and PNG formats. The projects are grouped into **microservices** and **libraries**, with each evaluated for its features and relevance to web content capture. Below are two tables summarizing the findings, followed by detailed feature lists for each project.

---

## Microservices for Web Capture

| **Project**             | **License** | **GitHub Link**                                                                           |
| ----------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| **screeenly**           | MIT         | [stefanzweifel/screeenly](https://github.com/stefanzweifel/screeenly)                     |
| **capture-website-api** | ISC         | [robvanderleek/capture-website-api](https://github.com/robvanderleek/capture-website-api) |
| **captino**             | MIT         | [pistatium/captino](https://github.com/pistatium/captino)                                 |
| **gowitness**           | MIT         | [gowitness/gowitness](https://github.com/gowitness/gowitness)                             |

### Features of Microservices

- **screeenly**
  - API for screenshots (PNG), PDFs, and HTML rendering
  - Customizable via pixel density and image loading options
  - Self-hosting support via Heroku, Zeet, or Docker

- **capture-website-api**
  - API for website screenshots (PNG)
  - Customizable via query parameters (e.g., width, height, scale)
  - Uses Puppeteer for rendering complex sites
  - Configurable via environment variables

- **captino**
  - API for webpage screenshots (PNG)
  - Supports full-page captures
  - Easy deployment with Docker

- **gowitness**
  - Command-line tool for website screenshots (PNG)
  - Batch processing and report generation
  - Built with Golang and Chrome Headless

---

## Libraries for Web Capture

| **Project**                | **License** | **GitHub Link**                                                                                                   |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| **webpage-capture**        | MIT         | [b4dnewz/webpage-capture](https://github.com/b4dnewz/webpage-capture)                                             |
| **html-screen-capture-js** | MIT         | [html-screen-capture-js/html-screen-capture-js](https://github.com/html-screen-capture-js/html-screen-capture-js) |

### Features of Libraries

- **webpage-capture**
  - Captures web pages in PNG, JPEG, PDF, HTML, and other formats
  - Customizable via options like timeout and headers
  - Supports single and batch captures

- **html-screen-capture-js**
  - Captures webpages as self-contained HTML
  - Removes external dependencies while preserving appearance
  - Lightweight (12KB)

---

## Summary

The report identifies four microservices (**screeenly**, **capture-website-api**, **captino**, **gowitness**) and two libraries (**webpage-capture**, **html-screen-capture-js**) that align with the functionality of "web-capture." Microservices provide API-driven solutions, while libraries offer flexibility for custom implementations. All projects are open-source, licensed under permissive terms (MIT or ISC), and actively maintained as of May 13, 2025.
