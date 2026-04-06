/**
 * Retry utility with exponential backoff.
 *
 * Used for network-dependent operations (fetching HTML, downloading images, etc.)
 * to handle transient failures gracefully.
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.retries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.factor - Exponential backoff factor (default: 2)
 * @param {Function} options.onRetry - Optional callback(error, attempt) called before each retry
 * @returns {Promise} Result of the function call
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= retries) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);

      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
