const httpStatus = require('http-status');
const Questionnaire = require('../models/questionnaire.model');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

/**
 * Create a questionnaire
 */
const createQuestionnaire = async (req, res) => {
  try {
    console.log('Create Questionnaire Request:', {
      body: req.body,
      userId: req.user?.id || req.user?._id,
      path: req.path
    });
    
    if (!req.user || (!req.user.id && !req.user._id)) {
      console.error('No user ID found in request');
      return res.status(httpStatus.UNAUTHORIZED).send({ 
        message: 'User not authenticated or user ID missing'
      });
    }
    
    // Ensure createdBy is set to the user's ID
    const questionnaireData = {
      ...req.body,
      createdBy: req.user.id || req.user._id
    };
    
    console.log('Creating questionnaire with data:', questionnaireData);
    
    const questionnaire = await Questionnaire.create(questionnaireData);
    console.log('Questionnaire created successfully:', questionnaire._id);
    
    res.status(httpStatus.CREATED).send(questionnaire);
  } catch (error) {
    console.error('Error creating questionnaire:', error);
    res.status(httpStatus.BAD_REQUEST).send({ 
      message: error.message,
      error: error.stack
    });
  }
};

/**
 * Get questionnaires with pagination
 */
const getQuestionnaires = async (req, res) => {
  try {
    const filter = {};
    const { title, category, status, search, page = 1, limit = 10, sortBy } = req.query;
    
    console.log('Questionnaires API Request:', { 
      userId: req.user?.id,
      query: req.query,
      path: req.path
    });

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (title) filter.title = { $regex: title, $options: 'i' };
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (status) filter.status = { $regex: status, $options: 'i' };

    const sort = sortBy ? sortBy.split(',').join(' ') : '-createdAt';
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    console.log('MongoDB Query:', { filter, sort, limit: limitNum, skip });

    // Get total count first
    const totalResults = await Questionnaire.countDocuments(filter);
    console.log('Total results count:', totalResults);
    
    // Then get the data
    const questionnaires = await Questionnaire.find(filter)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .populate('createdBy', 'name email')
      .lean();
    
    console.log('Found questionnaires:', questionnaires.length);
    
    // Create a sample questionnaire if none exist
    if (totalResults === 0 && questionnaires.length === 0) {
      console.log('No questionnaires found. Creating a sample one...');
      try {
        const sampleQuestionnaire = await Questionnaire.create({
          title: 'Sample Questionnaire',
          description: 'This is a sample questionnaire created automatically',
          category: 'safety',
          status: 'draft',
          createdBy: req.user.id || req.user._id,
          questions: [
            {
              text: 'Is safety equipment available?',
              type: 'yesno',
              required: true,
              requirementType: 'mandatory',
              weight: 1
            }
          ]
        });
        
        console.log('Sample questionnaire created:', sampleQuestionnaire._id);
        
        const response = {
          results: [sampleQuestionnaire],
          page: pageNum,
          limit: limitNum,
          totalPages: 1,
          totalResults: 1,
        };
        
        return res.send(response);
      } catch (sampleError) {
        console.error('Failed to create sample questionnaire:', sampleError);
      }
    }

    const response = {
      results: questionnaires,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalResults / limitNum) || 1,
      totalResults,
    };
    
    console.log('Sending response with results:', response.results.length);
    
    res.send(response);
  } catch (error) {
    console.error('Error in getQuestionnaires:', error);
    res.status(httpStatus.BAD_REQUEST).send({ 
      message: error.message,
      error: error.stack
    });
  }
};

/**
 * Get a questionnaire by id
 */
const getQuestionnaire = async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id)
      .populate('createdBy', 'name email')
      .lean();
      
    if (!questionnaire) {
      return res.status(httpStatus.NOT_FOUND).send({ message: 'Questionnaire not found' });
    }
    
    res.send(questionnaire);
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST).send({ message: error.message });
  }
};

/**
 * Update a questionnaire
 */
const updateQuestionnaire = async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(httpStatus.NOT_FOUND).send({ message: 'Questionnaire not found' });
    }

    // Set last updated timestamp
    if (req.body.metadata) {
      req.body.metadata.lastUpdated = new Date();
    } else {
      req.body.metadata = {
        usedInTemplates: questionnaire.metadata?.usedInTemplates || 0,
        lastUpdated: new Date()
      };
    }

    Object.assign(questionnaire, req.body);
    await questionnaire.save();
    res.send(questionnaire);
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST).send({ message: error.message });
  }
};

/**
 * Delete a questionnaire
 */
const deleteQuestionnaire = async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(httpStatus.NOT_FOUND).send({ message: 'Questionnaire not found' });
    }
    
    await questionnaire.deleteOne();
    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST).send({ message: error.message });
  }
};

/**
 * Duplicate a questionnaire
 */
const duplicateQuestionnaire = async (req, res) => {
  try {
    const questionnaire = await Questionnaire.findById(req.params.id);
    if (!questionnaire) {
      return res.status(httpStatus.NOT_FOUND).send({ message: 'Questionnaire not found' });
    }

    const questionnaireCopy = questionnaire.toObject();
    delete questionnaireCopy._id;
    delete questionnaireCopy.id;
    delete questionnaireCopy.createdAt;
    delete questionnaireCopy.updatedAt;
    
    questionnaireCopy.title = `${questionnaireCopy.title} (Copy)`;
    questionnaireCopy.status = 'draft';
    questionnaireCopy.createdBy = req.user.id;
    questionnaireCopy.metadata = {
      usedInTemplates: 0,
      lastUpdated: new Date()
    };

    const newQuestionnaire = await Questionnaire.create(questionnaireCopy);
    res.status(httpStatus.CREATED).send(newQuestionnaire);
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST).send({ message: error.message });
  }
};

module.exports = {
  createQuestionnaire,
  getQuestionnaires,
  getQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  duplicateQuestionnaire
}; 