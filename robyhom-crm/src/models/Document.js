const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    fileName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'שם הקובץ בשרת'
    },
    originalName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'שם הקובץ המקורי'
    },
    fileType: {
        type: DataTypes.ENUM,
        values: ['pdf', 'excel', 'word', 'image', 'other'],
        allowNull: false,
        comment: 'סוג הקובץ'
    },
    mimeType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'MIME type של הקובץ'
    },
    fileSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'גודל הקובץ בבתים'
    },
    filePath: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'נתיב הקובץ בשרת'
    },
    documentType: {
        type: DataTypes.ENUM,
        values: [
            'contract',        // חוזה
            'invoice',         // חשבונית
            'receipt',         // קבלה
            'report',          // דוח
            'photo',           // תמונה
            'certificate',     // תעודה
            'insurance',       // ביטוח
            'maintenance',     // תחזוקה
            'other'           // אחר
        ],
        allowNull: false,
        defaultValue: 'other',
        comment: 'סוג המסמך'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'תיאור המסמך'
    },
    isPublic: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'האם המסמך נגיש לכולם'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'האם המסמך פעיל'
    },
    uploadDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'תאריך העלאה'
    },
    // Foreign Keys - קשרים עם טבלאות אחרות
    uploadedBy: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'מי העלה את המסמך'
    },
    propertyId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'properties',
            key: 'id'
        },
        comment: 'נכס קשור (אופציונלי)'
    },
    bookingId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'bookings',
            key: 'id'
        },
        comment: 'הזמנה קשורה (אופציונלי)'
    },
    paymentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'payments',
            key: 'id'
        },
        comment: 'תשלום קשור (אופציונלי)'
    },
    tags: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'תגיות למסמך (JSON)'
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'מטא-דטה נוסף (JSON)'
    }
}, {
    tableName: 'Documents',
    timestamps: true,
    indexes: [
        {
            fields: ['uploadedBy']
        },
        {
            fields: ['propertyId']
        },
        {
            fields: ['bookingId']
        },
        {
            fields: ['paymentId']
        },
        {
            fields: ['documentType']
        },
        {
            fields: ['fileType']
        },
        {
            fields: ['uploadDate']
        },
        {
            fields: ['isActive']
        }
    ]
});

// פונקציות עזר - Instance Methods
Document.prototype.getDisplayName = function() {
    const types = {
        contract: 'חוזה',
        invoice: 'חשבונית',
        receipt: 'קבלה',
        report: 'דוח',
        photo: 'תמונה',
        certificate: 'תעודה',
        insurance: 'ביטוח',
        maintenance: 'תחזוקה',
        other: 'אחר'
    };
    return types[this.documentType] || 'לא ידוע';
};

Document.prototype.getFileTypeDisplay = function() {
    const types = {
        pdf: 'PDF',
        excel: 'Excel',
        word: 'Word',
        image: 'תמונה',
        other: 'אחר'
    };
    return types[this.fileType] || 'לא ידוע';
};

Document.prototype.getFileSizeDisplay = function() {
    const bytes = this.fileSize;
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

Document.prototype.canBeViewedBy = function(user) {
    // Admin can view all documents
    if (user.role === 'admin') {
        return true;
    }
    
    // Public documents can be viewed by everyone
    if (this.isPublic) {
        return true;
    }
    
    // Document uploader can always view
    if (this.uploadedBy === user.id) {
        return true;
    }
    
    // Property owner can view property documents
    if (this.propertyId && this.property && this.property.ownerId === user.id) {
        return true;
    }
    
    // Booking tenant can view booking documents
    if (this.bookingId && this.booking && this.booking.tenantId === user.id) {
        return true;
    }
    
    return false;
};

Document.prototype.canBeEditedBy = function(user) {
    // Admin can edit all documents
    if (user.role === 'admin') {
        return true;
    }
    
    // Document uploader can edit
    if (this.uploadedBy === user.id) {
        return true;
    }
    
    return false;
};

Document.prototype.canBeDeletedBy = function(user) {
    // Only admin and uploader can delete
    return user.role === 'admin' || this.uploadedBy === user.id;
};

// פונקציות סטטיות - Static Methods
Document.getFileTypeFromMime = (mimeType) => {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.includes('image')) return 'image';
    return 'other';
};

Document.validateFileType = (mimeType) => {
    const allowedTypes = [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];
    
    return allowedTypes.includes(mimeType);
};

Document.getMaxFileSize = () => {
    return 10 * 1024 * 1024; // 10MB
};

module.exports = Document;