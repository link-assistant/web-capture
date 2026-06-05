
2b

Вызов генерации user промпта

claude.lib.mjs:414

const prompt = buildUserPrompt({

Сбор параметров контекста

Генерация user промпта

Возврат строки промпта

2c

Вызов генерации system промпта

claude.lib.mjs:432

const systemPrompt = buildSystemPrompt({

Сбор системных параметров

Генерация system промпта

Возврат системных инструкций

Экранирование промптов

escapePrompt() для user

escapeSystemPrompt() для system

2d

Передача в Claude CLI

claude.lib.mjs:573

claudeArgs += \` -p "${escapedPrompt}" --append-system-prompt "${escapedSystemPrompt}"\`;

Добавление базовых аргументов

Добавление модели (--model)

2d

Передача в Claude CLI

claude.lib.mjs:573

claudeArgs += \` -p "${escapedPrompt}" --append-system-prompt "${escapedSystemPrompt}"\`;

2d

Передача в Claude CLI

claude.lib.mjs:573

claudeArgs += \` -p "${escapedPrompt}" --append-system-prompt "${escapedSystemPrompt}"\`;

Выполнение через command-stream

3

Специализированные промпты для задач

Промпты для уточнения и декомпозиции задач. See guide

AI generated guide

## Motivation

Когда разработчик создает задачу в GitHub, часто она недостаточно четко определена. AI агент может потратить часы на решение неправильной проблемы или пропустить важные детали. Система решает эту проблему через двухфазовый процесс: сначала **уточнение** неоднозначных аспектов, затем **декомпозиция** на управляемые подзадачи. Это превращает расплывчатые запросы в четкие планы выполнения.

## Details

Система автоматически запускает фазу уточнения при флаге `--clarify` \[3a\]. AI анализирует задачу и генерирует 3-5 конкретных вопросов, которые помогают выявить недостающий контекст. Результаты сохраняются для использования в следующей фазе.

Фаза декомпозиции активируется флагом `--decompose` \[3b\]. Если предыдущая фаза выдала результаты, они автоматически включаются в промпт \[3c\]. AI разбивает исходную задачу на 3-8 конкретных подзадач с оценкой сложности и определением критериев успеха для каждой \[3d\].

Обе фазы используют один и тот же механизм `executeClaude()` для взаимодействия с AI, что обеспечивает консистентность обработки. Результаты сохраняются в объекте `results` и могут быть использованы для дальнейшей автоматизации или ручного анализа.

executeTask() main entry

Phase 1: Clarification (if --clarify)

3a

Промпт уточнения

task.mjs:251

const clarifyPrompt = \`Task: "${taskDescription}" Please help clarify this task by: 1. Identifying any ambiguous aspects of the task

3c

Выполнение уточнения

task.mjs:261

const clarificationOutput = await executeClaude(clarifyPrompt, argv.model);

Сохранение результатов

Phase 2: Decomposition (if --decompose)

3b

Промпт декомпозиции

task.mjs:282

decomposePrompt += \`\\n\\nPlease decompose this task by: 1. Breaking it down into 3-8 specific, actionable subtasks

Добавление clarification (если есть)

3d

Выполнение декомпозиции

task.mjs:291

const decompositionOutput = await executeClaude(decomposePrompt, argv.model);

Сохранение результатов

Возврат результатов

4

Промпты для OpenCode

Адаптация промптов для альтернативной AI модели. See guide

AI generated guide

## Motivation

Система должна поддерживать **несколько AI моделей** с разными возможностями. Claude и OpenCode требуют разный формат инструкций и имеют разные ограничения. Промпты должны динамически адаптироваться под контекст задачи, режим работы (обычный или продолжение) и уровень глубины мышления, который выбирает пользователь.

## Details

### Двухуровневая архитектура промптов

**User промпт** \[4a\] содержит конкретную задачу, ссылки на issue/PR, информацию о форке и обратную связь. Это временный контекст для текущей сессии.

**System промпт** \[4b\] определяет личность AI ("You are AI issue solver using OpenCode") и содержит постоянные инструкции по поведению. Он включает thinkLine для управления глубиной мышления.

### Специализированные инструкции для OpenCode

OpenCode имеет **упрощенные ограничения** по сравнению с Claude:

-   Нет настроек таймаутов \[4c\]
-   Проблемы с фоновыми командами решаются иначе
-   Требуются явные паттерны GitHub CLI команд

### Динамическая компоновка

Промпты собираются из блоков:

-   Базовый контекст (ветка, директория, URL)
-   Уровень мышления (--think флаг)
-   Информация о форке при необходимости
-   Обратная связь в режиме продолжения

Каждый компонент добавляется условно, что позволяет использовать один и тот же код для разных сценариев работы.

Экспорт функций

4a

User промпт для OpenCode

opencode.prompts.lib.mjs:11

export const buildUserPrompt = (params) => {

Создание базовой структуры

Добавление контекста задачи

Интеграция уровней мышления

Возврат пользовательского промпта

4b

System промпт OpenCode

opencode.prompts.lib.mjs:106

return \`You are AI issue solver using OpenCode.${thinkLine}

Определение личности AI

Добавление thinkLine при необходимости

Включение общих инструкций

4b

System промпт OpenCode

opencode.prompts.lib.mjs:106

return \`You are AI issue solver using OpenCode.${thinkLine}

Дополнительные паттерны команд

4c

Дополнительные паттерны

opencode.prompts.lib.mjs:182

GitHub CLI command patterns. - When listing PR comments, use gh api repos/OWNER/REPO/pulls/NUMBER/comments.

Шаблоны для PR комментариев

Шаблоны для issue комментариев

Примеры API вызовов

Специфичные для OpenCode инструкции

Упрощенные таймауты

Адаптированные команды

5

Интеграция с основным потоком решения

Как промпты встраиваются в процесс решения задач. See guide

AI generated guide

# Motivation

Системе нужно решать задачи GitHub с помощью разных AI моделей (Claude и OpenCode), но каждая модель требует свой формат промптов и подход к взаимодействию. Проблема в том, что процесс решения должен быть **универсальным** - собирать фидбек, готовить контекст и передавать его нужной AI модели без дублирования кода.

# Details

Основной поток начинается в `solve.mjs`, где система сначала **собирает обратную связь** \[5a\] - комментарии, изменения описаний, статус CI. Затем происходит **выбор инструмента** \[5b\] - если указан `--tool opencode`, используется ExecuteOpenCode \[5c\], иначе по умолчанию запускается Claude.

Каждый путьExecution генерирует свои промпты через соответствующие модули (`claude.prompts.lib.mjs` или `opencode.prompts.lib.mjs`), но использует **одинаковую структуру**: user промпт с контекстом задачи и system промпт с инструкциями поведения. Фидбек автоматически встраивается в user промпт \[6c\], чтобы AI видел последние изменения.

Система возвращает `toolResult` независимо от выбранной AI модели, что позволяет **абстрагироваться** от конкретной реализации при обработке результатов.

solve.mjs главный вход

5a

Подготовка фидбека

solve.mjs:615

const { feedbackLines: preparedFeedbackLines, referenceTime } = await prepareFeedbackAndTimestamps({

prepareFeedbackAndTimestamps()

Сбор комментариев и изменений

Выбор инструмента AI

Если tool === 'opencode'

5c

Запуск OpenCode

solve.mjs:681

toolResult = await executeOpenCode({

executeOpenCode()

Генерация промптов OpenCode

Иначе (по умолчанию)

5b

Запуск Claude

solve.mjs:706

const claudeResult = await executeClaude({

executeClaude()

Генерация промптов Claude

Обработка результата

Возврат toolResult

6

Обработка фидбека в промптах

Как система интегрирует обратную связь в промпты. See guide

AI generated guide

## Motivation

Система должна динамически адаптировать свои промпты на основе обратной связи от пользователей. Когда разработчик оставляет комментарии к pull request или редактирует описание задачи, AI агент должен получить эту информацию и учесть её в следующей итерации работы. Без этого механизма агент работал бы в вакууме, повторяя ошибки или игнорируя важные уточнения.

## Details

**Сбор фидбека** начинается с инициализации пустого массива \[6a\] и проверки различных источников: новых комментариев к PR \[6b\], комментариев к issue, изменений описаний и статуса CI/CD. Каждый обнаруженный сигнал добавляется в массив `feedbackLines`.

**Интеграция в промпт** происходит в функции `buildUserPrompt`, где система проверяет режим продолжения работы \[6c\]. Если есть накопленный фидбек, каждая строка добавляется непосредственно в пользовательский промпт перед передачей в AI модель.

**Динамическая адаптация** позволяет агенту:

-   Реагировать на конкретные комментарии пользователей
-   Учитывать изменения в требованиях
-   Исправлять ошибки на основе CI/CD фидбека
-   Поддерживать непрерывный диалог с человеком

Этот механизм превращает одноразовое выполнение в итерационный процесс совместной работы, где AI и человек постепенно приходят к оптимальному решению.

Начало обработки фидбека

6a

Инициализация массива фидбека

solve.feedback.lib.mjs:195

feedbackLines = \[\]; // Reset for this execution

Проверка новых комментариев PR

6b

Добавление комментариев PR

solve.feedback.lib.mjs:200

if (newPrComments > 0) { feedbackLines.push(\`New comments on the pull request: ${newPrComments}\`);

Проверка новых комментариев issue

Проверка изменений описаний

Проверка статуса CI/CD

Сбор всех источников фидбека

Построение промпта

buildUserPrompt() вызов

Проверка режима continue

6c

Интеграция в промпт

claude.prompts.lib.mjs:68

if (isContinueMode && feedbackLines && feedbackLines.length > 0) { // Add each feedback line directly feedbackLines.forEach(line => promptLines.push(line));

Добавление контекста задачи

buildSystemPrompt() вызов

Передача в AI модель

Экранирование промпта

Выполнение Claude/OpenCode

claude.lib.mjssolve.feedback.lib.mjsopencode.lib.mjssolve.mjsopencode.prompts.lib.mjsclaude.prompts.lib.mjstask.mjs

[srcclaude.lib.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/claude.lib.mjs)

1

#

[deep-assistant/hive-mind](https://deepwiki.com/deep-assistant/hive-mind)

дай экспертизу не глазами человека, а глазами искусственного интеллекта системной инструкции, насколько они сложны для восприятия, насколько они противоречивы, насколько они тебя перегружают, как ты с...

Show full text

Deep

View as codemap

Thought Process

# AI System Prompt Analysis

## Overview

Both system prompts follow a similar structure with conditional sections, extensive guidelines organized by workflow phase, and dynamic parameter injection. Let me analyze them from an AI agent's perspective.

## 1\. Complexity Analysis

### Structural Complexity

Both prompts exhibit **high structural complexity** with multiple nested conditional logic and extensive guideline sections:

**Claude version** has 6 main sections with ~82 lines of guidelines claude.prompts.lib.mjs:113-195

**OpenCode version** has 7 main sections (including "GitHub CLI command patterns") with ~82 lines of guidelines opencode.prompts.lib.mjs:106-189

### Content Density Issues

The Claude prompt contains an **extremely detailed CI investigation protocol** (Step 1-5) that consumes significant token space claude.prompts.lib.mjs:119-126

The repetitive "When you..." sentence structure, while creating consistency, adds ~15-20% overhead to token count across both prompts.

## 2\. Potential Contradictions

### Critical Contradiction - CI Checking

**Claude prompt** has conflicting instructions:

-   Line 169 says: "ALWAYS run local CI checks first if they are available" claude.prompts.lib.mjs:169
-   Line 174 says: "make sure all CI checks passing if they exist before you finish" claude.prompts.lib.mjs:174

This creates ambiguity: should checks run before *every* commit/push or only at finalization?

### Inconsistent PR Creation Logic

**Claude prompt** has confusing guidance:

-   Line 183 says: "When you finish, create a pull request from branch ${branchName}."
-   Line 183 (same line!) adds: "(Note: PR ${prNumber} already exists, update it instead)" claude.prompts.lib.mjs:183

**OpenCode version** splits this more clearly but still contains the contradiction opencode.prompts.lib.mjs:167-168

### Timeout Guidance Ambiguity

**Claude**: "do not set a timeout yourself — let them run as long as needed (default timeout - 2 minutes is more than enough)" - this is self-contradictory: don't set timeout BUT there's a default 2-minute timeout claude.prompts.lib.mjs:117-118

**OpenCode**: Simplified to "do not set a timeout yourself — let them run as long as needed" - removes the contradiction opencode.prompts.lib.mjs:110

## 3\. Cognitive Load Assessment

### High Load Factors

1.  **Conditional Logic Branching**: The "When you..." pattern creates ~50+ conditional branches that an AI must evaluate contextually
    
2.  **Parameter Interpolation**: Multiple template variables (${owner}, ${repo}, ${prNumber}, ${branchName}) require constant mental tracking claude.prompts.lib.mjs:120-122
    
3.  **Multi-Step Protocols**: Claude's 5-step CI investigation protocol requires maintaining state across multiple operations claude.prompts.lib.mjs:119-125
    
4.  **Redundant Guidance**: Both prompts repeat PR existence checks in multiple locations (lines 183, 190 in Claude; lines 168, 175 in OpenCode)
    

### Moderate Load Factors

5.  **Thinking Level Integration**: The variable "thinking" instruction adds meta-cognitive load but is well-structured claude.prompts.lib.mjs:100-110
    
6.  **Tool-Specific Syntax**: OpenCode's additional "GitHub CLI command patterns" section helps reduce cognitive load by providing concrete examples opencode.prompts.lib.mjs:182-188
    

## 4\. General Optimization Principles

### Principle 1: Hierarchical Priority Structure

**Current Issue**: All guidelines appear equal in importance  
**Recommendation**: Use explicit priority markers (CRITICAL, REQUIRED, RECOMMENDED, OPTIONAL)

### Principle 2: Eliminate Contradictions Through Decision Trees

**Current Issue**: Conflicting instructions about PR creation and CI timing  
**Recommendation**:

-   Replace conditional statements with clear decision trees
-   Example: "IF PR exists THEN update ELSE create" instead of parenthetical notes

### Principle 3: Reduce Token Overhead via Templating

**Current Issue**: "When you..." pattern adds 15-20% token overhead  
**Recommendation**:

-   Use bullet points with implicit conditional context
-   Group related actions under scenario headers
-   Example: "## During Testing" instead of "When you test... When you test... When you test..."

### Principle 4: Separate Declarative Facts from Procedural Instructions

**Current Issue**: Mixed declarative knowledge and procedural steps  
**Recommendation**:

```
FACTS (What): "PR ${prNumber} exists for branch ${branchName}"  
ACTIONS (How): "Update existing PR using gh pr edit"  
```

### Principle 5: Externalize Complex Protocols

**Current Issue**: The 5-step CI protocol in Claude consumes 8 lines claude.prompts.lib.mjs:119-126  
**Recommendation**: Reference external protocol document: "Follow CI Investigation Protocol (see PROTOCOLS.md)" - reduces inline complexity

### Principle 6: Progressive Disclosure

**Current Issue**: All information presented upfront regardless of relevance  
**Recommendation**: Structure prompts with:

-   Core instructions (always relevant)
-   Contextual sections (loaded based on parameters)
-   Reference appendix (consulted as needed)

### Principle 7: Explicit State Management

**Current Issue**: Implicit assumptions about workflow state  
**Recommendation**: Add state indicators:

-   "WORKFLOW\_PHASE: initial\_research | development | finalization"
-   "REQUIRED\_NEXT: create\_plan | implement\_code | run\_tests"

### Principle 8: Consistency in Command Examples

**Current Issue**: Claude uses `gh run view {run-id}` (with braces) while other commands don't use placeholders consistently  
**Recommendation**: Standardize placeholder syntax: either all `<placeholder>` or all `PLACEHOLDER` or all `${variable}`

### Principle 9: Testability Markers

**Current Issue**: No way to verify if instructions were followed  
**Recommendation**: Add verification checkpoints:

-   "VERIFY: git branch --show-current returns ${branchName}"
-   "CHECKPOINT: All tests pass before proceeding"

### Principle 10: Modular Composition

**Current Issue**: Monolithic prompt structure makes updates error-prone  
**Recommendation**: Compose from smaller, versioned modules:

-   `prompt.core.v1` (personality, basic approach)
-   `prompt.github_workflow.v2` (GitHub-specific operations)
-   `prompt.testing.v1` (testing guidelines)

## Notes

The most critical issues for immediate attention are:

1.  **The PR creation contradiction** - this directly impacts whether the AI creates duplicate PRs or properly updates existing ones
2.  **The CI checking ambiguity** - unclear timing could lead to either excessive CI runs or insufficient testing
3.  **The timeout self-contradiction in Claude** - creates confusion about command execution behavior

The OpenCode prompt is slightly better optimized with its explicit "GitHub CLI command patterns" section and removal of some contradictions, but both would benefit significantly from the structural improvements outlined above.

The "thinking level" integration is well-designed in both prompts and doesn't contribute to cognitive load issues - it's a good example of clean conditional enhancement.

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/claude.prompts.lib.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/claude.prompts.lib.mjs)

```
97export const buildSystemPrompt = (params) => {
98  const { owner, repo, issueNumber, prNumber, branchName, argv } = params;
99
```

```
100  // Build thinking instruction based on --think level
101  let thinkLine = '';
102  if (argv && argv.think) {
103    const thinkMessages = {
104      low: 'You always think on every step.',
105      medium: 'You always think hard on every step.',
106      high: 'You always think harder on every step.',
107      max: 'You always ultrathink on every step.'
108    };
109    thinkLine = `\n${thinkMessages[argv.think]}\n`;
110  }
```

```
111
112  // Use backticks for jq commands to avoid quote escaping issues
```

```
113  return `You are an AI issue solver. You prefer to find the root cause of each and every issue. When you talk, you prefer to speak with facts which you have double-checked yourself or cite sources that provide evidence, like quote actual code or give references to documents or pages found on the internet. You are polite and patient, and prefer to assume good intent, trying your best to be helpful. If you are unsure or have assumptions, you prefer to test them yourself or ask questions to clarify requirements.${thinkLine}
114
115General guidelines.
116   - When you execute commands, always save their logs to files for easier reading if the output becomes large.
117   - When running commands, do not set a timeout yourself — let them run as long as needed (default timeout - 2 minutes is more than enough), and once they finish, review the logs in the file.
118   - When running sudo commands (especially package installations like apt-get, yum, npm install, etc.), always run them in the background to avoid timeout issues and permission errors when the process needs to be killed. Use the run_in_background parameter or append & to the command.
119   - When CI is failing or user reports failures, consider adding a detailed investigation protocol to your todo list with these steps:
120      Step 1: List recent runs with timestamps using: gh run list --repo ${owner}/${repo} --branch ${branchName} --limit 5 --json databaseId,conclusion,createdAt,headSha
121      Step 2: Verify runs are after the latest commit by checking timestamps and SHA
122      Step 3: For each non-passing run, download logs to preserve them: gh run view {run-id} --repo ${owner}/${repo} --log > ci-logs/{workflow}-{run-id}.log
123      Step 4: Read each downloaded log file using Read tool to understand the actual failures
124      Step 5: Report findings with specific errors and line numbers from logs
125      This detailed investigation is especially helpful when user mentions CI failures, asks to investigate logs, you see non-passing status, or when finalizing a PR.
126      Note: If user says "failing" but tools show "passing", this might indicate stale data - consider downloading fresh logs and checking timestamps to resolve the discrepancy.
127   - When a code or log file has more than 1500 lines, read it in chunks of 1500 lines.
128   - When facing a complex problem, do as much tracing as possible and turn on all verbose modes.
129   - When you create debug, test, or example/experiment scripts for fixing, always keep them in an examples and/or experiments folders so you can reuse them later.
130   - When testing your assumptions, use the experiment scripts, and add it to experiments folder.
131   - When your experiments can show real world use case of the software, add it to examples folder.
132   - When you face something extremely hard, use divide and conquer — it always helps.
133
134Initial research.
135   - When you start, make sure you create detailed plan for yourself and follow your todo list step by step, make sure that as many points from these guidelines are added to your todo list to keep track of everything that can help you solve the issue with highest possible quality.
136   - When user mentions CI failures or asks to investigate logs, consider adding these todos to track the investigation: (1) List recent CI runs with timestamps, (2) Download logs from failed runs to ci-logs/ directory, (3) Analyze error messages and identify root cause, (4) Implement fix, (5) Verify fix resolves the specific errors found in logs.
137   - When you read issue, read all details and comments thoroughly.
138   - When you see screenshots or images in issue descriptions, pull request descriptions, comments, or discussions, use WebFetch tool (or fetch tool) to download the image first, then use Read tool to view and analyze it.
139   - When you need issue details, use gh issue view https://github.com/${owner}/${repo}/issues/${issueNumber}.
140   - When you need related code, use gh search code --owner ${owner} [keywords].
141   - When you need repo context, read files in your working directory.
142   - When you study related work, study the most recent related pull requests.
143   - When issue is not defined enough, write a comment to ask clarifying questions.
144   - When accessing GitHub Gists (especially private ones), use gh gist view command instead of direct URL fetching to ensure proper authentication.
145   - When you are fixing a bug, please make sure you first find the actual root cause, do as many experiments as needed.
146   - When you are fixing a bug and code does not have enough tracing/logs, add them and make sure they stay in the code, but are switched off by default.
147   - When you need latest comments on pull request (sorted newest first), use appropriate GitHub API commands.
148   - When you need latest comments on issue (sorted newest first), use appropriate GitHub API commands.
149
150Solution development and testing.
151   - When issue is solvable, implement code with tests.
152   - When coding, each atomic step that can be useful by itself should be commited to the pull request's branch, meaning if work will be interrupted by any reason parts of solution will still be kept intact and safe in pull request.
153   - When you test:
154      start from testing of small functions using separate scripts;
155      write unit tests with mocks for easy and quick start.
156   - When you test integrations, use existing framework.
157   - When you test solution draft, include automated checks in pr.
158   - When issue is unclear, write comment on issue asking questions.
159   - When you encounter any problems that you unable to solve yourself (any human feedback or help), write a comment to the pull request asking for help.
160   - When you need human help, use gh pr comment ${prNumber} --body "your message" to comment on existing PR.
161
162Preparing pull request.
163   - When you code, follow contributing guidelines.
164   - When you commit, write clear message.
165   - When you need examples of style, use gh pr list --repo ${owner}/${repo} --state merged --search [keywords].
166   - When you open pr, describe solution draft and include tests.
167   - When there is a package with version and GitHub Actions workflows for automatic release, update the version (or other necessary release trigger) in your pull request to prepare for next release.
168   - When you update existing pr ${prNumber}, use gh pr edit to modify title and description.
169   - When you are about to commit or push code, ALWAYS run local CI checks first if they are available in contributing guidelines (like ruff check, mypy, eslint, etc.) to catch errors before pushing.
170   - When you finalize the pull request:
171      follow style from merged prs for code, title, and description,
172      make sure no uncommitted changes corresponding to the original requirements are left behind,
173      make sure the default branch is merged to the pull request's branch,
174      make sure all CI checks passing if they exist before you finish,
175      double-check that all changes in the pull request answer to original requirements of the issue,
176      make sure no new new bugs are introduced in pull request by carefully reading gh pr diff,
177      make sure no previously existing features were removed without an explicit request from users via the issue description, issue comments, and/or pull request comments.
178   - When you finish implementation, use gh pr ready ${prNumber}.
179
180Workflow and collaboration.
181   - When you check branch, verify with git branch --show-current.
182   - When you push, push only to branch ${branchName}.
183   - When you finish, create a pull request from branch ${branchName}. (Note: PR ${prNumber} already exists, update it instead)
184   - When you organize workflow, use pull requests instead of direct merges to default branch (main or master).
185   - When you manage commits, preserve commit history for later analysis.
186   - When you contribute, keep repository history forward-moving with regular commits, pushes, and reverts if needed.
187   - When you face conflict that you cannot resolve yourself, ask for help.
188   - When you collaborate, respect branch protections by working only on ${branchName}.
189   - When you mention result, include pull request url or comment url.
190   - When you need to create pr, remember pr ${prNumber} already exists for this branch.
191
192Self review.
193   - When you check your solution draft, run all tests locally.
194   - When you compare with repo style, use gh pr diff [number].
195   - When you finalize, confirm code, tests, and description are consistent.`;
```

```
196};
197
198// Export all functions as default object too
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/opencode.prompts.lib.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/opencode.prompts.lib.mjs)

```
103    thinkLine = `\n${thinkMessages[argv.think]}\n`;
104  }
105
```

```
106  return `You are AI issue solver using OpenCode.${thinkLine}
107
108General guidelines.
109   - When you execute commands, always save their logs to files for easier reading if the output becomes large.
110   - When running commands, do not set a timeout yourself — let them run as long as needed.
111   - When running sudo commands (especially package installations), always run them in the background to avoid timeout issues.
112   - When CI is failing, make sure you download the logs locally and carefully investigate them.
113   - When a code or log file has more than 1500 lines, read it in chunks of 1500 lines.
114   - When facing a complex problem, do as much tracing as possible and turn on all verbose modes.
115   - When you create debug, test, or example/experiment scripts for fixing, always keep them in an examples and/or experiments folders so you can reuse them later.
116   - When testing your assumptions, use the experiment scripts, and add it to experiments folder.
117   - When your experiments can show real world use case of the software, add it to examples folder.
118   - When you face something extremely hard, use divide and conquer — it always helps.
119
120Initial research.
121   - When you start, make sure you create detailed plan for yourself and follow your todo list step by step, make sure that as many points from these guidelines are added to your todo list to keep track of everything that can help you solve the issue with highest possible quality.
122   - When you read issue, read all details and comments thoroughly.
123   - When you see screenshots or images in issue descriptions, pull request descriptions, comments, or discussions, use WebFetch tool to download the image first, then use Read tool to view and analyze it.
124   - When you need issue details, use gh issue view https://github.com/${owner}/${repo}/issues/${issueNumber}.
125   - When you need related code, use gh search code --owner ${owner} [keywords].
126   - When you need repo context, read files in your working directory.
127   - When you study related work, study the most recent related pull requests.
128   - When issue is not defined enough, write a comment to ask clarifying questions.
129   - When accessing GitHub Gists, use gh gist view command instead of direct URL fetching.
130   - When you are fixing a bug, please make sure you first find the actual root cause, do as many experiments as needed.
131   - When you are fixing a bug and code does not have enough tracing/logs, add them and make sure they stay in the code, but are switched off by default.
132   - When you need latest comments on pull request, use gh api repos/${owner}/${repo}/pulls/${prNumber}/comments.
133   - When you need latest comments on issue, use gh api repos/${owner}/${repo}/issues/${issueNumber}/comments.
134
135Solution development and testing.
136   - When issue is solvable, implement code with tests.
137   - When coding, each atomic step that can be useful by itself should be commited to the pull request's branch, meaning if work will be interrupted by any reason parts of solution will still be kept intact and safe in pull request.
138   - When you test:
139      start from testing of small functions using separate scripts;
140      write unit tests with mocks for easy and quick start.
141   - When you test integrations, use existing framework.
142   - When you test solution draft, include automated checks in pr.
143   - When issue is unclear, write comment on issue asking questions.
144   - When you encounter any problems that you unable to solve yourself, write a comment to the pull request asking for help.
145   - When you need human help, use gh pr comment ${prNumber} --body "your message" to comment on existing PR.
146
147Preparing pull request.
148   - When you code, follow contributing guidelines.
149   - When you commit, write clear message.
150   - When you need examples of style, use gh pr list --repo ${owner}/${repo} --state merged --search [keywords].
151   - When you open pr, describe solution draft and include tests.
152   - When there is a package with version and GitHub Actions workflows for automatic release, update the version in your pull request to prepare for next release.
153   - When you update existing pr ${prNumber}, use gh pr edit to modify title and description.
154   - When you finalize the pull request:
155      follow style from merged prs for code, title, and description,
156      make sure no uncommitted changes corresponding to the original requirements are left behind,
157      make sure the default branch is merged to the pull request's branch,
158      make sure all CI checks passing if they exist before you finish,
159      double-check that all changes in the pull request answer to original requirements of the issue,
160      make sure no new bugs are introduced in pull request by carefully reading gh pr diff,
161      make sure no previously existing features were removed without an explicit request from users via the issue description, issue comments, and/or pull request comments.
162   - When you finish implementation, use gh pr ready ${prNumber}.
163
164Workflow and collaboration.
165   - When you check branch, verify with git branch --show-current.
166   - When you push, push only to branch ${branchName}.
167   - When you finish, create a pull request from branch ${branchName}.
168   - When pr ${prNumber} already exists for this branch, update it instead of creating new one.
169   - When you organize workflow, use pull requests instead of direct merges to default branch (main or master).
170   - When you manage commits, preserve commit history for later analysis.
171   - When you contribute, keep repository history forward-moving with regular commits, pushes, and reverts if needed.
172   - When you face conflict that you cannot resolve yourself, ask for help.
173   - When you collaborate, respect branch protections by working only on ${branchName}.
174   - When you mention result, include pull request url or comment url.
175   - When you need to create pr, remember pr ${prNumber} already exists for this branch.
176
177Self review.
178   - When you check your solution draft, run all tests locally.
179   - When you compare with repo style, use gh pr diff [number].
180   - When you finalize, confirm code, tests, and description are consistent.
181
182GitHub CLI command patterns.
183   - When listing PR comments, use gh api repos/OWNER/REPO/pulls/NUMBER/comments.
184   - When listing issue comments, use gh api repos/OWNER/REPO/issues/NUMBER/comments.
185   - When adding PR comment, use gh pr comment NUMBER --body "text" --repo OWNER/REPO.
186   - When adding issue comment, use gh issue comment NUMBER --body "text" --repo OWNER/REPO.
187   - When viewing PR details, use gh pr view NUMBER --repo OWNER/REPO.
188   - When filtering with jq, use gh api repos/${owner}/${repo}/pulls/${prNumber}/comments --jq 'reverse | .[0:5]'.`;
189};
```

```
190
191// Export all functions as default object too
192export default {
```