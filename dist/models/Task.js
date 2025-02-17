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
exports.Task = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const taskProgressSchema = new mongoose_1.Schema({
    subLevelId: { type: mongoose_1.Schema.Types.ObjectId, required: true, ref: 'InspectionLevel.subLevels' },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
    },
    completedAt: { type: Date },
    completedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    photos: [{ type: String }],
    signoff: {
        signedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
        signedAt: { type: Date },
        comments: { type: String }
    }
});
const taskSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, 'Task title is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Task description is required'],
    },
    assignedTo: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'incomplete', 'partially_completed'],
        default: 'pending',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
    },
    deadline: {
        type: Date,
        required: true,
    },
    location: {
        type: String,
    },
    inspectionLevel: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'InspectionLevel',
        required: true,
    },
    progress: [taskProgressSchema],
    overallProgress: {
        type: Number,
        default: 0,
    },
    attachments: [{
            url: String,
            filename: String,
            contentType: String,
        }],
    comments: [{
            user: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            content: {
                type: String,
                required: true,
            },
            attachments: [{
                    url: String,
                    filename: String,
                }],
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    statusHistory: [{
            status: {
                type: String,
                required: true,
            },
            changedBy: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            comment: String,
            attachments: [{
                    url: String,
                    filename: String,
                }],
            timestamp: {
                type: Date,
                default: Date.now,
            },
        }],
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
taskSchema.index({ status: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ deadline: 1 });
exports.Task = mongoose_1.default.model('Task', taskSchema);
//# sourceMappingURL=Task.js.map