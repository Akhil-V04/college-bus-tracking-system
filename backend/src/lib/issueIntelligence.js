const { generateEmbedding } = require('./aiProvider');
const { findSimilar } = require('./vectorStore');
const prisma = require('./prisma');

// Similarity threshold for semantic matching
const MATCH_THRESHOLD = 0.82;
const TIME_WINDOW_HOURS = 12;

/**
 * Process a new feedback report for semantic clustering.
 * 
 * @param {Object} report The saved FeedbackReport object
 */
async function processReportForClustering(report) {
  try {
    // 1. Generate Embedding for the report
    const textToEmbed = `Category: ${report.category}. Description: ${report.description}. ${report.additionalInfo || ''}`;
    const embedding = await generateEmbedding(textToEmbed);
    
    if (!embedding || embedding.length === 0) {
      return null;
    }

    // Save the report embedding
    await prisma.reportEmbedding.create({
      data: {
        reportId: report.id,
        embeddingArray: embedding,
        modelVersion: process.env.EMBEDDING_MODEL || 'text-embedding-004'
      }
    });

    // 2. Find Candidate Issues based on deterministic context
    // We only want to cluster with recent issues on the same route/category
    const recentTime = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);
    
    // Find reports in the same context to check their embeddings
    const contextReports = await prisma.feedbackReport.findMany({
      where: {
        id: { not: report.id },
        category: report.category,
        routeServiceId: report.routeServiceId,
        createdAt: { gte: recentTime }
      },
      select: {
        id: true,
        issueId: true
      }
    });
    
    if (contextReports.length === 0) {
      return await createNewIssue(report);
    }
    
    const contextReportIds = contextReports.map(r => r.id);
    
    // Get embeddings for those context reports
    const embeddings = await prisma.reportEmbedding.findMany({
      where: {
        reportId: { in: contextReportIds }
      }
    });
    
    // 3. Perform semantic similarity search
    const matches = findSimilar(
      embedding, 
      embeddings.map(e => ({ id: e.reportId, embeddingArray: e.embeddingArray })),
      MATCH_THRESHOLD
    );
    
    if (matches.length > 0) {
      // Find the issue associated with the best match
      const bestMatchReportId = matches[0].id;
      const matchReport = contextReports.find(r => r.id === bestMatchReportId);
      
      if (matchReport && matchReport.issueId) {
        // Attach to existing issue
        return await attachToIssue(report.id, matchReport.issueId);
      }
    }
    
    // 4. Create a new issue if no matches
    return await createNewIssue(report);
    
  } catch (error) {
    console.error('Error clustering report:', error);
    // Don't fail the original submission, just log error
    return null;
  }
}

async function createNewIssue(report) {
  const issue = await prisma.issue.create({
    data: {
      title: `${report.category} Issue (Auto-generated)`,
      category: report.category,
      routeServiceId: report.routeServiceId,
      status: 'NEW',
      reportCount: 1,
      firstReportAt: report.createdAt,
      latestReportAt: report.createdAt
    }
  });
  
  await prisma.feedbackReport.update({
    where: { id: report.id },
    data: { issueId: issue.id }
  });
  
  return issue;
}

async function attachToIssue(reportId, issueId) {
  // Attach report
  await prisma.feedbackReport.update({
    where: { id: reportId },
    data: { issueId: issueId }
  });
  
  // Update issue stats
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: {
      reportCount: { increment: 1 },
      latestReportAt: new Date()
    }
  });
  
  return issue;
}

module.exports = {
  processReportForClustering
};
