# Authentication API

All paths are under `/api/v1/auth`. The health check remains public. Send access tokens as `Authorization: Bearer <accessToken>`.

| Method / route                               | Purpose                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /login`                                | Password login; privileged accounts receive an MFA challenge.                                                            |
| `POST /otp/verify`                           | Exchanges an MFA challenge and code for access and refresh tokens.                                                       |
| `POST /refresh`                              | Rotates a refresh token and returns new tokens.                                                                          |
| `POST /logout`, `/logout-all`                | Revokes current or all user sessions.                                                                                    |
| `POST /password-recovery`, `/password-reset` | Starts and completes a time-bound password reset.                                                                        |
| `POST /register/patient`                     | Patient registration.                                                                                                    |
| `POST /register/doctor`                      | Public primary-doctor onboarding for a clinic that has no primary doctor. It cannot add a doctor to an operating clinic. |
| `POST /staff/receptionist`                   | Requires staff-permission management capability.                                                                         |

Receptionists sign in through the Doctor App. Their access token includes the `RECEPTIONIST` role plus only the operational permissions assigned to their own staff record. Creating a receptionist grants the standard operational set initially; a doctor can replace it with `PUT /staff/:id/permissions`. Every permission change revokes that staff member's active sessions and records the prior and new permission sets in the audit log.

Never log tokens. In production send refresh tokens in secure, HttpOnly, SameSite cookies instead of retaining them in browser or mobile app storage. Configure a unique `JWT_ACCESS_SECRET` of at least 32 random bytes; the development fallback is deliberately unsafe for deployment.
