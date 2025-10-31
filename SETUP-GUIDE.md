# Kew Garden Flowers Order Manager - Setup Guide

## Enhanced Features (New)

This guide covers the recently added features:

1. **Progressive Web App (PWA)** - Install on mobile devices
2. **Invoice Management** - Create, track, and manage invoices
3. **Bouquet Type Management** - Dynamically manage bouquet types and pricing
4. **Enhanced Client Management** - Sort, filter, and view client analytics

---

## Quick Start

### 1. Database Migration

Run the SQL migration in your Supabase SQL Editor:

```bash
# Open the file: supabase-migration.sql
# Copy the entire content
# Paste into Supabase SQL Editor
# Click "Run"
```

This will create the following new tables:

- `clients` - Client information
- `bouquet_types` - Bouquet catalog
- `invoices` - Invoice headers
- `invoice_items` - Invoice line items

### 2. Generate App Icons

For PWA functionality, you need to generate app icons:

1. Open `generate-icons.html` in your browser
2. Click "Download 192x192" button
3. Click "Download 512x512" button
4. Move both downloaded PNG files to the `icons/` directory
5. Rename them to `icon-192.png` and `icon-512.png`

### 3. Deploy to GitHub Pages

The app is ready to deploy! Simply push to your repository:

```bash
git add .
git commit -m "Add PWA, invoicing, and enhanced features"
git push origin main
```

Enable GitHub Pages in your repository settings (Settings → Pages → Source: main branch, root directory).

---

## New Features Guide

### 📱 Progressive Web App (PWA)

**What it does:**

- Allows users to install the app on their phone home screen
- Works offline with cached data
- Feels like a native app

**How to use:**

1. Open the app on your mobile device
2. Look for "Add to Home Screen" prompt or browser menu option
3. Confirm installation
4. App icon will appear on your home screen

**Offline Features:**

- View previously loaded orders, clients, and invoices
- Create new entries (will sync when online)
- Cached static assets for fast loading

### 📄 Invoice Management

**Creating an Invoice:**

1. Go to the "Invoices" tab
2. Click "+ Create invoice"
3. Select a client from the dropdown
4. Check the orders you want to include
5. Review the auto-calculated total
6. Add optional notes
7. Click "Save invoice"

**Invoice Status Workflow:**

- **Draft** - Invoice created, not sent yet
- **Sent** - Invoice has been sent to client
- **Paid** - Payment received

**Managing Invoices:**

- Click "View" to edit an existing invoice
- Click "PDF" to generate a PDF (coming soon)
- Filter by status using the dropdown
- Invoice numbers are auto-generated (format: INV-YYYYMM-0001)

### 🌸 Bouquet Type Management

**Accessing Settings:**

1. Click the ⚙️ settings icon in the header
2. You'll see the bouquet types management page

**Managing Bouquet Types:**

- **Add new:** Click "+ Add bouquet type"
- **Edit:** Click "Edit" on any bouquet card
- **Activate/Deactivate:** Click "Activate" or "Deactivate"
- **Reorder:** Drag and drop bouquets using the handle (⋮⋮)
- **Delete:** Open edit dialog and click "Delete"

**Bouquet Fields:**

- **Name:** Bouquet type name (required)
- **Default Price:** Auto-fills in order form when selected
- **Description:** Optional description for reference
- **Status:** Active bouquets appear in order form dropdown

**How it works:**

- When creating an order, the bouquet dropdown loads from the database
- Selecting a bouquet auto-fills the price
- Only active bouquets show in the order form
- Order is preserved by drag-and-drop arrangement

### 👥 Enhanced Client Management

**Client List Features:**

1. **Sorting Options:**

   - Name (A-Z) - Alphabetical
   - Order Count - Clients with most orders first
   - Total Spent - Highest revenue clients first
   - Recent Activity - Most recent orders first

2. **Search:**

   - Type in the search box to filter by name, email, or phone
   - Real-time filtering as you type

3. **Client Analytics:**

   - **Total Clients:** Count of unique clients
   - **Total Revenue:** Sum of all order values
   - Statistics appear at the top when clients exist

4. **Client Cards Show:**
   - Contact information (phone, email)
   - Total number of orders
   - Total amount spent

---

## Database Schema Overview

### Bouquet Types Table

```sql
bouquet_types (
  id, name, price_hkd, description,
  is_active, sort_order, created_at
)
```

### Invoices Table

```sql
invoices (
  id, invoice_number, client_id, client_name,
  client_email, client_phone, invoice_date, due_date,
  subtotal, tax, total, status, notes,
  created_at, sent_at, paid_at, updated_at
)
```

### Invoice Items Table

```sql
invoice_items (
  id, invoice_id, order_id, description,
  quantity, unit_price, amount, created_at
)
```

### Updated Orders Table

New fields added:

- `bouquet_type` - Selected bouquet name
- `price_hkd` - Order price
- `delivery_time_slot` - Delivery time window
- `card_message` - Message for gift card

---

## Configuration Options

### Invoice Number Format

Edit the `generate_invoice_number()` function in Supabase if you want a different format:

```sql
-- Default: INV-202410-0001
-- Change to your preferred format
```

### Default Bouquet Types

The migration includes 5 default bouquet types:

- Peony Sunrise (HKD 1500)
- Lavender Mist (HKD 1200)
- Autumn Ember (HKD 1350)
- Emerald Cascade (HKD 1600)
- Rose Quartz (HKD 1450)

You can modify or delete these in the Settings page.

---

## Mobile Optimization

The app is fully optimized for mobile use:

**Responsive Design:**

- Tab navigation switches to 2×2 grid on mobile
- Forms adjust to single column
- Touch-friendly buttons and inputs

**Mobile Workflows:**

- Quick order entry on the go
- Swipe-friendly interface
- Optimized for one-handed use

---

## Troubleshooting

### PWA Not Installing

- Ensure you're accessing via HTTPS (GitHub Pages uses HTTPS automatically)
- Check browser compatibility (Chrome, Safari, Edge recommended)
- Clear browser cache and try again

### Bouquets Not Showing in Order Form

- Check if bouquets are marked as "Active" in Settings
- Verify the `bouquet_types` table exists in Supabase
- Check browser console for errors

### Invoice Number Generation Fails

- Ensure the `generate_invoice_number()` function exists in Supabase
- Fallback will generate based on current date and count
- Check Supabase logs for errors

### Icons Not Showing

- Generate icons using `generate-icons.html`
- Place in `icons/` directory with correct names
- Clear browser cache
- Check file paths in `manifest.json`

---

## Future Enhancements

The following features are planned for future updates:

1. **PDF Invoice Generation**

   - Branded PDF templates
   - Email integration
   - Batch PDF creation

2. **Notifications**

   - Browser push notifications for upcoming deliveries
   - Email reminders for unpaid invoices
   - Order confirmation notifications

3. **Reporting Dashboard**

   - Monthly revenue charts
   - Popular bouquet analysis
   - Client acquisition trends
   - Fulfillment metrics

4. **Bulk Operations**

   - Multi-select orders
   - Batch status updates
   - CSV export

5. **Order Templates**
   - Save frequent orders as templates
   - "Repeat last order" quick action
   - Client-specific defaults

---

## Support

For issues or questions:

1. Check the browser console for error messages
2. Verify Supabase connection and RLS policies
3. Ensure all migrations have been run
4. Check that icons are properly generated

---

## Version History

**v2.0** (Current)

- Added PWA support with offline functionality
- Implemented invoice management system
- Dynamic bouquet type management
- Enhanced client sorting and filtering
- Client analytics and revenue tracking
- Mobile-optimized UX improvements

**v1.0**

- Basic order management
- Client tracking
- Calendar view
- Supabase integration

