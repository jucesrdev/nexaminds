const EMAIL_PATTERN =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,63}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}\b/g;

const CARD_CANDIDATE_PATTERN = /(?<!\d)(?:\d[ \-]?){13,19}(?!\d)/g;

const SSN_FORMATTED_PATTERN = /(?<!\d)\d{3}[-\s.]\d{2}[-\s.]\d{4}(?!\d)/g;

const SSN_NINE_DIGIT_PATTERN = /(?<!\d)\d{9}(?!\d)/g;

function passesLuhn(digits) {
  let sum = 0;
  let doubleDigit = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (value < 0 || value > 9) {
      return false;
    }
    if (doubleDigit) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function collectMatches(text, pattern, type, predicate) {
  const matches = [];
  const regex = new RegExp(pattern.source, pattern.flags);
  let found = regex.exec(text);

  while (found) {
    const raw = found[0];
    if (!predicate || predicate(raw)) {
      matches.push({
        start: found.index,
        end: found.index + raw.length,
        type,
      });
    }
    found = regex.exec(text);
  }

  return matches;
}

function findEmails(text) {
  return collectMatches(text, EMAIL_PATTERN, 'EMAIL');
}

function findCreditCards(text) {
  const matches = [];
  const regex = new RegExp(CARD_CANDIDATE_PATTERN.source, CARD_CANDIDATE_PATTERN.flags);
  let found = regex.exec(text);

  while (found) {
    const trimmed = found[0].replace(/[ \-]+$/, '');
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      matches.push({
        start: found.index,
        end: found.index + trimmed.length,
        type: 'CREDIT_CARD',
      });
    }
    found = regex.exec(text);
  }

  return matches;
}

function findSocialSecurityNumbers(text) {
  const formatted = collectMatches(text, SSN_FORMATTED_PATTERN, 'SSN');
  const nineDigits = collectMatches(text, SSN_NINE_DIGIT_PATTERN, 'SSN');
  return formatted.concat(nineDigits);
}

function resolveOverlaps(ranges) {
  const ranked = ranges.slice().sort((left, right) => {
    const lengthDelta = right.end - right.start - (left.end - left.start);
    if (lengthDelta !== 0) {
      return lengthDelta;
    }
    return left.start - right.start;
  });

  const accepted = [];

  for (const candidate of ranked) {
    const overlaps = accepted.some(
      (existing) => candidate.start < existing.end && candidate.end > existing.start
    );
    if (!overlaps) {
      accepted.push(candidate);
    }
  }

  return accepted.sort((left, right) => left.start - right.start);
}

function applyRedactions(text, ranges) {
  let cursor = 0;
  let output = '';

  for (const range of ranges) {
    output += text.slice(cursor, range.start);
    output += `<REDACTED: ${range.type}>`;
    cursor = range.end;
  }

  output += text.slice(cursor);
  return output;
}

function sanitize(message) {
  if (typeof message !== 'string') {
    throw new TypeError('message must be a string');
  }

  const ranges = resolveOverlaps([
    ...findEmails(message),
    ...findCreditCards(message),
    ...findSocialSecurityNumbers(message),
  ]);

  return applyRedactions(message, ranges);
}

module.exports = {
  sanitize,
  passesLuhn,
};
