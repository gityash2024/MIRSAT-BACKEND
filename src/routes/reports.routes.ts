import express from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getPerformanceMetrics,
  getComplianceData,
  getStatusDistribution,
  getTaskCompletion,
  getTrendAnalysis,
  getActivityTimeline,
  getRegionalDistribution,
  getInspectorPerformance
} from '../controllers/reports.controller';

const router = express.Router();

router.use(protect);

router.get('/performance-metrics', getPerformanceMetrics);
router.get('/compliance', getComplianceData);
router.get('/status-distribution', getStatusDistribution);
router.get('/task-completion', getTaskCompletion);
router.get('/trend-analysis', getTrendAnalysis);
router.get('/activity-timeline', getActivityTimeline);
router.get('/regional-distribution', getRegionalDistribution);
router.get('/inspector-performance', getInspectorPerformance);

export default router;