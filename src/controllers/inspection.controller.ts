import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import InspectionLevel from '../models/InspectionLevel';
import { pick } from 'lodash';
import PDFDocument from 'pdfkit';
import * as docx from 'docx';
import { Paragraph, TextRun, Document, Packer } from 'docx';
import mongoose from 'mongoose';

interface IQuestion {
  id?: string;
  _id?: string;
  text: string;
  answerType: string;
  options?: string[];
  required: boolean;
  levelId?: mongoose.Types.ObjectId | string | undefined;
  description?: string;
  type?: string;
  scoring?: {
    enabled: boolean;
    max: number;
    weights?: Record<string, any>;
  };
  scores?: Record<string, number>;
  requirementType?: string;
  mandatory?: boolean;
}

const flattenSubLevels = <T extends { subLevels?: any[], [key: string]: any }>(
  subLevels: T[], 
  level = 0
): Array<T & { nestLevel: number }> => {
  let result: Array<T & { nestLevel: number }> = [];
  
  if (!subLevels || !Array.isArray(subLevels) || subLevels.length === 0) return result;
  
  subLevels.forEach(subLevel => {
    result.push({ ...subLevel, nestLevel: level });
    
    if (subLevel.subLevels && subLevel.subLevels.length > 0) {
      result = [...result, ...flattenSubLevels(subLevel.subLevels, level + 1)];
    }
  });
  
  return result;
};

const processSubLevels = (subLevels:any) => {
  if (!subLevels || !Array.isArray(subLevels)) return [];

  return subLevels.map((subLevel) => {
    const processedSubLevel = { ...subLevel };
    
    if (subLevel.subLevels && Array.isArray(subLevel.subLevels)) {
      processedSubLevel.subLevels = processSubLevels(subLevel.subLevels);
    }
    
    return processedSubLevel;
  });
};

const processQuestions = (questions: any[]) => {
  if (!questions || !Array.isArray(questions)) return [];
  
  return questions.map((question: any) => {
    if (typeof question === 'object' && question !== null) {
      const processedQuestion = { ...question };
      
      if (question.levelId) {
        try {
          processedQuestion.levelId = mongoose.Types.ObjectId.isValid(question.levelId.toString()) 
            ? new mongoose.Types.ObjectId(question.levelId.toString()) 
            : undefined;
        } catch (err) {
          processedQuestion.levelId = undefined;
        }
      }
      
      if (!processedQuestion.description) {
        processedQuestion.description = '';
      }
      
      return processedQuestion;
    }
    
    try {
      if (typeof question === 'string') {
        return JSON.parse(question);
      }
      return question;
    } catch (error) {
      console.error("Error processing question:", error);
      return {
        text: 'Error parsing question',
        description: '',
        answerType: 'text',
        required: false
      };
    }
  });
};

const processPages = (pages:any) => {
  if (!pages || !Array.isArray(pages)) return [];
  
  return pages.map((page) => {
    const processedPage = { ...page };
    
    if (page.sections && Array.isArray(page.sections)) {
      processedPage.sections = page.sections.map((section: any) => {
        const processedSection = { ...section };
        
        if (section.questions && Array.isArray(section.questions)) {
          processedSection.questions = processQuestions(section.questions);
        }
        
        if (!processedSection.description) {
          processedSection.description = 'No description provided';
        }
        
        return processedSection;
      });
    }
    
    if (!processedPage.description) {
      processedPage.description = 'No description provided';
    }
    
    return processedPage;
  });
};

const convertPagesToSubLevels = (pages: any[]) => {
  if (!pages || !Array.isArray(pages)) return [];
  
  return pages.map((page: any) => {
    const pageLevel = {
      name: page.name,
      description: page.description || 'No description provided',
      order: page.order || 0,
      isCompleted: page.isCompleted || false,
      subLevels: []
    };
    
    if (page.sections && Array.isArray(page.sections)) {
      pageLevel.subLevels = page.sections.map((section: any, index: number) => ({
        name: section.name,
        description: section.description || 'No description provided',
        order: section.order || index,
        isCompleted: section.isCompleted || false,
        questions: section.questions || []
      }));
    }
    
    return pageLevel;
  });
};

export const createInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  const inspectionData: any = {
    ...req.body,
    createdBy: req.user?._id,
    updatedBy: req.user?._id
  };
  
  if (inspectionData.pages) {
    inspectionData.pages = processPages(inspectionData.pages);
    
    inspectionData.subLevels = convertPagesToSubLevels(inspectionData.pages);
    
    const allQuestions: IQuestion[] = [];
    
    inspectionData.pages.forEach((page: any) => {
      if (page.sections) {
        page.sections.forEach((section: any) => {
          if (section.questions && section.questions.length > 0) {
            allQuestions.push(...section.questions);
          }
        });
      }
    });
    
    if (allQuestions.length > 0) {
      inspectionData.questions = processQuestions(allQuestions);
    }
  } 
  else if (inspectionData.subLevels) {
    inspectionData.subLevels = processSubLevels(inspectionData.subLevels);
  }
  
  if (inspectionData.sets && Array.isArray(inspectionData.sets)) {
    inspectionData.sets = inspectionData.sets.map((set: any) => {
      const processedSet = { ...set };
      
      if (set.subLevels && Array.isArray(set.subLevels)) {
        processedSet.subLevels = processSubLevels(set.subLevels);
      }
      
      if (set.questions && Array.isArray(set.questions)) {
        processedSet.questions = processQuestions(set.questions);
      }
      
      if (set.generalQuestions && Array.isArray(set.generalQuestions)) {
        processedSet.generalQuestions = processQuestions(set.generalQuestions);
      }
      
      return processedSet;
    });
  }
  
  if (inspectionData.questions && Array.isArray(inspectionData.questions)) {
    inspectionData.questions = processQuestions(inspectionData.questions);
  }
  
  const inspection = await InspectionLevel.create(inspectionData);
  res.status(httpStatus.CREATED).send(inspection);
});

export const getInspectionLevels = catchAsync(async (req: Request, res: Response) => {
  const filter: any = pick(req.query, ['name', 'type', 'status', 'priority']);
  const options: any = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const search = req.query.search as string;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  Object.keys(filter).forEach(key => {
    if (key !== '$or' && filter[key]) {
      if (Array.isArray(filter[key])) {
        filter[key] = { $in: filter[key] };
      } else {
        filter[key] = { $regex: filter[key], $options: 'i' };
      }
    }
  });

  const sortBy = options.sortBy?.split(',').join(' ') || '-createdAt';
  const limit = parseInt(options.limit) || 10;
  const page = parseInt(options.page) || 1;
  const skip = (page - 1) * limit;

  const [inspections, count] = await Promise.all([
    InspectionLevel.find(filter)
      .sort(sortBy)
      .limit(limit)
      .skip(skip)
      .populate(options.populate || '')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('assignedTasks', 'title description status')
      .lean(),
    InspectionLevel.countDocuments(filter)
  ]);

  res.send({
    results: inspections,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
  });
});

export const getInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID is required');
  }

  const inspection = await InspectionLevel.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status')
    .lean();
    
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  // Convert ObjectId to string ID format
  const processEntity = (entity: any) => {
    if (!entity) return entity;
    return {
      ...entity,
      id: entity._id ? entity._id.toString() : undefined
    };
  };

  // Process questions to ensure they have IDs and standardized format
  const processQuestions = (questions: any[] = []) => {
    if (!questions || !Array.isArray(questions)) return [];
    
    return questions.map(q => ({
      ...q,
      id: q._id ? q._id.toString() : q.id,
      description: q.description || '',
      options: q.options || [],
      scoring: q.scoring || { enabled: false, max: 1 }
    }));
  };
  
  // Process sections recursively
  const processSections = (sections: any[] = []) => {
    if (!sections || !Array.isArray(sections)) return [];
    
    return sections.map(section => {
      const processedSection = processEntity(section);
      if (section.questions && Array.isArray(section.questions)) {
        processedSection.questions = processQuestions(section.questions);
      }
      return processedSection;
    });
  };
  
  // Process pages to standard format
  const processPages = (pages: any[] = []) => {
    if (!pages || !Array.isArray(pages)) return [];
    
    return pages.map(page => {
      const processedPage = processEntity(page);
      if (page.sections && Array.isArray(page.sections)) {
        processedPage.sections = processSections(page.sections);
      }
      return processedPage;
    });
  };
  
  // Process old subLevels format recursively
  const processSubLevels = (subLevels: any[] = [], level = 0) => {
    if (!subLevels || !Array.isArray(subLevels) || subLevels.length === 0) return [];
    
    return subLevels.map(sublevel => {
      const processedSublevel = processEntity(sublevel);
      
      if (sublevel.questions && Array.isArray(sublevel.questions)) {
        processedSublevel.questions = processQuestions(sublevel.questions);
      }
      
      if (sublevel.subLevels && Array.isArray(sublevel.subLevels) && sublevel.subLevels.length > 0) {
        processedSublevel.subLevels = processSubLevels(sublevel.subLevels, level + 1);
      }
      
      return processedSublevel;
    });
  };
  
  const result = processEntity(inspection);
  
  // Process both data structures for compatibility
  if (result.pages && Array.isArray(result.pages)) {
    result.pages = processPages(result.pages);
  } else {
    result.pages = []; // Ensure pages exists even if empty
  }
  
  if (result.subLevels && Array.isArray(result.subLevels)) {
    result.subLevels = processSubLevels(result.subLevels);
  }
  
  if (result.questions && Array.isArray(result.questions)) {
    result.questions = processQuestions(result.questions);
  }
  
  // Process sets for completeness
  if (result.sets && Array.isArray(result.sets)) {
    result.sets = result.sets.map((set: any) => {
      const processedSet = processEntity(set);
      
      if (set.subLevels && Array.isArray(set.subLevels)) {
        processedSet.subLevels = processSubLevels(set.subLevels);
      }
      
      if (set.questions && Array.isArray(set.questions)) {
        processedSet.questions = processQuestions(set.questions);
      }
      
      if (set.generalQuestions && Array.isArray(set.generalQuestions)) {
        processedSet.generalQuestions = processQuestions(set.generalQuestions);
      }
      
      return processedSet;
    });
  }
  
  // Add some backward compatibility
  if (!result.requirementType) {
    result.requirementType = 'mandatory';
  }

  res.send(result);
});

export const updateInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID is required');
  }

  const inspection = await InspectionLevel.findById(req.params.id);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  const updateData: any = {
    ...req.body,
    updatedBy: req.user?._id
  };
  
  if (updateData.pages) {
    updateData.pages = processPages(updateData.pages);
    
    updateData.subLevels = convertPagesToSubLevels(updateData.pages);
    
    const allQuestions: IQuestion[] = [];
    
    updateData.pages.forEach((page: any) => {
      if (page.sections) {
        page.sections.forEach((section: any) => {
          if (section.questions && section.questions.length > 0) {
            allQuestions.push(...section.questions);
          }
        });
      }
    });
    
    if (allQuestions.length > 0) {
      updateData.questions = processQuestions(allQuestions);
    }
  }
  else if (updateData.subLevels) {
    updateData.subLevels = processSubLevels(updateData.subLevels);
  }
  
  if (updateData.sets && Array.isArray(updateData.sets)) {
    updateData.sets = updateData.sets.map((set: any) => {
      const processedSet = { ...set };
      
      if (set.subLevels && Array.isArray(set.subLevels)) {
        processedSet.subLevels = processSubLevels(set.subLevels);
      }
      
      if (set.questions && Array.isArray(set.questions)) {
        processedSet.questions = processQuestions(set.questions);
      }
      
      if (set.generalQuestions && Array.isArray(set.generalQuestions)) {
        processedSet.generalQuestions = processQuestions(set.generalQuestions);
      }
      
      return processedSet;
    });
  }
  
  if (updateData.questions && Array.isArray(updateData.questions)) {
    updateData.questions = processQuestions(updateData.questions);
  }

  Object.assign(inspection, updateData);
  await inspection.save();
  
  const updatedInspection = await InspectionLevel.findById(inspection._id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');

  res.send(updatedInspection);
});

interface SubLevel {
  _id: any;
  name: string;
  description: string;
  order?: number;
  subLevels?: SubLevel[];
  [key: string]: any;
}

const findSubLevelById = (subLevels: SubLevel[], subLevelId: string): SubLevel | null => {
  for (const subLevel of subLevels) {
    if (subLevel._id.toString() === subLevelId) {
      return subLevel;
    }
    
    if (subLevel.subLevels && subLevel.subLevels.length > 0) {
      const nestedSubLevel: SubLevel | null = findSubLevelById(subLevel.subLevels, subLevelId);
      if (nestedSubLevel) {
        return nestedSubLevel;
      }
    }
  }
  
  return null;
};

export const deleteInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  const { id, sublevelId } = req.params;

  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID is required');
  }

  const inspection = await InspectionLevel.findById(id);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  if (sublevelId) {
    const removeSubLevel = (subLevels: any[], targetId: string): boolean => {
      const index = subLevels.findIndex((sl: any) => sl._id.toString() === targetId);
      
      if (index !== -1) {
        subLevels.splice(index, 1);
        return true;
      }
      
      for (let i = 0; i < subLevels.length; i++) {
        if (subLevels[i].subLevels && subLevels[i].subLevels.length > 0) {
          const found = removeSubLevel(subLevels[i].subLevels, targetId);
          if (found) return true;
        }
      }
      
      return false;
    };
    
    const found = removeSubLevel(inspection.subLevels, sublevelId);
    
    if (!found) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Sub level not found');
    }
    
    if (inspection.questions && Array.isArray(inspection.questions)) {
      const updatedQuestions = inspection.questions.map((q: any) => {
        if (q.levelId && q.levelId.toString() === sublevelId) {
          return { ...q, levelId: undefined };
        }
        return q;
      });
      inspection.questions = updatedQuestions;
    }
    
    inspection.updatedBy = req.user?._id;
    await inspection.save();
    
    res.status(httpStatus.NO_CONTENT).send();
  } else {
    if (inspection.assignedTasks && inspection.assignedTasks.length > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST, 
        'Cannot delete inspection level with associated tasks'
      );
    }
    
    await inspection.deleteOne();
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const updateSubLevel = catchAsync(async (req: Request, res: Response) => {
  const inspectionId = req.params.id;
  const subLevelId = req.params.sublevelId;
  
  if (!inspectionId || !subLevelId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID and Sub Level ID are required');
  }

  let inspection:any = await InspectionLevel.findById(inspectionId);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  const subLevel = findSubLevelById(inspection.subLevels, subLevelId);
  if (!subLevel) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sub level not found');
  }

  if (req.body.subLevels) {
    req.body.subLevels = processSubLevels(req.body.subLevels);
  }

  Object.assign(subLevel, req.body);
  inspection.updatedBy = req.user?._id;
  await inspection.save();

  const updatedInspection = await InspectionLevel.findById(inspectionId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');

  res.send(updatedInspection);
});

export const exportInspectionLevels = catchAsync(async (req: Request, res: Response) => {
  const { format } = req.params;
  const filter: any = pick(req.query, ['name', 'type', 'status', 'priority']);
  const search = req.query.search as string;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const inspections = await InspectionLevel.find(filter)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .lean();
  
  if (format === 'pdf') {
    try {
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        bufferPages: true,
        info: {
          Title: 'Inspection Levels Report',
          Author: 'MIRSAT System',
          Subject: 'Inspection Levels Report',
          Keywords: 'inspection, report, levels',
          CreationDate: new Date()
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=inspection-levels.pdf');
      
      doc.pipe(res);
      
      // Define consistent styling values
      const COLORS = {
        primary: '#1A237E',              // Dark Navy
        secondary: '#3949AB',            // Lighter Navy
        textDark: '#212121',             // Almost Black
        textMedium: '#424242',           // Dark Gray
        textLight: '#757575',            // Medium Gray
        headerBg: '#1A237E',             // Dark Navy Background
        tableHeaderBg: '#C5CAE9',        // Light Navy for Table Headers
        tableRowEven: '#FFFFFF',         // White
        tableRowOdd: '#F5F7FB',          // Very Light Gray
        tableBorder: '#E0E0E0',          // Light Gray Border
        bulletLevel1: '#3F51B5',         // Indigo
        bulletLevel2: '#7986CB'          // Light Indigo
      };
      
      const FONTS = {
        title: 'Helvetica-Bold',
        heading: 'Helvetica-Bold',
        subheading: 'Helvetica-Bold',
        normal: 'Helvetica',
        italic: 'Helvetica-Oblique'
      };
      
      // Add header to each page
      const addHeaderToPage = () => {
        // Clear the header area first to ensure no overlap
        doc.rect(0, 0, doc.page.width, 60).fill('#FFFFFF');
        
        // Add header background
        doc.rect(0, 0, doc.page.width, 50).fill(COLORS.headerBg);
        
        // Add title
        doc.font(FONTS.title).fontSize(22).fillColor('#FFFFFF');
        doc.text('Inspection Levels Report', 50, 18);
        
        // Add date on the right side
        const dateText = `Generated: ${new Date().toLocaleDateString()}`;
        const dateWidth = doc.widthOfString(dateText);
        doc.fontSize(10);
        doc.text(dateText, doc.page.width - 50 - dateWidth, 20);
        
        // Add page divider
        doc.rect(50, 60, doc.page.width - 100, 1).fill(COLORS.tableBorder);
        
        // Set position for content to start after header
        doc.y = 70;
      };
      
      // Function to create a properly formatted table header
      const createTableHeader = (title: string, x: number, y: number, width: number, options: any = {}) => {
        const height = options.height || 30;
        const fontSize = options.fontSize || 12;
        const color = options.color || '#FFFFFF';
        const bg = options.bg || COLORS.secondary;
        
        // Draw background
        doc.rect(x, y, width, height).fill(bg);
        
        // Add title text
        doc.font(FONTS.heading).fontSize(fontSize).fillColor(color);
        doc.text(title, x + 10, y + (height - fontSize) / 2, { width: width - 20 });
        
        return y + height;
      };
      
      // Function to create a table row with proper cell alignment
      const createTableRow = (data: { label: string, value: string }, x: number, y: number, width: number, options: any = {}) => {
        const height = options.height || 25;
        const colWidth1 = options.labelWidth || width * 0.3;
        const colWidth2 = width - colWidth1;
        const fontSize = options.fontSize || 10;
        const bg = options.bg || '#FFFFFF';
        const borderColor = options.borderColor || COLORS.tableBorder;
        
        // Draw background
        doc.rect(x, y, width, height).fill(bg).strokeColor(borderColor).stroke();
        
        // Add divider between columns
        doc.moveTo(x + colWidth1, y).lineTo(x + colWidth1, y + height)
           .strokeColor(borderColor).stroke();
        
        // Add label text
        doc.font(FONTS.normal).fontSize(fontSize).fillColor(COLORS.textDark);
        doc.text(data.label, x + 5, y + (height - fontSize) / 2, { width: colWidth1 - 10 });
        
        // Add value text with overflow handling
        doc.text(data.value || 'N/A', x + colWidth1 + 5, y + (height - fontSize) / 2, { 
          width: colWidth2 - 10,
          ellipsis: true
        });
        
        return y + height;
      };
      
      // Function to format text safely
      const safeText = (text: any): string => {
        if (text === null || text === undefined) return 'N/A';
        return String(text).replace(/[\r\n]+/g, ' ');
      };
      
      // Process each inspection
      for (let i = 0; i < inspections.length; i++) {
        const inspection = inspections[i];
        
        // Add new page for each inspection except the first
        if (i > 0) {
          doc.addPage();
        }
        
        // Add header to the page
        addHeaderToPage();
        
        // Add inspection name as a title
        doc.font(FONTS.heading).fontSize(16).fillColor(COLORS.primary);
        doc.text(safeText(inspection.name || `Inspection Level ${i + 1}`), 50, doc.y);
        doc.moveDown(0.5);
        
        // Create metadata table for inspection details
        let y = doc.y;
        const tableWidth = doc.page.width - 100;
        
        // Add metadata section header
        y = createTableHeader('Inspection Details', 50, y, tableWidth, {
          bg: COLORS.secondary,
          fontSize: 12
        });
        
        // Add metadata rows
        y = createTableRow({ label: 'Type', value: safeText(inspection.type) }, 50, y, tableWidth, {
          bg: COLORS.tableRowEven
        });
        
        y = createTableRow({ label: 'Status', value: safeText(inspection.status) }, 50, y, tableWidth, {
          bg: COLORS.tableRowOdd
        });
        
        y = createTableRow({ label: 'Priority', value: safeText(inspection.priority) }, 50, y, tableWidth, {
          bg: COLORS.tableRowEven
        });
        
        // Add description section
        doc.moveDown(1);
        y = doc.y;
        y = createTableHeader('Description', 50, y, tableWidth, {
          bg: COLORS.secondary,
          fontSize: 12
        });
        
        // Add description content with word wrapping
        doc.font(FONTS.normal).fontSize(10).fillColor(COLORS.textDark);
        doc.rect(50, y, tableWidth, 60).fill(COLORS.tableRowEven).strokeColor(COLORS.tableBorder).stroke();
        
        // Handle long descriptions with proper wrapping
        const descText = inspection.description || 'No description provided';
        doc.text(descText, 60, y + 10, { 
          width: tableWidth - 20,
          height: 40,
          ellipsis: true
        });
        
        y += 60;
        doc.moveDown(1);
        
        // Add sublevels section
        y = doc.y;
        y = createTableHeader('Sub Levels', 50, y, tableWidth, {
          bg: COLORS.secondary,
          fontSize: 12
        });
        
        if (inspection.subLevels && inspection.subLevels.length > 0) {
          // Process sublevels with proper indentation and formatting
          const renderSubLevels = (subLevels: any[], level = 0, baseY = y, maxDepth = 10): number => {
            if (!subLevels || !Array.isArray(subLevels) || subLevels.length === 0 || level >= maxDepth) {
              return baseY;
            }
            
            let currentY = baseY;
            
            for (let j = 0; j < subLevels.length; j++) {
              const subLevel = subLevels[j];
              if (!subLevel) continue;
              
              // Check if we need a new page
              if (currentY > doc.page.height - 100) {
                doc.addPage();
                addHeaderToPage();
                currentY = doc.y;
              }
              
              // Calculate indentation and bullet position
              const indent = 15 * level;
              const bulletX = 60 + indent;
              const textX = bulletX + 10;
              
              // Draw bullet based on level
              doc.circle(bulletX, currentY + 5, level === 0 ? 3 : 2)
                 .fill(level === 0 ? COLORS.bulletLevel1 : COLORS.bulletLevel2);
              
              // Format and add sublevel name
              doc.font(level === 0 ? FONTS.subheading : FONTS.normal)
                 .fontSize(level === 0 ? 11 : 10)
                 .fillColor(COLORS.textDark);
              
              const nameText = safeText(subLevel.name) || 'Unnamed';
              const textOptions = { 
                width: tableWidth - indent - 20,
                ellipsis: true,
                lineBreak: true
              };
              
              doc.text(nameText, textX, currentY, textOptions);
              currentY += doc.heightOfString(nameText, textOptions);
              
              // Add description if available
              if (subLevel.description) {
                doc.font(FONTS.italic)
                   .fontSize(9)
                   .fillColor(COLORS.textLight);
                
                const descText = `Description: ${safeText(subLevel.description)}`;
                doc.text(descText, textX, currentY, { 
                  width: tableWidth - indent - 20,
                  ellipsis: true,
                  lineBreak: true
                });
                
                currentY += doc.heightOfString(descText, { 
                  width: tableWidth - indent - 20,
                  ellipsis: true
                });
              }
              
              currentY += 5; // Add spacing between items
              
              // Process child sublevels if any
              if (subLevel.subLevels && Array.isArray(subLevel.subLevels) && subLevel.subLevels.length > 0) {
                currentY = renderSubLevels(subLevel.subLevels, level + 1, currentY, maxDepth);
              }
            }
            
            return currentY;
          };
          
          // Render all sublevels with hierarchy
          y = renderSubLevels(inspection.subLevels);
          
        } else {
          // Show message if no sublevels
          doc.font(FONTS.italic).fontSize(10).fillColor(COLORS.textLight);
          doc.text('No sub levels defined for this inspection level.', 60, y + 10);
          y += 30;
        }
      }
      
      // Add page numbers to all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        const pageText = `Page ${i + 1} of ${pageCount}`;
        const textWidth = doc.widthOfString(pageText);
        
        doc.fontSize(8)
           .fillColor(COLORS.textLight)
           .text(
             pageText,
             (doc.page.width - textWidth) / 2,
             doc.page.height - 30,
             { lineBreak: false }
           );
      }
      
      doc.end();
    } catch (err) {
      console.error('PDF generation error:', err);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error generating PDF');
    }
  } 
  else if (format === 'docx') {
    try {
      // Enhanced DOCX generation with better styling
      const createBorder = () => {
        return {
          top: { style: "single" as const, size: 1, color: "E0E0E0" },
          bottom: { style: "single" as const, size: 1, color: "E0E0E0" },
          left: { style: "single" as const, size: 1, color: "E0E0E0" },
          right: { style: "single" as const, size: 1, color: "E0E0E0" }
        };
      };
      
      // Document title with better styling
      const titleParagraph = new Paragraph({
        children: [
          new TextRun({ 
            text: 'Inspection Levels Report',
            size: 36,
            bold: true,
            color: "1A237E",
          }),
        ],
        alignment: 'center',
        spacing: {
          before: 200,
          after: 200,
        }
      });
      
      // Date with better positioning
      const dateParagraph = new Paragraph({
        children: [
          new TextRun({ 
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            size: 20,
            color: "666666",
          }),
        ],
        alignment: "center",
        spacing: {
          after: 400,
        }
      });
      
      const sections: (Paragraph | docx.Table)[] = [];
      
      // Process each inspection
      for (let index = 0; index < inspections.length; index++) {
        const inspection = inspections[index];
        
        // Add page break between inspections
        if (index > 0) {
          sections.push(new Paragraph({ 
            text: "", 
            pageBreakBefore: true,
          }));
        }
        
        // Inspection title with better styling
        sections.push(new Paragraph({
          children: [
            new TextRun({ 
              text: `${index + 1}. ${inspection.name || 'Unnamed Inspection Level'}`,
              bold: true,
              size: 28,
              color: "1A237E",
            }),
          ],
          spacing: {
            before: 200,
            after: 200,
          },
        }));
        
        // Details section title
        sections.push(new Paragraph({
          children: [
            new TextRun({
              text: "Inspection Details",
              bold: true,
              size: 24,
              color: "3949AB", // Lighter navy
            }),
          ],
          spacing: {
            before: 100,
            after: 100,
          },
        }));
        
        // Metadata table with improved styling
        const metadataTable = new docx.Table({
          width: {
            size: 100,
            type: "pct",
          },
          borders: {
            top: { style: "single", size: 1, color: "C5CAE9" },
            bottom: { style: "single", size: 1, color: "C5CAE9" },
            left: { style: "single", size: 1, color: "C5CAE9" },
            right: { style: "single", size: 1, color: "C5CAE9" },
            insideHorizontal: { style: "single", size: 1, color: "C5CAE9" },
            insideVertical: { style: "single", size: 1, color: "C5CAE9" },
          },
          rows: [
            // Header row
            new docx.TableRow({
              tableHeader: true,
              children: [
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Property",
                    alignment: "center",
                    spacing: { before: 50, after: 50 },
                  })],
                  shading: {
                    type: "clear",
                    fill: "3949AB", // Lighter navy
                  },
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Value",
                    alignment: "center",
                    spacing: { before: 50, after: 50 },
                  })],
                  shading: {
                    type: "clear",
                    fill: "3949AB", // Lighter navy
                  },
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
              ],
            }),
            // Type row
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Type",
                    spacing: { before: 30, after: 30 },
                  })],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
                new docx.TableCell({
                  children: [new Paragraph({
                    text: inspection.type || "N/A",
                    spacing: { before: 30, after: 30 },
                  })],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
              ],
            }),
            // Status row with alternating color
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Status",
                    spacing: { before: 30, after: 30 },
                  })],
                  verticalAlign: docx.VerticalAlign.CENTER,
                  shading: {
                    type: "clear",
                    fill: "F5F7FB", // Light background
                  },
                }),
                new docx.TableCell({
                  children: [new Paragraph({
                    text: inspection.status || "N/A",
                    spacing: { before: 30, after: 30 },
                  })],
                  verticalAlign: docx.VerticalAlign.CENTER,
                  shading: {
                    type: "clear",
                    fill: "F5F7FB", // Light background
                  },
                }),
              ],
            }),
            // Priority row
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Priority",
                    spacing: { before: 30, after: 30 },
                  })],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
                new docx.TableCell({
                  children: [new Paragraph({
                    text: inspection.priority?.toString() || "N/A",
                    spacing: { before: 30, after: 30 },
                  })],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
              ],
            }),
          ],
        });
        
        sections.push(metadataTable);
        
        // Description section with better styling
        sections.push(new Paragraph({
          children: [
            new TextRun({
              text: "Description",
              bold: true,
              size: 24,
              color: "3949AB", // Lighter navy
            }),
          ],
          spacing: {
            before: 200,
            after: 100,
          },
        }));
        
        // Description content with border
        sections.push(new Paragraph({
          text: inspection.description || "No description provided",
          border: {
            top: { style: "single", size: 1, color: "E0E0E0" },
            bottom: { style: "single", size: 1, color: "E0E0E0" },
            left: { style: "single", size: 1, color: "E0E0E0" },
            right: { style: "single", size: 1, color: "E0E0E0" },
          },
          spacing: {
            before: 30,
            after: 200,
          },
          shading: {
            type: "clear",
            fill: "F5F7FB", // Light background
          },
        }));
        
        // Sub levels section
        if (inspection.subLevels && inspection.subLevels.length > 0) {
          sections.push(new Paragraph({
            children: [
              new TextRun({
                text: "Sub Levels",
                bold: true,
                size: 24,
                color: "3949AB", // Lighter navy
              }),
            ],
            spacing: {
              before: 100,
              after: 100,
            },
          }));
          
          // Process sublevels with recursive function for proper hierarchy
          const processSubLevelsForDocx = (subLevels: any[], level = 0, paragraphs: Paragraph[] = [], maxDepth = 10): Paragraph[] => {
            if (!subLevels || !Array.isArray(subLevels) || subLevels.length === 0 || level >= maxDepth) {
              return paragraphs;
            }
            
            for (const item of subLevels) {
              if (!item) continue;
              
              const indent = 720 * level; // Proper indentation for hierarchy
              
              // Create paragraph for sublevel name with proper formatting
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.name || 'Unnamed',
                      bold: level === 0,
                      size: level === 0 ? 22 : 20,
                      color: level === 0 ? "3949AB" : "3F51B5", // Different colors by level
                    }),
                  ],
                  bullet: {
                    level: level,
                  },
                  indent: {
                    left: indent,
                  },
                  spacing: {
                    before: 100,
                    after: level === 0 ? 50 : 30,
                  },
                })
              );
              
              // Add description if available
              if (item.description) {
                paragraphs.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: item.description,
                        italics: true,
                        color: "757575", // Medium gray
                      }),
                    ],
                    indent: {
                      left: indent + 360, // Extra indent for description
                    },
                    spacing: {
                      before: 30,
                      after: 80,
                    },
                  })
                );
              }
              
              // Process child sublevels if any
              if (item.subLevels && Array.isArray(item.subLevels) && item.subLevels.length > 0) {
                processSubLevelsForDocx(item.subLevels, level + 1, paragraphs, maxDepth);
              }
            }
            
            return paragraphs;
          };
          
          // Process and add all sublevels
          const subLevelParagraphs = processSubLevelsForDocx(inspection.subLevels);
          sections.push(...subLevelParagraphs);
          
        } else {
          // Message for no sublevels
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'No sub levels defined for this inspection level.',
                  color: "757575", // Medium gray
                  italics: true,
                }),
              ],
              spacing: {
                before: 100,
                after: 100,
              },
            })
          );
        }
      }
      
      // Create document with proper styling and page layout
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1000,
                  bottom: 1000,
                  left: 1000,
                  right: 1000,
                },
              },
            },
            // Add header, footer if needed
            headers: {
              default: new docx.Header({
                children: [
                  new Paragraph({
                    text: "Inspection Levels Report",
                    alignment: docx.AlignmentType.RIGHT,
                    border: {
                      bottom: {
                        color: "C5CAE9",
                        space: 1,
                        style: "single",
                        size: 6,
                      },
                    },
                  }),
                ],
              }),
            },
            footers: {
              default: new docx.Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun("Page "),
                      new TextRun({
                        children: ["PAGE", "NUMPAGES"],
                        style: "PageNumber",
                      }),
                      new TextRun(" | MIRSAT Inspection System"),
                    ],
                    alignment: docx.AlignmentType.CENTER,
                  }),
                ],
              }),
            },
            children: [
              titleParagraph,
              dateParagraph,
              ...sections,
            ],
          },
        ],
      });
      
      // Set proper response headers for DOCX download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=inspection-levels.docx');
      
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (err) {
      console.error('DOCX generation error:', err);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error generating DOCX');
    }
  } 
  else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Unsupported export format');
  }
});

export const reorderSubLevels = catchAsync(async (req: Request, res: Response) => {
  const { inspectionId } = req.params;
  const { newOrder } = req.body;

  if (!inspectionId || !newOrder) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID and new order are required');
  }

  const inspection:any = await InspectionLevel.findById(inspectionId);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  newOrder.forEach((id: string, index: number) => {
    const subLevel = inspection.subLevels.id(id);
    if (subLevel) {
      subLevel.order = index;
    }
  });

  inspection.updatedBy = req.user?._id;
  await inspection.save();

  const updatedInspection = await InspectionLevel.findById(inspectionId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');

  res.send(updatedInspection);
});

export const updateInspectionQuestionnaire = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { responses, notes, completed } = req.body;
  
  const inspection = await InspectionLevel.findById(id);
  
  if (!inspection) {
    throw new ApiError('Inspection level not found', httpStatus.NOT_FOUND);
  }
  
  if (responses) {
    inspection.questionnaireResponses = responses;
  }
  
  if (notes !== undefined) {
    inspection.questionnaireNotes = notes;
  }
  
  if (completed !== undefined) {
    inspection.questionnaireCompleted = completed;
  }
  
  await inspection.save();
  
  res.status(httpStatus.OK).send({
    message: 'Questionnaire updated successfully',
    data: {
      id: inspection._id,
      questionnaireCompleted: inspection.questionnaireCompleted,
      questionnaireResponses: inspection.questionnaireResponses,
      questionnaireNotes: inspection.questionnaireNotes
    }
  });
});

export const getInspectionQuestionnaire = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const inspection = await InspectionLevel.findById(id)
    .select('questions questionnaireResponses questionnaireCompleted questionnaireNotes');
  
  if (!inspection) {
    throw new ApiError('Inspection level not found', httpStatus.NOT_FOUND);
  }
  
  res.status(httpStatus.OK).send({
    data: {
      id: inspection._id,
      questions: inspection.questions || [],
      questionnaireResponses: inspection.questionnaireResponses || {},
      questionnaireCompleted: inspection.questionnaireCompleted || false,
      questionnaireNotes: inspection.questionnaireNotes || ''
    }
  });
});

export const updateInspectionQuestions = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { questions } = req.body;
  
  const inspection = await InspectionLevel.findById(id);
  
  if (!inspection) {
    throw new ApiError('Inspection level not found', httpStatus.NOT_FOUND);
  }
  
  if (questions && Array.isArray(questions)) {
    const processedQuestions = questions.map((question: any) => {
      if (question.levelId) {
        try {
          question.levelId = mongoose.Types.ObjectId.isValid(question.levelId.toString()) 
            ? new mongoose.Types.ObjectId(question.levelId.toString()) 
            : undefined;
        } catch (err) {
          question.levelId = undefined;
        }
      }
      return question;
    });
    
    inspection.questions = processedQuestions;
  }
  
  await inspection.save();
  
  res.status(httpStatus.OK).send({
    message: 'Questions updated successfully',
    data: {
      id: inspection._id,
      questions: inspection.questions
    }
  });
});

export const getQuestionsByLevel = catchAsync(async (req: Request, res: Response) => {
  const { id, levelId } = req.params;
  
  if (!id || !levelId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID and Level ID are required');
  }
  
  const inspection = await InspectionLevel.findById(id);
  
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }
  
  const questions = inspection.questions.filter((q: any) => 
    q.levelId && q.levelId.toString() === levelId
  );
  
  res.status(httpStatus.OK).send({
    data: questions
  });
});