class CircuitOpenError extends Error {
  constructor() {
    super('Service Busy');
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

module.exports = { CircuitOpenError, ValidationError };
