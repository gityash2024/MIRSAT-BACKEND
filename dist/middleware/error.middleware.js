"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const ApiError_1 = require("../utils/ApiError");
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    let error = err;
    logger_1.logger.error('Error 💥:', err);
    if (err.name === 'CastError') {
        error = new ApiError_1.ApiError('Resource not found', 404);
    }
    if (err.code === 11000) {
        error = new ApiError_1.ApiError('Duplicate field value entered', 400);
    }
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors)
            .map((val) => val.message)
            .join(', ');
        error = new ApiError_1.ApiError(message, 400);
    }
    const statusCode = error instanceof ApiError_1.ApiError ? error.statusCode : 500;
    const message = error.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        error: Object.assign({ statusCode,
            message }, (process.env.NODE_ENV === 'development' && { stack: err.stack })),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.middleware.js.map