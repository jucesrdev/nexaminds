const { CircuitBreaker, STATES } = require('../src/services/circuitBreaker');
const { CircuitOpenError } = require('../src/errors');
const { waitFor } = require('./helpers/waitFor');

describe('CircuitBreaker', () => {
  it('stays closed while operations succeed', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    await waitFor(async () => {
      const value = await breaker.exec(async () => 'ok');
      expect(value).toBe('ok');
    });

    expect(breaker.snapshot().state).toBe(STATES.CLOSED);
    expect(breaker.snapshot().consecutiveFailures).toBe(0);
  });

  it('opens after three consecutive failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    const fail = async () => {
      throw new Error('upstream');
    };

    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');

    await waitFor(() => {
      expect(breaker.snapshot().state).toBe(STATES.OPEN);
      expect(breaker.snapshot().consecutiveFailures).toBe(3);
    });
  });

  it('fails instantly once open without invoking the operation', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30_000 });
    const fail = async () => {
      throw new Error('upstream');
    };

    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');

    let invoked = false;
    const startedAt = Date.now();

    await expect(
      breaker.exec(async () => {
        invoked = true;
        return 'should-not-run';
      })
    ).rejects.toBeInstanceOf(CircuitOpenError);

    await waitFor(() => {
      expect(invoked).toBe(false);
      expect(Date.now() - startedAt).toBeLessThan(50);
      expect(breaker.snapshot().state).toBe(STATES.OPEN);
    });
  });

  it('resets the failure count after a success', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    const fail = async () => {
      throw new Error('upstream');
    };

    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await waitFor(async () => {
      const value = await breaker.exec(async () => 'recovered');
      expect(value).toBe('recovered');
    });

    expect(breaker.snapshot().consecutiveFailures).toBe(0);
    expect(breaker.snapshot().state).toBe(STATES.CLOSED);
  });

  it('allows a trial call after the reset timeout', async () => {
    let now = 1_000;
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1_000,
      now: () => now,
    });
    const fail = async () => {
      throw new Error('upstream');
    };

    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');
    await expect(breaker.exec(fail)).rejects.toThrow('upstream');

    now += 1_000;

    await waitFor(async () => {
      const value = await breaker.exec(async () => 'half-open-success');
      expect(value).toBe('half-open-success');
    });

    expect(breaker.snapshot().state).toBe(STATES.CLOSED);
  });
});
