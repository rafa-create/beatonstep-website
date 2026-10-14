-- Strava TCX uploads are asynchronous. Preserve the upload identifier so
-- repeated Save taps can poll status without resubmitting the same GPS data.
ALTER TABLE strava_exports ADD COLUMN upload_id TEXT;
