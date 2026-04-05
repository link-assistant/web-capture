import { jest } from '@jest/globals';
import { retry } from '../../src/retry.js';

jest.setTimeout(30000);

describe('retry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retry(fn, { retries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds eventually', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) {
        throw new Error('fail');
      }
      return 'success';
    });

    const result = await retry(fn, { retries: 3, baseDelay: 50 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(retry(fn, { retries: 2, baseDelay: 50 })).rejects.toThrow(
      'persistent failure'
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('calls onRetry callback before each retry', async () => {
    let calls = 0;
    const fn = jest.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) {
        throw new Error('fail');
      }
      return 'ok';
    });
    const onRetry = jest.fn();

    await retry(fn, { retries: 3, baseDelay: 50, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 50);
  });

  it('uses exponential backoff delays', async () => {
    const delays = [];
    const onRetry = jest.fn((err, attempt, delay) => {
      delays.push(delay);
    });

    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(
      retry(fn, {
        retries: 3,
        baseDelay: 100,
        factor: 2,
        maxDelay: 1000,
        onRetry,
      })
    ).rejects.toThrow();

    // Delays should be: 100, 200, 400
    expect(delays).toEqual([100, 200, 400]);
  });

  it('caps delay at maxDelay', async () => {
    const delays = [];
    const onRetry = jest.fn((err, attempt, delay) => {
      delays.push(delay);
    });

    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(
      retry(fn, {
        retries: 3,
        baseDelay: 100,
        factor: 10,
        maxDelay: 500,
        onRetry,
      })
    ).rejects.toThrow();

    // Delays: min(100, 500)=100, min(1000, 500)=500, min(10000, 500)=500
    expect(delays).toEqual([100, 500, 500]);
  });

  it('passes attempt number to fn', async () => {
    const attempts = [];
    const fn = jest.fn().mockImplementation(async (attempt) => {
      attempts.push(attempt);
      if (attempt < 2) {
        throw new Error('fail');
      }
      return 'ok';
    });

    await retry(fn, { retries: 3, baseDelay: 50 });
    expect(attempts).toEqual([0, 1, 2]);
  });
});
