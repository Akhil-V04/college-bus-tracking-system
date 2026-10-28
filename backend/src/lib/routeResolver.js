const prisma = require('./prisma');

/**
 * Resolve a RouteService record from loose user inputs:
 * e.g. "8", "08", "RT08", "Route 8", or from additionalInfo like "Route: 8 | Location: Ecil"
 *
 * @param {string|number} routeInput
 * @param {string} [additionalInfo]
 * @returns {Promise<Object|null>} RouteService with driver included
 */
async function resolveRouteService(routeInput, additionalInfo) {
  try {
    let raw = (routeInput || '').toString().trim();

    // If no direct route number, extract from additionalInfo "Route: 8 | Location: ..."
    if (!raw && additionalInfo) {
      const match = additionalInfo.match(/Route:\s*([^\s|]+)/i);
      if (match) raw = match[1].trim();
    }

    if (!raw) return null;

    // Normalize: strip 'RT', 'Route', '#', whitespace
    const clean = raw
      .replace(/^RT/i, '')
      .replace(/^Route\s*/i, '')
      .replace(/^#/, '')
      .trim();

    const num = parseInt(clean, 10);
    const padded = !isNaN(num) && num < 100 ? String(num).padStart(2, '0') : clean;

    const route = await prisma.routeService.findFirst({
      where: {
        OR: [
          { routeNo: { equals: raw, mode: 'insensitive' } },
          { routeNo: { equals: clean, mode: 'insensitive' } },
          { routeNo: { equals: padded, mode: 'insensitive' } },
          { name: { contains: `Route ${clean}`, mode: 'insensitive' } },
          { name: { contains: `Route ${padded}`, mode: 'insensitive' } },
        ],
      },
      include: {
        driver: { select: { id: true, name: true, phone: true, driverCode: true } },
      },
    });

    return route;
  } catch (error) {
    console.error('Error resolving route service:', error);
    return null;
  }
}

module.exports = {
  resolveRouteService,
};
