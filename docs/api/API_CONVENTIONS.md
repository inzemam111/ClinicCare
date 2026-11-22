# API Conventions

## Versioning and responses

All REST routes are under `/api/v1`. Successful responses use:

```json
{ "data": {} }
```

Collections accept `page` (1-based), `pageSize` (1–100), `sortOrder` (`asc` or `desc`), and resource-specific filters. Paginated responses use:

```json
{
  "data": [],
  "meta": { "pagination": { "total": 0, "page": 1, "pageSize": 25 } }
}
```

Resource-specific `sortBy` values are allow-listed. Date-time filters use ISO-8601 timestamps; availability takes a clinic-local `YYYY-MM-DD` date and returns ISO-8601 slot times in the clinic timezone.

Errors use a stable envelope with a request ID:

```json
{
  "error": { "code": "BAD_REQUEST", "message": "Validation failed" },
  "requestId": "..."
}
```

Validation errors return HTTP 400. Duplicate records return 409, missing resources 404, permission failures 403, and unauthenticated requests 401. Protected endpoints require a bearer access token. Clinic IDs are derived from the authenticated session; request bodies cannot select a tenant.

## Endpoints

| Area            | Routes                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication  | `POST /auth/register/patient`, `POST /auth/login`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, password recovery/reset                             |
| Users           | `GET /users`, `GET /users/me`, `GET /users/:id`, `PUT /users/:id`                                                                                                                                   |
| Doctors         | `GET /doctors`, `GET /doctors/:id`, `PUT /doctors/:id`, `GET /doctors/:id/schedules`, `POST /doctors/:id/schedules`                                                                                 |
| Patients        | `POST /patients`, `GET /patients`, `GET /patients/:id`, `PUT /patients/:id`, `GET /patients/:id/history`                                                                                            |
| Clinics         | `POST /clinics`, `GET /clinics`, `GET /clinics/:id`, `PUT /clinics/:id`                                                                                                                             |
| Staff           | `POST /staff/receptionist`, `GET /staff`, `PUT /staff/:id`, `PUT /staff/:id/permissions`                                                                                                            |
| Appointments    | `POST /appointments`, `GET /appointments`, `GET /appointments/availability`, `PUT /appointments/:id`                                                                                                |
| Consultations   | `POST /consultations`, `GET /consultations`                                                                                                                                                         |
| Medical records | `POST /medical-records`, `GET /medical-records`, `GET /medical-records/:id`                                                                                                                         |
| Prescriptions   | `POST /prescriptions`, `GET /prescriptions`                                                                                                                                                         |
| Finance         | `POST /payments`, `POST /payments/:id/verify`, `POST /payments/:id/refunds`, `GET /payments`, `GET /income`, `POST /expenses`, `POST /expenses/:id/correct`, `GET /finance/summary`, report exports |
| Notifications   | `POST /notifications`, `GET /notifications`, `PUT /notifications/:id/read`                                                                                                                          |
| Audit logs      | `GET /audit-logs`                                                                                                                                                                                   |
| Health          | `GET /health`                                                                                                                                                                                       |

DTOs are validated with `class-validator`; unknown body fields are rejected. Swagger UI and the OpenAPI JSON are served at `/api/v1/docs` and `/api/v1/docs-json`.

Patient identifiers are clinic-scoped, and patient accounts can only read their own clinical history. Doctors can access clinical operations in their assigned clinic. Receptionists receive individually assigned operational permissions only and cannot access clinical, doctor-configuration, staff-management, analytics, or expense routes. Finance, staff-management, and audit-log routes require their respective permissions. Successful authenticated write requests generate an audit event containing actor, action, resource type, and request ID, but not request or response bodies; permission changes additionally preserve the before/after permission sets.

Medical-record endpoints store metadata for an opaque key created by the trusted file-storage service; they do not upload files. Notification endpoints persist in-app notification records; channel delivery is handled by a future provider integration.
