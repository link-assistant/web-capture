[![npm](https://img.shields.io/npm/v/command-stream.svg)](https://npmjs.com/command-stream)
[![JavaScript CI](https://github.com/link-foundation/command-stream/actions/workflows/js.yml/badge.svg)](https://github.com/link-foundation/command-stream/actions/workflows/js.yml)
[![License](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://github.com/link-foundation/command-stream/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/link-foundation/command-stream?style=social)](https://github.com/link-foundation/command-stream/stargazers)

[![Open in Gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-f29718?logo=gitpod)](https://gitpod.io/#https://github.com/link-foundation/command-stream)
[![Open in GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Open-181717?logo=github)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=link-foundation/command-stream)

# [command-$tream](https://github.com/link-foundation/command-stream)

$treamable commands executor

A modern $ shell utility library with streaming, async iteration, and EventEmitter support, optimized for Bun runtime.

<img width="2752" height="1344" alt="ray-so-export" src="https://github.com/user-attachments/assets/***" />

## Features

- 🐚 **Shell-like by Default**: Commands behave exactly like running in terminal (stdout→stdout, stderr→stderr, stdin→stdin)
- 🎛️ **Fully Controllable**: Override default behavior with options (`mirror`, `capture`, `stdin`)
- 🚀 **Multiple Usage Patterns**: Classic await, async iteration, EventEmitter, .pipe() method, and mixed patterns
- 📡 **Real-time Streaming**: Process command output as it arrives, not after completion
- 🔄 **Bun Optimized**: Designed for Bun runtime with Node.js compatibility
- ⚡ **Performance**: Memory-efficient streaming prevents large buffer accumulation
- 🎯 **Bun.$ Everywhere**: the full Bun Shell API as `command-stream/bun` (or `$.bun`) on Node.js, Bun and Deno, tested with Bun's own tests ([guide](docs/BUN_SHELL.md))
- 🔧 **Built-in Commands**: 26 essential commands work identically across platforms
- 🆔 **Process Identity**: Read the process id with `command.pid`, before, during and after the run
- 🔄 **Migration**: [Cross-spawn guide for JavaScript and Rust](docs/CROSS_SPAWN_MIGRATION.md); zx scripts run unchanged via `$.zx`, `command-stream/zx` or `#!/usr/bin/env command-stream`, with all 291 zx test units ported ([zx guide](docs/ZX_MIGRATION.md)); Execa 10.1.0 runs via `command-stream/execa`, `$.execa` and `$.execaCompat()` ([guide and runtime limits](docs/EXECA_MIGRATION.md))
- 🟦 **TypeScript**: Bundled strict declarations for ESM and CommonJS, with typed events, streams, pipelines and virtual commands ([guide and Rust mapping](docs/TYPESCRIPT.md))

## Comparison with Other Libraries

| Feature                        | [**command-stream**](https://github.com/link-foundation/command-stream)                                 | [**execa**](https://github.com/sindresorhus/execa)                                    | [**cross-spawn**](https://github.com/moxystudio/node-cross-spawn)                                 | [**Bun.$**](https://github.com/oven-sh/bun)                | [**ShellJS**](https://github.com/shelljs/shelljs)                                         | [**zx**](https://github.com/google/zx)                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **📦 NPM Package**             | [![npm](https://img.shields.io/npm/v/command-stream.svg)](https://www.npmjs.com/package/command-stream) | [![npm](https://img.shields.io/npm/v/execa.svg)](https://www.npmjs.com/package/execa) | [![npm](https://img.shields.io/npm/v/cross-spawn.svg)](https://www.npmjs.com/package/cross-spawn) | N/A (Built-in)                                             | [![npm](https://img.shields.io/npm/v/shelljs.svg)](https://www.npmjs.com/package/shelljs) | [![npm](https://img.shields.io/npm/v/zx.svg)](https://www.npmjs.com/package/zx) |
| **⭐ GitHub Stars**            | [**⭐ 2** (Please ⭐ us!)](https://github.com/link-foundation/command-stream)                           | [⭐ 7,264](https://github.com/sindresorhus/execa)                                     | [⭐ 1,149](https://github.com/moxystudio/node-cross-spawn)                                        | [⭐ 80,169](https://github.com/oven-sh/bun) (Full Runtime) | [⭐ 14,375](https://github.com/shelljs/shelljs)                                           | [⭐ 44,569](https://github.com/google/zx)                                       |
| **📊 Monthly Downloads**       | **893** (New project!)                                                                                  | **381M**                                                                              | **409M**                                                                                          | N/A (Built-in)                                             | **35M**                                                                                   | **4.2M**                                                                        |
| **📈 Total Downloads**         | **Growing**                                                                                             | **6B+**                                                                               | **5.4B**                                                                                          | N/A (Built-in)                                             | **596M**                                                                                  | **37M**                                                                         |
| **Runtime Support**            | ✅ Bun + Node.js (+ Deno for `command-stream/bun`)                                                      | ✅ Node.js                                                                            | ✅ Node.js                                                                                        | 🟡 Bun only                                                | ✅ Node.js                                                                                | ✅ Node.js                                                                      |
| **Template Literals**          | ✅ `` $`cmd` ``                                                                                         | ✅ `` $`cmd` ``                                                                       | ❌ Function calls                                                                                 | ✅ `` $`cmd` ``                                            | ❌ Function calls                                                                         | ✅ `` $`cmd` ``                                                                 |
| **Real-time Streaming**        | ✅ Live output                                                                                          | 🟡 Limited                                                                            | ✅ Native ChildProcess stdout/stderr streams                                                      | ❌ Buffer only                                             | ❌ Buffer only                                                                            | ❌ Buffer only                                                                  |
| **Synchronous Execution**      | ✅ `.sync()` with events                                                                                | ✅ `execaSync`                                                                        | ✅ `spawnSync`                                                                                    | ❌ No                                                      | ✅ Sync by default                                                                        | ❌ No                                                                           |
| **Async Iteration**            | ✅ `for await (chunk of $.stream())`                                                                    | ❌ No                                                                                 | ✅ Node readable streams support async iteration                                                  | ❌ No                                                      | ❌ No                                                                                     | ✅ Stdout lines: ``for await (const line of $`cmd`)``                           |
| **EventEmitter Pattern**       | ✅ `.on('data', ...)`                                                                                   | 🟡 Limited events                                                                     | ✅ Native ChildProcess and stream events                                                          | ❌ No                                                      | ❌ No                                                                                     | ❌ No                                                                           |
| **Mixed Patterns**             | ✅ Events + await/sync                                                                                  | ❌ No                                                                                 | ❌ No                                                                                             | ❌ No                                                      | ❌ No                                                                                     | ❌ No                                                                           |
| **Bun.$ Compatibility**        | ✅ **Full API** in [`command-stream/bun`](docs/BUN_SHELL.md), tested with Bun's own tests               | ❌ No                                                                                 | ❌ No                                                                                             | ✅ Native API                                              | ❌ No                                                                                     | ❌ No                                                                           |
| **Shell Injection Protection** | ✅ Smart auto-quoting                                                                                   | ✅ Safe by default                                                                    | ✅ Safe by default                                                                                | ✅ Built-in                                                | 🟡 Manual escaping                                                                        | ✅ Safe by default                                                              |
| **Cross-platform**             | ✅ macOS/Linux/Windows                                                                                  | ✅ Yes                                                                                | ✅ **Specialized** cross-platform                                                                 | ✅ Yes                                                     | ✅ Yes                                                                                    | ✅ Yes                                                                          |
| **Performance**                | [Measured](benchmarks/README.md)                                                                        | [Measured](benchmarks/README.md)                                                      | [Measured](benchmarks/README.md)                                                                  | [Measured](benchmarks/README.md)                           | [Measured](benchmarks/README.md)                                                          | [Measured](benchmarks/README.md)                                                |
| **Memory Efficiency**          | [Measured](benchmarks/README.md)                                                                        | [Measured](benchmarks/README.md)                                                      | [Measured](benchmarks/README.md)                                                                  | [Measured](benchmarks/README.md)                           | [Measured](benchmarks/README.md)                                                          | [Measured](benchmarks/README.md)                                                |
| **Error Handling**             | ✅ Configurable (`set -e`/`set +e`, non-zero OK by default)                                             | ✅ Throws on error                                                                    | ❌ Basic (exit codes)                                                                             | ✅ Throws on error                                         | ✅ Configurable                                                                           | ✅ Throws on error                                                              |
| **Shell Settings**             | ✅ `set -e`/`set +e` equivalent                                                                         | ❌ No                                                                                 | ❌ No                                                                                             | ❌ No                                                      | 🟡 Limited (`set()`)                                                                      | ❌ No                                                                           |
| **Stdout Support**             | ✅ Real-time streaming + events                                                                         | ✅ Node.js streams + interleaved                                                      | ✅ Inherited/buffered                                                                             | ✅ Shell redirection + buffered                            | ✅ Direct output                                                                          | ✅ Readable streams + `.pipe.stdout`                                            |
| **Stderr Support**             | ✅ Real-time streaming + events                                                                         | ✅ Streams + interleaved output                                                       | ✅ Inherited/buffered                                                                             | ✅ Redirection + `.quiet()` access                         | ✅ Error output                                                                           | ✅ Readable streams + `.pipe.stderr`                                            |
| **Stdin Support**              | ✅ string/Buffer/inherit/ignore                                                                         | ✅ Input/output streams                                                               | ✅ Full stdio support                                                                             | ✅ Pipe operations                                         | 🟡 Basic                                                                                  | ✅ Basic stdin                                                                  |
| **Built-in Commands**          | ✅ **26 commands**: cat, ls, mkdir, rm, mv, cp, touch, basename, dirname, seq, yes + all Bun.$ commands | ❌ Uses system                                                                        | ❌ Uses system                                                                                    | ✅ echo, cd, etc.                                          | ✅ **20+ commands**: cat, ls, mkdir, rm, mv, cp, etc.                                     | ❌ Uses system                                                                  |
| **Virtual Commands Engine**    | ✅ **Revolutionary**: Register JavaScript functions as shell commands with full pipeline support        | ❌ No custom commands                                                                 | ❌ No custom commands                                                                             | ❌ No extensibility                                        | ❌ No custom commands                                                                     | ❌ No custom commands                                                           |
| **Pipeline/Piping Support**    | ✅ **Advanced**: System + Built-ins + Virtual + Mixed + `.pipe()` method                                | ✅ Programmatic `.pipe()` + multi-destination                                         | ✅ Child streams can be piped                                                                     | ✅ Standard shell piping                                   | ✅ Shell piping + `.to()` method                                                          | ✅ Shell piping + `.pipe()` method                                              |
| **Bundle Size**                | [Measured](benchmarks/README.md)                                                                        | [Measured](benchmarks/README.md)                                                      | [Measured](benchmarks/README.md)                                                                  | [Measured](benchmarks/README.md)                           | [Measured](benchmarks/README.md)                                                          | [Measured](benchmarks/README.md)                                                |
| **Signal Handling**            | ✅ **Advanced SIGINT/SIGTERM forwarding** with cleanup                                                  | 🟡 Basic                                                                              | ✅ **Excellent** cross-platform                                                                   | 🟡 Basic                                                   | 🟡 Basic                                                                                  | 🟡 Basic                                                                        |
| **Process Management**         | ✅ **Robust child process lifecycle** with proper termination                                           | ✅ Good                                                                               | ✅ **Excellent** spawn wrapper                                                                    | ❌ Basic                                                   | 🟡 Limited                                                                                | 🟡 Limited                                                                      |
| **Debug Tracing**              | ✅ **Comprehensive VERBOSE logging** for CI/debugging                                                   | 🟡 Limited                                                                            | ❌ No                                                                                             | ❌ No                                                      | 🟡 Basic                                                                                  | ❌ No                                                                           |
| **Test Coverage**              | ✅ **518+ tests, 1165+ assertions**                                                                     | ✅ Excellent                                                                          | ✅ Good                                                                                           | 🟡 Good coverage                                           | ✅ Good                                                                                   | 🟡 Good                                                                         |
| **CI Reliability**             | ✅ **Platform-specific handling** (macOS/Ubuntu)                                                        | ✅ Good                                                                               | ✅ **Excellent**                                                                                  | 🟡 Basic                                                   | ✅ Good                                                                                   | 🟡 Basic                                                                        |
| **Documentation**              | ✅ **Comprehensive examples + guides**                                                                  | ✅ Excellent                                                                          | 🟡 Basic                                                                                          | ✅ Good                                                    | ✅ Good                                                                                   | 🟡 Limited                                                                      |
| **TypeScript**                 | ✅ **Bundled strict declarations** (ESM + CommonJS), typed events, streams and virtual commands         | ✅ Full support                                                                       | ✅ Built-in                                                                                       | ✅ Built-in                                                | 🟡 Community types                                                                        | ✅ Full support                                                                 |
| **License**                    | ✅ **Unlicense (Public Domain)**                                                                        | 🟡 MIT                                                                                | 🟡 MIT                                                                                            | 🟡 MIT (+ LGPL dependencies)                               | 🟡 BSD-3-Clause                                                                           | 🟡 Apache 2.0                                                                   |

Performance, memory, and package-size values depend on the runtime and host.
Use the [reproducible benchmark playground](benchmarks/README.md) for measured
same-host comparisons, raw statistics, and an interactive report rather than
static estimates.

**📊 Popularity & Adoption:**

- **⭐ GitHub Stars:** [Bun: 80,169](https://github.com/oven-sh/bun) • [zx: 44,569](https://github.com/google/zx) • [ShellJS: 14,375](https://github.com/shelljs/shelljs) • [execa: 7,264](https://github.com/sindresorhus/execa) • [cross-spawn: 1,149](https://github.com/moxystudio/node-cross-spawn) • [**command-stream: 2 ⭐ us!**](https://github.com/link-foundation/command-stream)
- **📈 Total Downloads:** [execa: 6B+](https://www.npmjs.com/package/execa) • [cross-spawn: 5.4B](https://www.npmjs.com/package/cross-spawn) • [ShellJS: 596M](https://www.npmjs.com/package/shelljs) • [zx: 37M](https://www.npmjs.com/package/zx) • [command-stream: Growing](https://www.npmjs.com/package/command-stream)
- **📊 Monthly Downloads:** [cross-spawn: 409M](https://www.npmjs.com/package/cross-spawn) • [execa: 381M](https://www.npmjs.com/package/execa) • [ShellJS: 35M](https://www.npmjs.com/package/shelljs) • [zx: 4.2M](https://www.npmjs.com/package/zx) • [command-stream: 893 (growing!)](https://www.npmjs.com/package/command-stream)

**⭐ Help Us Grow!** If command-stream's **revolutionary virtual commands** and **advanced streaming capabilities** help your project, [**please star us on GitHub**](https://github.com/link-foundation/command-stream) to help the project grow!

### Tracked compatibility corpus

The comparison tests also track Node.js `child_process`, `Deno.Command`, Dax,
`@david/shell`, nano-spawn, `@actions/exec`, and cross-env. All twelve upstream sources are pinned to immutable
commits. Portable public behavior runs against command-stream, while unsupported
capabilities and inapplicable competitor-specific tests are accounted for in the
[competitor test corpus audit](docs/COMPETITOR_TEST_AUDIT.md).

Run the focused executable corpus with `bun run test:competitors`.

### Why Choose command-stream?

- **🆓 Truly Free**: **Unlicense (Public Domain)** - No restrictions, no attribution required, use however you want
- **🚀 Revolutionary Virtual Commands**: **World's first** fully customizable virtual commands engine - register JavaScript functions as shell commands!
- **🔗 Advanced Pipeline System**: **Only library** where virtual commands work seamlessly in pipelines with built-ins and system commands
- **🔧 Built-in Commands**: **18 essential commands** work identically across all platforms - no system dependencies!
- **📡 Real-time Processing**: Typed stdout, stderr, and exit chunks through async iteration
- **🔄 Flexible Patterns**: Multiple usage patterns (await, events, iteration, mixed)
- **🐚 Shell Replacement**: Dynamic error handling with `set -e`/`set +e` equivalents for .sh file replacement
- **⚡ Bun Optimized**: Designed for Bun with Node.js fallback compatibility
- **💾 Memory Efficient**: Streaming prevents large buffer accumulation
- **🛡️ Production Ready**: **518+ tests, 1165+ assertions** with comprehensive coverage including CI reliability
- **🎯 Advanced Signal Handling**: Robust SIGINT/SIGTERM forwarding with proper child process cleanup
- **🔍 Debug-Friendly**: Comprehensive VERBOSE tracing for CI debugging and troubleshooting

## Built-in Commands (🚀 NEW!)

command-stream includes **26 built-in commands** with portable option subsets, providing cross-platform shell scripting without external command dependencies:

### 📁 **File System Commands**

- `cat` - Read and display file contents
- `ls` - List directory contents (supports `-l`, `-a`, `-A`)
- `mkdir` - Create directories (supports `-p` recursive)
- `rm` - Remove files/directories (supports `-r`, `-f`)
- `mv` / `cp` - Move or copy files/directories (`cp` supports `-r` recursive)
- `touch` - Create files or update timestamps

### Text Commands

- `head` / `tail` - Select the first or last lines (supports `-n N`)
- `sort` - Sort lines (supports `-r`, `-n`, `-u`)
- `uniq` - Filter consecutive duplicate lines (supports `-c`, `-d`, `-u`, `-i`)

### 🔧 **Utility Commands**

- `basename` / `dirname` - Extract filename or directory from a path
- `seq` / `yes` - Generate number sequences or repeatedly output a string
- `tee` - Copy input to stdout and to files (supports `-a`, `-i`)

### ⚡ **System Commands**

- `cd` / `pwd` - Change or print the working directory
- `echo` - Print arguments (supports `-n`)
- `sleep` / `true` / `false` - Wait or return success/failure
- `which` / `exit` - Locate commands or return an exit code
- `env` / `test` - Print environment variables or test file conditions

### ✨ **Key Advantages**

Native commands use JavaScript APIs across Windows, macOS and Linux, support pipelines, and respect `cwd` and `env`. They report failures through exit codes and stderr; for example, `rm` requires `-r` for directories. See the [migration guide](./docs/SHELLJS_MIGRATION.md) for text-command option and streaming limits.

```javascript
import { $ } from 'command-stream';

// All these work without any system dependencies!
await $`mkdir -p project/src`;
await $`touch project/src/index.js`;
await $`echo "console.log('Hello!');" > project/src/index.js`;
await $`ls -la project/src`;
await $`cat project/src/index.js`;
await $`cp -r project project-backup`;
await $`rm -r project-backup`;

// Mix built-ins with pipelines and virtual commands
await $`seq 1 5 | cat > numbers.txt`;
await $`basename /path/to/file.txt .txt`; // → "file"
```

### 🔀 `tee`: splitting a pipeline

`tee` copies its input to stdout and to every file it is given, so a pipeline
can be recorded and kept flowing at the same time. It follows GNU coreutils:
`-a`/`--append` appends instead of truncating, `-i`/`--ignore-interrupts`
keeps writing when the pipeline is cancelled, `--` ends option parsing, and a
bare `-` is a file named `-` rather than stdout.

```javascript
// Record a step without consuming it
await $`echo "deploying" | tee deploy.log | cat`;

// Fan out to several files, appending to each
await $`echo "second run" | tee -a deploy.log audit.log`;
```

A write failure is reported on stderr and sets exit code 1, but the remaining
files are still written and the input still reaches stdout, exactly as
coreutils does.

**On interactive use:** built-in commands receive their stdin as one completed
buffer, because a pipeline reads each upstream stage to the end before handing
the result on. So this `tee` is a pipeline stage, not a live terminal filter --
it cannot echo keystrokes back as you type them. The `interactive: true` option
applies to spawned system processes; for a live `tee`, disable virtual commands
and let the system binary run.

## ShellJS compatibility

`$.shelljs`, the named `shelljs` export and `command-stream/shelljs` retain the pinned ShellJS 0.10.0 API. The [migration guide](./docs/SHELLJS_MIGRATION.md) covers every command, native streaming, Rust counterparts and benchmarks.

## Installation

```bash
# Using npm
npm install command-stream

# Using bun
bun add command-stream
```

### Lightweight ProcessRunner entry point

Consumers that only need direct process execution can import `ProcessRunner`
without loading the optional PTY, terminal rendering, SVG, or GIF modules:

```javascript
import { ProcessRunner } from 'command-stream/process-runner';

const runner = new ProcessRunner(
  { mode: 'exec', file: 'git', args: ['status', '--short'] },
  { mirror: false, capture: true, stdin: 'ignore' }
);
const result = await runner;
```

The main `command-stream` entry point remains the supported import for `$` and
terminal capture features.

## Module Formats (ESM and CommonJS)

The package ships both entry points and they resolve automatically:

| Host     | Resolved entry | How to load                           |
| -------- | -------------- | ------------------------------------- |
| ESM      | `src/$.mjs`    | `import { $ } from 'command-stream'`  |
| CommonJS | `src/$.cjs`    | `const $ = require('command-stream')` |

```javascript
// CommonJS: the exported value is the $ tagged template itself,
// with every named export attached to it.
const $ = require('command-stream');
const { sh, run, ProcessRunner, shell } = require('command-stream');

const result = $({ mirror: false })`echo hello`.sync();
console.log(result.stdout.trim()); // "hello"
```

Both entry points load the same module instance, so virtual command
registrations, shell settings, and cleanup state are shared no matter how the
package was loaded.

`require('command-stream')` needs a runtime with `require(esm)` support:
Node.js >= 22.12.0, or Bun. On older Node.js versions the
package throws an explicit error asking you to upgrade or to use
`await import('command-stream')` instead.

## Smart Quoting & Security

Command-stream provides intelligent auto-quoting to protect against shell injection while avoiding unnecessary quotes for safe strings:

### Smart Quoting Behavior

```javascript
import { $ } from 'command-stream';

// Safe strings are NOT quoted (performance optimization)
await $`echo ${name}`; // name = "hello" → echo hello
await $`${cmd} --version`; // cmd = "/usr/bin/node" → /usr/bin/node --version

// Dangerous strings are automatically quoted for safety
await $`echo ${userInput}`; // userInput = "test; rm -rf /" → echo 'test; rm -rf /'
await $`echo ${pathWithSpaces}`; // pathWithSpaces = "/my path/file" → echo '/my path/file'

// Special characters that trigger auto-quoting:
// Spaces, $, ;, |, &, >, <, `, *, ?, [, ], {, }, (, ), !, #, and others

// Quote characters inside a value are data, never shell syntax
const quotedPath = "'/path with spaces/file'";
await $`cat ${quotedPath}`; // → cat with the argument: '/path with spaces/file'

const doubleQuoted = '"/path with spaces/file"';
await $`cat ${doubleQuoted}`; // → cat with the argument: "/path with spaces/file"
```

### Paths With Spaces

An interpolated value always becomes **exactly one argument**, spaces and all —
the same guarantee you get from `"$path"` in a shell script, and the same
behavior as Bun's `$`, zx, and execa:

```javascript
const file = '/Users/john/My Documents/report.txt';

await $`cat ${file}`; // one argument: /Users/john/My Documents/report.txt
await $`cp ${file} ${'/tmp/My Backups/'}`; // both paths stay intact
await $`ls -la ${'/Applications/Visual Studio Code.app'}`;
```

Do **not** pre-quote the path yourself. Quote characters you put in the value
are literal characters of the file name, exactly as `sh` treats them:

```javascript
// ❌ looks for a file whose name literally starts and ends with a quote
await $`cat ${`'${file}'`}`;

// ✅ just interpolate the path
await $`cat ${file}`;
```

**Opting out.** Before v0.21 a value that started and ended with a matching
quote was spliced into the command as shell syntax instead of being quoted.
That diverged from `sh` and could produce unrunnable commands: the value
`"it's"` was emitted as `'"it's"'`, an unterminated string. If you depend on
the old behavior:

```javascript
import { shell, setPreQuotedPassthroughEnabled } from 'command-stream';

shell.preQuotedPassthrough(true); // or: setPreQuotedPassthroughEnabled(true)
shell.preQuotedPassthrough(false); // back to sh-like quoting
setPreQuotedPassthroughEnabled(null); // follow the environment again
```

Or set `COMMAND_STREAM_PREQUOTED_PASSTHROUGH=1` for a whole process. Even then
only _balanced_ values are passed through, so a value like `"a" ; rm -rf / ; "b"`
is still quoted rather than executed.

### Interpolating Inside Your Own Quotes

Quoting is context-aware: an interpolated value is quoted only where a quote is
actually needed. When you wrote the quotes yourself, the value is spliced in as
escaped literal text, exactly like `"$var"` in a POSIX shell.

```javascript
// Outside quotes: the value is quoted for you
await $`echo ${'hello world'}`; // → echo 'hello world'

// Inside your own double quotes: spliced in like "$var"
const script = 'for f in *.js; do echo "Processing: $f"; done';
await $`bash -c "${script}"`; // → bash -c "for f in *.js; do echo \"Processing: \$f\"; done"

// Inside your own single quotes: spliced in like '...', apostrophes escaped
await $`echo '${"it's here"}'`; // → echo 'it'\''s here'
```

Template quotes and quote characters inside a value are intentionally
different (issue #45):

```javascript
const value = 'hello world';
await $`echo "${value}"`; // author-written quotes group one argument

const preQuoted = '"hello world"';
await $`echo ${preQuoted}`; // the quote characters are part of the argument
```

The second form follows `"$var"` in `sh`, Bun's `$`, zx, and execa: an
interpolated value is data, so quote characters are preserved instead of being
reinterpreted as shell syntax. Remove the quotes from the value when they are
not part of the intended argument. Code that relied on the pre-v0.21 behavior
can opt into `shell.preQuotedPassthrough(true)` as described above.

This matches how the same line behaves in `sh`, and it is what fixes the classic
`bash -c "${cmd}"` failure, where the extra quotes used to turn the whole script
into a single unrunnable word (issue #49).

Splicing is still injection-safe: a value cannot end a quote or start a new
command, because every character the shell would interpret is escaped.

```javascript
const evil = '"; rm -rf /; echo "';
await $`bash -c "echo ${evil}"`; // prints the text; no second command runs
```

The behavior of `raw()` and `literal()` is unchanged — `raw()` still inserts its
value verbatim, and `literal()` still preserves apostrophes.

**Opting out.** If you depend on the previous behavior of always quoting every
value, turn context-aware quoting off:

```javascript
import { shell, setQuoteContextEnabled } from 'command-stream';

shell.quoteContext(false); // or: setQuoteContextEnabled(false)
shell.quoteContext(true); // back on
setQuoteContextEnabled(null); // follow the environment again
```

Or set `COMMAND_STREAM_QUOTE_CONTEXT=0` in the environment to disable it for a
whole process without touching code.

### JSON and Other Structured Arguments

Pass serialized data directly. Every interpolation is one literal argument, so
JSON quotes, apostrophes, dollar signs, backticks, backslashes, whitespace, and
Unicode remain data instead of becoming shell syntax:

```javascript
const json = JSON.stringify({
  message: 'She said "hello"',
  path: 'C:\\Program Files\\app',
  template: '$HOME and `date`',
});

await $`some-cli --payload ${json}`;
```

Do not pre-quote the value or replace `"` with `\\"`. Those added quote or
backslash characters are caller data and are intentionally preserved, matching
the literal-argument behavior of `"$value"` in `sh`, Bun's `$`, zx, and
Execa.

For byte-exact redirection, use a constant `printf` format string and put the
JSON in a separate argument:

```javascript
const outputFile = 'config.json';
await $`printf '%s' ${json} > ${outputFile}`;
```

`echo` appends a newline and its backslash handling varies between shells, so
it is not a byte-preserving serialization primitive. If no external command is
needed, avoid a shell and use `fs.writeFile(outputFile, json)`.

No JSON-specific mode is needed: automatic interpolation already provides the
safe, unsurprising literal contract. The
`COMMAND_STREAM_PREQUOTED_PASSTHROUGH` and
`COMMAND_STREAM_QUOTE_CONTEXT` switches remain available only for legacy
general quoting compatibility.

### Multiline Text and Exact File Writes

Interpolated multiline strings stay one literal argument. Their backticks,
dollar signs, quotes, backslashes, and newlines are data rather than shell
syntax:

```javascript
const outputFile = 'generated.md';
const content = `# Generated

Literal: \`code\`, $HOME, \${name}, "quotes", and C:\\Tools`;
await $`printf '%s' ${content} > ${outputFile}`;
```

`echo` still adds its normal trailing newline. Prefer `printf '%s'` when the
file must match the string exactly, or pass large text through the `stdin`
option. Use `fs.writeFile` for binary data. See
[`examples/multiline-content.mjs`](examples/multiline-content.mjs) for both
text-writing patterns.

### GitHub CLI Markdown Bodies

Pass a generated issue body directly, without adding quotes or escaping the
Markdown yourself. Fenced code, inline backticks, `${...}` text, shell-looking
syntax, quotes, backslashes, newlines, and Unicode all stay in one literal
`--body` argument:

```javascript
const title = 'Bug report';
const body = `## Reproduction

\`\`\`javascript
const message = \`literal \${value}\`;
\`\`\`

$HOME and $(whoami) are documentation, not shell syntax.`;

await $`gh issue create --repo ${repository} --title ${title} --body ${body}`;
```

Author-written quotes are also context-aware, so `--body "${body}"` has the
same one-argument result with the default configuration. The unquoted form is
simpler and remains safe if legacy code opts out of context-aware quoting with
`COMMAND_STREAM_QUOTE_CONTEXT=0`.

When the body already comes from a file, GitHub CLI's native `--body-file`
option avoids loading it into an argument. `-` reads from standard input:

```javascript
await $({
  stdin: body,
})`gh issue create --repo ${repository} --title ${title} --body-file -`;
```

Neither form requires a GitHub-specific escaping helper. See
[`examples/github-cli-markdown-body.mjs`](examples/github-cli-markdown-body.mjs)
for a runnable example of both modes.

### Go templates & `{{ }}` arguments

`command-stream` gives you a real shell's word-splitting, including for tokens
you type **literally** in the template. That means a Go/Docker template flag
like `--format {{json .Config.Env}}` behaves exactly as it would in `bash`: the
**unquoted space** inside `{{ }}` splits the token into separate words, so the
child process receives a broken `--format` value (e.g. Docker reports
`template parsing error: ... unclosed action`).

The rule is simple — **quote template tokens that contain spaces**, just like
you would in a shell script:

```javascript
import { $ } from 'command-stream';

// ❌ BREAKS — the unquoted space splits the token into 3 argv words:
//   `--format`, `{{json`, `.Config.Env}}`
await $`docker image inspect alpine --format {{json .Config.Env}}`;

// ✅ WORKS — a token with no space stays a single word
await $`docker image inspect alpine --format {{.Id}}`;

// ✅ WORKS — single-quote the template (recommended, mirrors shell scripts)
await $`docker image inspect alpine --format '{{json .Config.Env}}'`;

// ✅ WORKS — double quotes work too
await $`docker image inspect alpine --format "{{json .Config.Env}}"`;

// ✅ WORKS — interpolate the whole template as one ${value}; it is
//   auto-quoted and always reaches the child as a single argument
const format = '{{json .Config.Env}}';
await $`docker image inspect alpine --format ${format}`;

// ✅ WORKAROUND — drop --format and parse the full JSON in JS
const all = await $`docker image inspect alpine`;
const env = JSON.parse(all.stdout)[0].Config.Env;
```

To help diagnose the broken case, `command-stream` prints a one-line warning to
stderr when a built command contains an **unquoted** `{{ … }}` token with an
internal space (the warning fires once per unique token). Silence it by setting
the `COMMAND_STREAM_NO_TEMPLATE_WARNING=1` environment variable.

> Note: a token whose space is already **quoted** (`'{{json .Config.Env}}'`) or
> supplied via interpolation (`${format}`) is passed through untouched — no
> splitting, no warning.

### Shell Injection Protection

All interpolated values are automatically secured:

```javascript
// ✅ SAFE - All these injection attempts are neutralized
const dangerous = "'; rm -rf /; echo '";
await $`echo ${dangerous}`; // → echo ''\'' rm -rf /; echo '\'''

const cmdSubstitution = '$(whoami)';
await $`echo ${cmdSubstitution}`; // → echo '$(whoami)' (literal text, not executed)

const varExpansion = '$HOME';
await $`echo ${varExpansion}`; // → echo '$HOME' (literal text, not expanded)

// ✅ SAFE - Even complex injection attempts
const complex = '`cat /etc/passwd`';
await $`echo ${complex}`; // → echo '`cat /etc/passwd`' (literal text)
```

### Disabling Auto-Escape (Advanced)

**⚠️ WARNING: Use with extreme caution! Only use `raw()` with trusted input to prevent shell injection attacks.**

For advanced use cases where you need to use command strings directly without auto-escaping, use the `raw()` function:

```javascript
import { $, raw } from 'command-stream';

// ⚠️ DANGEROUS - Bypasses all safety checks
const userCommand = 'echo "hello" && ls -la';
await $`${raw(userCommand)}`; // → Executes: echo "hello" && ls -la

// ✅ Safe use case: Trusted command templates
const trustedCommand = 'git log --oneline --graph --all';
await $`${raw(trustedCommand)}`;

// ✅ Combining raw with safe interpolation
const branch = 'main'; // User input - will be auto-quoted
await $`${raw('git log --oneline')} ${branch}`;
// → git log --oneline 'main' (raw part unescaped, branch safely quoted)

// 🎯 Use case: Pre-built command strings from configuration
const config = {
  backupCommand: 'tar -czf backup.tar.gz --exclude="*.log" .',
  cleanCommand: 'find . -name "*.tmp" -delete',
};
await $`${raw(config.backupCommand)}`;

// ⚠️ NEVER use raw() with user input
const userInput = req.body.command; // ❌ DANGEROUS!
await $`${raw(userInput)}`; // ❌ Shell injection vulnerability!

// ✅ Instead, use normal interpolation for user input
await $`echo ${userInput}`; // ✅ Safe - auto-escaped
```

**When to use `raw()`:**

- ✅ Trusted command templates from your codebase
- ✅ Configuration files you control
- ✅ Hardcoded command strings
- ✅ Complex shell operators that need to be preserved

**When NOT to use `raw()`:**

- ❌ User input (form fields, API parameters, CLI arguments)
- ❌ External data (database, API responses, files)
- ❌ Any untrusted source
- ❌ When you're unsure - use normal interpolation instead

## Usage Patterns

### Classic Await (Backward Compatible)

```javascript
import { $ } from 'command-stream';

const result = await $`ls -la`;
console.log(result.stdout.toString());
console.log(result.code); // exit code
console.log(result.exitCode); // alias for result.code
console.log(result.signal); // terminating signal name, or null
```

Errors thrown in `errexit` mode carry `code` and `exitCode` for compatibility with
Node.js, Execa, zx, nano-spawn, and Bun Shell. See
[signal termination](./docs/SIGNAL_TERMINATION.md) for nonzero statuses and signal fields.

### Custom Options with $({ options }) Syntax (NEW!)

```javascript
import { $ } from 'command-stream';

// Create a $ with custom options
const $silent = $({ mirror: false, capture: true });
const result = await $silent`echo "quiet operation"`;

// Options for stdin handling
const $withInput = $({ stdin: 'input data\n' });
await $withInput`cat`; // Pipes the input to cat

// Custom environment variables
const $withEnv = $({ env: { ...process.env, MY_VAR: 'value' } });
await $withEnv`printenv MY_VAR`; // Prints: value

// Custom working directory
const $inTmp = $({ cwd: '/tmp' });
await $inTmp`pwd`; // Prints: /tmp

// Interactive mode for TTY commands (requires TTY environment)
const $interactive = $({ interactive: true });
await $interactive`vim myfile.txt`; // Full TTY access for editor
await $interactive`less README.md`; // Proper pager interaction

// Combine multiple options
const $custom = $({
  stdin: 'test data',
  mirror: false,
  capture: true,
  cwd: '/tmp',
});
await $custom`cat > output.txt`; // Writes to /tmp/output.txt silently

// Reusable configurations
const $prod = $({ env: { NODE_ENV: 'production' }, capture: true });
await $prod`npm start`;
await $prod`npm test`;
```

### Execution Control (NEW!)

```javascript
import { $ } from 'command-stream';

// Commands don't auto-start when created
const cmd = $`echo "hello"`;

// Three ways to start execution:

// 1. Explicit start with options
cmd.start(); // Default async mode
cmd.start({ mode: 'async' }); // Explicitly async
cmd.start({ mode: 'sync' }); // Synchronous execution

// 2. Convenience methods
cmd.async(); // Same as start({ mode: 'async' })
cmd.sync(); // Same as start({ mode: 'sync' })

// 3. Auto-start by awaiting (always async)
await cmd; // Auto-starts in async mode

// Event handlers can be attached before starting
const process = $`long-command`
  .on('data', (chunk) => console.log('Received:', chunk))
  .on('end', (result) => console.log('Done!'));

// Start whenever you're ready
process.start();
```

### Child Handle and Immediate Cancellation

Reading `child` starts a lazy command and immediately returns a handle. It can
stop the command without awaiting `start()` or waiting for a stream:

```javascript
const process = $`long-running-command`;
const earlyChild = process.child;
earlyChild.kill('SIGTERM');
const result = await process;
console.log(result.code); // 143
```

During asynchronous startup, the early handle's `kill(signal)` cancels pending
startup. Its `pid`, standard streams, status properties, and `native` reference
follow the runtime child after spawn; later `process.child` reads return that
native Node.js or Bun object. Built-ins have no native child, but the handle can
still cancel them. After completion `process.child` is `null`; use `process.pid`
when the process id must survive cleanup.

### Process ID of a Running Command

`pid` is the id of the operating system process behind a command. It is recorded
when the process is spawned, so — unlike `child`, which is released during
cleanup — it stays readable after the command has finished:

```javascript
const cmd = $`/bin/sleep 5`;
cmd.pid; // undefined — nothing has been spawned yet

cmd.start();
await cmd.streams.stdout; // resolves once the child exists
console.log(cmd.pid); // 51234

cmd.kill();
await cmd.catch(() => {});

console.log(cmd.pid); // 51234 — still there
console.log(cmd.child); // null — released by cleanup
```

The same value is reported on every execution path: `await`, `.sync()`,
`.stream()`, and the `streams` getters.

```javascript
const awaited = $`sh -c 'echo done'`;
await awaited;
awaited.pid; // the process that just ran

const blocking = $`sh -c 'echo done'`;
blocking.sync();
blocking.pid; // sync mode records it too
```

#### What the id names

A command string is handed to a shell, so the id names **the shell**, and the
command itself runs as its child:

```console
$ ps -o args= -p 51234
/bin/sh -l -c /bin/sleep 5
```

Do not depend on the wrapper being there. Some shells replace themselves with
the command when the string is a single simple command, in which case the same
id names the command directly. What holds everywhere is that the id names the
process the library spawned to run your command.

The shell is spawned as the leader of its own process group, so the group id
equals the pid. That is what lets `kill()` reach the command underneath the
wrapper (see
[Grandchildren and process groups](#grandchildren-and-process-groups)), and it
means you can signal the group yourself:

```javascript
process.kill(-cmd.pid, 'SIGTERM'); // the shell and everything under it
```

A consequence worth knowing: a command that does not exist is reported by the
shell that looked for it, so there is still a pid even though nothing you asked
for ran.

```javascript
const missing = $`no-such-command`;
await missing.catch(() => {});
missing.pid; // the shell's pid
(await missing.catch((error) => error)).code; // 127 — "command not found"
```

The code is the shell's convention rather than the library's: POSIX shells and
Git Bash use `127`, while `cmd.exe` exits with `1`.

To get the id of the command itself, with no shell in between, use the `exec`
command specification, which bypasses the shell entirely:

```javascript
import { ProcessRunner } from 'command-stream';

const cmd = new ProcessRunner({
  mode: 'exec',
  file: '/bin/sleep',
  args: ['5'],
});
await cmd.streams.stdout;
// ps -o args= -p <cmd.pid>  =>  /bin/sleep 5
```

With no shell to fall back on, a missing executable in `exec` mode is a failed
spawn, and `pid` stays `undefined`.

#### Built-in commands have no id

[Built-in commands](#built-in-commands--new) such as `echo`, `sleep` and `cat`
run inside your process and never spawn anything, so there is no operating
system process to identify and `pid` stays `undefined`:

```javascript
const builtin = $`echo hello`;
await builtin;
builtin.pid; // undefined

const external = $`/bin/echo hello`;
await external;
external.pid; // a real pid — the path bypasses the built-in
```

This is the difference to check for before using the id, rather than assuming
every command has one:

```javascript
function isStillRunning(cmd) {
  if (cmd.pid === undefined) return false; // never spawned, or a built-in
  try {
    process.kill(cmd.pid, 0); // signal 0 only performs the existence check
    return true;
  } catch {
    return false;
  }
}
```

A runnable walkthrough of all of the above is in
[`js/examples/process-pid-access.mjs`](examples/process-pid-access.mjs).

#### Rust parity

The Rust crate exposes the same value as `ProcessRunner::pid()`, plus
`OutputStream::pid()` and `OutputStream::wait_for_pid()` for streaming commands.
See [the Rust process id documentation](../rust/README.md#process-id-of-a-running-command).

### Synchronous Execution

```javascript
import { $ } from 'command-stream';

// Use .sync() for blocking execution
const result = $`echo "hello"`.sync();
console.log(result.stdout.toString()); // "hello\n"

// Events still work but are batched after completion
$`echo "world"`.on('end', (result) => console.log('Done:', result)).sync();
```

`.sync()` is also reachable from CommonJS without any `await`, which makes it
usable at synchronous launch-time boundaries such as availability probes:

```javascript
const $ = require('command-stream');

function isGitAvailable() {
  return $({ mirror: false })`git --version`.sync().code === 0;
}
```

### TUI Capture

`captureTerminal()` runs a command in a real pseudoterminal and uses xterm's
terminal model to capture settled screen states. It can send text and control
keys, resize the terminal, and stop after an output marker:

```javascript
import { captureTerminal } from 'command-stream';

const capture = await captureTerminal({
  file: 'my-tui',
  args: ['--interactive'],
  cols: 80,
  // rows defaults to 30: an 80-column 4:3 terminal with the default cell ratio
  interactions: [
    // Readiness accepts a string or RegExp. idleMilliseconds restarts whenever
    // output arrives, so the key is sent only after the repaint goes quiet.
    { after: /Choose an option/, idleMilliseconds: 50, key: 'DOWN' },
    { after: 'Second option', idleMilliseconds: 50, key: 'ENTER' },
    { after: 'Your name', text: 'Ada', key: 'ENTER' },
    { after: 'Dashboard', resize: { cols: 120, rows: 40 } },
  ],
  stopMarker: 'Done',
  artifactDirectory: 'artifacts/my-tui',
  artifactOptions: {
    cellWidth: 9,
    cellHeight: 18,
    fontSize: 14,
    padding: 12,
    borderRadius: 0,
    idleTimeLimit: 2,
  },
});

console.log(capture.transcript);
console.log(`${capture.frames.length} distinct settled states`);
```

Unlike `interactive: true`, `captureTerminal()` allocates a PTY without
forwarding the session exclusively to the parent terminal. The child sees a
TTY and raw-mode input while the returned `output`, `frames`, `transcript`, and
`asciicast` remain available for assertions. To inspect output as it arrives,
pass `onTrace(event)` and handle events whose `type` is `"output"`.

Named keys include `UP`, `DOWN`, `LEFT`, `RIGHT`, `ENTER`, `TAB`, `ESCAPE`,
`BACKSPACE`, `CTRL_C`, and `CTRL_D`. The `key` value may also be any raw
sequence, such as `'\x1b[6~'` for Page Down; `text` is likewise written
verbatim to the PTY master. Initial `cols`, `rows`, and `TERM` come from the
capture options and `env`, and interaction `resize` values update the PTY and
deliver the platform's resize notification to the child.

Each interaction can use `after: 'literal text'` or `after: /pattern/` as its
readiness condition. Add `idleMilliseconds` to require that no PTY output
arrive for that duration before applying the interaction; new output restarts
the idle wait. An interaction must contain an action (`text`, `key`, or
`resize`) or a wait (`after` or a positive `idleMilliseconds`); otherwise the
call rejects with a `TypeError` before the terminal is opened or input is sent.
The complete, runnable
[`tui-e2e.mjs`](examples/tui-e2e.mjs) example navigates a raw-mode menu and
asserts on its captured output.

#### Interactive sessions

`captureTerminal()` is a batch call: every interaction is known up front and the
child is killed after `timeoutMilliseconds` (30 s by default). When the input
arrives later and from elsewhere — an authorization code a human pastes back
minutes later, a chat-ops bridge, a test that interleaves assertions with input
— use `openTerminal()`, which keeps the same PTY open until you close it:

```javascript
import { openTerminal } from 'command-stream';

const session = await openTerminal({
  file: 'my-cli',
  args: ['login'],
  cols: 80,
});

// Same readiness matcher as interactions, including idleMilliseconds.
await session.waitFor(/https:\/\/\S+/, { idleMilliseconds: 50 });
const url = session.transcript.match(/https:\/\/\S+/)[0];

// ... arbitrary time passes; nothing terminates the child ...

await session.send({ text: code, key: 'ENTER' });
await session.waitFor('Logged in');

const capture = await session.close(); // frames/transcript/asciicast as usual
```

`openTerminal()` accepts every `captureTerminal()` option, including
`interactions` for the parts that _are_ known up front, but its
`timeoutMilliseconds` has no default: a session runs until the child exits or
you close it, and passing an explicit value opts back into a deadline.
`captureTerminal()` is implemented on top of `openTerminal()`, so the two paths
cannot drift.

The session exposes:

- `waitFor(pattern, { idleMilliseconds, timeoutMilliseconds })` — resolves with
  the current transcript once `pattern` (string or RegExp) has been seen and,
  with `idleMilliseconds`, output has been quiet for that long. It rejects if
  the wait times out or the child exits first.
- `send(interaction | interaction[])` — the `text`, `key`, and `resize`
  vocabulary of `interactions`; an entry may also carry `after` /
  `idleMilliseconds` to wait before it is applied.
- `output`, `transcript`, `frames`, `asciicast`, `running`, `exitStatus`,
  and `exited` (a promise for the child's exit) for live inspection.
- `close({ signal, timeoutMilliseconds })` — signals the child (escalating to
  `SIGKILL`), then returns the same result object `captureTerminal()` resolves
  to and writes `artifactDirectory` artifacts. `dispose()` is the
  never-throwing variant for cleanup paths, and `finished()` waits for a child
  that exits on its own.

The runnable [`tui-session.mjs`](examples/tui-session.mjs) example walks through
a deferred-input login.

The artifact directory contains an unrolled `transcript.txt`, machine-readable
`frames.json`, an asciicast v2 `session.cast`, a final `snapshot.svg`, a
self-contained animated `recording.svg`, and `recording.gif`. Frames retain
truecolor and 256-color foreground/background values plus bold, dim, italic,
underline, reverse, and strikethrough attributes. The SVG embeds a pre-subsetted
DejaVu Sans Mono font with Latin, arrow, and Braille coverage, preserves an
integer cell grid, and draws box/block
characters as seamless vector geometry. Animation uses the capture's real
timestamps; pauses longer than `idleTimeLimit` are trimmed.

GIF is provided for consumers that cannot play CSS-animated SVG. The format is
limited to 256 colors per frame, so truecolor recordings can show color
banding. Prefer `recording.svg` when full color fidelity is important.

The [committed recording sample](docs/screenshots/terminal-artifacts/recording.svg)
uses the same public API and CSS animation path used by generated artifacts.
Run `bun examples/terminal-artifacts-demo.mjs` to regenerate it.

Set `aspectRatio` to derive the row count when `rows` is omitted (the default is
`4 / 3`). Explicit `rows` always wins. Exact consecutive repaints are
deduplicated, including style-only repaints, while repeated content after an
intervening state remains in the transcript. Scrolled-off terminal history is
retained.

Set `settleMilliseconds` to tune repaint coalescing. For opt-in diagnostics,
pass `onTrace(event)`; capture is silent by default.

### Async Iteration (Real-time Streaming)

```javascript
import { $ } from 'command-stream';

for await (const chunk of $`long-running-command`.stream()) {
  if (chunk.type === 'stdout') {
    console.log('Real-time output:', chunk.data.toString());
  } else if (chunk.type === 'exit') {
    console.log('Exit:', chunk.code, chunk.signal);
  }
}
```

`stream()` yields `{ type: 'stdout' | 'stderr', data: Buffer }` chunks as output
arrives, followed by a final `{ type: 'exit', code, signal }` chunk when the process
exits. Always guard on `chunk.type` before reading `chunk.data`, since the
`exit` chunk carries `code` and `signal`, a signal name or `null`, instead of `data`.

Compound commands stream progressively too. Supported sequences keep built-in
and registered virtual commands in command-stream while forwarding nested
system-process output in real time:

```javascript
const build = $({
  mirror: false,
})`echo "build started"; npm run build; echo "build finished"`;

for await (const chunk of build.stream()) {
  if (chunk.type === 'stdout') {
    consumeBuildOutput(chunk.data);
  }
}
```

Breaking the loop or calling `build.kill()` also stops the active nested
command. For guidance on system-shell fallback, programmatic pipelines,
producer-side buffering, and patterns to avoid, see
[Real-time Streaming in Best Practices](BEST-PRACTICES.md#real-time-streaming).

The iterator terminates as soon as the process exits, even if a grandchild keeps
the stdout/stderr pipe open (e.g. `sh -c 'background-task & echo done'`). Any
output still buffered is drained within a short grace period (the `exitPumpGrace`
option, default `100`ms) before the lingering reads are aborted, so the loop
never hangs waiting on a pipe the command itself is no longer using.

#### Stopping the process from inside the loop

You can stop a long-running command while iterating over it — either by calling
`kill()` on the command, or simply by `break`ing out of the loop (which kills the
process automatically as the iterator is cleaned up):

```javascript
const cmd = $`some-endless-stream`;

for await (const chunk of cmd.stream()) {
  if (chunk.type === 'stdout') {
    console.log(chunk.data.toString());
    if (seenEnoughOutput(chunk)) {
      cmd.kill(); // stops the process; the loop then ends with an exit chunk
    }
  } else if (chunk.type === 'exit') {
    console.log('stopped with code', chunk.code); // 143 for the SIGTERM from kill()
  }
}

// Or just break — the process is terminated as the loop unwinds:
for await (const chunk of $`some-endless-stream`.stream()) {
  if (chunk.type === 'stdout' && done(chunk)) break;
}
```

##### Choosing the stop signal

`kill()` defaults to `SIGTERM`, but you can stop with any signal, either per
call (`cmd.kill('SIGINT')`) or by configuring a default with the `killSignal`
option. The child is given a grace period to handle the signal before SIGKILL
follows. See
[Sending Signals to a Running Command](#sending-signals-to-a-running-command)
for the full model, the `killGrace` option, and the exit-code table.

### EventEmitter Pattern (Event-driven)

```javascript
import { $ } from 'command-stream';

// Attach event handlers then start execution
$`command`
  .on('data', (chunk) => {
    if (chunk.type === 'stdout') {
      console.log('Stdout:', chunk.data.toString());
    }
  })
  .on('stderr', (chunk) => console.log('Stderr:', chunk))
  .on('end', (result) => console.log('Done:', result))
  .on('exit', (code, signal) => console.log('Exit:', code, signal))
  .start(); // Explicitly start the command

// Or auto-start by awaiting
const cmd = $`another-command`.on('data', (chunk) => console.log(chunk));
await cmd; // Auto-starts in async mode
```

### Mixed Pattern (Best of Both Worlds)

```javascript
import { $ } from 'command-stream';

// Async mode - events fire in real-time
const process = $`streaming-command`;
process.on('data', (chunk) => {
  processRealTimeData(chunk);
});
const result = await process;
console.log('Final output:', result.stdout.toString());

// Sync mode - events fire after completion (batched)
const syncCmd = $`another-command`;
syncCmd.on('end', (result) => {
  console.log('Completed with:', result.stdout);
});
const syncResult = syncCmd.sync();
```

### Streaming Interfaces

Completed results have readable `stdout` and `stderr` streams and a writable
`stdin` record. See [result streams](docs/RESULT_STREAMS.md) for examples and
the distinction between completed snapshots and live process streams.

```javascript
import { $ } from 'command-stream';

// 🎯 STDIN CONTROL: Send data to interactive commands (real-time)
const grepCmd = $`grep "important"`;
const stdin = await grepCmd.streams.stdin; // Available immediately

stdin.write('ignore this line\n');
stdin.write('important message\n');
stdin.write('skip this too\n');
stdin.end();

const result = await grepCmd;
console.log(result.stdout.toString()); // "important message\n"

// 🔧 BINARY DATA: Access raw buffers (after command finishes)
const cmd = $`echo "Hello World"`;
const buffer = await cmd.buffers.stdout; // Complete snapshot
console.log(buffer.length); // 12

// 📝 TEXT DATA: Access as strings (after command finishes)
const textCmd = $`echo "Hello World"`;
const text = await textCmd.strings.stdout; // Complete snapshot
console.log(text.trim()); // "Hello World"

// ⚡ PROCESS CONTROL: Kill commands that ignore stdin
const pingCmd = $`ping google.com`;

// Some commands ignore stdin input
const pingStdin = await pingCmd.streams.stdin;
if (pingStdin) {
  pingStdin.write('q\n'); // ping ignores this
}

// Use kill() for forceful termination
setTimeout(() => pingCmd.kill(), 2000);
const pingResult = await pingCmd;
console.log('Ping stopped with code:', pingResult.code); // 143 (SIGTERM)

// 🔄 MIXED STDOUT/STDERR: Handle both streams (complete snapshots)
const mixedCmd = $`sh -c 'echo "out" && echo "err" >&2'`;
const [stdout, stderr] = await Promise.all([
  mixedCmd.strings.stdout, // Available after finish
  mixedCmd.strings.stderr, // Available after finish
]);
console.log('Out:', stdout.trim()); // "out"
console.log('Err:', stderr.trim()); // "err"

// 🏃‍♂️ AUTO-START: Streams auto-start processes when accessed
const cmd = $`echo "test"`;
console.log('Started?', cmd.started); // false

const output = await cmd.streams.stdout; // Auto-starts, immediate access
console.log('Started?', cmd.started); // true

// Traditional await returns streams on the result
const traditional = await $`echo "still works"`;
console
