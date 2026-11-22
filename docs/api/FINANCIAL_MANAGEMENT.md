# Financial Management API

All routes are under `/api/v1` and scoped to the authenticated clinic. Amounts are decimal strings in responses and must be sent with no more than two decimal places.

## Collection lifecycle

1. `POST /payments` records a pending receivable with a caller-generated UUID idempotency key.
2. `POST /payments/:id/verify` verifies cash, UPI, card, or online collection. In the same database transaction it creates the immutable income entry, receipt, and audit event.
3. `POST /payments/:id/refunds` records an immutable full or partial refund. It never overwrites the original collection.

An appointment is never income by itself. Dashboard and report collections use only payments with a verification timestamp. Pending payments remain outstanding receivables. Subscription records are not queried by clinic-finance endpoints.

Cash may be verified by an authorised clinic user. UPI, card, and online payments are deliberately kept pending unless `PAYMENT_VERIFICATION_MODE=sandbox` is configured for development. A production gateway webhook/verification adapter must be configured before electronic payments can become verified collections.

## Dashboard and reports

| Route                                                   | Purpose                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /finance/summary`                                  | Server-calculated metrics and daily, monthly, yearly, expense, comparison, and payment-method chart data. |
| `GET /finance/reports?reportType=...`                   | Date-wise collections, monthly statement, expenses, outstanding, refunds, or service revenue.             |
| `GET /finance/reports/export?reportType=...&format=csv` | Download CSV report.                                                                                      |
| `GET /finance/reports/export?reportType=...&format=pdf` | Download a portable PDF report.                                                                           |
| `POST /expenses`                                        | Create an expense.                                                                                        |
| `POST /expenses/:id/correct`                            | Create a corrected replacement while preserving the original version.                                     |

Finance analytics and expenses are doctor-only in the current role model. Receptionists may record and verify permitted payments but cannot read financial analytics, expenses, or refunds.

Patients can create and verify a payment only for their own patient record and appointment. `GET /payments/mine` returns only that patient's payments and receipt numbers; it does not expose clinic-wide collections or analytics.
