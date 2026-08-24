// Haversine distance between two lat/lng points, in meters.
//
// The problem: the Earth is (approximately) a sphere, so you can't just use the
// Pythagorean theorem on latitude/longitude degrees. A degree of longitude is
// ~111 km at the equator but shrinks to 0 km at the poles, while a degree of
// latitude stays roughly constant. So we convert the points to actual
// *angular positions* on the sphere and measure the great-circle distance
// between them.
//
// The haversine formula:
//
//   a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
//   c = 2 · atan2(√a, √(1−a))
//   d = R · c
//
// where:
//   φ1, φ2  = latitudes  of the two points (in radians)
//   λ1, λ2  = longitudes of the two points (in radians)
//   Δφ       = φ2 − φ1
//   Δλ       = λ2 − λ1
//   R        = mean Earth radius in meters (6,371,000)
//
// `a` is the haversine of the angular distance — it combines the two angular
// differences, weighted by the cosines of the latitudes so that longitude
// differences "shrink" correctly as you move away from the equator. `c` is the
// central angle (in radians) subtended at the center of the Earth by the arc
// between the two points, and multiplying it by the radius R gives the arc
// length on the surface.
//
// For the short distances we care about (bus stops are < a few km apart) this
// is more than accurate enough — error is well under 1%.
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // mean Earth radius in meters

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = haversineDistance;