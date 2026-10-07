const { appendFileSync } = require('node:fs');
const { relative } = require('node:path');

// Retain progress if a native crash prevents Jest's normal summary.
class ProgressReporter {
  onTestStart(test) {
    this.write('start', test.path);
  }
  onTestResult(test, result) {
    this.write('end', test.path, {
      passed: result.numPassingTests,
      failed: result.numFailingTests,
    });
  }
  write(event, file, result = {}) {
    appendFileSync(
      process.env.ISSUE_158_PROGRESS_LOG,
      JSON.stringify({
        event,
        file: relative(process.cwd(), file),
        heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        ...result,
      }) + '\n'
    );
  }
}
module.exports = ProgressReporter;
