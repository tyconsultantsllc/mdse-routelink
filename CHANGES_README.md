# Priority stops: click-to-select interaction + pharmacy request flow

Builds on the `priority-stops.zip` delivery from a moment ago (same
migration `028_priority_stops.sql` - no new migration here). This changes
two things based on your last message:

## 1. Click-to-select interaction (instead of a checkbox)

**Admin - Add Route / Edit Route:** each stop's "Dropoff Address" field now
has a small "Mark as priority" pill next to its label. Click it to flag
that stop - it turns into an amber "⭐ Priority stop" pill, the address
field gets an amber ring, and a designated-time picker (15-min increments)
appears right underneath. Click it again to un-mark. A stop that's already
been delivered/failed/returned shows its priority status read-only, same
as the rest of that row's fields.

**Pharmacy - Request a Route** (the screen in your screenshot): every
parsed/typed stop is now clickable. Click anywhere on an address row to
flag it as priority - the pin icon becomes a filled star, the row gets an
amber highlight, and a "Requested time" field appears inline for that stop.
Click the row again to un-flag it. The remove (X) button still works
independently without triggering the toggle.

## 2. Pharmacy-flagged priority now survives into the real route

Previously this only existed in the admin-side create/edit forms. Now:
- A pharmacy's priority flag + requested time on a submitted route request
  is visible to the admin on the **Route Requests** page (a "Priority" badge
  with the time, right under that address) *before* they even open Assign
  Driver.
- When an admin assigns a driver to that request, whatever the pharmacy
  flagged now carries through into the real `route_stops` row - it's no
  longer silently dropped at that step. From there it shows up everywhere
  the last delivery already wired up: the driver app, the admin map, and
  the routes table.

## Files changed
- `components/request-route-dialog.tsx` - click-to-select priority + time
  per stop, pharmacy side.
- `components/add-route-modal.tsx` / `components/edit-route-modal.tsx` -
  swapped the checkbox for the click-the-address pill described above.
- `app/actions/data-actions.ts` - `createRouteRequest` accepts
  `isPriority`/`requestedTime` per stop (stored as-is in the existing JSONB
  column, no schema change); `assignRouteRequestToDriver` now carries those
  into the created route's real stops instead of dropping them.
- `app/admin/route-requests/page.tsx` - shows the priority badge + time on
  each pending request's stop list.

## Nothing to run in Supabase for this one
No new migration - this reuses the `is_priority` / `designated_time`
columns from `028_priority_stops.sql`. If you haven't run that one yet,
run it first (see the previous delivery's README).
