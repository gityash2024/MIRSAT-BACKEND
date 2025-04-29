import 'dotenv/config';
import app from './app';
import connectDB from './config/database';
import { logger } from './utils/logger';
import { createServer } from 'http';
import { socketService } from './services/socket.service';
import { reminderService } from './services/reminder.service';
// Import models to ensure plugins are applied
import './models';

const httpServer = createServer(app);
socketService.initialize(httpServer);

const PORT = process.env.PORT || 5001;


connectDB().then(() => {
  httpServer.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    
    // Initialize reminder service jobs
    reminderService.initJobs();
    logger.info('Scheduled jobs initialized');
  });
})
  .catch((error) => {
    logger.error('Database connection failed', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});