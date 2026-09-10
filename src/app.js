const express = require('express');
const helmet = require('helmet');
const { createSecureInquiryRouter } = require('./routes/secureInquiry');
const { ValidationError } = require('./errors');

function createApp(deps) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      circuit: deps.circuitBreaker.snapshot(),
    });
  });

  app.use(createSecureInquiryRouter(deps));

  app.use((err, _req, res, _next) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large' });
      return;
    }

    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'unhandled_error',
        name: err.name,
        message: err.message,
      })
    );

    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
