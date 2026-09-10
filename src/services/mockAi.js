function createMockAi({ delayMs = 2000 } = {}) {
  function generate(_prompt, { fail = false } = {}) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (fail) {
          const error = new Error('Mock AI upstream failure');
          error.code = 'AI_FAILURE';
          reject(error);
          return;
        }

        resolve({ answer: 'Generated Answer' });
      }, delayMs);
    });
  }

  return { generate, delayMs };
}

module.exports = { createMockAi };
