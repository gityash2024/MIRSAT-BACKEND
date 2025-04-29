import mongoose from 'mongoose';
import { toJSON } from './plugins';

export interface IQuestion {
  text: string;
  type: 'text' | 'number' | 'boolean' | 'multiple-choice' | 'checkbox' | 'date';
  options?: string[];
  required: boolean;
}

export interface IQuestionnaireMetadata {
  usedInTemplates?: number;
  lastUpdated?: Date;
}

export interface IQuestionnaire {
  title: string;
  description?: string;
  category: 'safety' | 'health' | 'environment' | 'quality' | 'other';
  status: 'draft' | 'published';
  questions: IQuestion[];
  createdBy: mongoose.Types.ObjectId | string;
  metadata?: IQuestionnaireMetadata;
  updatedAt: Date;
  createdAt: Date;
}

export interface IQuestionnaireDoc extends IQuestionnaire, mongoose.Document {
  createdAt: Date;
  updatedAt: Date;
  metadata: IQuestionnaireMetadata;
}

export interface IQuestionnaireModel extends mongoose.Model<IQuestionnaireDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<any>;
}

const questionSchema = new mongoose.Schema<IQuestion>({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'boolean', 'multiple-choice', 'checkbox', 'date'],
    default: 'text',
  },
  options: {
    type: [String],
    default: undefined,
  },
  required: {
    type: Boolean,
    default: true,
  },
});

const questionnaireSchema = new mongoose.Schema<IQuestionnaireDoc, IQuestionnaireModel>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['safety', 'health', 'environment', 'quality', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    metadata: {
      type: Object,
      default: () => ({
        usedInTemplates: 0,
        lastUpdated: new Date()
      })
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
questionnaireSchema.plugin(toJSON);

/**
 * Paginate questionnaires
 */
questionnaireSchema.static('paginate', async function (filter, options) {
  let sort = '';
  if (options.sortBy) {
    const sortingCriteria: any[] = [];
    options.sortBy.split(',').forEach((sortOption: string) => {
      const [key, order] = sortOption.split(':');
      sortingCriteria.push((order === 'desc' ? '-' : '') + key);
    });
    sort = sortingCriteria.join(' ');
  } else {
    sort = '-createdAt';
  }

  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;

  // Add search functionality
  if (options.search && filter.$or) {
    filter.$or = [
      { title: { $regex: options.search, $options: 'i' } },
      { description: { $regex: options.search, $options: 'i' } },
    ];
  }

  const countPromise = this.countDocuments(filter).exec();
  const docsPromise = this.find(filter).sort(sort).skip(skip).limit(limit).exec();

  return Promise.all([countPromise, docsPromise]).then((values) => {
    const [totalResults, results] = values;
    const totalPages = Math.ceil(totalResults / limit);
    const result = {
      results,
      page,
      limit,
      totalPages,
      totalResults,
    };
    return Promise.resolve(result);
  });
});

const Questionnaire = mongoose.model<IQuestionnaireDoc, IQuestionnaireModel>('Questionnaire', questionnaireSchema);

export default Questionnaire; 