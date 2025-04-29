const mongoose = require('mongoose');

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message('{{#label}} must be a valid MongoDB ObjectId');
  }
  return value;
};

module.exports = {
  objectId,
}; 