const { ValidationError } = require('../errors');

const USER_ID_MAX_LENGTH = 128;
const MESSAGE_MAX_LENGTH = 10000;

function validateInquiry(req, _res, next) {
  const body = req.body;

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    next(new ValidationError('JSON body is required'));
    return;
  }

  const { userId, message } = body;

  if (typeof userId !== 'string' || userId.trim() === '') {
    next(new ValidationError('userId must be a non-empty string'));
    return;
  }

  if (userId.length > USER_ID_MAX_LENGTH) {
    next(new ValidationError(`userId must be at most ${USER_ID_MAX_LENGTH} characters`));
    return;
  }

  if (typeof message !== 'string' || message.trim() === '') {
    next(new ValidationError('message must be a non-empty string'));
    return;
  }

  if (message.length > MESSAGE_MAX_LENGTH) {
    next(new ValidationError(`message must be at most ${MESSAGE_MAX_LENGTH} characters`));
    return;
  }

  req.body.userId = userId.trim();
  next();
}

module.exports = { validateInquiry };
