const { Document, User, Property, Booking, Payment } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');

// העלאת מסמך חדש
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'לא הועלה קובץ'
            });
        }

        // בדיקת הרשאות
        if (!req.user.canUploadDocuments()) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה להעלות מסמכים'
            });
        }

        const {
            documentType = 'other',
            description,
            propertyId,
            bookingId,
            paymentId,
            isPublic = false,
            tags
        } = req.body;

        // בדיקת קשרים (אם נדרש)
        if (propertyId) {
            const property = await Property.findByPk(propertyId);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'נכס לא נמצא'
                });
            }

            // בדיקת הרשאה לנכס
            if (req.user.role !== 'admin' && property.ownerId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'אין לך הרשאה להעלות מסמכים לנכס זה'
                });
            }
        }

        // יצירת רשומת מסמך
        const document = await Document.create({
            fileName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            filePath: req.file.path,
            fileType: Document.getFileTypeFromMime(req.file.mimetype),
            documentType,
            description,
            isPublic: isPublic === 'true',
            uploadedBy: req.user.id,
            propertyId: propertyId || null,
            bookingId: bookingId || null,
            paymentId: paymentId || null,
            tags: tags ? JSON.stringify(tags.split(',').map(tag => tag.trim())) : null
        });

        res.status(201).json({
            success: true,
            message: 'מסמך הועלה בהצלחה',
            data: {
                id: document.id,
                fileName: document.originalName,
                fileType: document.getFileTypeDisplay(),
                documentType: document.getDisplayName(),
                size: document.getFileSizeDisplay(),
                uploadDate: document.uploadDate
            }
        });

    } catch (error) {
        console.error('שגיאה בהעלאת מסמך:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בהעלאת המסמך',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// רשימת מסמכים
const getDocuments = async (req, res) => {
    try {
        const {
            documentType,
            fileType,
            propertyId,
            bookingId,
            paymentId,
            isPublic,
            search,
            page = 1,
            limit = 50
        } = req.query;

        // בניית תנאי חיפוש
        let whereConditions = { isActive: true };

        // פילטרים
        if (documentType) whereConditions.documentType = documentType;
        if (fileType) whereConditions.fileType = fileType;
        if (propertyId) whereConditions.propertyId = propertyId;
        if (bookingId) whereConditions.bookingId = bookingId;
        if (paymentId) whereConditions.paymentId = paymentId;
        if (isPublic !== undefined) whereConditions.isPublic = isPublic === 'true';

        // חיפוש טקסט
        if (search) {
            whereConditions[Op.or] = [
                { originalName: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // הרשאות - רק מנהל רואה הכל
        if (req.user.role !== 'admin') {
            whereConditions[Op.or] = [
                { uploadedBy: req.user.id },
                { isPublic: true },
                ...(req.user.role === 'owner' ? [
                    { '$property.ownerId$': req.user.id }
                ] : []),
                ...(req.user.role === 'tenant' ? [
                    { '$booking.tenantId$': req.user.id }
                ] : [])
            ];
        }

        const offset = (page - 1) * limit;

        const { count, rows: documents } = await Document.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address'],
                    required: false
                },
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'guestName', 'checkInDate'],
                    required: false
                },
                {
                    model: Payment,
                    as: 'payment',
                    attributes: ['id', 'amount', 'paymentType'],
                    required: false
                }
            ],
            order: [['uploadDate', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        res.json({
            success: true,
            data: {
                documents: documents.map(doc => ({
                    id: doc.id,
                    fileName: doc.originalName,
                    fileType: doc.getFileTypeDisplay(),
                    documentType: doc.getDisplayName(),
                    size: doc.getFileSizeDisplay(),
                    uploadDate: doc.uploadDate,
                    description: doc.description,
                    isPublic: doc.isPublic,
                    uploader: doc.uploader,
                    property: doc.property,
                    booking: doc.booking,
                    payment: doc.payment
                })),
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit),
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('שגיאה בקבלת מסמכים:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת המסמכים',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// הורדת מסמך
const downloadDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await Document.findByPk(id, {
            include: [
                { model: Property, as: 'property' },
                { model: Booking, as: 'booking' }
            ]
        });

        if (!document || !document.isActive) {
            return res.status(404).json({
                success: false,
                message: 'מסמך לא נמצא'
            });
        }

        // בדיקת הרשאות
        if (!document.canBeViewedBy(req.user)) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לצפות במסמך זה'
            });
        }

        // בדיקה שהקובץ קיים
        try {
            await fs.access(document.filePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'קובץ לא נמצא בשרת'
            });
        }

        // הגדרת headers לתגובה
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        res.setHeader('Content-Type', document.mimeType);

        // שליחת הקובץ
        res.sendFile(path.resolve(document.filePath));

    } catch (error) {
        console.error('שגיאה בהורדת מסמך:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בהורדת המסמך',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// מחיקת מסמך
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await Document.findByPk(id);

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'מסמך לא נמצא'
            });
        }

        // בדיקת הרשאות
        if (!document.canBeDeletedBy(req.user)) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה למחוק מסמך זה'
            });
        }

        // מחיקת הקובץ מהדיסק
        try {
            await fs.unlink(document.filePath);
        } catch (error) {
            console.warn('לא ניתן למחוק קובץ:', document.filePath);
        }

        // מחיקת הרשומה מהמסד
        await document.destroy();

        res.json({
            success: true,
            message: 'מסמך נמחק בהצלחה'
        });

    } catch (error) {
        console.error('שגיאה במחיקת מסמך:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת המסמך',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// יצוא דוח כספי לExcel
const exportOwnerFinancialReportExcel = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { startDate, endDate, propertyId } = req.query;

        // בדיקת הרשאות
        if (req.user.role !== 'admin' && req.user.id !== ownerId) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לייצא דוח זה'
            });
        }

        // קבלת נתוני הדוח (נשתמש באותה לוגיקה כמו בדוח הרגיל)
        const owner = await User.findByPk(ownerId);
        if (!owner || owner.role !== 'owner') {
            return res.status(404).json({
                success: false,
                message: 'בעל נכס לא נמצא'
            });
        }

        // יצירת קובץ Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('דוח כספי');

        // הגדרת כותרות
        worksheet.columns = [
            { header: 'תאריך', key: 'date', width: 12 },
            { header: 'סוג תשלום', key: 'type', width: 15 },
            { header: 'תיאור', key: 'description', width: 30 },
            { header: 'סכום', key: 'amount', width: 12 },
            { header: 'סטטוס', key: 'status', width: 10 },
            { header: 'נכס', key: 'property', width: 20 }
        ];

        // עיצוב כותרות
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // הוספת מידע כללי
        worksheet.addRow([]);
        worksheet.addRow(['דוח כספי עבור:', owner.fullName]);
        worksheet.addRow(['תקופה:', `${startDate || 'התחלת הזמנים'} - ${endDate || 'עד היום'}`]);
        worksheet.addRow(['תאריך יצירה:', new Date().toLocaleDateString('he-IL')]);
        worksheet.addRow([]);

        // TODO: הוספת נתונים אמיתיים (נוסיף בהמשך)
        // כרגע נוסיף נתונים לדוגמה
        const sampleData = [
            {
                date: '2025-06-01',
                type: 'הכנסה מהזמנה',
                description: 'תשלום עבור הזמנה',
                amount: 1500,
                status: 'שולם',
                property: 'דירה בתל אביב'
            },
            {
                date: '2025-06-05',
                type: 'הוצאה',
                description: 'תחזוקה',
                amount: -200,
                status: 'שולם',
                property: 'דירה בתל אביב'
            }
        ];

        sampleData.forEach(row => {
            worksheet.addRow(row);
        });

        // הוספת סיכום
        worksheet.addRow([]);
        worksheet.addRow(['סיכום:']);
        worksheet.addRow(['סה"כ הכנסות:', 15000]);
        worksheet.addRow(['סה"כ הוצאות:', 3000]);
        worksheet.addRow(['רווח נטו:', 12000]);

        // שמירת הקובץ
        const fileName = `דוח_כספי_${owner.fullName}_${Date.now()}.xlsx`;
        const filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);

        await workbook.xlsx.writeFile(filePath);

        // שמירה במסד נתונים
        const document = await Document.create({
            fileName: fileName,
            originalName: fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileSize: (await fs.stat(filePath)).size,
            filePath: filePath,
            fileType: 'excel',
            documentType: 'report',
            description: `דוח כספי עבור ${owner.fullName}`,
            isPublic: false,
            uploadedBy: req.user.id,
            propertyId: propertyId || null
        });

        // החזרת הקובץ
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('שגיאה ביצוא Excel:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצוא הדוח',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// יצוא דוח כספי לPDF
const exportOwnerFinancialReportPDF = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { startDate, endDate, propertyId } = req.query;

        // בדיקת הרשאות
        if (req.user.role !== 'admin' && req.user.id !== ownerId) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לייצא דוח זה'
            });
        }

        const owner = await User.findByPk(ownerId);
        if (!owner || owner.role !== 'owner') {
            return res.status(404).json({
                success: false,
                message: 'בעל נכס לא נמצא'
            });
        }

        // יצירת HTML לדוח
        const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    direction: rtl;
                    text-align: right;
                    margin: 20px;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .summary {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: right;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                .amount-positive { color: green; }
                .amount-negative { color: red; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>דוח כספי</h1>
                <h2>עבור: ${owner.fullName}</h2>
                <p>תקופה: ${startDate || 'התחלת הזמנים'} - ${endDate || 'עד היום'}</p>
                <p>תאריך יצירה: ${new Date().toLocaleDateString('he-IL')}</p>
            </div>

            <div class="summary">
                <h3>סיכום כספי</h3>
                <p><strong>סה"כ הכנסות:</strong> ₪15,000</p>
                <p><strong>סה"כ הוצאות:</strong> ₪3,000</p>
                <p><strong>רווח נטו:</strong> <span class="amount-positive">₪12,000</span></p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>תאריך</th>
                        <th>סוג תשלום</th>
                        <th>תיאור</th>
                        <th>סכום</th>
                        <th>נכס</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>01/06/2025</td>
                        <td>הכנסה מהזמנה</td>
                        <td>תשלום עבור הזמנה</td>
                        <td class="amount-positive">₪1,500</td>
                        <td>דירה בתל אביב</td>
                    </tr>
                    <tr>
                        <td>05/06/2025</td>
                        <td>הוצאה</td>
                        <td>תחזוקה</td>
                        <td class="amount-negative">₪200-</td>
                        <td>דירה בתל אביב</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        `;

        // יצירת PDF
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'load' });
        
        const fileName = `דוח_כספי_${owner.fullName}_${Date.now()}.pdf`;
        const filePath = path.join(process.cwd(), 'uploads', 'reports', fileName);
        
        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                bottom: '20px',
                left: '20px',
                right: '20px'
            }
        });

        await browser.close();

        // שמירה במסד נתונים
        const document = await Document.create({
            fileName: fileName,
            originalName: fileName,
            mimeType: 'application/pdf',
            fileSize: (await fs.stat(filePath)).size,
            filePath: filePath,
            fileType: 'pdf',
            documentType: 'report',
            description: `דוח כספי PDF עבור ${owner.fullName}`,
            isPublic: false,
            uploadedBy: req.user.id,
            propertyId: propertyId || null
        });

        // החזרת הקובץ
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('שגיאה ביצוא PDF:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצוא הדוח',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

module.exports = {
    uploadDocument,
    getDocuments,
    downloadDocument,
    deleteDocument,
    exportOwnerFinancialReportExcel,
    exportOwnerFinancialReportPDF
};