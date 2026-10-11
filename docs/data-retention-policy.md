# Data Retention Policy

## Default Retention

| Data class | Default retention |
| --- | --- |
| Approved service records and PDFs | 7 years |
| Routine evidence photos | 7 years |
| Service GPS events | 7 years |
| Raw continuous breadcrumb points | 180 days |
| Daily route/work-session summaries | 2 years |
| Audit events | 7 years |
| Damage/incident evidence | At least 7 years or active hold |
| Auth/security logs | 180 days |
| Invalid push subscriptions | 30 days |
| Orphan drafts | 30 days after job closure |
| Temporary or failed upload files | 7 days |
| Soft-deleted media quarantine | 30 days |

## Legal Holds

Legal holds can apply by customer, property, work order, service run, incident, or date range. A held record, its required parents, and its required evidence cannot be purged until the hold is released by an authorized admin.

## Purge Rules

- Purge is not exposed as a normal DELETE route.
- Purge jobs must first produce a dry-run report.
- Purge jobs must check legal holds and parent retention.
- Purge jobs must append audit records with counts, bytes, policy version, actor/process, and timestamp.
- Service record amendments do not shorten retention of the original approved record.

## Current Implementation Status

The current application has soft deletes in some business tables and `audit_logs`, but no automated retention, legal hold, or purge process. The first implementation should add retention tables and tests before any destructive process is enabled.
