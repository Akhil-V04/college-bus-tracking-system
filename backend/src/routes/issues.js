const express = require('express');
const prisma = require('../lib/prisma');
const { processReportForClustering } = require('../lib/issueIntelligence');
// Assuming adminAuth is in auth.js
// const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/v1/issues/report
 * Public endpoint for passengers to report an issue
 */
router.post('/report', async (req, res) => {
  try {
    const { category, description, routeServiceId, tripId, additionalInfo, fingerprintHash } = req.body;
    
    // Basic validation
    if (!category || !description || !fingerprintHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Save the report
    const report = await prisma.feedbackReport.create({
      data: {
        category,
        description,
        routeServiceId: routeServiceId || null,
        tripId: tripId || null,
        additionalInfo,
        fingerprintHash
      }
    });

    // 2. Trigger AI Clustering in the background (don't await so we respond fast)
    processReportForClustering(report).catch(e => console.error('Background clustering failed:', e));

    res.status(201).json({ success: true, reportId: report.id });
    
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

/**
 * GET /api/v1/issues
 * Admin endpoint to view clustered issues
 */
router.get('/', async (req, res) => {
  // Should ideally have requireAdmin middleware here
  try {
    const issues = await prisma.issue.findMany({
      orderBy: { latestReportAt: 'desc' },
      include: {
        routeService: { select: { routeNo: true } }
      }
    });
    
    res.json(issues);
  } catch (error) {
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
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {})
      }
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
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * POST /api/v1/issues/:id/merge
 * Admin endpoint to merge one issue into another
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
      data: { issueId: targetIssueId }
    });
    
    // Update target issue count
    const sourceReportsCount = await prisma.feedbackReport.count({
      where: { issueId: targetIssueId }
    });
    
    const targetIssue = await prisma.issue.update({
      where: { id: targetIssueId },
      data: { reportCount: sourceReportsCount }
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
