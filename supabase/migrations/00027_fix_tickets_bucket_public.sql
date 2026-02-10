-- Make tickets storage bucket public so getPublicUrl() works
-- The bucket was created as private in 00025_tickets.sql, but the upload API
-- uses getPublicUrl() which generates URLs for the /object/public/ endpoint.
-- This endpoint only works for public buckets.
UPDATE storage.buckets SET public = true WHERE id = 'tickets';
