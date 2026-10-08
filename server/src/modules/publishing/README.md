# Phase 3

Worker, jobs/retries/idempotency are intentionally not active in Phase 1. Scheduling is editorial state only. Use the PublicationJob/PublicationAttempt schema and SocialAdapter contract; never publish inside REST handlers. Cancel or replace queued jobs atomically when an approved/scheduled post is edited.
