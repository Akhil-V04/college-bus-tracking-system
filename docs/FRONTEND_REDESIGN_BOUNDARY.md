# Frontend implementation boundary

Status: the stable-contract frontend implementation is complete locally. Visual branding may still be redesigned, but the screens now cover required administrator, passenger and driver workflows.

## Replaceable presentation

Colors, typography, icons, animation, component libraries and layout composition may change. Frontends must continue consuming the stable `/api/v1` contract rather than reimplementing business rules.

## Non-negotiable behavior

- one route/bus-number selector and no registration-number field;
- no passenger accounts, QR boarding or bus-attendance claims;
- visible Student/Faculty differentiation;
- phone numbers only in administrator responses;
- capacity is assigned roster count, not current occupancy;
- draft/validate/publish/archive lifecycle for schedules and annual rosters;
- passed/missed stops never show a negative ETA;
- drivers control only their assigned running trip; and
- late alerts use assigned students/advisor mappings, not boarding scans.

## Implemented surfaces

- `admin-panel`: dashboard, routes/capacity, schedules, annual roster exchange, drivers, advisors, alert/delivery recovery, operations, audit history and revocable sessions.
- `mobile-app`: public route list/detail, Track Bus map, boarding timeline/times, assigned names with type badges, complete ETA-state feedback, driver authentication/trip recovery, background GPS and bounded offline queue.

Visual/accessibility acceptance must still be repeated in the target browsers and real Android development build before release.