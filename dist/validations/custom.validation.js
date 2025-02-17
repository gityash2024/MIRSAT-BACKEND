"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = exports.objectId = void 0;
const objectId = (value, helpers) => {
    if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message('"{{#label}}" must be a valid mongo id');
    }
    return value;
};
exports.objectId = objectId;
const validateSchema = (schema) => {
    return (data) => {
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            const message = error.details.map((detail) => detail.message).join(', ');
            return { error: message };
        }
        return { value };
    };
};
exports.validateSchema = validateSchema;
//# sourceMappingURL=custom.validation.js.map