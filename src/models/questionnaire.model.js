const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const questionSchema = mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'yesno', 'radio', 'checkbox', 'dropdown', 'compliance', 'file', 'date'],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  requirementType: {
    type: String,
    enum: ['mandatory', 'recommended'],
    default: 'mandatory'
  },
  weight: {
    type: Number,
    default: 1
  },
  options: [{
    text: String,
    value: String,
    score: {
      type: Number,
      default: 0
    }
  }],
  scoring: {
    enabled: {
      type: Boolean,
      default: false
    },
    max: {
      type: Number,
      default: 1
    }
  },
  scores: {
    type: Map,
    of: Number
  }
});

const questionnaireSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      enum: ['safety', 'health', 'environment', 'quality', 'other'],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft'
    },
    createdBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true
    },
    questions: [questionSchema],
    metadata: {
      usedInTemplates: {
        type: Number,
        default: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }
  },
  {
    timestamps: true
  }
);

// Add plugin that converts mongoose to json
questionnaireSchema.plugin(toJSON);

// Add paginate plugin
if (paginate) {
  questionnaireSchema.plugin(paginate);
}

/**
 * @typedef Questionnaire
 */
const Questionnaire = mongoose.model('Questionnaire', questionnaireSchema);

module.exports = Questionnaire; 