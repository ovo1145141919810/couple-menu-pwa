# Privacy policy for this public repository

This repository is intentionally safe to show in a portfolio. Its source code, migrations and demo records are public; the couple's production content is not.

## Never commit

- real email addresses, passwords, Auth UUIDs or profile names;
- real photos, orders, comments or interaction history;
- `.env.local`, database URLs with passwords, Supabase Secret/Service Role keys;
- exported databases, Storage backups or Dashboard screenshots containing identifiers.

## Safe to publish

- `.env.example` with placeholders;
- the Supabase project URL and Publishable Key used by a compiled browser app;
- schema migrations, RLS policies and system seed data;
- fictional Demo records and screenshots captured from Demo mode.

Run `npm run check:privacy` before every push. Git history is permanent: if a secret is ever committed, rotate it immediately even if the commit is later deleted.
