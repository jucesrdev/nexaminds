const { sanitize, passesLuhn } = require('../src/services/sanitizer');

describe('sanitizer', () => {
  describe('emails', () => {
    it('redacts a standard email address', () => {
      expect(sanitize('Contact me at jane.doe@example.com please')).toBe(
        'Contact me at <REDACTED: EMAIL> please'
      );
    });

    it('redacts plus-addressing and subdomains', () => {
      expect(sanitize('Send to qa+probe@mail.company.co.uk')).toBe(
        'Send to <REDACTED: EMAIL>'
      );
    });

    it('redacts multiple emails in one message', () => {
      expect(sanitize('a@x.com and b@y.org')).toBe(
        '<REDACTED: EMAIL> and <REDACTED: EMAIL>'
      );
    });
  });

  describe('credit cards', () => {
    it('accepts valid Luhn numbers', () => {
      expect(passesLuhn('4111111111111111')).toBe(true);
      expect(passesLuhn('378282246310005')).toBe(true);
    });

    it('rejects numbers that fail Luhn', () => {
      expect(passesLuhn('4111111111111112')).toBe(false);
    });

    it('redacts a Visa number without separators', () => {
      expect(sanitize('Card 4111111111111111 charged')).toBe(
        'Card <REDACTED: CREDIT_CARD> charged'
      );
    });

    it('redacts cards grouped with spaces or dashes', () => {
      expect(sanitize('pay 4111-1111-1111-1111 now')).toBe(
        'pay <REDACTED: CREDIT_CARD> now'
      );
      expect(sanitize('pay 4111 1111 1111 1111 now')).toBe(
        'pay <REDACTED: CREDIT_CARD> now'
      );
    });

    it('redacts a 15-digit American Express number', () => {
      expect(sanitize('Amex 3782 822463 10005')).toBe('Amex <REDACTED: CREDIT_CARD>');
    });

    it('does not treat a Luhn-invalid 16-digit run as a card', () => {
      expect(sanitize('ref 4111111111111112 stays')).toBe(
        'ref 4111111111111112 stays'
      );
    });
  });

  describe('social security numbers', () => {
    it('redacts hyphenated SSNs', () => {
      expect(sanitize('SSN 123-45-6789 on file')).toBe(
        'SSN <REDACTED: SSN> on file'
      );
    });

    it('redacts SSNs with spaces or dots', () => {
      expect(sanitize('123 45 6789 and 123.45.6789')).toBe(
        '<REDACTED: SSN> and <REDACTED: SSN>'
      );
    });

    it('redacts a bare 9-digit sequence', () => {
      expect(sanitize('id 987654321 stored')).toBe('id <REDACTED: SSN> stored');
    });

    it('does not redact a 10-digit phone number as an SSN', () => {
      expect(sanitize('Call 5551234567 tomorrow')).toBe(
        'Call 5551234567 tomorrow'
      );
    });
  });

  describe('mixed and overlapping PII', () => {
    it('redacts every supported type in one message', () => {
      const message =
        'User jane@acme.com paid 4111111111111111 and SSN 078-05-1120';
      expect(sanitize(message)).toBe(
        'User <REDACTED: EMAIL> paid <REDACTED: CREDIT_CARD> and SSN <REDACTED: SSN>'
      );
    });

    it('prefers a credit card match over a nested 9-digit SSN', () => {
      expect(sanitize('4111111111111111')).toBe('<REDACTED: CREDIT_CARD>');
    });

    it('leaves ordinary text untouched', () => {
      expect(sanitize('How do I reset my password?')).toBe(
        'How do I reset my password?'
      );
    });
  });
});
