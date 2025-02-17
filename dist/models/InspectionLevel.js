"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const subLevelSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    order: { type: Number, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });
const inspectionLevelSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['safety', 'environmental', 'operational', 'quality']
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'inactive', 'draft', 'archived'],
        default: 'active'
    },
    priority: {
        type: String,
        required: true,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
    },
    subLevels: [subLevelSchema],
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    completionCriteria: {
        requiredPhotos: { type: Boolean, default: false },
        requiredNotes: { type: Boolean, default: false },
        requiredSignoff: { type: Boolean, default: false }
    },
    assignedTasks: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Task' }],
    metrics: {
        completedTasks: { type: Number, default: 0 },
        activeInspectors: { type: Number, default: 0 },
        avgCompletionTime: { type: Number, default: 0 },
        complianceRate: { type: Number, default: 0 }
    },
    attachments: [{
            url: String,
            filename: String,
            contentType: String
        }],
    comments: [{
            user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            content: { type: String, required: true },
            attachments: [{
                    url: String,
                    filename: String
                }],
            createdAt: { type: Date, default: Date.now }
        }],
    statusHistory: [{
            status: { type: String, required: true },
            changedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
            comment: String,
            attachments: [{
                    url: String,
                    filename: String
                }],
            timestamp: { type: Date, default: Date.now }
        }],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
inspectionLevelSchema.index({ name: 1 });
inspectionLevelSchema.index({ type: 1 });
inspectionLevelSchema.index({ status: 1 });
inspectionLevelSchema.index({ createdBy: 1 });
inspectionLevelSchema.index({ priority: 1 });
inspectionLevelSchema.index({ isActive: 1 });
exports.default = mongoose_1.default.model('InspectionLevel', inspectionLevelSchema);
//# sourceMappingURL=InspectionLevel.js.map