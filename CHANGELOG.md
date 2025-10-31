# Changelog

All notable changes to the Kew Garden Flowers Order Manager.

## [2.0.0] - 2025-10-28

### Added - PWA Support

- Progressive Web App manifest for installable mobile experience
- Service worker for offline functionality and caching
- Install prompt with user-friendly UI
- Offline mode with cached data access
- iOS and Android PWA support
- App icons (192×192 and 512×512)
- Icon generator utility (`generate-icons.html`)

### Added - Invoice Management

- Complete invoicing system with database tables
- Create invoices from existing orders
- Auto-generated invoice numbers (INV-YYYYMM-0001 format)
- Invoice status tracking (draft, sent, paid)
- Filter invoices by status
- Link multiple orders to single invoice
- Client information stored with invoice
- Subtotal and total calculation
- Due date tracking
- Invoice notes field
- View and edit existing invoices
- Delete invoices
- PDF download button (placeholder for future implementation)

### Added - Bouquet Type Management

- Settings page for bouquet catalog management
- Add, edit, delete bouquet types
- Set default price per bouquet type
- Activate/deactivate bouquets
- Drag-and-drop reordering
- Optional descriptions
- Dynamic loading in order form
- Auto-fill price when bouquet selected
- Only active bouquets shown in dropdown

### Added - Enhanced Client Features

- Sort clients by: Name, Order Count, Total Spent, Recent Activity
- Real-time search/filter by name, email, or phone
- Client analytics dashboard showing:
  - Total number of clients
  - Total revenue across all clients
- Enhanced client cards displaying:
  - Total orders per client
  - Total amount spent per client
- Last order date tracking

### Added - Database

- `bouquet_types` table with RLS policies
- `invoices` table with auto-timestamps
- `invoice_items` table with order linkage
- `clients` table (normalized client data)
- Database function `generate_invoice_number()`
- Trigger for auto-updating timestamps
- Indexes for improved performance
- Default bouquet types seeded

### Changed - UI/UX

- Navigation tabs: 3 tabs → 4 tabs (added Invoices)
- Mobile: Tab navigation responsive (4-col → 2×2 grid)
- Header: Added settings button (⚙️)
- Client tab: Added sort dropdown and search input
- Client tab: Added analytics panel
- All pages: Added PWA meta tags
- Forms: Enhanced with better mobile optimization

### Changed - Orders

- Added fields: `bouquet_type`, `price_hkd`, `delivery_time_slot`, `card_message`
- Bouquet dropdown now dynamically populated from database
- Price auto-fills when bouquet selected
- Enhanced order cards with more detail

### Changed - Styling

- Added invoice status color coding (draft/sent/paid)
- Added client statistics panel styling
- Added order checkbox list styling for invoice form
- Added PWA install prompt styling
- Improved mobile responsiveness
- Added hover effects and transitions

### Technical

- Service worker with cache-first and network-first strategies
- Offline fallback for API calls
- State management for invoices and bouquets
- Enhanced error handling
- Toast notifications for all major actions
- Form validation improvements
- Event listener optimization

## [1.0.0] - Initial Release

### Added

- Basic order management (create, read, update, delete)
- Client tracking from orders
- Order status tracking (pending/fulfilled)
- Delivery calendar with agenda and month views
- Manual order entry form
- Public client order form
- Supabase integration
- Email authentication (optional)
- Mobile-first responsive design
- Filter orders by status
- Client list view
- Brand-aligned styling

---

## Migration Guide: 1.0 → 2.0

### Database Changes Required

1. **Run Migration SQL**

   ```bash
   # Execute supabase-migration.sql in Supabase SQL Editor
   ```

2. **New Tables Created**

   - `clients`
   - `bouquet_types`
   - `invoices`
   - `invoice_items`

3. **Orders Table Updated**
   - New optional columns added automatically
   - Existing data remains intact

### File Changes

**New Files:**

- `manifest.json`
- `sw.js`
- `js/pwa.js`
- `js/settings.js`
- `settings.html`
- `generate-icons.html`
- `supabase-migration.sql`
- `SETUP-GUIDE.md`
- `IMPLEMENTATION-SUMMARY.md`
- `CHANGELOG.md`

**Modified Files:**

- `index.html` - Added PWA tags, Invoices tab, client controls
- `order.html` - Added PWA tags
- `client.html` - Added PWA tags
- `js/app.js` - Added invoice management, bouquet loading, client sorting
- `styles.css` - Added new component styles

### Icon Generation

New step required:

1. Open `generate-icons.html` in browser
2. Download both icon sizes
3. Place in `icons/` directory

### Configuration

No changes to `js/config.js` required, but verify:

- SUPABASE_URL is correct
- SUPABASE_ANON_KEY is correct
- ENABLE_AUTH preference

### Browser Requirements

- Modern browser with ES6+ support
- Service Worker support (Chrome, Safari, Edge, Firefox)
- HTTPS required for PWA features (automatic on GitHub Pages)

---

## Upgrade Instructions

From version 1.0 to 2.0:

1. **Backup your data** (export from Supabase)
2. **Pull latest code** from repository
3. **Run database migration** (`supabase-migration.sql`)
4. **Generate app icons** (using `generate-icons.html`)
5. **Clear browser cache** (to load new service worker)
6. **Test functionality**:
   - Create a bouquet type
   - Create an invoice
   - Test PWA install
   - Verify client sorting

---

## Breaking Changes

### None

Version 2.0 is fully backward compatible with 1.0:

- Existing orders continue to work
- New fields are optional
- Old order form still functional
- No API changes

---

## Deprecations

### None

All 1.0 features remain available.

---

## Security Updates

- Enhanced RLS policies for new tables
- Bouquet types readable by public (active only)
- Invoices restricted to authenticated users
- Maintained existing security model

---

## Performance Improvements

- Service worker caching reduces load times
- Database indexes on foreign keys
- Optimized client sorting algorithms
- Lazy loading of invoice items
- Efficient tab switching with selective rendering

---

## Bug Fixes

None reported from 1.0 (fresh enhancement release)

---

## Known Issues

1. **PDF Generation**: Not yet implemented (placeholder button)
2. **Icon Generation**: Requires manual browser step
3. **Service Worker Cache**: May need manual clear during development

---

## Roadmap

See `IMPLEMENTATION-SUMMARY.md` for detailed future roadmap.

**Planned for v2.1:**

- PDF invoice generation
- Email integration
- Push notifications

**Planned for v3.0:**

- Reporting dashboard
- Bulk operations
- Order templates
- Calendar enhancements

---

## Credits

**Framework & Services:**

- Supabase (Database & Auth)
- GitHub Pages (Hosting)
- Google Fonts (Typography)

**Design:**

- Brand colors inspired by kewgardenflowers.com
- Mobile-first responsive approach
- Progressive Web App standards

---

[Unreleased]: https://github.com/yourusername/yourrepo/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/yourusername/yourrepo/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/yourusername/yourrepo/releases/tag/v1.0.0

