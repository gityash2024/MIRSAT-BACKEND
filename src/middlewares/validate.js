// Adapter to use new middleware structure with old v1 routes
const { validate: newValidate } = require('../middleware/validate.middleware');

const validate = (schema) => {
  return newValidate(schema);
};

module.exports = validate; 