const express = require('express');
const prisma = require('../lib/prisma');
const { processReportForClustering } = require('../lib/issueIntelligence');
const { resolveRouteService } = require('../lib/routeResolver');
const router = express.Router();

/**
 * POST /api/v1/issues/report
 * Public endpoint for passengers to report an issue
 */
router.post('/report', async (req, res) => {
  try {
    const { category, description, routeNumber, routeNo, tripId, additionalInfo, fingerprintHash } = req.body;
    let { routeServiceId } = req.body;

    // Basic validation
    if (!category || !description || !fingerprintHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Auto-resolve routeServiceId if not provided or if string route was provided
    if (!routeServiceId) {
      const candidateRoute = routeNo || routeNumber;
      const resolved = await resolveRouteService(candidateRoute, additionalInfo);
      if (resolved) {
        routeServiceId = resolved.id;
      }
    }

    // 1. Save the report
    const report = await prisma.feedbackReport.create({
      data: {
        category,
        description,
        routeServiceId: routeServiceId ? Number(routeServiceId) : null,
        tripId: tripId ? Number(tripId) : null,
        additionalInfo: additionalInfo || null,
        fingerprintHash,
      },
    });

    // 2. Trigger smart AI clustering and auto-merging in the background
    processReportForClustering(report).catch((e) =>
      console.error('Background clustering failed:', e)
    );

    res.status(201).json({ success: true, reportId: report.id });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

/**
 * GET /api/v1/issues
 * Admin endpoint to view clustered issues, sorted by priority
 * Multiple complaints regarding the same driver or route are automatically prioritized at the top
 */
router.get('/', async (_req, res) => {
  try {
    const issues = await prisma.issue.findMany({
      include: {
        routeService: {
          select: {
            id: true,
            routeNo: true,
            name: true,
            driver: {
              select: { id: true, name: true, phone: true, driverCode: true },
            },
          },
        },
        _count: {
          select: { reports: true },
        },
      },
    });

    // Compute smart priority and ranking
    const scoredIssues = issues.map((issue) => {
      const isDriverIssue =
        issue.category === 'DRIVER_BEHAVIOUR' || issue.category === 'DRIVING';

      let priority = 'NORMAL';
      let priorityScore = 10;

      if (isDriverIssue && issue.reportCount >= 2) {
        priority = 'URGENT'; // Top Priority: Multiple driver complaints on this route
        priorityScore = 100;
      } else if (issue.reportCount >= 3) {
        priority = 'HIGH';
        priorityScore = 80;
      } else if (isDriverIssue) {
        priority = 'ELEVATED';
        priorityScore = 50;
      } else if (issue.reportCount >= 2) {
        priority = 'ELEVATED';
        priorityScore = 40;
      }

      // Solved issues stay at the bottom
      if (issue.status === 'RESOLVED' || issue.status === 'DISMISSED') {
        priorityScore = 0;
      }

      return {
        ...issue,
        priority,
        priorityScore,
        driverName: issue.routeService?.driver?.name || null,
        driverPhone: issue.routeService?.driver?.phone || null,
        routeName: issue.routeService?.name || null,
      };
    });

    // Sort by priorityScore DESC, then reportCount DESC, then latestReportAt DESC
    scoredIssues.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
      return new Date(b.latestReportAt).getTime() - new Date(a.latestReportAt).getTime();
    });

    res.json(scoredIssues);
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

/**
 * PATCH /api/v1/issues/:id
 * Admin endpoint to update issue status
 */
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const issue = await prisma.issue.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    });
    res.json(issue);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

/**
 * GET /api/v1/issues/:id/reports
 * Get all linked reports for an issue
 */
router.get('/:id/reports', async (req, res) => {
  try {
    const reports = await prisma.feedbackReport.findMany({
      where: { issueId: req.params.id },
      include: {
        routeService: { select: { routeNo: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * POST /api/v1/issues/:id/merge
 * Admin endpoint to merge one issue into another manually if needed
 */
router.post('/:id/merge', async (req, res) => {
  try {
    const sourceIssueId = req.params.id;
    const { targetIssueId } = req.body;

    if (!targetIssueId) {
      return res.status(400).json({ error: 'Target issue ID is required' });
    }

    // Move all reports from source to target
    await prisma.feedbackReport.updateMany({
      where: { issueId: sourceIssueId },
      data: { issueId: targetIssueId },
    });

    // Update target issue count
    const totalCount = await prisma.feedbackReport.count({
      where: { issueId: targetIssueId },
    });

    const targetIssue = await prisma.issue.update({
      where: { id: targetIssueId },
      data: { reportCount: totalCount, latestReportAt: new Date() },
    });

    // Delete source issue
    await prisma.issue.delete({ where: { id: sourceIssueId } });

    res.json(targetIssue);
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Failed to merge issues' });
  }
});

module.exports = router;
