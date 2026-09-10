async function waitFor(callback, { timeout = 1000, interval = 25 } = {}) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeout) {
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        return await result;
      }
      return result;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
  }

  throw lastError || new Error(`waitFor timed out after ${timeout}ms`);
}

module.exports = { waitFor };
