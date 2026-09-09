# Live Trip, GPS, Progress, and ETA Contract

This backend contract keeps passenger information honest when requests race, the driver reconnects, GPS is unreliable, or route progress is ambiguous. It is a transparent baseline algorithm, not a machine-learning claim.

## Trip lifecycle

### Start or resume

`POST /trips/start`

- A driver token starts only its assigned route. An administrator must supply a matching `driverId` and `routeServiceId`.
- PostgreSQL partial unique indexes permit only one `RUNNING` trip per route and per driver.
- Simultaneous start requests converge on the same trip: one creates it and the other receives the existing trip with `resumed: true`.
- The trip captures the currently published roster and route schedule versions.
- A successful new trip begins with `trackingState: NO_LIVE_DATA`; a resumed trip reports `RECOVERING` until its tracking snapshot is fetched.

### Driver reconnect

`GET /trips/mine`

Returns the driver's running trip plus a `tracking` snapshot containing:

- `state`: `NO_LIVE_DATA`, `STALE_LOCATION`, or `LIVE`;
- the last accepted location and its server receipt time;
- the last sample time, whether it was accepted, and a safe rejection reason.

The running trip is stored in PostgreSQL, so an app or server restart does not create a new trip.

### End

`POST /trips/:id/end`

Ending uses a compare-and-set update from `RUNNING` to `COMPLETED`. Concurrent retries are idempotent: exactly one response reports `alreadyEnded: false`; later calls return the recorded completion with `alreadyEnded: true`.

## GPS socket contract

Driver event: `driver:location`

Required fields:

- `tripId`
- `latitude`
- `longitude`

Optional quality fields:

- `deviceTimestamp`
- `accuracyMeters`
- `deviceSpeedKmh`

Every event is authorized against the authenticated driver's current session and trip ownership. Server receipt time remains authoritative. A `(tripId, deviceTimestamp)` partial unique index makes replay after reconnect idempotent.

Rejected samples are retained diagnostically with `acceptedForEta: false` and one of:

- `POOR_ACCURACY`
- `DEVICE_TIMESTAMP_TOO_OLD`
- `DEVICE_TIMESTAMP_IN_FUTURE`
- `DUPLICATE_SAMPLE`
- `OUT_OF_ORDER_SAMPLE`
- `IMPOSSIBLE_SPEED`

Rejected points do not move the public bus marker, advance stop progress, or influence ETA. The current thresholds are 200 metres maximum reported accuracy, five minutes maximum queued age, two minutes maximum future clock skew, and 120 km/h maximum calculated movement.

## Route progress

- Progress is monotonic and serialized with a PostgreSQL row lock for each trip.
- Entering the next stop's 150-metre radius records `REACHED` and advances the index.
- If a reliable point is near a later stop while earlier stops were never reached, those earlier stops become `POSSIBLY_SKIPPED`; the system does not falsely claim a confirmed stop.
- A point more than two kilometres from the stop-to-stop route polyline returns `OFF_ROUTE` and does not advance progress.
- Reaching the last configured stop returns `ROUTE_COMPLETED`; the trip remains operationally `RUNNING` until the driver ends it.

The off-route and skipped-stop rules use stop coordinates, not full road geometry. They are intentionally conservative and must be calibrated during real-route testing. Future road map-matching can replace the geometry implementation without changing the public state names.

## ETA states

An ETA response returns one of:

- `NOT_STARTED`
- `NO_LIVE_DATA`
- `GPS_UNRELIABLE`
- `STALE_LOCATION`
- `OFF_ROUTE`
- `NOT_MOVING`
- `ARRIVING`
- `UPCOMING`
- `AT_STOP`
- `PASSED`
- `POSSIBLY_SKIPPED`
- `ROUTE_COMPLETED`
- `TRIP_ENDED`
- `NO_SCHEDULE`
- `INVALID_STOP`

`PASSED`, `POSSIBLY_SKIPPED`, `OFF_ROUTE`, `STALE_LOCATION`, `GPS_UNRELIABLE`, `NOT_MOVING`, `ROUTE_COMPLETED`, and `TRIP_ENDED` return no invented live ETA. When a stop was selected, unavailable-live-data responses include its published `scheduledTime` as a clearly labelled fallback. Passed stops never receive negative minutes.

The baseline ETA uses recent accepted server-timestamped movement, distance through the ordered stop chain, a confidence label, and a widening range. Multiple stationary observations pause the ETA instead of pretending the bus is travelling at the default speed.

## Passenger and server events

- `join:trip` validates the trip and acknowledges success/failure.
- `bus:update` is emitted once to the union of the trip and route rooms, preventing duplicate delivery to a socket that joined both.
- `trip:stale` is emitted once when a running trip crosses the stale/missing-data threshold.
- `trip:recovered` is emitted when reliable data resumes.
- `trip:ended` is emitted once when the lifecycle transition succeeds.

The stale monitor rebuilds its view from persisted running trips, so a backend restart does not hide an already stale route.
