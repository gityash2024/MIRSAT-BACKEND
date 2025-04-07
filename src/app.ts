import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';
import notificationRoutes from './routes/notification.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import taskRoutes from './routes/task.routes';
import assetRoutes from './routes/asset.routes';
import roleRoutes from './routes/role.routes';

const app = express();
if (process.env.NODE_ENV === 'development') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}
logger.info('Initializing application...');

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://mirsat-frontend.vercel.app', 'http://localhost:5173','http://localhost:5174','https://mirsat.mymultimeds.com'],
  methods: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 100000 // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all routes
app.use('/api', limiter);

// Routes
app.use('/api/v1', routes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/notifications', notificationRoutes);

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
