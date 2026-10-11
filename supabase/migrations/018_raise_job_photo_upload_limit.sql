-- Raise legacy field job photo uploads to match the Next server action limit.
-- Phone camera images can exceed the original 15 MB bucket limit.

UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
WHERE id = 'job-photos';
