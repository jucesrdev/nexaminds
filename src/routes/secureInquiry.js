const express = require('express');
const { validateInquiry } = require('../middleware/validateInquiry');
const { CircuitOpenError } = require('../errors');

function shouldSimulateAiFailure(req) {
  return String(req.headers['x-simulate-ai-failure'] || '').toLowerCase() === 'true';
}

function createSecureInquiryRouter({ sanitizer, aiClient, circuitBreaker, encryption, auditLog }) {
  const router = express.Router();

  router.post('/secure-inquiry', validateInquiry, async (req, res, next) => {
    const { userId, message } = req.body;

    try {
      const redactedMessage = sanitizer.sanitize(message);
      let status = 200;
      let body = { userId, redactedMessage, answer: null };

      try {
        const aiResult = await circuitBreaker.exec(() =>
          aiClient.generate(redactedMessage, { fail: shouldSimulateAiFailure(req) })
        );
        body.answer = aiResult.answer;
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          status = 503;
          body = { error: 'Service Busy' };
        } else if (error.code === 'AI_FAILURE') {
          status = 502;
          body = { error: 'AI service unavailable' };
        } else {
          throw error;
        }
      }

      await auditLog.append({
        userId,
        originalMessageEncrypted: encryption.encrypt(message),
        redactedMessage,
        answer: body.answer || body.error || null,
      });

      res.status(status).json(body);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createSecureInquiryRouter };
