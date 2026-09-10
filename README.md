# Secure Inquiry Middleware

Express service that redacts PII before a mock AI call, encrypts the original message in an audit log, and fails fast behind a circuit breaker.

## Request flow

`POST /secure-inquiry` accepts `{ "userId": string, "message": string }`.

1. **Sanitize** emails, credit cards (Luhn-validated 13–19 digits), and SSNs (formatted or any 9-digit run). Each match becomes `<REDACTED: EMAIL|CREDIT_CARD|SSN>`.
2. **Audit** the original message with AES-256-GCM and the redacted message in plaintext. Storage is a JSON file.
3. **Mock AI** waits 2 seconds and returns `Generated Answer`. The AI only sees the redacted text.
4. **Circuit breaker** trips after 3 consecutive AI failures. Later requests return `Service Busy` immediately and never start the 2s timer. After `CIRCUIT_RESET_MS` the breaker allows one trial call.

## Run locally

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste the output into ENCRYPTION_KEY in .env
npm install
npm test
npm start
```

```bash
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/secure-inquiry \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"u1\",\"message\":\"Hi jane@acme.com card 4111111111111111 ssn 123-45-6789\"}"
```

Force an AI failure (for the circuit breaker):

```bash
curl -s -X POST http://localhost:3000/secure-inquiry \
  -H "Content-Type: application/json" \
  -H "x-simulate-ai-failure: true" \
  -d "{\"userId\":\"u1\",\"message\":\"hello\"}"
```

The fourth request after three forced failures returns HTTP 503 `{ "error": "Service Busy" }` without waiting.

## Docker

Create a `.env` with a generated `ENCRYPTION_KEY`, then:

```bash
docker compose up --build
```

Compose refuses to start if `ENCRYPTION_KEY` is missing. The API listens on `http://localhost:3000`. Audit records persist in the `audit-data` volume at `/app/data/audit-log.json`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `ENCRYPTION_KEY` | required | 32-byte AES key as 64 hex characters |
| `AUDIT_LOG_PATH` | `./data/audit-log.json` | Audit JSON file |
| `CIRCUIT_FAILURE_THRESHOLD` | `3` | Consecutive failures before open |
| `CIRCUIT_RESET_MS` | `30000` | Cool-down before a trial call |
| `AI_DELAY_MS` | `2000` | Mock AI latency |
