# Region-aware maps (SoCal / Minnesota / both)

## What changed

Both admin maps now respect region, each giving a distinct view per region
plus the ability to show both together:

**Dashboard map** (`app/admin/page.tsx` → "Live Driver Locations"):
- Added a region dropdown (the same "All Regions / Southern California /
  Minnesota" control already used on Drivers, Pharmacies, Performance, and
  Reports) right above the map.
- Picking a region now filters both the driver markers and the route lines
  to that region only, and the map automatically zooms/centers tightly on
  whichever drivers are actually out there (falling back to that region's
  general area if no one's currently active).
- Picking "All Regions" shows every driver/route from both regions
  together on one map, zoomed out to fit all of them - this is also
  exactly what it did before this change, so nothing changes if you never
  touch the new dropdown.

**Routes map** (`app/admin/routes/page.tsx` → "Active Routes Map"):
- This page already had a region dropdown, but it only filtered the route
  list below the map - the map itself always showed every region's routes
  regardless of what was selected. That's now fixed: the map filters by
  the same dropdown, and (since this map already auto-fits to whatever
  routes it's drawing) a single region's routes now naturally zoom in on
  just that region, while "All Regions" fits both together like before.

## Files changed

- `components/admin-map.tsx` — accepts a new optional `region` prop, used
  only to decide where to center/zoom when there's nothing live to fit
  around; otherwise behaves exactly as before.
- `app/admin/page.tsx` — adds the region dropdown + state, tags each driver
  and route with its region, and filters what's passed to the map.
- `app/admin/routes/page.tsx` — the existing region dropdown's state now
  also filters the map's route list (previously only filtered the table),
  plus a one-line wording update under the map saying so.

No database changes — this is all built from region data your app already
has (`drivers.region`, and each route's region derived from its stops'
pharmacies, the same way the Routes page already computed it).

## Steps to apply

1. Unzip into your project folder, overwriting the three existing files.
2. Commit and push:
   ```powershell
   git add -A
   git commit -m "Make admin maps region-aware (SoCal / Minnesota / both)"
   git push
   ```
3. Test: open the Dashboard, switch the new region dropdown above the map
   and confirm it narrows to that region's drivers; open Routes, switch its
   existing dropdown and confirm the map (not just the table below it) now
   changes too.

## Worth knowing

- If a region currently has zero active drivers, the dashboard map falls
  back to that region's general area (same fallback coordinates already
  used elsewhere in the app for Orange County, CA / St. Paul, MN) rather
  than showing an empty continental-US view.
- I didn't add any color-coding to distinguish SoCal vs. Minnesota markers
  when "All Regions" is selected (e.g. tinting one region's drivers
  differently from the other's) - happy to add that if it'd help tell the
  two apart at a glance on the combined view.
- This dropdown's choice isn't remembered between page visits (it resets to
  "All Regions" each time you load the page) - matches how the same
  dropdown already behaves on every other page it's used on. Let me know
  if you'd rather it stick to whatever you last picked.
