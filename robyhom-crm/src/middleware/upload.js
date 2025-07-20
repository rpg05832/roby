const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// יצירת תיקיות אם לא קיימות
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 נוצרה תיקייה: ${dirPath}`);
    }
};

// וידוא שכל התיקיות קיימות
const uploadDirs = [
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'uploads', 'documents'),
    path.join(process.cwd(), 'uploads', 'images'),
    path.join(process.cwd(), 'uploads', 'reports'),
    path.join(process.cwd(), 'uploads', 'temp')
];

uploadDirs.forEach(dir => ensureDirectoryExists(dir));

// הגדרת אחסון
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;
        
        // קביעת תיקייה לפי סוג הקובץ
        if (file.mimetype.startsWith('image/')) {
            uploadPath = path.join(process.cwd(), 'uploads', 'images');
        } else {
            uploadPath = path.join(process.cwd(), 'uploads', 'documents');
        }
        
        // וידוא שהתיקייה קיימת
        ensureDirectoryExists(uploadPath);
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // יצירת שם קובץ ייחודי
        const uniqueId = uuidv4();
        const fileExtension = path.extname(file.originalname);
        const fileName = `${uniqueId}${fileExtension}`;
        
        cb(null, fileName);
    }
});

// פילטרים לסוגי קבצים
const fileFilter = (req, file, cb) => {
    // סוגי קבצים מותרים
    const allowedMimeTypes = [
        // תמונות
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        
        // PDF
        'application/pdf',
        
        // Excel
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        
        // Word
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        
        // טקסט
        'text/plain',
        'text/csv'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const error = new Error(`סוג קובץ לא נתמך: ${file.mimetype}`);
        error.code = 'UNSUPPORTED_FILE_TYPE';
        cb(error, false);
    }
};

// גבולות גודל קובץ
const limits = {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // מקסימום 5 קבצים בו זמנית
};

// יצירת instance של multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits
});

// Middleware לטיפול בשגיאות העלאה
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    success: false,
                    message: 'קובץ גדול מדי (מקסימום 10MB)',
                    code: 'FILE_TOO_LARGE'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    message: 'יותר מדי קבצים (מקסימום 5)',
                    code: 'TOO_MANY_FILES'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    message: 'שדה קובץ לא צפוי',
                    code: 'UNEXPECTED_FILE'
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: 'שגיאה בהעלאת הקובץ',
                    code: 'UPLOAD_ERROR'
                });
        }
    }
    
    if (error.code === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(400).json({
            success: false,
            message: error.message,
            code: 'UNSUPPORTED_FILE_TYPE',
            allowedTypes: [
                'תמונות: JPEG, PNG, GIF, WebP',
                'מסמכים: PDF, Word, Excel',
                'טקסט: TXT, CSV'
            ]
        });
    }
    
    next(error);
};

// פונקציות עזר לניקוי קבצים
const cleanupTempFiles = async () => {
    try {
        const tempDir = path.join(process.cwd(), 'uploads', 'temp');
        const files = await fs.promises.readdir(tempDir);
        
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // שעה במילישניות
        
        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = await fs.promises.stat(filePath);
            
            // מחק קבצים ישנים משעה
            if (now - stats.mtime.getTime() > oneHour) {
                await fs.promises.unlink(filePath);
                console.log(`🗑️ נמחק קובץ זמני ישן: ${file}`);
            }
        }
    } catch (error) {
        console.error('שגיאה בניקוי קבצים זמניים:', error);
    }
};

// ניקוי קבצים זמניים כל שעה
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// פונקציה לקבלת מידע על קובץ
const getFileInfo = (file) => {
    return {
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        destination: file.destination
    };
};

// פונקציות ולידציה
const validateImageFile = (file) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return allowedImageTypes.includes(file.mimetype);
};

const validateDocumentFile = (file) => {
    const allowedDocTypes = [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return allowedDocTypes.includes(file.mimetype);
};

// יצירת middleware שונים לסוגי העלאה שונים
const uploadMiddleware = {
    // העלאת מסמך יחיד
    single: (fieldName = 'document') => [
        upload.single(fieldName),
        handleUploadError
    ],
    
    // העלאת מספר מסמכים
    multiple: (fieldName = 'documents', maxFiles = 5) => [
        upload.array(fieldName, maxFiles),
        handleUploadError
    ],
    
    // העלאת תמונה יחידה
    singleImage: (fieldName = 'image') => [
        upload.single(fieldName),
        (req, res, next) => {
            if (req.file && !validateImageFile(req.file)) {
                return res.status(400).json({
                    success: false,
                    message: 'יש להעלות קובץ תמונה בלבד',
                    code: 'INVALID_IMAGE_TYPE'
                });
            }
            next();
        },
        handleUploadError
    ],
    
    // העלאת מסמך יחיד (לא תמונה)
    singleDocument: (fieldName = 'document') => [
        upload.single(fieldName),
        (req, res, next) => {
            if (req.file && !validateDocumentFile(req.file)) {
                return res.status(400).json({
                    success: false,
                    message: 'יש להעלות מסמך תקין (PDF, Word, Excel)',
                    code: 'INVALID_DOCUMENT_TYPE'
                });
            }
            next();
        },
        handleUploadError
    ]
};

module.exports = {
    upload,
    uploadMiddleware,
    handleUploadError,
    getFileInfo,
    validateImageFile,
    validateDocumentFile,
    cleanupTempFiles,
    ensureDirectoryExists
};