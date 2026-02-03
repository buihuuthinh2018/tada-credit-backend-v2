# API Convention

- RESTful endpoints
- Use plural nouns
- Use HTTP status codes correctly
- Soft delete preferred where applicable
- Admin APIs separated by route prefix

Example:
POST /admin/services
POST /contracts/:id/submit
POST /admin/workflows/:id/transitions
