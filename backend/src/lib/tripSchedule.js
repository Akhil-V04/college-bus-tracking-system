function operationalStops(trip) {
  const snapshotStops = trip?.scheduleSnapshot?.stops;
  if (Array.isArray(snapshotStops) && snapshotStops.length) {
    return snapshotStops.map((entry) => ({
      id: entry.scheduleStopId,
      stopId: entry.stopId,
      sequenceOrder: entry.sequenceOrder,
      scheduledTime: entry.scheduledTime,
      stop: {
        id: entry.stopId,
        name: entry.name,
        latitude: entry.latitude,
        longitude: entry.longitude,
      },
    }));
  }
  return trip?.scheduleVersion?.stops || [];
}

module.exports = { operationalStops };
