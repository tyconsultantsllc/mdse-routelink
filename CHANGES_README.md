# Priority stops with a designated delivery time

## What this adds
When creating (or editing) a route, you can now mark **any individual stop**
as a **Priority Stop** and give it a **Designated Delivery Time** — e.g.
"this one needs to be there by 2:30 PM." This is separate from the existing
route-level Priority field (Low/Medium/High/Urgent), which only describes
the route as a whole and can't call out one stop among several.

## Where it shows up
- **Add Route / Edit Route modals**: each stop card now has a "Priority
  stop" checkbox; checking it reveals a 15-minute-increment time picker for
  the designated time.
- **Driver app**: a priority stop gets an amber "⭐ Priority" badge (with the
  designated time, if set) both in the full stop list and in the "Next
  Stop" summary card, and its card is highlighted amber so it stands out at
  a glance.
- **Admin Routes page**: the map's "View on Map" now draws priority stops as
  a distinct amber circle marker (instead of the default pin) with the time
  in its popup, and the routes table shows a "⭐ N priority" badge under the
  stop count for any route that has one.
- **Recurring series**: marking a stop priority when creating a recurring
  route carries into every generated occurrence, and editing "this and
  following" occurrences propagates the change the same way the rest of a
  route's stops already do.

## Migration - run this first
Run `scripts/028_priority_stops.sql` in the Supabase SQL Editor before
deploying this code. It adds two nullable/defaulted columns to
`route_stops` (`is_priority boolean default false`, `designated_time time`),
so it's safe to run even with the app already live - existing stops just
default to "not priority."

## Files changed
- `scripts/028_priority_stops.sql` (new migration)
- `app/actions/data-actions.ts` - `createRoute`, `createRouteSeries`,
  `updateRoute`, `updateRouteOccurrence`, and the shared
  `insertRouteWithStops` helper now accept/persist `isPriority` +
  `designatedTime` per stop, including keeping the series template and
  future occurrences in sync.
- `components/add-route-modal.tsx` - per-stop Priority Stop checkbox +
  designated-time input; the route optimizer's reorder step now preserves
  these fields instead of dropping them.
- `components/edit-route-modal.tsx` - same UI, disabled for stops that
  already have a real delivery outcome recorded (same rule as the rest of
  that form).
- `app/driver/page.tsx` - priority badge + designated time shown on each
  stop and on the "Next Stop" preview.
- `components/route-map.tsx` - priority stops draw as a distinct amber
  marker with the designated time in the popup.
- `app/admin/routes/page.tsx` - "⭐ N priority" badge on the routes table.

## Notes / things I didn't add
- The designated time is informational for the driver - it doesn't block
  starting/completing a stop early or late, and it doesn't change stop
  ordering. If you'd rather it enforce sequencing (e.g. force this stop
  first) or gate something, let me know and I can add that.
- Copying an existing route ("Copy" on the calendar) doesn't carry over
  priority/time from the original, since a copy is usually a different
  date/context - easy to change if you'd rather it did.
