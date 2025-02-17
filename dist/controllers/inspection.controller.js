"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderSubLevels = exports.updateSubLevel = exports.deleteInspectionLevel = exports.updateInspectionLevel = exports.getInspectionLevel = exports.getInspectionLevels = exports.createInspectionLevel = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = require("../utils/catchAsync");
const ApiError_1 = require("../utils/ApiError");
const InspectionLevel_1 = __importDefault(require("../models/InspectionLevel"));
const lodash_1 = require("lodash");
exports.createInspectionLevel = (0, catchAsync_1.catchAsync)(async (req, res) => {
    var _a, _b;
    const inspectionData = Object.assign(Object.assign({}, req.body), { createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id, updatedBy: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id });
    const inspection = await InspectionLevel_1.default.create(inspectionData);
    res.status(http_status_1.default.CREATED).send(inspection);
});
exports.getInspectionLevels = (0, catchAsync_1.catchAsync)(async (req, res) => {
    var _a;
    const filter = (0, lodash_1.pick)(req.query, ['name', 'type', 'status', 'priority']);
    const options = (0, lodash_1.pick)(req.query, ['sortBy', 'limit', 'page', 'populate']);
    const search = req.query.search;
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }
    Object.keys(filter).forEach(key => {
        if (key !== '$or' && filter[key]) {
            if (Array.isArray(filter[key])) {
                filter[key] = { $in: filter[key] };
            }
            else {
                filter[key] = { $regex: filter[key], $options: 'i' };
            }
        }
    });
    const sortBy = ((_a = options.sortBy) === null || _a === void 0 ? void 0 : _a.split(',').join(' ')) || '-createdAt';
    const limit = parseInt(options.limit) || 10;
    const page = parseInt(options.page) || 1;
    const skip = (page - 1) * limit;
    const [inspections, count] = await Promise.all([
        InspectionLevel_1.default.find(filter)
            .sort(sortBy)
            .limit(limit)
            .skip(skip)
            .populate(options.populate || '')
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .populate('assignedTasks', 'title description status'),
        InspectionLevel_1.default.countDocuments(filter)
    ]);
    res.send({
        results: inspections,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        totalResults: count,
    });
});
exports.getInspectionLevel = (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.params.inspectionId) {
        throw new ApiError_1.ApiError(http_status_1.default.BAD_REQUEST, 'Inspection ID is required');
    }
    const inspection = await InspectionLevel_1.default.findById(req.params.inspectionId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('assignedTasks', 'title description status');
    if (!inspection) {
        throw new ApiError_1.ApiError(http_status_1.default.NOT_FOUND, 'Inspection level not found');
    }
    res.send(inspection);
});
exports.updateInspectionLevel = (0, catchAsync_1.catchAsync)(async (req, res) => {
    var _a;
    if (!req.params.inspectionId) {
        throw new ApiError_1.ApiError(http_status_1.default.BAD_REQUEST, 'Inspection ID is required');
    }
    const inspection = await InspectionLevel_1.default.findById(req.params.inspectionId);
    if (!inspection) {
        throw new ApiError_1.ApiError(http_status_1.default.NOT_FOUND, 'Inspection level not found');
    }
    const updateData = Object.assign(Object.assign({}, req.body), { updatedBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id });
    Object.assign(inspection, updateData);
    await inspection.save();
    const updatedInspection = await InspectionLevel_1.default.findById(inspection._id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('assignedTasks', 'title description status');
    res.send(updatedInspection);
});
exports.deleteInspectionLevel = (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.params.inspectionId) {
        throw new ApiError_1.ApiError(http_status_1.default.BAD_REQUEST, 'Inspection ID is required');
    }
    const inspection = await InspectionLevel_1.default.findById(req.params.inspectionId);
    if (!inspection) {
        throw new ApiError_1.ApiError(http_status_1.default.NOT_FOUND, 'Inspection level not found');
    }
    if (inspection.assignedTasks && inspection.assignedTasks.length > 0) {
        throw new ApiError_1.ApiError(http_status_1.default.BAD_REQUEST, 'Cannot delete inspection level with associated tasks');
    }
    await inspection.deleteOne();
    res.status(http_status_1.default.NO_CONTENT).send();
});
exports.updateSubLevel = (0, catchAsync_1.catchAsync)(async (req, res) => {
    var _a;
    const { inspectionId, subLevelId } = req.params;
    if (!inspectionId || !subLevelId) {
        throw new ApiError_1.ApiError(http_status_1.default.BAD_REQUEST, 'Inspection ID and Sub Level ID are required');
    }
    const inspection = await InspectionLevel_1.default.findById(inspectionId);
    if (!inspection) {
        throw new ApiError_1.ApiError(http_status_1.default.NOT_FOUND, 'Inspection level not found');
    }
    const subLevel = inspection.subLevels.id(subLevelId);
    if (!subLevel) {
        throw new ApiError_1.ApiError(http_status_1.default.NOT_FOUND, 'Sub level not found');
    }
    Object.assign(subLevel, req.body);
    inspection.updatedBy = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    await inspection.save();
    const updatedInspection = await InspectionLevel_1.default.findById(inspectionId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('assignedTasks', 'title description status');
    res.send(updatedInspection);
});
exports.reorderSubLevels = (0, catchAsync_1.catchAsync)(async (req, res) => {
    var _a;
    const { inspectionId } = req.params;
    const { newOrder } = req.body;
    if (!inspectionId || !newOrder) {
        throw new ApiError_1.ApiError(http_status_1.default.BAD_REQUEST, 'Inspection ID and new order are required');
    }
    const inspection = await InspectionLevel_1.default.findById(inspectionId);
    if (!inspection) {
        throw new ApiError_1.ApiError(http_status_1.default.NOT_FOUND, 'Inspection level not found');
    }
    newOrder.forEach((id, index) => {
        const subLevel = inspection.subLevels.id(id);
        if (subLevel) {
            subLevel.order = index;
        }
    });
    inspection.updatedBy = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    await inspection.save();
    const updatedInspection = await InspectionLevel_1.default.findById(inspectionId)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .populate('assignedTasks', 'title description status');
    res.send(updatedInspection);
});
//# sourceMappingURL=inspection.controller.js.map