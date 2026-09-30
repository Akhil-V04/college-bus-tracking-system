const { generateEmbedding } = require('./aiProvider');
const { findSimilar } = require('./vectorStore');
const prisma = require('./prisma');

// Similarity threshold for semantic matching
const MATCH_THRESHOLD = 0.82;
const TIME_WINDOW_HOURS = 12;

/**
 * Process a new feedback report for semantic clustering using centroid embeddings.
 * 
 * @param {Object} report The saved FeedbackReport object
 */
async function processReportForClustering(report) {
  try {
    // 1. Generate temporary embedding for the report
    const textToEmbed = `Category: ${report.category}. Description: ${report.description}. ${report.additionalInfo || ''}`;
    const embedding = await generateEmbedding(textToEmbed);
    
    if (!embedding || embedding.length === 0) {
      return null;
    }

    // 2. Find Active Issues based on deterministic context
    // We only want to cluster with recent issues on the same route/category that are not resolved
    const recentTime = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);
    
    const candidateIssues = await prisma.issue.findMany({
      where: {
        category: report.category,
        routeServiceId: report.routeServiceId,
        status: { in: ['NEW', 'UNDER_REVIEW'] },
        latestReportAt: { gte: recentTime }
      },
      select: {
        id: true,
        embeddingArray: true
      }
    });
    
    if (candidateIssues.length === 0) {
      return await createNewIssue(report, embedding);
    }
    
    // 3. Perform semantic similarity search against Issue Centroids
    const matches = findSimilar(
      embedding, 
      candidateIssues.filter(i => i.embeddingArray && i.embeddingArray.length > 0),
      MATCH_THRESHOLD
    );
    
    if (matches.length > 0) {
      // Find the issue associated with the best match
      const bestMatchIssueId = matches[0].id;
      
      // Attach to existing issue
      return await attachToIssue(report, bestMatchIssueId);
    }
    
    // 4. Create a new issue if no matches
    return await createNewIssue(report, embedding);
    
  } catch (error) {
    console.error('Error clustering report:', error);
    // Don't fail the original submission, just log error
    return null;
  }
}

async function createNewIssue(report, embedding) {
  const issue = await prisma.issue.create({
    data: {
      title: `${report.category} Issue (Auto-generated)`,
      category: report.category,
      routeServiceId: report.routeServiceId,
      status: 'NEW',
      reportCount: 1,
      firstReportAt: report.createdAt,
      latestReportAt: report.createdAt,
      representativeText: report.description,
      embeddingArray: embedding,
      modelVersion: process.env.EMBEDDING_MODEL || 'text-embedding-004'
    }
  });
  
  await prisma.feedbackReport.update({
    where: { id: report.id },
    data: { issueId: issue.id }
  });
  
  return issue;
}

async function attachToIssue(report, issueId) {
  // Attach report
  await prisma.feedbackReport.update({
    where: { id: report.id },
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

