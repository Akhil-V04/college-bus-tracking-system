const { generateEmbedding } = require('./aiProvider');
const { findSimilar } = require('./vectorStore');
const { resolveRouteService } = require('./routeResolver');
const prisma = require('./prisma');

// Similarity threshold for semantic matching
const MATCH_THRESHOLD = 0.78;
const TIME_WINDOW_HOURS = 24;

/**
 * Format a clean human-readable title for an issue based on route and driver
 */
function formatIssueTitle(routeService, category, reportCount = 1) {
  const routeNo = routeService?.routeNo || 'General';
  const driverName = routeService?.driver?.name;

  if (category === 'DRIVER_BEHAVIOUR' || category === 'DRIVING') {
    const driverPart = driverName ? ` [Driver: ${driverName}]` : '';
    if (reportCount >= 2) {
      return `⚠️ Route ${routeNo}: Multiple Driver Complaints (${reportCount} reports)${driverPart}`;
    }
    return `Route ${routeNo}: Driver Complaint${driverPart}`;
  }

  if (category === 'BUS_CONDITION') {
    if (reportCount >= 2) {
      return `⚠️ Route ${routeNo}: Repeated Bus Condition Reports (${reportCount} reports)`;
    }
    return `Route ${routeNo}: Bus Condition Issue`;
  }

  if (category === 'SCHEDULE_ISSUE') {
    if (reportCount >= 2) {
      return `⚠️ Route ${routeNo}: Frequent Schedule Delay (${reportCount} reports)`;
    }
    return `Route ${routeNo}: Schedule Delay Issue`;
  }

  if (category === 'ROUTE_STOP_ISSUE') {
    if (reportCount >= 2) {
      return `Route ${routeNo}: Route / Stop Issues (${reportCount} reports)`;
    }
    return `Route ${routeNo}: Route / Stop Issue`;
  }

  return `${category.replaceAll('_', ' ')} Issue (Route ${routeNo})`;
}

/**
 * Process a new feedback report for smart semantic & route-based clustering.
 * Multiple complaints about the same driver or route are automatically merged
 * into a single unified high-priority issue rather than flooding the admin panel.
 *
 * @param {Object} report The saved FeedbackReport object
 */
async function processReportForClustering(report) {
  try {
    // 1. Ensure routeServiceId is resolved if missing
    if (!report.routeServiceId && report.additionalInfo) {
      const resolved = await resolveRouteService(null, report.additionalInfo);
      if (resolved) {
        report.routeServiceId = resolved.id;
        await prisma.feedbackReport.update({
          where: { id: report.id },
          data: { routeServiceId: resolved.id },
        });
      }
    }

    const isDriverIssue =
      report.category === 'DRIVER_BEHAVIOUR' || report.category === 'DRIVING';

    // 2. SMART MERGE: Driver Complaints on the same route
    // If multiple passengers complain about a driver on a route, merge them all into ONE active issue!
    if (isDriverIssue && report.routeServiceId) {
      const existingDriverIssue = await prisma.issue.findFirst({
        where: {
          routeServiceId: report.routeServiceId,
          category: { in: ['DRIVER_BEHAVIOUR', 'DRIVING'] },
          status: { in: ['NEW', 'UNDER_REVIEW'] },
        },
        include: {
          routeService: { include: { driver: true } },
        },
      });

      if (existingDriverIssue) {
        return await attachToIssue(report, existingDriverIssue.id);
      }
    }

    // 3. Same-Route Active Issue Merge for Vehicle / Schedule issues
    if (report.routeServiceId && (report.category === 'BUS_CONDITION' || report.category === 'SCHEDULE_ISSUE')) {
      const existingRouteIssue = await prisma.issue.findFirst({
        where: {
          routeServiceId: report.routeServiceId,
          category: report.category,
          status: { in: ['NEW', 'UNDER_REVIEW'] },
        },
        include: {
          routeService: { include: { driver: true } },
        },
      });

      if (existingRouteIssue) {
        return await attachToIssue(report, existingRouteIssue.id);
      }
    }

    // 4. Semantic similarity search against recent issue centroids
    const textToEmbed = `Category: ${report.category}. Description: ${report.description}. ${report.additionalInfo || ''}`;
    const embedding = await generateEmbedding(textToEmbed);

    const recentTime = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);
    const candidateIssues = await prisma.issue.findMany({
      where: {
        category: report.category,
        routeServiceId: report.routeServiceId || null,
        status: { in: ['NEW', 'UNDER_REVIEW'] },
        latestReportAt: { gte: recentTime },
      },
      select: {
        id: true,
        embeddingArray: true,
      },
    });

    if (candidateIssues.length > 0 && embedding && embedding.length > 0) {
      const matches = findSimilar(
        embedding,
        candidateIssues.filter((i) => i.embeddingArray && i.embeddingArray.length > 0),
        MATCH_THRESHOLD
      );

      if (matches.length > 0) {
        return await attachToIssue(report, matches[0].id);
      }
    }

    // 5. If no existing active issue matched, create a new issue with clean route metadata
    return await createNewIssue(report, embedding || []);
  } catch (error) {
    console.error('Error clustering report:', error);
    return null;
  }
}

async function createNewIssue(report, embedding) {
  let routeService = null;
  if (report.routeServiceId) {
    routeService = await prisma.routeService.findUnique({
      where: { id: report.routeServiceId },
      include: { driver: true },
    });
  }

  const title = formatIssueTitle(routeService, report.category, 1);

  const issue = await prisma.issue.create({
    data: {
      title,
      category: report.category,
      routeServiceId: report.routeServiceId || null,
      status: 'NEW',
      reportCount: 1,
      firstReportAt: report.createdAt,
      latestReportAt: report.createdAt,
      representativeText: report.description,
      embeddingArray: embedding || [],
      modelVersion: process.env.EMBEDDING_MODEL || 'text-embedding-004',
    },
  });

  await prisma.feedbackReport.update({
    where: { id: report.id },
    data: { issueId: issue.id },
  });

  return issue;
}

async function attachToIssue(report, issueId) {
  // 1. Link report to the target issue
  await prisma.feedbackReport.update({
    where: { id: report.id },
    data: { issueId },
  });

  // 2. Count total linked reports
  const totalReports = await prisma.feedbackReport.count({
    where: { issueId },
  });

  // 3. Fetch issue with route and driver details to update title
  const currentIssue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      routeService: { include: { driver: true } },
    },
  });

  let updatedTitle = currentIssue?.title;
  if (currentIssue?.routeService) {
    updatedTitle = formatIssueTitle(
      currentIssue.routeService,
      currentIssue.category,
      totalReports
    );
  }

  // 4. Update issue stats, latestReportAt, and title
  const updatedIssue = await prisma.issue.update({
    where: { id: issueId },
    data: {
      reportCount: totalReports,
      latestReportAt: new Date(),
      title: updatedTitle,
      status: currentIssue.status === 'RESOLVED' ? 'NEW' : currentIssue.status,
    },
  });

  return updatedIssue;
}

module.exports = {
  processReportForClustering,
  formatIssueTitle,
};
