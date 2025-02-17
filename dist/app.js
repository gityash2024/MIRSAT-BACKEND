"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const logger_1 = require("./utils/logger");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const app = (0, express_1.default)();
if (process.env.NODE_ENV === 'development') {
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.specs));
}
logger_1.logger.info('Initializing application...');
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: ['https://mirsat-frontend.vercel.app', 'http://localhost:5173', 'https://mirsat.mymultimeds.com'],
    methods: '*',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api', limiter);
app.use('/api/v1', routes_1.default);
app.get('/', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
});
app.all('*', (req, res) => {
    logger_1.logger.warn(`Route not found: ${req.originalUrl}`);
    res.status(404).json({
        status: 'error',
        message: `Can't find ${req.originalUrl} on this server!`
    });
});
app.use(error_middleware_1.errorHandler);
logger_1.logger.info('Application initialized successfully');
exports.default = app;
//# sourceMappingURL=app.js.map