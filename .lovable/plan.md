## What I'll build

### 1. Admin role system (foundation)
- New `app_role` enum (`admin`, `user`) and `user_roles` table with the `has_role()` security-definer function (never store roles on profiles — privilege escalation risk).
- Seed `bolkerbino26@gmail.com` as admin in the migration.
- Add `feature_flags` table (key/value) with one row: `boost_enabled = false` by default. Admin-only write, public read.

### 2. Admin dashboard (`/_authenticated/admin`)
- Gate: redirect non-admins.
- Toggle switch for `boost_enabled` (live updates the flag).
- Set per-view rate in NGN (e.g. ₦2/view) — stored in `feature_flags`.
- List of recent boosted listings + total revenue.

### 3. Boost feature (Paystack pay-per-view)
- New columns on `listings`: `boost_status` (none/active/expired), `boost_views_purchased`, `boost_views_delivered`, `boost_expires_at`, `boost_started_at`.
- New `boost_orders` table: listing_id, user_id, views, amount_naira, paystack_reference, status, created_at.
- Boost modal on listing/shop (only shows when admin flag is on): user picks number of viewers → sees total price → "Boost now" opens **Paystack inline checkout** (publishable key in frontend).
- Server route `/api/public/paystack/webhook`: verifies `x-paystack-signature` HMAC with secret key, marks order paid, activates boost on the listing, sets `boost_expires_at = now + 7 days`.
- Boost ends when **views delivered ≥ purchased OR expires_at passed** (whichever first). A `boost_view` increment runs each time the listing is shown in feed.
- Boosted cards get a glowing border/badge across feed + shop pages.

### 4. Account deletion
- New `/_authenticated/profile` → "Delete account" button.
- Calls server fn → sends confirmation email with one-time token (stored in `account_deletion_tokens`, 1hr expiry).
- User clicks email link → `/delete-account/confirm?token=…` → confirms → hard-deletes auth user + cascades wipe everything (listings, messages, ratings, favorites, etc. — your FKs already cascade from auth.users).

### 5. Email branding fix
- The "your-exact website" sender name comes from the `from:` field in `src/routes/api/public/signup.ts`. Change `Your App <onboarding@resend.dev>` → `Souqss <onboarding@resend.dev>`. Same fix for the new account-deletion email.
- To stop landing in spam/bin: the ONLY real fix is verifying your own domain in Resend (resend.com/domains → add `souqss.com` or similar → add the DKIM/SPF DNS records they show you). Until then, `onboarding@resend.dev` will keep hitting spam — that's a Resend limitation, not a code bug. Once verified tell me the domain and I'll swap the `from:`.

## Technical notes
- Paystack publishable key (`pk_live_…`) goes in `.env` as `VITE_PAYSTACK_PUBLIC_KEY` (safe to ship).
- Secret key goes through `secrets--add_secret` as `PAYSTACK_SECRET_KEY` (server-only, used in webhook signature verify + transaction verify call).
- Webhook URL to register in Paystack dashboard: `https://project--7e25b3fe-4e4d-40be-baa7-1cd16dd8db72.lovable.app/api/public/paystack/webhook`
- All new tables get RLS + GRANTs per project convention.

## What I need from you first
1. **Rotate the Paystack secret key on paystack.com**, then tell me "rotated" — I'll open the secure secret form.
2. Confirm the per-view default rate (I'll use **₦2/view** unless you say otherwise — you can change it in admin anytime).
3. Confirm the default boost duration cap (I'll use **7 days** unless you say otherwise).
4. For the new Resend connection: either share access with the project owner in workspace settings, OR I'll just keep using the currently-linked one (works either way).

Reply with those 4 and I'll ship everything in one batch.