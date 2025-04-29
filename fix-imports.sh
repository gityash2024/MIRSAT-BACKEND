#!/bin/bash

# Files that need to be fixed
FILES=(
  "src/middleware/error.middleware.ts"
  "src/controllers/task.controller.ts"
  "src/controllers/UserTaskController.ts"
  "src/controllers/questionnaire.controller.ts"
  "src/controllers/questionLibrary.controller.ts"
  "src/controllers/notification.controller.ts"
  "src/controllers/assetType.controller.ts"
  "src/controllers/asset.controller.ts"
  "src/controllers/inspection.controller.ts"
  "src/services/upload.service.ts"
)

# Loop through each file and replace the import
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    # Use sed to replace the import pattern
    sed -i '' -e 's/import { ApiError } from/import ApiError from/g' "$file"
  else
    echo "File not found: $file"
  fi
done

echo "Import fixes completed!" 