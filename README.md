# KGF Orders (Static + Supabase)

Mobile-first static frontend hosted on GitHub Pages. Backend = Supabase (Auth/DB/Storage).

## Goal
Deliver a minimal florist order manager that can be deployed on GitHub Pages within a day, using Supabase for auth + database. Focus on mobile-first experience aligned with [kewgardenflowers.com](https://www.kewgardenflowers.com/) branding.

## Suggested MVP Scope Review

| Requirement | Notes & Simplifications |
|-------------|-------------------------|
| Manual order entry | Provide a simple "Add Order" drawer from the dashboard for internal use. Keep required fields to: client name, contact, delivery date, order items/notes, status. |
| Client self-entry | Serve a separate lightweight form page (same repo) that writes to the Supabase `orders` table without auth using a row level security policy (insert only). Provide QR/shareable link. |
| Client database | Store client info in `clients` table; orders reference client via foreign key. In MVP show a simple searchable list detail view. |
| Order status tabs | Implement tabs (All / Unfulfilled / Fulfilled) driven by Supabase queries with toggle button to update status. |
| Calendar view | Use a basic calendar list grouped by delivery date (no Google Calendar integration yet). Optionally embed Google Calendar later. |

### Additional recommendations
- Start with **no authentication** for internal dashboard while testing. Once ready, enable Supabase email OTP and wrap dashboard routes behind login.
- Track minimal fields first; add optional fields later instead of delaying MVP.
- Use Supabase generated REST (`supabase-js`) instead of building API routes.
- Keep styling with a single `styles.css` and CSS variables for brand colors (grey/white base, orange/brown accents).

## Architecture Outline
```
/docs
  index.html        # Dashboard (mobile-first)
  client-form.html  # Public order intake form
  styles.css        # Shared styling + responsive layout
  app.js            # Dashboard logic (Supabase queries)
  form.js           # Client form submission logic
  config.js         # Supabase URL + anon key (loaded from GitHub secrets during build or manual replace)
  assets/
    logo.svg        # Optional brand asset pulled from website
```

- Host via GitHub Pages (enable Pages from `main` branch `/docs` folder).
- Store Supabase credentials in `config.js`. For security, consider using GitHub Actions to inject from repo secrets when building. For MVP, you can temporarily hardcode anon key while restricting RLS policies.

## Deployment Checklist (GitHub Pages)
1. Create Supabase project → set up `clients` & `orders` tables.
2. Configure Row Level Security with policies:
   - Clients: allow authenticated read/write.
   - Orders: allow public insert (for client form) but read/update only for authenticated users (dashboard).
3. Update `docs/config.js` with Supabase URL + anon key.
4. Commit and push to GitHub. In repo settings, enable Pages (branch `main`, folder `/docs`).
5. Visit `https://<username>.github.io/<repo>/`.

## Implementation Phases
1. **Design skeleton**: Create minimal HTML markup and CSS with responsive layout inspired by existing branding.
2. **Supabase wiring**: Add `supabase-js` CDN script, implement CRUD for orders/clients.
3. **Dashboard features**: Tabs for statuses, simple calendar list (grouped by delivery date), client list.
4. **Client form**: Separate page posting to Supabase with confirmation message.
5. **Testing + polish**: Ensure mobile layout, quick manual test, prepare instructions for future enhancements (Google Calendar, invoicing integrations).

## Future Enhancements (Wishlist Feasibility)
1. **Google Calendar sync**: Replace internal calendar list with Supabase Edge Function + Google Calendar API (requires OAuth + service account).
2. **Invoicing**: Either integrate with Zoho Books via API (create invoices from orders) or generate PDFs via serverless function.

