"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInspectionLevel = exports.updateInspectionLevel = exports.createInspectionLevel = exports.getInspectionLevel = exports.queryInspectionLevels = void 0;
const joi_1 = __importDefault(require("joi"));
const custom_validation_1 = require("./custom.validation");
exports.queryInspectionLevels = {
    query: joi_1.default.object().keys({
        search: joi_1.default.string().allow('', null),
        name: joi_1.default.string(),
        type: joi_1.default.array().items(joi_1.default.string().valid('safety', 'environmental', 'operational', 'quality')),
        status: joi_1.default.array().items(joi_1.default.string().valid('active', 'inactive', 'draft', 'archived')),
        priority: joi_1.default.array().items(joi_1.default.string().valid('high', 'medium', 'low')),
        sortBy: joi_1.default.string(),
        limit: joi_1.default.number().integer(),
        page: joi_1.default.number().integer(),
        populate: joi_1.default.string()
    })
};
exports.getInspectionLevel = {
    params: joi_1.default.object().keys({
        inspectionId: joi_1.default.string().custom(custom_validation_1.objectId).required()
    })
};
exports.createInspectionLevel = {
    body: joi_1.default.object().keys({
        name: joi_1.default.string().required(),
        description: joi_1.default.string().required(),
        type: joi_1.default.string().valid('safety', 'environmental', 'operational', 'quality').required(),
        status: joi_1.default.string().valid('active', 'inactive', 'draft', 'archived'),
        priority: joi_1.default.string().valid('high', 'medium', 'low'),
        subLevels: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().required(),
            description: joi_1.default.string().required(),
            order: joi_1.default.number().required(),
            id: joi_1.default.number(),
            isCompleted: joi_1.default.boolean(),
            completedAt: joi_1.default.date(),
            completedBy: joi_1.default.string().custom(custom_validation_1.objectId)
        })),
        completionCriteria: joi_1.default.object({
            requiredPhotos: joi_1.default.boolean(),
            requiredNotes: joi_1.default.boolean(),
            requiredSignoff: joi_1.default.boolean()
        })
    })
};
exports.updateInspectionLevel = {
    params: joi_1.default.object().keys({
        inspectionId: joi_1.default.string().custom(custom_validation_1.objectId).required()
    }),
    body: joi_1.default.object().keys({
        _id: joi_1.default.string().custom(custom_validation_1.objectId),
        name: joi_1.default.string(),
        description: joi_1.default.string(),
        type: joi_1.default.string().valid('safety', 'environmental', 'operational', 'quality'),
        status: joi_1.default.string().valid('active', 'inactive', 'draft', 'archived'),
        priority: joi_1.default.string().valid('high', 'medium', 'low'),
        metrics: joi_1.default.object({
            completedTasks: joi_1.default.number(),
            activeInspectors: joi_1.default.number(),
            avgCompletionTime: joi_1.default.number(),
            complianceRate: joi_1.default.number()
        }),
        subLevels: joi_1.default.array().items(joi_1.default.object({
            _id: joi_1.default.string().custom(custom_validation_1.objectId).optional(),
            id: joi_1.default.number().optional(),
            name: joi_1.default.string(),
            description: joi_1.default.string(),
            order: joi_1.default.number(),
            isCompleted: joi_1.default.boolean().optional()
        })),
        completionCriteria: joi_1.default.object({
            requiredPhotos: joi_1.default.boolean(),
            requiredNotes: joi_1.default.boolean(),
            requiredSignoff: joi_1.default.boolean()
        }),
        createdBy: joi_1.default.object({
            _id: joi_1.default.string().custom(custom_validation_1.objectId),
            name: joi_1.default.string(),
            email: joi_1.default.string().email()
        }),
        updatedBy: joi_1.default.object({
            _id: joi_1.default.string().custom(custom_validation_1.objectId),
            name: joi_1.default.string(),
            email: joi_1.default.string().email()
        }),
        assignedTasks: joi_1.default.array(),
        isActive: joi_1.default.boolean(),
        attachments: joi_1.default.array(),
        comments: joi_1.default.array(),
        statusHistory: joi_1.default.array(),
        createdAt: joi_1.default.date(),
        updatedAt: joi_1.default.date(),
        __v: joi_1.default.number(),
        id: joi_1.default.string().custom(custom_validation_1.objectId)
    })
};
exports.deleteInspectionLevel = {
    params: joi_1.default.object().keys({
        inspectionId: joi_1.default.string().custom(custom_validation_1.objectId).required()
    })
};
//# sourceMappingURL=inspection.validation.js.map