import mongoose from 'mongoose';

/**
 * A mongoose schema plugin that transforms the document for JSON serialization
 * - Removes MongoDB specific fields like __v, createdAt, updatedAt
 * - Transforms _id to id
 */
export const toJSON = (schema: mongoose.Schema) => {
  let transform: Function | undefined;
  const toJSONConfig = schema.get('toJSON');
  
  if (toJSONConfig && typeof toJSONConfig.transform === 'function') {
    transform = toJSONConfig.transform;
  }

  schema.set('toJSON', Object.assign(schema.get('toJSON') || {}, {
    transform(doc: any, ret: any, options: any) {
      // Convert _id to id
      if (ret._id) {
        ret.id = ret._id.toString();
        delete ret._id;
      }

      // Remove __v (version key)
      delete ret.__v;

      // Call the original transform if it exists
      if (transform) {
        return transform(doc, ret, options);
      }

      return ret;
    },
  }));
};

/**
 * A mongoose schema plugin that adds pagination functionality
 * - Provides a static paginate method to the model
 */
export const paginate = (schema: mongoose.Schema) => {
  /**
   * @typedef {Object} QueryResult
   * @property {Document[]} results - Results found
   * @property {number} page - Current page
   * @property {number} limit - Maximum number of results per page
   * @property {number} totalPages - Total number of pages
   * @property {number} totalResults - Total number of documents
   */
  /**
   * Query for documents with pagination
   * @param {Object} [filter] - Mongo filter
   * @param {Object} [options] - Query options
   * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
   * @param {number} [options.limit] - Maximum number of results per page (default = 10)
   * @param {number} [options.page] - Current page (default = 1)
   * @param {string} [options.search] - Search term to filter by title and description
   * @returns {Promise<QueryResult>}
   */
  schema.static('paginate', async function(filter: Record<string, any>, options: Record<string, any>) {
    let sort = '';
    if (options.sortBy) {
      const sortingCriteria: string[] = [];
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
}; 