# Region color-coding on the Dashboard map

Builds on the last delivery (region-aware maps). Two things:

## 1. Color-coded driver markers when showing both regions

On the Dashboard's "Live Driver Locations" map, when "All Regions" is
selected, each driver marker now gets a colored ring around it — amber for
SoCal, indigo for Minnesota — so you can tell the two apart at a glance on
the combined view. The marker's fill color is unchanged (still
green/amber for active/on-break) — that's the more urgent signal, so
region is a second, separate channel (the ring) rather than replacing it.

A small legend ("● SoCal driver  ● Minnesota driver") appears above the map
only when "All Regions" is selected — once you narrow to one region, every
marker would get the same ring, so the legend (and the ring itself) stays
out of the way.

The driver's region is also now shown in their map popup (e.g. "Active ·
SoCal"), for when you click a marker directly.

I kept this to the Dashboard's driver markers specifically, since that's
what you flagged as useful for the combined view. The Routes page's map
still colors route lines by priority (urgent/high/medium/low) — I left
that alone since overriding it with region color would bury that signal.
Say the word if you want region color there too and we can figure out how
to show both without clashing.

## 2. The region dropdown already resets to "All Regions"

No change needed here — both dropdowns (Dashboard and Routes) already
reset to "All Regions" on every page load, same as the other pages that
use this same control. That was the existing behavior I was describing
last time, not something that needed building.

## Files changed

- `lib/region-utils.ts` — adds `REGION_MAP_COLORS` (hex versions of the
  same amber/indigo used in region badges elsewhere, for contexts like a
  Leaflet marker that can't use Tailwind classes).
- `components/admin-map.tsx` — driver markers get a region-colored ring
  when `region="all"`, and the popup shows the driver's region.
- `app/admin/page.tsx` — adds the small legend above the map, shown only
  when "All Regions" is selected.

## Steps to apply

1. Unzip into your project folder, overwriting the three files.
2. Commit and push:
   ```powershell
   git add -A
   git commit -m "Color-code driver markers by region on the combined dashboard map"
   git push
   ```
3. Test: open the Dashboard with "All Regions" selected and confirm driver
   markers show a colored ring (amber/indigo) and the legend appears above
   the map; switch to a single region and confirm the ring and legend both
   disappear (every marker shown is already that region, so there's
   nothing to distinguish).
