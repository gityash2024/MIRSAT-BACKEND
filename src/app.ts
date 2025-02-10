import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';

const app = express();
if (process.env.NODE_ENV === 'development') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}
logger.info('Initializing application...');

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'https://mirsat-frontend.vercel.app',
  methods: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all routes
app.use('/api', limiter);

// Routes
app.use('/api/v1', routes);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Handle unhandled routes
app.all('*', (req, res) => {
  logger.warn(`Route not found: ${req.originalUrl}`);
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Error handling middleware
app.use(errorHandler);

logger.info('Application initialized successfully');

export default app;
