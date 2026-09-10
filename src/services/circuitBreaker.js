const { CircuitOpenError } = require('../errors');

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  constructor({ failureThreshold = 3, resetTimeoutMs = 30000, now = () => Date.now() } = {}) {
    if (failureThreshold < 1) {
      throw new Error('failureThreshold must be at least 1');
    }

    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.now = now;
    this.state = STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  async exec(operation) {
    if (this.isOpenAndCoolingDown()) {
      throw new CircuitOpenError();
    }

    if (this.state === STATES.OPEN) {
      this.state = STATES.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw error;
      }
      this.recordFailure();
      throw error;
    }
  }

  isOpenAndCoolingDown() {
    return this.state === STATES.OPEN && this.now() < this.openedAt + this.resetTimeoutMs;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.state = STATES.CLOSED;
    this.openedAt = null;
  }

  recordFailure() {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = STATES.OPEN;
      this.openedAt = this.now();
    }
  }

  snapshot() {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAt,
    };
  }

  reset() {
    this.state = STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }
}

module.exports = { CircuitBreaker, STATES };
