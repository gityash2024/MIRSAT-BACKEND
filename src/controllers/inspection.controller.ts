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
        margins: { top: 40, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        bufferPages: true
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=inspection-levels.pdf');
      
      doc.pipe(res);
      
      doc.info.Title = 'Inspection Levels Report';
      doc.info.Author = 'Inspection System';
      
      const COLORS = {
        primary: '#1F3F7A',
        secondary: '#1F3F7A',
        text: '#333333',
        subText: '#666666',
        tableHeader: '#1F3F7A',
        tableBorder: '#E0E0E0',
        tableRowEven: '#FFFFFF',
        tableRowOdd: '#F5F5F5',
        bulletPrimary: '#1F3F7A',
        bulletSecondary: '#4A90E2'
      };
      
      const FONTS = {
        heading: 'Helvetica-Bold',
        subheading: 'Helvetica-Bold',
        normal: 'Helvetica',
        italic: 'Helvetica-Oblique'
      };
      
      const addHeaderToPage = () => {
        const headerHeight = 50;
        
        doc.rect(50, 40, doc.page.width - 100, headerHeight)
           .fillAndStroke(COLORS.primary, COLORS.primary);
        
        doc.fontSize(18)
           .fillColor('white')
           .font(FONTS.heading)
           .text('Inspection Levels Report', 60, 55, { align: 'center' });
        
        const dateText = `Generated on: ${new Date().toLocaleDateString()}`;
        const dateWidth = doc.widthOfString(dateText);
        
        doc.fontSize(9)
           .fillColor('white')
           .font(FONTS.normal)
           .text(dateText, doc.page.width - 60 - dateWidth, 55, { align: 'right' });
           
        doc.moveDown(2);
      };
      
      for (let i = 0; i < inspections.length; i++) {
        const inspection = inspections[i];
        
        if (i > 0) {
          doc.addPage();
        }
        
        addHeaderToPage();
        
        const tableTop = doc.y + 20;
        const tableWidth = doc.page.width - 100;
        const colWidth1 = 150;
        const colWidth2 = tableWidth - colWidth1;
        const rowHeight = 30;
        
        doc.rect(50, tableTop, colWidth1, rowHeight)
           .fillAndStroke(COLORS.tableHeader, COLORS.tableHeader);
        doc.rect(50 + colWidth1, tableTop, colWidth2, rowHeight)
           .fillAndStroke(COLORS.tableHeader, COLORS.tableHeader);
        
        doc.fillColor('white')
           .fontSize(12)
           .font(FONTS.heading)
           .text('Property', 60, tableTop + 10)
           .text('Value', 60 + colWidth1, tableTop + 10);
        
        const addRow = (label: string, value: string, rowIndex: number) => {
          const y = tableTop + (rowIndex * rowHeight);
          const bgColor = rowIndex % 2 === 0 ? COLORS.tableRowEven : COLORS.tableRowOdd;
          
          doc.rect(50, y + rowHeight, colWidth1, rowHeight)
             .fillAndStroke(bgColor, COLORS.tableBorder);
          doc.rect(50 + colWidth1, y + rowHeight, colWidth2, rowHeight)
             .fillAndStroke(bgColor, COLORS.tableBorder);
          
          doc.fillColor(COLORS.text)
             .fontSize(11)
             .font(FONTS.normal)
             .text(label, 60, y + rowHeight + 10)
             .text(value || 'N/A', 60 + colWidth1, y + rowHeight + 10);
        };
        
        addRow('Type', inspection.type || 'N/A', 0);
        addRow('Status', inspection.status || 'N/A', 1);
        addRow('Priority', inspection.priority?.toString() || 'N/A', 2);
        
        const descriptionTop = tableTop + (4 * rowHeight) + 20;
        
        doc.rect(50, descriptionTop, tableWidth, 30)
           .fillAndStroke(COLORS.secondary, COLORS.secondary);
        
        doc.fillColor('white')
           .fontSize(12)
           .font(FONTS.heading)
           .text('Description', 60, descriptionTop + 10);
        
        doc.rect(50, descriptionTop + 30, tableWidth, 50)
           .fillAndStroke(COLORS.tableRowEven, COLORS.tableBorder);
           
        doc.fontSize(10)
           .fillColor(COLORS.text)
           .font(FONTS.normal)
           .text(inspection.description || 'No description provided', 60, descriptionTop + 40, { 
             width: tableWidth - 20,
             height: 40
           });
        
        const subLevelsTop = descriptionTop + 100;
        
        doc.rect(50, subLevelsTop, tableWidth, 30)
           .fillAndStroke(COLORS.secondary, COLORS.secondary);
           
        doc.fillColor('white')
           .fontSize(12)
           .font(FONTS.heading)
           .text('Sub Levels:', 60, subLevelsTop + 10);
           
        doc.y = subLevelsTop + 40;
        
        if (inspection.subLevels && inspection.subLevels.length > 0) {
          const processSubLevelsForPDF = (subLevels: any[], level = 0, maxDepth = 10): void => {
            if (!subLevels || !Array.isArray(subLevels) || subLevels.length === 0 || level >= maxDepth) {
              return;
            }
            
            for (let i = 0; i < subLevels.length; i++) {
              const item = subLevels[i];
              if (!item) continue;
              
              if (doc.y > doc.page.height - 100) {
                doc.addPage();
                addHeaderToPage();
              }
              
              const indent = 15 * level;
              const bulletX = 60 + indent;
              const bulletY = doc.y + 4;
              
              if (level === 0) {
                doc.circle(bulletX, bulletY, 3)
                   .fill(COLORS.bulletPrimary);
              } else {
                doc.circle(bulletX, bulletY, 2)
                   .fill(COLORS.bulletSecondary);
              }
              
              const textX = bulletX + 10;
              
              doc.fontSize(level === 0 ? 11 : 10)
                 .font(level === 0 ? FONTS.subheading : FONTS.normal)
                 .fillColor(COLORS.text);
                 
              const nameText = item.name || 'Unnamed';
              doc.text(nameText, textX, doc.y, { 
                continued: item.description ? true : false
              });
              
              if (item.description) {
                doc.font(FONTS.italic)
                   .fillColor(COLORS.subText)
                   .fontSize(level === 0 ? 10 : 9)
                   .text(` - ${item.description}`);
              } else {
                doc.moveDown(0.5);
              }
              
              if (item.subLevels && Array.isArray(item.subLevels) && item.subLevels.length > 0) {
                processSubLevelsForPDF(item.subLevels, level + 1, maxDepth);
              }
            }
          };
          
          processSubLevelsForPDF(inspection.subLevels);
          
        } else {
          doc.fontSize(11)
             .font(FONTS.italic)
             .fillColor(COLORS.subText)
             .text('No sub levels defined for this inspection level.', 60, doc.y);
        }
      }
      
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        const pageText = `Page ${i + 1} / ${pageCount}`;
        const textWidth = doc.widthOfString(pageText);
        
        doc.fontSize(10)
           .fillColor(COLORS.subText)
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
      const createBorder = () => {
        return {
          top: { style: "single" as const, size: 1, color: "E0E0E0" },
          bottom: { style: "single" as const, size: 1, color: "E0E0E0" },
          left: { style: "single" as const, size: 1, color: "E0E0E0" },
          right: { style: "single" as const, size: 1, color: "E0E0E0" }
        };
      };
      
      const titleParagraph = new Paragraph({
        text: 'Inspection Levels Report',
        heading: 'Heading1',
        alignment: 'center',
      });
      
      const dateParagraph = new Paragraph({
        children: [
          new TextRun({ 
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            size: 18,
            color: "666666",
          }),
        ],
        alignment: "center",
      });
      
      const sections: (Paragraph | docx.Table)[] = [];
      
      for (let index = 0; index < inspections.length; index++) {
        const inspection = inspections[index];
        
        if (index > 0) {
          sections.push(new Paragraph({ 
            text: "", 
            pageBreakBefore: true,
          }));
        }
        
        sections.push(new Paragraph({
          children: [
            new TextRun({ 
              text: `${index + 1}. ${inspection.name || 'Unnamed'}`,
              bold: true,
              size: 28,
              color: "1A237E",
            }),
          ],
          shading: {
            type: "clear",
            fill: "F5F5F5",
          },
          border: createBorder(),
          spacing: {
            before: 200,
            after: 200,
          },
        }));
        
        sections.push(new Paragraph({
          text: "Inspection Details",
          heading: "Heading3",
        }));
        
        const metadataTable = new docx.Table({
          width: {
            size: 100,
            type: "pct",
          },
          rows: [
            new docx.TableRow({
              tableHeader: true,
              children: [
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Property",
                    alignment: "center",
                  })],
                  shading: {
                    type: "clear",
                    fill: "1A237E",
                  },
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
                new docx.TableCell({
                  children: [new Paragraph({
                    text: "Value",
                    alignment: "center",
                  })],
                  shading: {
                    type: "clear",
                    fill: "1A237E",
                  },
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
              ],
            }),
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  children: [new Paragraph("Type")],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
                new docx.TableCell({
                  children: [new Paragraph(inspection.type || "N/A")],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
              ],
            }),
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  children: [new Paragraph("Status")],
                  verticalAlign: docx.VerticalAlign.CENTER,
                  shading: {
                    type: "clear",
                    fill: "F5F5F5",
                  },
                }),
                new docx.TableCell({
                  children: [new Paragraph(inspection.status || "N/A")],
                  verticalAlign: docx.VerticalAlign.CENTER,
                  shading: {
                    type: "clear",
                    fill: "F5F5F5",
                  },
                }),
              ],
            }),
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  children: [new Paragraph("Priority")],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
                new docx.TableCell({
                  children: [new Paragraph(inspection.priority?.toString() || "N/A")],
                  verticalAlign: docx.VerticalAlign.CENTER,
                }),
              ],
            }),
          ],
        });
        
        sections.push(metadataTable);
        
        sections.push(new Paragraph({
          text: "Description",
          heading: "Heading3",
        }));
        
        sections.push(new Paragraph({
          text: inspection.description || "No description provided",
        }));
        
        if (inspection.subLevels && inspection.subLevels.length > 0) {
          sections.push(new Paragraph({
            text: "Sub Levels",
            heading: "Heading3",
          }));
          
          const processSubLevelsForDocx = (subLevels: any[], level = 0, paragraphs: Paragraph[] = [], maxDepth = 10): Paragraph[] => {
            if (!subLevels || !Array.isArray(subLevels) || subLevels.length === 0 || level >= maxDepth) {
              return paragraphs;
            }
            
            for (const item of subLevels) {
              if (!item) continue;
              
              const indent = 720 * level;
              
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.name || 'Unnamed',
                      bold: level === 0,
                    }),
                    ...(item.description ? [new TextRun({
                      text: ` - ${item.description}`,
                    })] : []),
                  ],
                  bullet: {
                    level: level,
                  },
                  indent: {
                    left: indent,
                  },
                  spacing: {
                    before: 100,
                    after: 100,
                  },
                })
              );
              
              if (item.subLevels && Array.isArray(item.subLevels) && item.subLevels.length > 0) {
                processSubLevelsForDocx(item.subLevels, level + 1, paragraphs, maxDepth);
              }
            }
            
            return paragraphs;
          };
          
          const subLevelParagraphs = processSubLevelsForDocx(inspection.subLevels);
          
          sections.push(...subLevelParagraphs);
          
        } else {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'No sub levels defined for this inspection level.',
                  color: "666666",
                  italics: true,
                }),
              ],
            })
          );
        }
      }
      
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
            children: [
              titleParagraph,
              dateParagraph,
              ...sections,
            ],
          },
        ],
      });
      
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