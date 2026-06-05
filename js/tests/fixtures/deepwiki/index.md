Search | DeepWiki

[Index your code with Devin](https://deepwiki.com/private-repo)

[DeepWiki](https://deepwiki.com/)

[

Index your code with

Devin

](https://deepwiki.com/private-repo)Share

[deep-assistant/hive-mind](https://deepwiki.com/deep-assistant/hive-mind)

расскажи пожалуйста на английском всю суть основных идей этой агентной системы, как она работает, напиши конспект на 5-7 а4 листов, то есть в чем заключаются какие-то оригинальные идеи, мне нужно объя...

Show full text

Deep

Thought Process

# Hive Mind: A Comprehensive Overview of an AI Agent System for Software Development

## Executive Summary

Hive Mind is an orchestration system that coordinates artificial intelligence agents to solve software development tasks autonomously while maintaining human oversight at critical decision points. The system transforms GitHub issues into pull requests through a structured problem-solving methodology, inspired by universal problem-solving algorithms. README.md:10-16

## I. Foundational Philosophy: Human-AI Collaboration Model

### The Core Premise

The system operates on a fundamental principle: **AI agents should amplify human capabilities, not replace human judgment**. Every automated action is subject to human review and approval. This creates a collaborative loop where humans define problems and make decisions, while AI agents handle implementation and iteration. flow.md:436-442

### The Two Operating Modes

The system recognizes two distinct patterns of human-AI interaction:

**Mode 1: Issue-Driven Development** - Humans create GitHub issues describing requirements. The AI analyzes these requirements, develops solutions, and creates draft pull requests for human review.

**Mode 2: Feedback-Driven Refinement** - Humans provide comments on existing pull requests. The AI processes this feedback, updates the solution, and pushes changes back for further review. flow.md:24-30

## II. Architectural Layers: The Three-Tier Design

### Layer 1: The Orchestration Layer (The "Hive Mind")

This is the strategic intelligence layer that monitors repositories, assigns tasks, and manages multiple AI agents concurrently. Think of it as the conductor of an orchestra - it doesn't play instruments, but coordinates when and how each musician performs.

The orchestration layer continuously monitors GitHub for new issues, checks for labels (like "help wanted"), manages a queue of work, and distributes tasks across multiple AI agents working in parallel. It implements concurrency control, ensuring agents don't conflict with each other. README.md:378-386

### Layer 2: The Execution Layer (The "Solvers")

These are the tactical workers that implement specific tasks. Each solver operates independently in its own isolated environment, following a structured problem-solving methodology:

1.  **Deep Analysis**: Read issue descriptions, comments, screenshots, and related code
2.  **Plan Formation**: Create detailed step-by-step plans
3.  **Iterative Implementation**: Develop solutions incrementally with atomic commits
4.  **Continuous Testing**: Start with small functions, progress to integration tests
5.  **Self-Review**: Verify solutions match requirements before finalizing claude.prompts.lib.mjs:134-148

### Layer 3: The Human Interface Layer

This layer enables human-AI collaboration through familiar tools - GitHub issues, pull requests, comments, and even Telegram bots. Humans don't need to learn new interfaces; the AI adapts to existing workflows. README.md:294-302

## III. Original Ideas and Innovations

### Innovation 1: The Task Clarification System

Before solving any problem, the system can run a separate clarification phase where the AI generates clarifying questions about ambiguous requirements. This prevents misunderstandings and reduces wasted effort.

The system breaks tasks into two distinct cognitive phases:

-   **Clarification Mode**: Identifies ambiguous aspects, asks 3-5 specific questions, suggests assumptions, and identifies missing context
-   **Decomposition Mode**: Breaks tasks into 3-8 actionable subtasks, orders them logically, estimates complexity, identifies risks, and defines success criteria task.mjs:246-299

### Innovation 2: Multi-Dimensional Feedback Detection

The system doesn't just look for new comments. It implements a sophisticated feedback detection algorithm that monitors seven different signals:

1.  New comments on pull requests or issues (excluding bot-generated logs)
2.  Edited issue or PR descriptions
3.  New commits on the default branch (indicating repository evolution)
4.  Pull request state changes (closed, merged)
5.  Merge status changes (conflicts, test failures)
6.  Failed CI/CD checks
7.  Reviewer-requested changes

This comprehensive approach ensures the AI responds to implicit feedback (like failing tests) just as it does to explicit feedback (like comments). solve.feedback.lib.mjs:196-308

### Innovation 3: Thinking Depth Control

The system introduces a novel `--think` parameter with four levels (low, medium, high, max) that controls the cognitive depth of AI reasoning. At maximum depth ("Ultrathink"), the AI engages in the most thorough analysis possible, considering edge cases, performing extensive validation, and exploring alternative approaches. claude.prompts.lib.mjs:74-83

### Innovation 4: Automatic Fork Management

The system intelligently handles repository permissions. If an AI agent lacks write access to a repository, it automatically forks the repository, works in the fork, and creates pull requests back to the original. This enables collaborative contribution to any public repository without requiring upfront permissions. README.md:206-209

### Innovation 5: Session Persistence and Recovery

When AI agents hit usage limits or encounter errors, the system preserves the entire conversation context as a session ID. Humans or other agents can resume exactly where work stopped, maintaining continuity across interruptions. README.md:500-506

### Innovation 6: Structured Problem-Solving Prompts

Rather than generic instructions, the system provides AI agents with highly structured guidelines organized into cognitive phases:

-   **Initial Research**: How to gather information systematically
-   **Solution Development**: How to implement incrementally with tests
-   **Preparation**: How to follow conventions and run checks
-   **Self-Review**: How to verify completeness before submission

Each phase includes specific commands, patterns, and decision criteria, creating a repeatable methodology. claude.prompts.lib.mjs:113-132

### Innovation 7: Continuous Integration with CI/CD

The system includes detailed protocols for investigating CI failures. When tests fail, the AI follows a systematic investigation:

1.  List recent CI runs with timestamps
2.  Verify runs correspond to latest commits
3.  Download logs from failed runs
4.  Analyze specific errors with line numbers
5.  Report findings and implement fixes claude.prompts.lib.mjs:119-127

## IV. The Workflow Logic: How Everything Connects

### The Default Mode Journey

1.  **Human Input**: A developer creates a GitHub issue describing a problem or feature request
2.  **AI Detection**: The Hive Mind orchestrator detects the issue (either through monitoring or explicit command)
3.  **Work Assignment**: The orchestrator creates an isolated working environment for an AI agent
4.  **Deep Analysis**: The agent reads all issue details, comments, related code, and screenshots
5.  **Solution Development**: The agent implements the solution incrementally, committing atomic changes
6.  **Draft PR Creation**: The agent creates a draft pull request with description and tests
7.  **Human Decision Point**: The developer reviews the PR and decides: approve/merge, request changes, or close
8.  **Iteration Loop**: If changes are requested, return to step 4 with the comments as new input flow.md:183-191

### The Continue Mode Journey

1.  **Existing Context**: There's already an open pull request with previous work
2.  **Human Feedback**: A developer adds comments requesting changes or clarifications
3.  **Feedback Detection**: The system detects new comments, failed tests, or other signals
4.  **Context Loading**: The agent loads the full history of the issue, PR, and all feedback
5.  **Incremental Updates**: The agent modifies the existing solution based on feedback
6.  **Push Changes**: Updated code is committed and pushed to the same branch
7.  **Human Re-Review**: The developer reviews updates and decides next steps
8.  **Iteration Continues**: The cycle repeats until the solution is acceptable or abandoned flow.md:235-243

## V. The Orchestration Strategy: Managing Multiple Agents

### Concurrent Work Distribution

The Hive Mind can monitor entire organizations (like `https://github.com/microsoft`) and process multiple issues simultaneously. It implements:

-   **Queue Management**: Maintains a priority queue of issues to solve
-   **Concurrency Control**: Runs multiple solvers in parallel with configurable limits
-   **Resource Monitoring**: Checks disk space and memory before starting new work
-   **Failure Handling**: Automatically retries failed tasks with exponential backoff
-   **State Tracking**: Remembers which issues are in progress, completed, or failed README.md:481-497

### The Monitoring Loop

The orchestrator operates in a continuous cycle:

1.  **Scan Phase**: Query GitHub for issues matching criteria (labels, project boards, specific repositories)
2.  **Filter Phase**: Exclude issues that already have pull requests (if configured)
3.  **Batch Processing**: Check repository permissions and archived status in bulk
4.  **Assignment Phase**: Distribute work to available solver slots
5.  **Wait Phase**: Sleep for configured interval (default 5 minutes)
6.  **Repeat**: Return to scan phase hive.mjs:143-200

## VI. Safety and Control Mechanisms

### Multiple Safety Layers

The system implements several safeguards:

1.  **Draft PR by Default**: All pull requests start as drafts, requiring explicit human conversion to "ready for review"
2.  **No Auto-Merge**: Humans must manually approve and merge - the AI never merges automatically
3.  **Feedback Requirements**: Options like `--continue-only-on-feedback` ensure the AI only acts when humans provide input
4.  **Comment Filtering**: AI-generated logs are automatically excluded from feedback detection to prevent false triggers
5.  **Isolation**: Each solver works in a separate temporary directory, preventing cross-contamination flow.md:349-354

### Emergency Intervention

Humans can immediately halt AI work through:

-   Closing the pull request
-   Adding "STOP" commands in comments
-   Changing repository permissions
-   Manual branch protection flow.md:305-313

## VII. The Telegram Integration: Remote Control

The system includes a Telegram bot interface that allows humans to command the AI swarm from mobile devices or chat applications. Teams can:

-   Submit issues for solving directly from chat
-   Monitor ongoing work through status updates
-   Execute the full orchestrator across multiple repositories
-   Receive notifications when work completes

This bridges the gap between formal GitHub workflows and informal team communication channels. README.md:329-361

## VIII. Configuration Philosophy: Adaptable Behavior

The system exposes numerous configuration options through environment variables, allowing teams to tune behavior without code changes:

-   **Timeouts**: How long to wait for AI responses or API calls
-   **Retry Logic**: How aggressively to retry failed operations
-   **Resource Limits**: Minimum disk space, memory requirements
-   **Auto-Continue Thresholds**: How long to wait before automatically continuing work
-   **GitHub Limits**: Maximum file sizes, comment lengths, attachment sizes

This configurability enables the system to adapt to different team workflows, repository sizes, and operational constraints. CONFIG.md:1-23

## IX. The Problem-Solving Methodology: Universal Algorithm Inspiration

The system is inspired by universal problem-solving algorithms that break complex problems into manageable steps. The core methodology follows a pattern:

1.  **Understand**: Thoroughly analyze the problem from all angles
2.  **Decompose**: Break into smaller, manageable subproblems
3.  **Research**: Study related work, existing solutions, and patterns
4.  **Experiment**: Test assumptions through small experiments
5.  **Implement**: Build incrementally with frequent validation
6.  **Verify**: Ensure solution meets all original requirements
7.  **Document**: Explain what was done and why

This structured approach reduces cognitive load on the AI and produces more reliable outcomes. README.md:14-16

## X. Key Design Principles: The Philosophical Foundation

### Principle 1: Human-Centric Design

Every automated action is subject to human review and approval. The system enhances human capabilities rather than replacing human judgment.

### Principle 2: Feedback-Driven Iteration

The system responds dynamically to human input at multiple points, creating a continuous improvement loop.

### Principle 3: Transparency by Default

All AI actions are visible through GitHub's standard interfaces. Nothing happens in hidden background processes.

### Principle 4: Iterative Refinement

The system supports multiple rounds of improvement based on feedback, recognizing that solutions rarely emerge perfect on first attempt.

### Principle 5: Configurable Autonomy

Teams can adjust automation levels to match their comfort and requirements, from fully manual to highly autonomous. flow.md:436-453

## XI. Practical Implications: What This Enables

### For Open Source Maintainers

-   Automatically handle straightforward issues and bug fixes
-   Scale contribution handling beyond what's manually possible
-   Maintain consistent code quality through structured approaches
-   Reduce burnout by delegating routine tasks

### For Development Teams

-   Accelerate feature development on internal projects
-   Maintain multiple repositories with fewer human resources
-   Ensure consistent implementation patterns across codebases
-   Enable 24/7 development cycles (AI works while humans sleep)

### For Individual Developers

-   Contribute to projects without deep codebase knowledge
-   Learn by observing AI problem-solving approaches
-   Delegate routine tasks while focusing on architecture
-   Experiment with solutions quickly

## XII. Limitations and Constraints

### What This System Cannot Do

-   Replace human architectural decisions
-   Understand unstated business requirements
-   Navigate complex political or organizational dynamics
-   Make ethical judgments about feature priorities
-   Guarantee perfect security or performance

### Required Human Involvement

-   Defining clear requirements in issues
-   Reviewing and approving all changes
-   Making merge/reject decisions
-   Providing feedback when solutions miss the mark
-   Managing overall project direction README.md:18-55

## Conclusion: A New Paradigm in Software Development

Hive Mind represents a shift from viewing AI as a tool for individual tasks to viewing AI as a coordinated team member in software development. The system's original contributions include:

1.  **Structured orchestration** of multiple AI agents working concurrently
2.  **Multi-dimensional feedback detection** beyond simple comments
3.  **Task clarification protocols** that prevent misunderstandings
4.  **Thinking depth control** for adjusting cognitive rigor
5.  **Automatic fork management** enabling universal contribution
6.  **Session persistence** for seamless work continuation
7.  **Human-centric safety** ensuring oversight at critical points

The system demonstrates that AI agents can handle substantial development work autonomously while maintaining human control over strategic decisions. This creates a collaborative model where humans focus on defining problems and making judgments, while AI agents handle implementation details and iterative refinement.

The philosophical innovation is recognizing that software development is fundamentally about **iteration** and **feedback**, not just initial implementation. By building feedback detection and response into the core architecture, the system creates a genuine dialogue between humans and AI, rather than a simple command-execution model.

---

## Notes

This system is explicitly marked as **unsafe to run on developer machines** due to security concerns. It's designed for isolated virtual machines with dedicated tokens. The Claude AI agents have full autonomous mode enabled, meaning they can execute arbitrary commands as needed for problem-solving. This power comes with inherent risks that require careful operational security. README.md:18-29

The system supports multiple AI backends (Claude, OpenCode with Grok) and can be extended to additional models, making it tool-agnostic in its core design. The structured prompting approach works across different AI systems with minimal adaptation. README.md:204-206

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[README.md](https://github.com/deep-assistant/hive-mind/blob/718b5d74/README.md)

```
7
8# Hive Mind 🧠
9
```

```
10**The master mind AI that controls hive of AI.** The orchestrator AI that controls AIs. The HIVE MIND. The SWARM MIND.
11
12It is also possible to connect this AI to collective human intelligence, meaning this system can communicate with humans for requirements, expertise, feedback.
13
14[![Universal Problem Solving Algorithm](https://github.com/user-attachments/assets/1d91e911-9ba4-456e-a00a-14cdd60d9a0a)](https://github.com/konard/problem-solving)
15
16Inspired by [konard/problem-solving](https://github.com/konard/problem-solving)
```

```
17 
```

```
18## ⚠️ WARNING
19
20It is UNSAFE to run this software on your developer machine.
21
22It is recommended to use SEPARATE Ubuntu 24.04 installation (installation script is prepared for you).
23
24This software uses full autonomous mode of Claude Code, that means it is free to execute any commands it sees fit.
25
26That means it can lead to unexpected side effects.
27
28There is also a known issue of space leakage. So you need to make sure you are able to reinstall your virtual machine to clear space and/or any damage to the virtual machine.
29
30### ⚠️ CRITICAL: Token and Sensitive Data Security
31
32**THIS SOFTWARE CANNOT GUARANTEE ANY SAFETY FOR YOUR TOKENS OR OTHER SENSITIVE DATA ON THE VIRTUAL MACHINE.**
33
34There are infinite ways to extract tokens from a virtual machine connected to the internet. This includes but is not limited to:
35
36- **Claude MAX tokens** - Required for AI operations
37- **GitHub tokens** - Required for repository access
38- **API keys and credentials** - Any sensitive data on the system
39
40**IMPORTANT SECURITY CONSIDERATIONS:**
41
42- Running on a developer machine is **ABSOLUTELY UNSAFE**
43- Running on a virtual machine is **LESS UNSAFE** but still has risks
44- Even though your developer machine data isn't directly exposed, the VM still contains sensitive tokens
45- Any token stored on an internet-connected system can potentially be compromised
46
47**USE THIS SOFTWARE ENTIRELY AT YOUR OWN RISK AND RESPONSIBILITY.**
48
49We strongly recommend:
50- Using dedicated, isolated virtual machines
51- Rotating tokens regularly
52- Monitoring token usage for suspicious activity
53- Never using production tokens or credentials
54- Being prepared to revoke and replace all tokens used with this system
55
```

```
56Minimum system requirements to run `hive.mjs`:
57```
581 CPU Core
```

```
201```bash
202solve <issue-url> [options]
203
```

```
204  --model, -m           Model (sonnet, opus for claude; grok-code-fast-1, gpt4o for opencode)
205                        [default: sonnet for claude, grok-code-fast-1 for opencode]
206  --tool                AI tool (claude, opencode)           [default: claude]
207  --fork, -f            Fork repo if no write access         [default: false]
208  --auto-fork           Automatically fork public repos without write access (fails for private)
209                        [default: false]
```

```
210  --base-branch, -b     Target branch for PR                 [default: repo default]
211  --resume, -r          Resume from session ID
212  --verbose, -v         Enable verbose logging               [default: false]
```

```
291```
292
293## 🤖 Telegram Bot
```

```
294
295The Hive Mind includes a Telegram bot interface (SwarmMindBot) for remote command execution.
296
297### 🚀 Test Drive
298
299Want to see the Hive Mind in action? Join our Telegram channel where you can execute the Hive Mind on your own issues and watch AI solve them:
300
301**[Join https://t.me/hive_mind_pull_requests](https://t.me/hive_mind_pull_requests)**
302
```

```
303### Setup
304
3051. **Get Bot Token**
```

```
326   ```
327
328### Bot Commands
```

```
329
330All commands work in **group chats only** (not in private messages with the bot):
331
332#### `/solve` - Solve GitHub Issues
333```
334/solve <github-url> [options]
335
336Examples:
337/solve https://github.com/owner/repo/issues/123
338/solve https://github.com/owner/repo/issues/123 --auto-fork --verbose
339/solve https://github.com/owner/repo/issues/123 --auto-fork --auto-continue --attach-logs --verbose --model sonnet --think max
340```
341
342#### `/hive` - Run Hive Orchestration
343```
344/hive <github-url> [options]
345
346Examples:
347/hive https://github.com/owner/repo
348/hive https://github.com/owner/repo --all-issues --max-issues 10
349/hive https://github.com/microsoft --all-issues --concurrency 3
350```
351
352#### `/help` - Get Help and Diagnostic Info
353```
354/help
355
356Shows:
357- Chat ID (needed for TELEGRAM_ALLOWED_CHATS)
358- Chat type
359- Available commands
360- Usage examples
361```
```

```
362
363### Features
364
```

```
375- Commands run as the system user running the bot
376- Ensure proper authentication (`gh auth login`, `claude-profiles`)
377
```

```
378## 🏗️ Architecture
379
380The Hive Mind operates on three layers:
381
3821. **Orchestration Layer** (`hive.mjs`) - Coordinates multiple AI agents
3832. **Execution Layer** (`solve.mjs`, `review.mjs`) - Performs specific tasks
3843. **Human Interface Layer** - Enables human-AI collaboration
385
386### Data Flow
```

```
387
388#### Mode 1: Issue → Pull Request Flow
389```mermaid
```

```
478solve https://github.com/owner/repo/issues/123 --dry-run
479```
480
```

```
481### Multi-Repository Orchestration
482```bash
483# Monitor single repository with specific label
484hive https://github.com/owner/repo --monitor-tag "bug" --concurrency 4
485
486# Monitor all issues in an organization with auto-fork
487hive https://github.com/microsoft --all-issues --max-issues 20 --once --auto-fork
488
489# Monitor user repositories with high concurrency
490hive https://github.com/username --all-issues --concurrency 8 --interval 120 --auto-fork
491
492# Skip issues that already have PRs
493hive https://github.com/org/repo --skip-issues-with-prs --verbose
494
495# Auto-cleanup temporary files and auto-fork if needed
496hive https://github.com/org/repo --auto-cleanup --auto-fork --concurrency 5
497```
```

```
498
499### Session Management
```

```
500```bash
501# Resume when Claude hits limit
502solve https://github.com/owner/repo/issues/123 --resume 657e6db1-6eb3-4a8d
503
504# Continue session interactively in Claude Code
505(cd /tmp/gh-issue-solver-123456789 && claude --resume session-id)
506```
```

```
507
508## 🔍 Monitoring & Logging
509
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[docs/flow.md](https://github.com/deep-assistant/hive-mind/blob/718b5d74/docs/flow.md)

```
21
22## Operating Modes
23
```

```
24Hive Mind operates in two primary modes based on the entry point and human interaction patterns:
25
26| Mode | Entry Point | Primary Human Input | Secondary Input | Decision Points |
27|------|------------|-------------------|-----------------|-----------------|
28| **Default Mode** | GitHub Issue | Issue description & requirements | PR comments for refinements | Merge/Request Changes/Close |
29| **Continue Mode** | Existing PR | PR comments with feedback | Additional PR comments | Merge/Request Changes/Close |
30
```

```
31## Data Flow Architecture
32
33### High-Level System Architecture
```

```
180    end
181```
182
```

```
183### Data Flow Steps
1841. **Human creates GitHub issue** (Primary human input)
1852. Hive Mind detects and assigns issue to AI agent
1863. AI agent analyzes issue requirements
1874. AI agent develops solution and creates draft PR
1885. **Human reviews PR** (Human decision point)
1896. **Human decides**: Merge, request changes, or close (Human feedback)
1907. If changes requested, cycle continues with PR comments as input
191
```

```
192## Mode 2: Continue Mode (Pull Request → Comments)
193
194### Human Feedback Points
```

```
232    end
233```
234
```

```
235### Data Flow Steps
2361. **Human adds comment to existing PR** (Primary human input)
2372. Hive Mind detects new comment
2383. AI agent processes comment and feedback
2394. AI agent updates solution based on feedback
2405. AI agent pushes changes to PR
2416. **Human reviews updates** (Human decision point)
2427. **Human decides**: Merge, add more comments, or close (Human feedback)
2438. Cycle continues until resolution
```

```
244
245## Human Feedback Integration Points
246
```

```
302  - Provide ongoing guidance
303
304### 5. Emergency Intervention Points
```

```
305- **Type**: Critical feedback
306- **Format**: Direct commands in comments
307- **Impact**: Immediate system response
308- **Triggers**:
309  - `STOP` command in comment
310  - PR closure
311  - Branch protection activation
312  - Manual revert
313
```

```
314### Human Feedback Processing Flow
315
316```mermaid
```

```
346- `--auto-continue`: Automatically continue with existing PRs for issues
347- `--auto-continue-only-on-new-comments`: Only continue if new comments detected
348- `--continue-only-on-feedback`: Only continue if feedback is present
```

```
349
350### Human Interaction Controls
351- `--auto-pull-request-creation`: Create draft PR before human review
352- `--attach-logs`: Include detailed logs for human review
353- Manual merge requirement ensures human oversight
354
```

```
355## Error Handling & Fallbacks
356
357### When Human Feedback is Absent
```

```
433
434## Summary
435
```

```
436### Key Design Principles
437
4381. **Human-Centric**: Every automated action is subject to human review and approval
4392. **Feedback-Driven**: System responds dynamically to human input at multiple points
4403. **Transparent**: All AI actions are visible through GitHub's standard interfaces
4414. **Iterative**: Supports multiple rounds of refinement based on human feedback
4425. **Configurable**: Behavior can be adjusted to match team workflows
443
444### Data Flow Summary
445
446The Hive Mind data flow architecture ensures comprehensive human oversight through:
447
448- **Multiple Entry Points**: Issues (Default Mode) or PRs (Continue Mode)
449- **Continuous Feedback Integration**: Comments processed in real-time
450- **Clear Decision Gates**: Explicit human approval required for merging
451- **Emergency Controls**: Immediate halt capabilities through commands
452- **Flexible Configuration**: Adjustable automation levels
453
```

```
454### Human Feedback Integration
455
456| Mode | Primary Feedback | Secondary Feedback | Decision Authority |
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/claude.prompts.lib.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/claude.prompts.lib.mjs)

```
71    promptLines.push('');
72  }
73
```

```
74  // Add thinking instruction based on --think level
75  if (argv && argv.think) {
76    const thinkMessages = {
77      low: 'Think.',
78      medium: 'Think hard.',
79      high: 'Think harder.',
80      max: 'Ultrathink.'
81    };
82    promptLines.push(thinkMessages[argv.think]);
83  }
```

```
84
85  // Final instruction
86  promptLines.push(isContinueMode ? 'Continue.' : 'Proceed.');
```

```
110  }
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
```

```
133 
```

```
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
```

```
149
150Solution development and testing.
151   - When issue is solvable, implement code with tests.
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/task.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/task.mjs)

```
243    decomposition: null
244  };
245
```

```
246  // Phase 1: Clarification
247  if (argv.clarify) {
248    await log(`\n🤔 Phase 1: Task Clarification`);
249    await log(`   Analyzing task and generating clarifying questions...`);
250    
251    const clarifyPrompt = `Task: "${taskDescription}"
252
253Please help clarify this task by:
2541. Identifying any ambiguous aspects of the task
2552. Asking 3-5 specific clarifying questions that would help someone implement this task more effectively
2563. Suggesting potential assumptions that could be made if these questions aren't answered
2574. Identifying any missing context or requirements
258
259Provide your response in a clear, structured format that helps refine the task understanding.`;
260
261    const clarificationOutput = await executeClaude(clarifyPrompt, argv.model);
262    if (!argv.verbose) {
263      console.log('\n📝 Clarification Results:');
264      console.log(clarificationOutput);
265    }
266    
267    results.clarification = clarificationOutput;
268    await log(`\n✅ Clarification phase completed`);
269  }
270
271  // Phase 2: Decomposition
272  if (argv.decompose) {
273    await log(`\n🔍 Phase 2: Task Decomposition`);
274    await log(`   Breaking down task into manageable subtasks...`);
275    
276    let decomposePrompt = `Task: "${taskDescription}"`;
277    
278    if (results.clarification) {
279      decomposePrompt += `\n\nClarification analysis:\n${results.clarification}`;
280    }
281    
282    decomposePrompt += `\n\nPlease decompose this task by:
2831. Breaking it down into 3-8 specific, actionable subtasks
2842. Ordering the subtasks logically (dependencies and sequence)
2853. Estimating relative complexity/effort for each subtask (simple/medium/complex)
2864. Identifying any potential risks or challenges for each subtask
2875. Suggesting success criteria for each subtask
288
289Provide your response as a structured breakdown that someone could use as a implementation roadmap.`;
290
291    const decompositionOutput = await executeClaude(decomposePrompt, argv.model);
292    if (!argv.verbose) {
293      console.log('\n🔍 Decomposition Results:');
294      console.log(decompositionOutput);
295    }
296    
297    results.decomposition = decompositionOutput;
298    await log(`\n✅ Decomposition phase completed`);
299  }
```

```
300
301  // Output results
302  if (argv.outputFormat === 'json') {
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/solve.feedback.lib.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/solve.feedback.lib.mjs)

```
193
194        // Build comprehensive feedback info for system prompt
195        feedbackLines = []; // Reset for this execution
```

```
196        let feedbackDetected = false;
197        const feedbackSources = [];
198
199        // Add comment info if counts are > 0 to avoid wasting tokens
200        if (newPrComments > 0) {
201          feedbackLines.push(`New comments on the pull request: ${newPrComments}`);
202        }
203        if (newIssueComments > 0) {
204          feedbackLines.push(`New comments on the issue: ${newIssueComments}`);
205        }
206
207        // Enhanced feedback detection for all continue modes
208        if (isContinueMode || argv.autoContinue) {
209          if (argv.continueOnlyOnFeedback) {
210            await log(`${formatAligned('🔍', 'Feedback detection:', 'Checking for any feedback since last commit...')}`);
211          }
212
213          // 1. Check for new comments (already filtered above)
214          const totalNewComments = newPrComments + newIssueComments;
215          if (totalNewComments > 0) {
216            feedbackDetected = true;
217            feedbackSources.push(`New comments (${totalNewComments})`);
218          }
219
220          // 2. Check for edited descriptions
221          try {
222            // Check PR description edit time
223            const prDetailsResult = await $`gh api repos/${owner}/${repo}/pulls/${prNumber}`;
224            if (prDetailsResult.code === 0) {
225              const prDetails = JSON.parse(prDetailsResult.stdout.toString());
226              const prUpdatedAt = new Date(prDetails.updated_at);
227              if (prUpdatedAt > lastCommitTime) {
228                feedbackLines.push('Pull request description was edited after last commit');
229                feedbackDetected = true;
230                feedbackSources.push('PR description edited');
231              }
232            }
233
234            // Check issue description edit time if we have an issue
235            if (issueNumber) {
236              const issueDetailsResult = await $`gh api repos/${owner}/${repo}/issues/${issueNumber}`;
237              if (issueDetailsResult.code === 0) {
238                const issueDetails = JSON.parse(issueDetailsResult.stdout.toString());
239                const issueUpdatedAt = new Date(issueDetails.updated_at);
240                if (issueUpdatedAt > lastCommitTime) {
241                  feedbackLines.push('Issue description was edited after last commit');
242                  feedbackDetected = true;
243                  feedbackSources.push('Issue description edited');
244                }
245              }
246            }
247          } catch (error) {
248            reportError(error, {
249              context: 'check_description_edits',
250              prNumber,
251              operation: 'fetch_pr_timeline'
252            });
253            if (argv.verbose) {
254              await log(`Warning: Could not check description edit times: ${cleanErrorMessage(error)}`, { level: 'warning' });
255            }
256          }
257
258          // 3. Check for new commits on default branch
259          try {
260            const defaultBranchResult = await $`gh api repos/${owner}/${repo}`;
261            if (defaultBranchResult.code === 0) {
262              const repoData = JSON.parse(defaultBranchResult.stdout.toString());
263              const defaultBranch = repoData.default_branch;
264
265              const commitsResult = await $`gh api repos/${owner}/${repo}/commits --field sha=${defaultBranch} --field since=${lastCommitTime.toISOString()}`;
266              if (commitsResult.code === 0) {
267                const commits = JSON.parse(commitsResult.stdout.toString());
268                if (commits.length > 0) {
269                  feedbackLines.push(`New commits on ${defaultBranch} branch: ${commits.length}`);
270                  feedbackDetected = true;
271                  feedbackSources.push(`New commits on ${defaultBranch} (${commits.length})`);
272                }
273              }
274            }
275          } catch (error) {
276            reportError(error, {
277              context: 'check_branch_commits',
278              branchName,
279              operation: 'fetch_commit_messages'
280            });
281            if (argv.verbose) {
282              await log(`Warning: Could not check default branch commits: ${cleanErrorMessage(error)}`, { level: 'warning' });
283            }
284          }
285
286          // 4. Check pull request state (non-open indicates closed or merged)
287          if (prState && prState !== 'OPEN') {
288            feedbackLines.push(`Pull request state: ${prState}`);
289            feedbackDetected = true;
290            feedbackSources.push(`PR state ${prState}`);
291          }
292
293          // 5. Check merge status (non-clean indicates issues with merging)
294          if (mergeStateStatus && mergeStateStatus !== 'CLEAN') {
295            const statusDescriptions = {
296              'DIRTY': 'Merge status is DIRTY (conflicts detected)',
297              'UNSTABLE': 'Merge status is UNSTABLE (non-passing commit status)',
298              'BLOCKED': 'Merge status is BLOCKED',
299              'BEHIND': 'Merge status is BEHIND (head ref is out of date)',
300              'HAS_HOOKS': 'Merge status is HAS_HOOKS (has pre-receive hooks)',
301              'UNKNOWN': 'Merge status is UNKNOWN'
302            };
303            const description = statusDescriptions[mergeStateStatus] || `Merge status is ${mergeStateStatus}`;
304            feedbackLines.push(description);
305            feedbackDetected = true;
306            feedbackSources.push(`Merge status ${mergeStateStatus}`);
307          }
308
```

```
309          // 6. Check for failed PR checks
310          try {
311            const checksResult = await $`gh api repos/${owner}/${repo}/commits/$(gh api repos/${owner}/${repo}/pulls/${prNumber} --jq '.head.sha')/check-runs`;
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/hive.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/hive.mjs)

```
140 * @param {boolean} allIssues - Whether to fetch all issues or only labeled ones
141 * @returns {Promise<Array>} Array of issues
142 */
```

```
143async function fetchIssuesFromRepositories(owner, scope, monitorTag, fetchAllIssues = false) {
144  const { execSync } = await import('child_process');
145  try {
146    await log(`   🔄 Using repository-by-repository fallback for ${scope}: ${owner}`);
147    // Strategy 1: Try GraphQL approach first (faster but has limitations)
148    // Only try GraphQL for "all issues" mode, not for labeled issues
149    if (fetchAllIssues) {
150      const graphqlResult = await tryFetchIssuesWithGraphQL(owner, scope, log, cleanErrorMessage);
151      if (graphqlResult.success) {
152        await log(`   ✅ GraphQL approach successful: ${graphqlResult.issues.length} issues from ${graphqlResult.repoCount} repositories`);
153        return graphqlResult.issues;
154      }
155    }
156
157    // Strategy 2: Fallback to gh api --paginate approach (comprehensive but slower)
158    await log('   📋 Using gh api --paginate approach for comprehensive coverage...', { verbose: true });
159
160    // First, get list of ALL repositories using gh api with --paginate for unlimited pagination
161    // This approach uses the GitHub API directly to fetch all repositories without any limits
162    // Include isArchived field to filter out archived repositories
163    let repoListCmd;
164    if (scope === 'organization') {
165      repoListCmd = `gh api orgs/${owner}/repos --paginate --jq '.[] | {name: .name, owner: .owner.login, isArchived: .archived}'`;
166    } else {
167      repoListCmd = `gh api users/${owner}/repos --paginate --jq '.[] | {name: .name, owner: .owner.login, isArchived: .archived}'`;
168    }
169
170    await log('   📋 Fetching repository list (using --paginate for unlimited pagination)...', { verbose: true });
171    await log(`   🔎 Command: ${repoListCmd}`, { verbose: true });
172
173    // Add delay for rate limiting
174    await new Promise(resolve => setTimeout(resolve, 2000));
175
176    const repoOutput = execSync(repoListCmd, { encoding: 'utf8' });
177    // Parse the output line by line, as gh api with --jq outputs one JSON object per line
178    const repoLines = repoOutput.trim().split('\n').filter(line => line.trim());
179    const allRepositories = repoLines.map(line => JSON.parse(line));
180
181    await log(`   📊 Found ${allRepositories.length} repositories`);
182
183    // Filter repositories to only include those owned by the target user/org
184    const ownedRepositories = allRepositories.filter(repo => {
185      const repoOwner = repo.owner?.login || repo.owner;
186      return repoOwner === owner;
187    });
188    const unownedCount = allRepositories.length - ownedRepositories.length;
189
190    if (unownedCount > 0) {
191      await log(`   ⏭️  Skipping ${unownedCount} repository(ies) not owned by ${owner}`);
192    }
193
194    // Filter out archived repositories from owned repositories
195    const repositories = ownedRepositories.filter(repo => !repo.isArchived);
196    const archivedCount = ownedRepositories.length - repositories.length;
197
198    if (archivedCount > 0) {
199      await log(`   ⏭️  Skipping ${archivedCount} archived repository(ies)`);
200    }
```

```
201
202    await log(`   ✅ Processing ${repositories.length} non-archived repositories owned by ${owner}`);
203
```

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[docs/CONFIG.md](https://github.com/deep-assistant/hive-mind/blob/718b5d74/docs/CONFIG.md)

```
1# Configuration Guide
2
3The Hive Mind application now supports extensive configuration through environment variables using the `getenv` package. This allows you to customize various aspects of the application without modifying the source code.
4
5## Configuration Overview
6
7All configuration is managed through the `src/config.lib.mjs` module which uses `getenv` from use-m for environment variable handling. The configuration uses camelCase property names for consistency.
8
9## Configuration Categories
10
11### 1. Timeout Configurations (timeouts)
12
13- `HIVE_MIND_CLAUDE_TIMEOUT_SECONDS`: Claude CLI timeout in seconds (default: 60)
14- `HIVE_MIND_GITHUB_API_DELAY_MS`: Delay between GitHub API calls (default: 5000)
15- `HIVE_MIND_GITHUB_REPO_DELAY_MS`: Delay between repository operations (default: 2000)
16- `HIVE_MIND_RETRY_BASE_DELAY_MS`: Base delay for retry operations (default: 5000)
17- `HIVE_MIND_RETRY_BACKOFF_DELAY_MS`: Backoff delay for retries (default: 1000)
18
19Available as: `timeouts.claudeCli`, `timeouts.githubApiDelay`, etc.
20
21### 2. Auto-Continue Settings (autoContinue)
22
23- `HIVE_MIND_AUTO_CONTINUE_AGE_HOURS`: Minimum age of PRs before auto-continue (default: 24)
```

```
24
25Available as: `autoContinue.ageThresholdHours`
26
```

[deep-assistant/hive-mind](https://deepwiki.com/deep-assistant/hive-mind)

Какие промпты тут применяются? Дать цитаты и экспертизу как промпт инженер

Deep

Thought Process

# Prompts in the Agent System

The `src/claude.prompts.lib.mjs` file contains two main prompt-building functions with distinct approaches to guiding the AI agent's behavior.

## Thinking Depth Control

The system implements a **tiered thinking depth mechanism** controlled by the `--think` flag with four levels:

**User Prompt (Short Commands):** claude.prompts.lib.mjs:75-83

**System Prompt (Persistent Instructions):** claude.prompts.lib.mjs:101-110

### Prompt Engineering Analysis:

-   **Progressive Intensity**: The levels (`low` → `medium` → `high` → `max`) use increasingly emphatic language ("Think" → "Think hard" → "Think harder" → "Ultrathink")
-   **Dual Reinforcement**: Instructions appear in both user and system prompts - user prompt gives immediate directive, system prompt establishes persistent behavior
-   **Behavioral Anchoring**: System prompt uses "always...on every step" phrasing to create consistent meta-cognitive behavior throughout the session
-   **Semantic Escalation**: The progression from standard thinking to "ultrathink" signals computational intensity without technical jargon

## Structured Problem-Solving Prompts

The system prompt contains a comprehensive **conditional workflow framework** organized into five major sections:

**1\. General Guidelines** claude.prompts.lib.mjs:115-132

**2\. Initial Research** claude.prompts.lib.mjs:134-148

**3\. Solution Development and Testing** claude.prompts.lib.mjs:150-160

**4\. Preparing Pull Request** claude.prompts.lib.mjs:162-178

**5\. Workflow and Collaboration** claude.prompts.lib.mjs:180-190

**6\. Self Review** claude.prompts.lib.mjs:192-195

### Prompt Engineering Analysis:

**Structural Patterns:**

-   **"When...then" Conditionals**: Every guideline uses "When \[situation\], \[action\]" format, creating a decision tree that maps contexts to behaviors
-   **Phase-Based Organization**: The prompt mirrors a software development lifecycle (research → develop → test → prepare → review)
-   **Specificity Gradient**: Instructions become increasingly specific as they progress (general principles → concrete commands with actual GitHub CLI syntax)

**Behavioral Design:**

-   **Procedural Memory**: Rather than abstract principles, the prompt embeds specific commands (`gh issue view`, `gh pr diff`) directly into instructions
-   **Error Prevention**: Multiple redundant checks (e.g., verify branch, check CI, confirm no uncommitted changes) create safety nets
-   **Tool-Use Scaffolding**: Instructions explicitly name tools and their contexts (WebFetch for images, Read for files), reducing ambiguity
-   **Defensive Programming Patterns**: Instructions like "always save logs to files" and "run commands in background" anticipate edge cases

**Cognitive Load Management:**

-   **Chunking Strategy**: Complex tasks are broken into numbered substeps (e.g., the 5-step CI investigation protocol)
-   **Context Injection**: Dynamic variables like `${owner}`, `${repo}`, `${branchName}` are templated directly into commands, reducing mental overhead
-   **Persistent State References**: The prompt repeatedly refers back to specific branch names and PR numbers to maintain context

**Meta-Cognitive Elements:**

-   **Self-Monitoring**: "When you check your solution draft" and "double-check" instructions encourage internal validation loops
-   **Help-Seeking Behavior**: Explicit instructions on when to ask for human help prevent the agent from getting stuck
-   **Documentation Habits**: Requirements to keep experiment scripts and maintain commit history create an audit trail

## Notes

The prompt architecture demonstrates a **hybrid approach**:

1.  **Declarative layer** (system prompt): Establishes persistent behavioral rules and workflow structure
2.  **Imperative layer** (user prompt): Provides immediate context and action triggers

The thinking depth control is notably **minimalist** - using brief, emphatic commands rather than lengthy explanations. This suggests the designers trust the model's pre-training to interpret escalating intensity signals.

The structured problem-solving prompts employ **situational awareness programming** - rather than giving a linear sequence of steps, they define behaviors for different scenarios the agent might encounter. This makes the system more robust to unexpected situations while maintaining consistent behavior patterns.

The extensive use of concrete examples and actual command syntax serves as **in-prompt documentation**, reducing the need for the model to recall or infer correct tool usage from general knowledge.

[deep-assistant/hive-mind](https://github.com/deep-assistant/hive-mind)[src/claude.prompts.lib.mjs](https://github.com/deep-assistant/hive-mind/blob/718b5d74/src/claude.prompts.lib.mjs)

```
72  }
73
74  // Add thinking instruction based on --think level
```

```
75  if (argv && argv.think) {
76    const thinkMessages = {
77      low: 'Think.',
78      medium: 'Think hard.',
79      high: 'Think harder.',
80      max: 'Ultrathink.'
81    };
82    promptLines.push(thinkMessages[argv.think]);
83  }
```

```
84
85  // Final instruction
86  promptLines.push(isContinueMode ? 'Continue.' : 'Proceed.');
```

```
98  const { owner, repo, issueNumber, prNumber, branchName, argv } = params;
99
100  // Build thinking instruction based on --think level
```

```
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
113  return `You are an AI issue solver. You prefer to find the root cause of each and every issue. When you talk, you prefer to speak with facts which you have double-checked yourself or cite sources that provide evidence, like quote actual code or give references to documents or pages found on the internet. You are polite and patient, and prefer to assume good intent, trying your best to be helpful. If you are unsure or have assumptions, you prefer to test them yourself or ask questions to clarify requirements.${thinkLine}
114
```

```
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
```

```
133 
```

```
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
```

```
149 
```

```
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
```

```
161 
```

```
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
```

```
179 
```

```
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
```

```
191 
```

```
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

[deep-assistant/hive-mind](https://deepwiki.com/deep-assistant/hive-mind)

Какие промпты тут применяются? Дать цитаты и экспертизу как промпт инженер

Codemap

Open with Windsurf

Архитектура промптов в Hive Mind

Карта показывает архитектуру промптов в системе Hive Mind, включая их генерацию \[1a\], выполнение \[2d\], специализацию для разных AI моделей \[4b\], обработку фидбека \[6c\] и интеграцию в основной процесс решения \[5b\].

1

Генерация промптов для Claude

Создание user и system промптов на основе контекста задачи. See guide

AI generated guide

## Motivation

Система нуждается в способе **управлять поведением AI** при решении задач GitHub. Без структурированных промптов AI может действовать непоследовательно, пропустить важные шаги или создавать некачественные решения. Промпты гарантируют, что AI следует проверенной методологии для каждого типа задач.

## Details

### Двухуровневая архитектура промптов

Система использует **user промпт** \[1a\] для контекста задачи и **system промпт** \[1c\] для инструкций поведения. User промпт динамически включает URL задачи, имя ветки и рабочую директорию, адаптируясь к конкретной ситуации.

### Адаптивное мышление

Промпты поддерживают **четыре уровня мышления** \[1b\] — от базового "Think" до интенсивного "Ultrathink". Это позволяет регулировать глубину анализа AI в зависимости от сложности задачи.

### Структурированная методология

System промпт определяет **пять фаз работы** \[1c\]:

1.  **Общие руководства** — сохранение логов, фоновые команды
2.  **Начальное исследование** — анализ issue, поиск кода
3.  **Разработка решения** — атомарные коммиты, тестирование
4.  **Подготовка PR** — следование гайдлайнам, финализация
5.  **Рабочий процесс** — управление ветками, историей коммитов

Каждая фаза содержит **конкретные инструкции "When...then"** \[1c\], которые направляют AI в различных сценариях, обеспечивая последовательное и надежное решение задач.

1a

Функция построения user промпта

claude.prompts.lib.mjs:11

export const buildUserPrompt = (params) => {

Добавление основной информации

URL задачи

Имя ветки

Рабочая директория

Обработка уровней мышления

1b

Уровни мышления

claude.prompts.lib.mjs:76

const thinkMessages = { low: 'Think.', medium: 'Think hard.', high: 'Think harder.', max: 'Ultrathink.' };

Финальная инструкция

1c

Функция построения system промпта

claude.prompts.lib.mjs:97

export const buildSystemPrompt = (params) => {

1d

Базовая личность AI

claude.prompts.lib.mjs:113

return \`You are an AI issue solver. You prefer to find the root cause...${thinkLine}

Общие руководства

Сохранение логов

Фоновые команды sudo

Протокол расследования CI

Начальное исследование

Чтение деталей issue

Поиск связанного кода

Разработка решения

Атомарные коммиты

Тестирование

Подготовка PR

Следование гайдлайнам

Финализация

Рабочий процесс

Работа с ветками

Сохранение истории

2

Выполнение промптов в Claude

Передача сгенерированных промптов в Claude CLI. See guide

AI generated guide

# Motivation

Системе нужно **автоматически генерировать инструкции** для AI моделей, которые решают задачи разработки. Без этого каждый раз пришлось бы вручную писать промпты, что невозможно при масштабной обработке сотен issues. Промпты должны адаптироваться под контекст конкретной задачи, режим работы (новая задача или продолжение) и уровень глубины мышления \[2b\].

# Details

Процесс начинается с **импорта функций генерации** \[2a\], которые создают два типа промптов:

-   **User промпт** содержит контекст задачи: URL issue, ветка, директория работы, информация о форке и фидбэк \[2b\]
-   **System промпт** определяет поведение AI: инструкции по работе с CI, git, тестированием и т.д. \[2c\]

После генерации промпты **экранируются** для безопасной передачи в shell \[2d\], затем формируется команда Claude с параметрами модели и переданными промптами. Система поддерживает разные уровни мышления от "Think" до "Ultrathink" \[2b\], что позволяет контролировать глубину анализа AI.

**Ключевая инновация** - промпты генерируются динамически на основе реального контекста репозитория, а не являются статическими шаблонами.

2a

Импорт функций промптов

claude.lib.mjs:411

const { buildUserPrompt, buildSystemPrompt } = await import('./claude.prompts.lib.mjs');