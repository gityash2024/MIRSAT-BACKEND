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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const inspectionController = __importStar(require("../controllers/inspection.controller"));
const inspectionValidation = __importStar(require("../validations/inspection.validation"));
const router = express_1.default.Router();
router.post('/', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('create_inspections'), (0, validate_middleware_1.validate)(inspectionValidation.createInspectionLevel), inspectionController.createInspectionLevel);
router.get('/', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('view_inspections'), (0, validate_middleware_1.validate)(inspectionValidation.queryInspectionLevels), inspectionController.getInspectionLevels);
router.get('/:inspectionId', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('view_inspections'), (0, validate_middleware_1.validate)(inspectionValidation.getInspectionLevel), inspectionController.getInspectionLevel);
router.patch('/:inspectionId', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('edit_inspections'), (0, validate_middleware_1.validate)(inspectionValidation.updateInspectionLevel), inspectionController.updateInspectionLevel);
router.delete('/:inspectionId', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('delete_inspections'), (0, validate_middleware_1.validate)(inspectionValidation.deleteInspectionLevel), inspectionController.deleteInspectionLevel);
router.patch('/:inspectionId/sub-levels/:subLevelId', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('edit_inspections'), inspectionController.updateSubLevel);
router.post('/:inspectionId/sub-levels/reorder', auth_middleware_1.protect, (0, auth_middleware_1.hasPermission)('edit_inspections'), inspectionController.reorderSubLevels);
exports.default = router;
//# sourceMappingURL=inspection.routes.js.map