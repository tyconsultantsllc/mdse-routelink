# Driver timesheets + admin approval (v2 — adds CSV export + real push)

**This zip replaces the earlier `driver-timesheets-feature.zip` entirely.**
If you haven't applied that one yet, just use this one instead — it has
everything, plus CSV export and a real push alert to admins. If you already
applied the first one, this re-delivers every file in that feature with the
two additions layered on top.

## What this adds, end to end

**For drivers** (clock-icon "My Timesheet" button in the driver portal
header):
- See the current week's hours, computed automatically from their routes
  until an admin approves a specific correction for a day.
- Request a change to any day (clock in/out, break minutes) with a required
  reason — never changes their timesheet directly, just files a request.
- See each day's status: "From routes," "Pending approval," or "Approved."

**For admins** (new "Timesheets" page in the sidebar, pending-count badge):
- An approval queue for every driver's requested changes — approve (writes
  the correction) or reject (optional note), either way the driver is
  notified.
- A second section to browse any driver's week and correct an entry
  directly, no request needed.
- **New: "Export week as CSV"** button — exports every driver's hours for
  the displayed week to a CSV (Driver, Date, Clock In, Clock Out, Break,
  Hours, Status). This is time tracking only — there's no pay rate anywhere
  in your schema, so the export reports hours, not pay. Days with nothing
  recorded are left out rather than padding the file with blank rows.
- **New: a real push notification** when a driver submits a request — not
  just the in-app bell, an actual push to an admin's phone, the same way
  drivers already get pushed when a route is assigned. Requires push to be
  set up per `SETUP.md`'s "Push Notifications" section (Firebase project +
  `google-services.json` + the three `FIREBASE_*` env vars +
  `NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true`) — if you've already done
  that for driver/pharmacy push, admins now get it too with no extra setup;
  an admin just needs to open the Android app once (logged in) so their
  device registers, same as drivers do.

## Files in this zip

- `scripts/031_driver_timesheets.sql` — unchanged from before (see the
  numbering warning below if you haven't run it yet).
- `app/actions/data-actions.ts` — adds `getWeeklyTimesheetReport` (CSV data)
  and wires `requestTimesheetEdit` to push admins.
- `lib/notifications.ts` — adds `pushAdminsTimesheetEditRequested`.
- `components/admin-header.tsx` — registers the logged-in admin's device
  for push (same hook drivers/pharmacies already use).
- `app/admin/timesheets/page.tsx` — adds the "Export week as CSV" button.
- `components/admin-sidebar.tsx`, `components/driver-timesheet-dialog.tsx`,
  `app/driver/page.tsx` — unchanged from the first delivery, included so
  this zip is complete on its own.

## ⚠️ Migration numbering (same note as before)

If you already have a `scripts/031_driver_active_status.sql` from an
earlier delivery, rename `scripts/031_driver_timesheets.sql` to
`032_driver_timesheets.sql` before running it, so your scripts stay in
order. If you already ran it from the first timesheets zip, you don't need
to run it again — nothing in the schema changed this round.

## Steps to apply

1. Unzip into your project folder, overwriting existing files.
2. Rename the migration if needed (see above), and run it in Supabase if
   you haven't already.
3. Commit and push:
   ```powershell
   git add -A
   git commit -m "Add CSV export and real push alerts to driver timesheets"
   git push
   ```
4. If you haven't set up push notifications at all yet, that's a separate,
   one-time Firebase setup — see `SETUP.md`'s "Push Notifications" section.
   Until that's done, this still works exactly the same except the push
   itself quietly no-ops (same as it already does for driver/pharmacy push
   today) — the in-app bell and the CSV export don't depend on it at all.

## Still not built (same as last time)

No pay calculation and no hourly-rate concept — still pure time tracking,
per your note. If a payroll need comes up later (e.g. exporting a full pay
period instead of one week, or flagging weeks over 40h), that's still a
separate ask whenever you want it.
