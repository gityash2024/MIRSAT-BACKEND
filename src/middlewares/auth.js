// Adapter to use new middleware structure with old v1 routes
const { protect, hasPermission } = require('../middleware/auth.middleware');

const auth = (permission) => {
  return [
    // First middleware to prepare the request for compatibility
    (req, res, next) => {
      // Add user field to req if not exists
      if (!req.user) {
        req.user = {};
      }
      
      // Log authentication headers for debugging
      console.log('Auth middleware request headers:', {
        authorization: req.headers.authorization ? 'Bearer xxx...' : undefined,
        path: req.path,
        method: req.method
      });
      
      next();
    }, 
    // Standard auth middleware from new structure
    protect, 
    // Ensure the user object has both id and _id properties
    (req, res, next) => {
      if (req.user) {
        // Ensure both id and _id are available for compatibility
        if (req.user._id && !req.user.id) {
          req.user.id = req.user._id.toString();
        } else if (req.user.id && !req.user._id) {
          req.user._id = req.user.id;
        }
        
        console.log('User authenticated:', {
          id: req.user.id || req.user._id,
          permissions: req.user.permissions,
          path: req.path
        });
      }
      
      next();
    },
    // Check permissions
    hasPermission(permission)
  ];
};

module.exports = auth; 