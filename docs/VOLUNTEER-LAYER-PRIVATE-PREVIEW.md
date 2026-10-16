# Volunteer layer private-preview boundary

This branch contains a synthetic-only UI shell for the volunteer service-point layer.

- No roster file, real name, phone number, home address, or national identifier is present in this repository.
- All bundled points are explicitly synthetic district-level display fixtures. They are not volunteer homes.
- `GET /api/volunteers` intentionally returns `503 VOLUNTEER_PRIVATE_SOURCE_NOT_CONFIGURED` with `Cache-Control: private, no-store` until an approved authenticated data source and per-request role authorization are available.
- Vercel page protection is not accepted as API authorization. Real-data acceptance requires independent anonymous, unauthorized, authorized, and revoked-user API tests.
- Production deployment and `main` merge are outside this branch's authorization.

The private source workbook and reference prototypes remain outside the Git worktree and must not be copied into the repository, build context, logs, screenshots, or pull-request text.
