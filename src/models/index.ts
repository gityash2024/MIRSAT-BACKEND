import mongoose from 'mongoose';
import { toJSON, paginate } from './plugins';

// Import all models
import { User } from './User';
import InspectionLevel from './InspectionLevel';
import Questionnaire from './questionnaire.model';
import { Task } from './Task';
import { Asset } from './Asset';
import { AssetType } from './AssetType';
import QuestionLibrary from './QuestionLibrary';
import { Role } from './Role';
import { Notification } from './Notification';

// Ensure toJSON and paginate plugins are applied to all models that don't already have them
// This ensures consistent serialization behavior across all models
const models = [
  { model: InspectionLevel, name: 'InspectionLevel' },
  { model: User, name: 'User' },
  { model: Task, name: 'Task' },
  { model: Asset, name: 'Asset' },
  { model: AssetType, name: 'AssetType' },
  { model: QuestionLibrary, name: 'QuestionLibrary' },
  { model: Role, name: 'Role' },
  { model: Notification, name: 'Notification' }
];

// For models that don't have the plugins applied in their schema definition
// This is a safety measure to ensure all models have consistent serialization
models.forEach(({ model, name }) => {
  try {
    const schema = mongoose.model(name).schema;
    
    // Apply toJSON plugin if not already applied
    if (!schema.get('toJSON') || !schema.get('toJSON').transform) {
      schema.plugin(toJSON);
    }
    
    // Apply paginate plugin to all schemas for consistency
    // The existence of the method will be checked at runtime
    schema.plugin(paginate);
  } catch (error) {
    console.warn(`Could not apply plugins to model ${name}:`, error);
  }
});

// Export all models
export {
  User,
  InspectionLevel,
  Questionnaire,
  Task, 
  Asset,
  AssetType,
  QuestionLibrary,
  Role,
  Notification
}; 