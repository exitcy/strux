-- Manual cleanup for comment threads that no longer anchor to the document.
-- Run in Supabase SQL editor AFTER reviewing counts (SELECT before DELETE).

-- 1) Comments whose highlighted_text no longer appears anywhere in the doc body (plain text).
--    Adjust if you store HTML in documents.content — this uses content::text.
/*
select c.id, c.document_id, c.highlighted_text, c.block_id, c.created_at
from public.comments c
join public.documents d on d.id = c.document_id
where c.highlighted_text is not null
  and length(trim(c.highlighted_text)) > 0
  and coalesce(d.content::text, '') not ilike ('%' || replace(c.highlighted_text, '%', '\%') || '%');
*/

-- 2) Comments with block_id that you know is obsolete (no matching node in JSON).
--    Requires app-side audit; example: delete threads older than N days on archived docs.
/*
delete from public.proposed_changes pc
using public.comments c
where pc.comment_id = c.id
  and c.document_id = 'YOUR-DOC-UUID';

delete from public.comments
where document_id = 'YOUR-DOC-UUID'
  and parent_id is not null;

delete from public.comments
where document_id = 'YOUR-DOC-UUID';
*/

-- 3) Safe reset: mark stale threads resolved instead of deleting.
/*
update public.comments
set is_resolved = true
where highlighted_text is not null
  and block_id is null
  and created_at < now() - interval '90 days';
*/
