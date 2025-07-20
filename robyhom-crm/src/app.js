const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { testConnection } = require('./config/database');
const { syncModels, createDefaultAdmin } = require('./models');

// ייבוא middleware להעלאת קבצים וביקורת תיקיות
const { ensureDirectoryExists } = require('./middleware/upload');

// Import routes
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const documentRoutes = require('./routes/documents'); // ← השורה החדשה!

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// יצירת תיקיות uploads אם לא קיימות
const initializeUploadsDirectories = () => {
    console.log('📁 בודק ויוצר תיקיות uploads...');
    
    const uploadDirs = [
        path.join(process.cwd(), 'uploads'),
        path.join(process.cwd(), 'uploads', 'documents'),
        path.join(process.cwd(), 'uploads', 'images'),
        path.join(process.cwd(), 'uploads', 'reports'),
        path.join(process.cwd(), 'uploads', 'temp')
    ];

    uploadDirs.forEach(dir => {
        ensureDirectoryExists(dir);
    });
    
    console.log('✅ כל תיקיות uploads מוכנות לשימוש');
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/documents', documentRoutes); // ← השורה החדשה!
// Root routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'ברוכים הבאים למערכת RobyHom CRM',
        version: '1.0.0',
        status: 'פעיל',
        features: [
            '✅ ניהול משתמשים (מנהלים, בעלי נכסים, שוכרים)',
            '✅ מערכת אימות מלאה עם JWT',
            '✅ ניהול נכסים (תחזוקה, טווח קצר, טווח ארוך)',
            '✅ ניהול הזמנות לטווח קצר',
            '✅ מערכת תשלומים עם הרשאות מתקדמות',
            '✅ דוחות כספיים מתקדמים',
            '✅ מערכת מסמכים ויצוא דוחות - פעיל!' // ← עודכן!
        ],
        apiEndpoints: {
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register (admin only)',
                profile: 'GET /api/auth/profile',
                users: 'GET /api/auth/users (admin only)'
            },
            properties: {
                list: 'GET /api/properties',
                create: 'POST /api/properties',
                getById: 'GET /api/properties/:id',
                update: 'PUT /api/properties/:id',
                delete: 'DELETE /api/properties/:id',
                stats: 'GET /api/properties/stats',
                availability: 'GET /api/properties/:id/availability'
            },
            bookings: {
                list: 'GET /api/bookings',
                create: 'POST /api/bookings',
                getById: 'GET /api/bookings/:id',
                update: 'PUT /api/bookings/:id',
                cancel: 'POST /api/bookings/:id/cancel',
                checkIn: 'POST /api/bookings/:id/check-in',
                checkOut: 'POST /api/bookings/:id/check-out',
                stats: 'GET /api/bookings/stats'
            },
            payments: {
                list: 'GET /api/payments (כל המשתמשים לפי הרשאות)',
                create: 'POST /api/payments (מנהל בלבד)',
                getById: 'GET /api/payments/:id (לפי הרשאות)',
                update: 'PUT /api/payments/:id (מנהל בלבד)',
                delete: 'DELETE /api/payments/:id (מנהל בלבד)',
                stats: 'GET /api/payments/stats (דוחות)',
                ownerBalance: 'GET /api/payments/owner-balance/:ownerId (יתרת בעל נכס)'
            },
            reports: {
                ownerFinancial: 'GET /api/reports/owner/:ownerId/financial (דוח כספי לבעל נכס)',
                propertyPerformance: 'GET /api/reports/property/:propertyId/performance (דוח ביצועי נכס)',
                systemSummary: 'GET /api/reports/system/summary (דוח כלל המערכת - מנהלים בלבד)',
                exportExcel: 'GET /api/reports/owner/:ownerId/financial/excel (יצוא לExcel)',
                exportPDF: 'GET /api/reports/owner/:ownerId/financial/pdf (יצוא לPDF)'
            },
            documents: { // ← חדש ופעיל!
                upload: 'POST /api/documents/upload (העלאת מסמך)',
                list: 'GET /api/documents (רשימת מסמכים)',
                download: 'GET /api/documents/:id/download (הורדת מסמך)',
                delete: 'DELETE /api/documents/:id (מחיקת מסמך)',
                exportReports: 'GET /api/documents/reports/owner/:id/financial/excel|pdf (יצוא דוחות)'
            }
        },
        permissions: {
            admin: 'מנהל מערכת - יכול ליצור, לעדכן ולמחוק תשלומים ומסמכים',
            owner: 'בעל נכס - יכול רק לראות דוחות ויתרה של הנכסים שלו ולהעלות מסמכים',
            tenant: 'שוכר - יכול לראות רק תשלומים ומסמכים שלו'
        },
        defaultAdmin: {
            email: 'admin@robyhom.com',
            password: 'admin123456',
            note: 'שנה את הסיסמה לאחר הכניסה הראשונה'
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'השרת פועל בהצלחה',
        database: 'מחובר',
        auth: 'פעיל',
        features: {
            authentication: '✅',
            userManagement: '✅',
            properties: '✅',
            bookings: '✅',
            payments: '✅ עם הרשאות מתקדמות',
            reports: '✅ דוחות כספיים מתקדמים',
            documents: '✅ מערכת מסמכים ויצוא - פעיל!', // ← עודכן!
            fileUploads: '✅ העלאת קבצים'
        }
    });
});

// Database connection test
app.get('/api/db-test', async (req, res) => {
    const isConnected = await testConnection();
    res.json({
        database: isConnected ? 'מחובר' : 'לא מחובר',
        status: isConnected ? 'success' : 'error',
        timestamp: new Date().toISOString(),
        models: ['User ✅', 'Property ✅', 'Booking ✅', 'Payment ✅', 'Document ✅']
    });
});

// System info endpoint
app.get('/api/system-info', (req, res) => {
    res.json({
        appName: process.env.APP_NAME || 'RobyHom CRM',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: {
            type: 'PostgreSQL',
            name: process.env.DB_NAME,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT
        },
        authentication: {
            jwtEnabled: true,
            tokenExpiry: '24h',
            rateLimiting: true
        },
        models: {
            User: '✅ מודל משתמשים - מנהלים, בעלי נכסים, שוכרים',
            Property: '✅ מודל נכסים - תחזוקה, טווח קצר, טווח ארוך',
            Booking: '✅ מודל הזמנות - רק לנכסים לטווח קצר',
            Payment: '✅ מודל תשלומים - ניהול כספי עם הרשאות מתקדמות',
            Document: '✅ מודל מסמכים - העלאה, הורדה ויצוא - פעיל!' // ← עודכן!
        },
        features: {
            completed: [
                'מערכת משתמשים',
                'אימות עם JWT',
                'הרשאות לפי תפקידים',
                'מודלים של בסיס הנתונים',
                'מנהל ברירת מחדל',
                'ניהול נכסים מלא',
                'בקרת גישה לפי בעלות',
                'סטטיסטיקות נכסים',
                'בדיקת זמינות נכסים',
                'ניהול הזמנות מלא',
                'צ\'ק-אין וצ\'ק-אאוט',
                'ביטול הזמנות',
                'סטטיסטיקות הזמנות',
                'חישוב מחירים אוטומטי',
                'מערכת תשלומים מלאה עם הרשאות',
                'חישובי יתרה לבעלי נכסים',
                'סטטיסטיקות תשלומים ודוחות כספיים',
                'דוחות כספיים מתקדמים',
                'מערכת מסמכים מלאה - פעיל!', // ← עודכן!
                'יצוא דוחות לPDF ו-Excel - פעיל!', // ← עודכן!
                'העלאת קבצים מאובטחת'
            ],
            inProgress: [
                'מערכת הודעות',
                'לוח עברי',
                'אינטגרציות חיצוניות'
            ]
        },
        uploads: {
            maxFileSize: '10MB',
            allowedTypes: ['PDF', 'Excel', 'Word', 'Images'],
            directories: ['documents', 'images', 'reports', 'temp']
        },
        timestamp: new Date().toISOString()
    });
});

// Test authentication endpoint
app.get('/api/test-auth', (req, res) => {
    res.json({
        message: 'נקודת בדיקה לאימות',
        instructions: {
            step1: 'התחבר עם POST /api/auth/login',
            step2: 'השתמש בטוקן שקיבלת בכותרת Authorization: Bearer <token>',
            step3: 'גש לנקודות הגישה המוגנות'
        },
        examples: {
            login: {
                url: 'POST /api/auth/login',
                body: {
                    email: 'admin@robyhom.com',
                    password: 'admin123456'
                }
            },
            createProperty: {
                url: 'POST /api/properties',
                headers: {
                    'Authorization': 'Bearer <your-token-here>',
                    'Content-Type': 'application/json'
                },
                body: {
                    name: 'דירה לדוגמה',
                    address: 'רחוב הרצל 123, תל אביב',
                    propertyType: 'short_term',
                    basePrice: 300,
                    rooms: 3,
                    bedrooms: 2
                }
            },
            createBooking: {
                url: 'POST /api/bookings',
                headers: {
                    'Authorization': 'Bearer <your-token-here>',
                    'Content-Type': 'application/json'
                },
                body: {
                    propertyId: 'property-uuid-here',
                    guestName: 'יוסי כהן',
                    guestPhone: '050-1234567',
                    numberOfGuests: 2,
                    checkInDate: '2025-07-01',
                    checkOutDate: '2025-07-05'
                }
            },
            createPayment: {
                url: 'POST /api/payments (מנהל בלבד)',
                headers: {
                    'Authorization': 'Bearer <admin-token-here>',
                    'Content-Type': 'application/json'
                },
                body: {
                    amount: 1500,
                    paymentType: 'booking_payment',
                    paymentMethod: 'bank_transfer',
                    description: 'תשלום עבור הזמנה',
                    bookingId: 'booking-uuid-here'
                },
                note: 'רק מנהל מערכת יכול ליצור תשלומים!'
            },
            uploadDocument: {
                url: 'POST /api/documents/upload - פעיל!', // ← עודכן!
                headers: {
                    'Authorization': 'Bearer <your-token-here>'
                },
                body: 'multipart/form-data עם קובץ',
                note: 'העלאת מסמכים עם הרשאות - עובד!'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    res.json({
        title: 'RobyHom CRM API Documentation',
        version: '1.0.0',
        baseUrl: `http://localhost:${PORT}/api`,
        authentication: {
            type: 'JWT Bearer Token',
            header: 'Authorization: Bearer <token>',
            expiry: '24 hours'
        },
        endpoints: {
            auth: {
                'POST /auth/login': 'כניסה למערכת',
                'POST /auth/register': 'רישום משתמש (מנהל בלבד)',
                'GET /auth/profile': 'פרופיל משתמש',
                'PUT /auth/profile': 'עדכון פרופיל',
                'GET /auth/users': 'רשימת משתמשים (מנהל בלבד)',
                'POST /auth/logout': 'יציאה מהמערכת'
            },
            properties: {
                'GET /properties': 'רשימת נכסים (עם פילטרים)',
                'POST /properties': 'יצירת נכס חדש (מנהל/בעל נכס)',
                'GET /properties/:id': 'פרטי נכס ספציפי',
                'PUT /properties/:id': 'עדכון נכס',
                'DELETE /properties/:id': 'מחיקת נכס',
                'GET /properties/stats': 'סטטיסטיקות נכסים',
                'GET /properties/type/:type': 'נכסים לפי סוג',
                'GET /properties/:id/availability': 'בדיקת זמינות נכס',
                'POST /properties/:id/toggle-status': 'שינוי סטטוס נכס'
            },
            bookings: {
                'GET /bookings': 'רשימת הזמנות (עם פילטרים)',
                'POST /bookings': 'יצירת הזמנה חדשה (מנהל/בעל נכס)',
                'GET /bookings/:id': 'פרטי הזמנה ספציפית',
                'PUT /bookings/:id': 'עדכון הזמנה',
                'POST /bookings/:id/cancel': 'ביטול הזמנה',
                'POST /bookings/:id/confirm': 'אישור הזמנה',
                'POST /bookings/:id/check-in': 'צ\'ק-אין',
                'POST /bookings/:id/check-out': 'צ\'ק-אאוט',
                'GET /bookings/stats': 'סטטיסטיקות הזמנות',
                'GET /bookings/property/:id': 'הזמנות לפי נכס',
                'GET /bookings/status/:status': 'הזמנות לפי סטטוס',
                'POST /bookings/:id/add-payment': 'הוספת תשלום'
            },
            payments: {
                'GET /payments': 'רשימת תשלומים (לפי הרשאות המשתמש)',
                'POST /payments': 'יצירת תשלום חדש (מנהל בלבד)',
                'GET /payments/:id': 'פרטי תשלום ספציפי (לפי הרשאות)',
                'PUT /payments/:id': 'עדכון תשלום (מנהל בלבד)',
                'DELETE /payments/:id': 'מחיקת תשלום (מנהל בלבד)',
                'GET /payments/stats': 'סטטיסטיקות תשלומים (דוחות)',
                'GET /payments/owner-balance/:ownerId': 'יתרת בעל נכס (מנהל או בעל הנכס)'
            },
            reports: {
                'GET /reports/owner/:ownerId/financial': 'דוח כספי מפורט לבעל נכס (מנהל או בעל הנכס)',
                'GET /reports/property/:propertyId/performance': 'דוח ביצועי נכס ספציפי (מנהל או בעל הנכס)',
                'GET /reports/system/summary': 'דוח סיכום כלל המערכת (מנהלים בלבד)',
                'GET /reports/owner/:ownerId/financial/excel': 'יצוא דוח כספי לExcel',
                'GET /reports/owner/:ownerId/financial/pdf': 'יצוא דוח כספי לPDF'
            },
            documents: { // ← חדש ופעיל!
                'GET /documents': 'רשימת מסמכים (עם פילטרים וחיפוש) - פעיל!',
                'POST /documents/upload': 'העלאת מסמך חדש (מנהל/בעל נכס) - פעיל!',
                'GET /documents/:id/download': 'הורדת מסמך (לפי הרשאות) - פעיל!',
                'DELETE /documents/:id': 'מחיקת מסמך (מנהל או המעלה) - פעיל!',
                'GET /documents/reports/owner/:id/financial/excel': 'יצוא דוח לExcel - פעיל!',
                'GET /documents/reports/owner/:id/financial/pdf': 'יצוא דוח לPDF - פעיל!'
            },
            system: {
                'GET /health': 'בדיקת תקינות',
                'GET /db-test': 'בדיקת חיבור למסד נתונים',
                'GET /system-info': 'מידע על המערכת',
                'GET /docs': 'תיעוד API'
            }
        },
        userRoles: {
            admin: 'מנהל מערכת - גישה מלאה לכל הנכסים, ההזמנות, התשלומים והמסמכים. יכול ליצור, לעדכן ולמחוק הכל',
            owner: 'בעל נכס - גישה לנכסים והזמנות שלו בלבד. יכול לראות רק דוחות ויתרה שלו ולהעלות מסמכים (לא יכול לשנות תשלומים)',
            tenant: 'שוכר - גישה להזמנות, תשלומים ומסמכים שלו בלבד (צפייה בלבד)'
        },
        propertyTypes: {
            maintenance: 'תחזוקה - נכסים בתחזוקה',
            short_term: 'טווח קצר - שכירות יומית/שבועית',
            long_term: 'טווח ארוך - שכירות חודשית/שנתית'
        },
        bookingStatuses: {
            pending: 'ממתין לאישור',
            confirmed: 'מאושר',
            checked_in: 'נכנס',
            checked_out: 'יצא',
            cancelled: 'בוטל',
            no_show: 'לא הגיע'
        },
        paymentTypes: {
            booking_payment: 'תשלום הזמנה',
            owner_deposit: 'הפקדה מבעל נכס',
            expense_payment: 'תשלום הוצאה',
            refund: 'החזר כספי',
            commission: 'עמלה',
            other: 'אחר'
        },
        paymentMethods: {
            cash: 'מזומן',
            bank_transfer: 'העברה בנקאית',
            credit_card: 'כרטיס אשראי',
            check: 'צ\'ק',
            bit: 'Bit',
            paypal: 'PayPal',
            other: 'אחר'
        },
        documentTypes: {
            contract: 'חוזה',
            invoice: 'חשבונית',
            receipt: 'קבלה',
            report: 'דוח',
            photo: 'תמונה',
            certificate: 'תעודה',
            insurance: 'ביטוח',
            maintenance: 'תחזוקה',
            other: 'אחר'
        },
        fileTypes: {
            pdf: 'PDF',
            excel: 'Excel',
            word: 'Word',
            image: 'תמונה',
            other: 'אחר'
        },
        securityNote: 'רק מנהלי מערכת יכולים ליצור, לעדכן או למחוק תשלומים. בעלי נכסים יכולים רק לצפות בדוחות ויתרה שלהם ולהעלות מסמכים.'
    });
});

// Test documents endpoint - עודכן!
app.get('/api/test-documents', (req, res) => {
    res.json({
        message: '🎉 מערכת מסמכים פעילה ומחוברת!',
        status: 'ACTIVE', // ← עודכן!
        features: [
            '📁 העלאת קבצים מאובטחת - פעיל!',
            '🔍 חיפוש מתקדם במסמכים - פעיל!',
            '📊 יצוא דוחות לPDF ו-Excel - פעיל!',
            '🔒 הרשאות מתקדמות - פעיל!',
            '🏷️ תיוג וקטלוג מסמכים - פעיל!'
        ],
        instructions: {
            step1: 'התחבר למערכת (מנהל או בעל נכס)',
            step2: 'העלה מסמך עם POST /api/documents/upload',
            step3: 'חפש מסמכים עם GET /api/documents?search=...',
            step4: 'יצא דוח לExcel עם GET /api/documents/reports/owner/:id/financial/excel'
        },
        uploadExample: {
            url: 'POST /api/documents/upload',
            headers: {
                'Authorization': 'Bearer <your-token>',
                'Content-Type': 'multipart/form-data'
            },
            formData: {
                document: 'file.pdf',
                documentType: 'invoice',
                description: 'חשבונית לחודש יוני',
                propertyId: 'property-uuid-here',
                isPublic: false
            }
        },
        searchExample: {
            url: 'GET /api/documents',
            parameters: {
                search: 'חשבונית',
                documentType: 'invoice',
                fileType: 'pdf',
                propertyId: 'property-uuid',
                isPublic: 'false',
                page: 1,
                limit: 10
            }
        },
        exportExamples: {
            excelReport: 'GET /api/documents/reports/owner/:ownerId/financial/excel',
            pdfReport: 'GET /api/documents/reports/owner/:ownerId/financial/pdf'
        },
        allowedFileTypes: [
            'PDF (application/pdf)',
            'Excel (.xlsx, .xls)',
            'Word (.docx, .doc)',
            'Images (JPEG, PNG, GIF, WebP)',
            'Text (TXT, CSV)'
        ],
        maxFileSize: '10MB',
        timestamp: new Date().toISOString()
    });
});

// שאר נקודות הבדיקה...
app.get('/api/test-bookings', (req, res) => {
    res.json({
        message: 'נקודת בדיקה לניהול הזמנות',
        instructions: {
            step1: 'התחבר קודם כמנהל מערכת',
            step2: 'צור נכס לטווח קצר עם POST /api/properties',
            step3: 'צור הזמנה עם POST /api/bookings',
            step4: 'בדוק את רשימת ההזמנות עם GET /api/bookings'
        },
        sampleBooking: {
            propertyId: 'property-uuid-here',
            guestName: 'דוד לוי',
            guestEmail: 'david@example.com',
            guestPhone: '050-1234567',
            numberOfGuests: 3,
            checkInDate: '2025-08-15',
            checkOutDate: '2025-08-20',
            specialRequests: 'מיטה נוספת',
            bookingSource: 'direct'
        },
        workflowExample: {
            step1: 'POST /api/bookings - יצירת הזמנה (סטטוס: pending)',
            step2: 'POST /api/bookings/:id/confirm - אישור הזמנה',
            step3: 'POST /api/bookings/:id/check-in - צ\'ק-אין ביום הגעה',
            step4: 'POST /api/bookings/:id/check-out - צ\'ק-אאוט ביום עזיבה'
        },
        availableFilters: {
            status: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
            paymentStatus: ['unpaid', 'partial', 'paid', 'refunded'],
            propertyId: 'מזהה נכס ספציפי',
            search: 'חיפוש בשם אורח, אימייל או טלפון',
            checkInDate: 'תאריך כניסה',
            checkOutDate: 'תאריך יציאה'
        }
    });
});

app.get('/api/test-payments', (req, res) => {
    res.json({
        message: 'נקודת בדיקה למערכת תשלומים',
        importantNote: '⚠️ רק מנהלי מערכת יכולים ליצור ולעדכן תשלומים!',
        instructions: {
            step1: 'התחבר קודם כמנהל מערכת (לא בעל נכס!)',
            step2: 'צור תשלום עם POST /api/payments (מנהל בלבד)',
            step3: 'בדוק את רשימת התשלומים עם GET /api/payments',
            step4: 'קבל סטטיסטיקות עם GET /api/payments/stats'
        },
        userPermissions: {
            admin: {
                canCreate: true,
                canUpdate: true,
                canDelete: true,
                canView: 'כל התשלומים'
            },
            owner: {
                canCreate: false,
                canUpdate: false,
                canDelete: false,
                canView: 'רק דוחות ויתרה של הנכסים שלו'
            },
            tenant: {
                canCreate: false,
                canUpdate: false,
                canDelete: false,
                canView: 'רק תשלומים שלו'
            }
        },
        samplePayment: {
            amount: 1500,
            paymentType: 'booking_payment',
            paymentMethod: 'bank_transfer',
            description: 'תשלום עבור הזמנה ביולי',
            bookingId: 'booking-uuid-here',
            referenceNumber: '123456789',
            note: 'נוצר על ידי מנהל מערכת בלבד'
        },
        paymentTypes: {
            booking_payment: 'תשלום מאורח עבור הזמנה',
            owner_deposit: 'הפקדה של בעל נכס למערכת',
            expense_payment: 'תשלום הוצאה (תחזוקה, שיפוץ)',
            commission: 'עמלה שנגבתה',
            refund: 'החזר כספי',
            other: 'אחר'
        },
        ownerBalanceExample: {
            url: 'GET /api/payments/owner-balance/:ownerId',
            description: 'חישוב יתרה של בעל נכס',
            access: 'מנהל או בעל הנכס עצמו',
            response: {
                income: 'הכנסות מהזמנות',
                deposits: 'הפקדות שהעביר',
                expenses: 'הוצאות ששולמו עבורו',
                commissions: 'עמלות שנגבו',
                balance: 'יתרה נטו'
            }
        }
    });
});

// Test reports endpoint
app.get('/api/test-reports', (req, res) => {
    res.json({
        message: 'נקודת בדיקה לדוחות כספיים ויצוא',
        availableReports: {
            ownerFinancial: {
                url: 'GET /api/reports/owner/:ownerId/financial',
                description: 'דוח כספי מפורט לבעל נכס',
                access: 'מנהל או בעל הנכס עצמו',
                parameters: {
                    startDate: 'תאריך התחלה (אופציונלי)',
                    endDate: 'תאריך סיום (אופציונלי)',
                    propertyId: 'מזהה נכס ספציפי (אופציונלי)'
                },
                example: '/api/reports/owner/12345/financial?startDate=2025-01-01&endDate=2025-12-31'
            },
            propertyPerformance: {
                url: 'GET /api/reports/property/:propertyId/performance',
                description: 'דוח ביצועי נכס ספציפי',
                access: 'מנהל או בעל הנכס',
                parameters: {
                    startDate: 'תאריך התחלה (אופציונלי)',
                    endDate: 'תאריך סיום (אופציונלי)'
                },
                example: '/api/reports/property/prop-123/performance?startDate=2025-01-01'
            },
            systemSummary: {
                url: 'GET /api/reports/system/summary',
                description: 'דוח סיכום כלל המערכת',
                access: 'מנהלים בלבד',
                parameters: {
                    startDate: 'תאריך התחלה (אופציונלי)',
                    endDate: 'תאריך סיום (אופציונלי)'
                },
                example: '/api/reports/system/summary?startDate=2025-01-01&endDate=2025-12-31'
            }
        },
        exportOptions: {
            excel: {
                url: 'GET /api/documents/reports/owner/:ownerId/financial/excel', // ← עודכן!
                description: 'יצוא דוח כספי לExcel - פעיל!',
                features: ['טבלאות מעוצבות', 'נוסחאות אוטומטיות', 'סיכומים']
            },
            pdf: {
                url: 'GET /api/documents/reports/owner/:ownerId/financial/pdf', // ← עודכן!
                description: 'יצוא דוח כספי לPDF - פעיל!',
                features: ['עיצוב מקצועי', 'לוגו וכותרות', 'גרפיקה']
            }
        },
        reportFeatures: [
            '📊 סיכומים כספיים מפורטים',
            '📈 פירוט חודשי של הכנסות והוצאות',
            '🏢 ביצועים לפי נכס',
            '👥 פירוט לפי בעלי נכסים',
            '💰 חישובי יתרה ורווחיות',
            '🔍 פילטרים מתקדמים לפי תאריך ונכס',
            '📄 יצוא לPDF מעוצב - פעיל!', // ← עודכן!
            '📊 יצוא לExcel עם נוסחאות - פעיל!' // ← עודכן!
        ],
        instructions: {
            step1: 'התחבר למערכת (מנהל או בעל נכס)',
            step2: 'צור נתונים - נכסים, הזמנות, תשלומים',
            step3: 'בקש דוח עם הפרמטרים הרצויים',
            step4: 'יצא לPDF או Excel לשימוש חיצוני - עובד!'
        },
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 שגיאה בשרת:', err.stack);
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'טוקן לא תקין',
            code: 'INVALID_TOKEN'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'טוקן פג תוקף',
            code: 'TOKEN_EXPIRED'
        });
    }
    
    // Validation errors
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            error: 'שגיאת ולידציה',
            details: err.errors.map(e => e.message),
            code: 'VALIDATION_ERROR'
        });
    }
    
    // Database constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            error: 'הפרת אילוץ ייחודיות',
            message: 'הערך שהוזן כבר קיים במערכת',
            code: 'UNIQUE_CONSTRAINT_ERROR'
        });
    }
    
    // Generic error
    res.status(500).json({ 
        error: 'שגיאה פנימית בשרת',
        message: process.env.NODE_ENV === 'development' ? err.message : 'אירעה שגיאה',
        timestamp: new Date().toISOString(),
        code: 'INTERNAL_SERVER_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'הדף לא נמצא',
        path: req.path,
        method: req.method,
        message: 'הנתיב המבוקש לא קיים',
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'GET /api/db-test',
            'GET /api/system-info',
            'GET /api/docs',
            'GET /api/test-auth',
            'GET /api/test-bookings',
            'GET /api/test-payments',
            'GET /api/test-reports',
            'GET /api/test-documents',
            'POST /api/auth/login',
            'GET /api/properties',
            'GET /api/bookings',
            'GET /api/payments',
            'GET /api/documents', // ← חדש!
            'POST /api/documents/upload', // ← חדש!
            'GET /api/reports/owner/:ownerId/financial',
            'GET /api/reports/property/:propertyId/performance',
            'GET /api/reports/system/summary'
        ],
        timestamp: new Date().toISOString()
    });
});

// Initialize database and start server
const startServer = async () => {
    try {
        console.log('🚀 מפעיל שרת RobyHom CRM...');
        
        // Initialize upload directories
        initializeUploadsDirectories();
        
        // Test database connection
        console.log('📊 בודק חיבור לבסיס הנתונים...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ לא ניתן להתחבר לבסיס הנתונים. בודק את ההגדרות...');
            process.exit(1);
        }
        
        // Sync database models
        console.log('🔄 מסנכרן מודלים עם בסיס הנתונים...');
        await syncModels(true);
        
        // Create default admin user
        console.log('👤 בודק משתמש מנהל ברירת מחדל...');
        await createDefaultAdmin();
        
        // Start server
        app.listen(PORT, () => {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎉 שרת RobyHom CRM הופעל בהצלחה עם מערכת מסמכים מלאה!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌐 כתובת שרת: http://localhost:${PORT}`);
            console.log(`📊 בסיס נתונים: ${process.env.DB_NAME} (מחובר ופעיל)`);
            console.log(`🗄️  מודלים: User, Property, Booking, Payment, Document`);
            console.log(`🔐 אימות: JWT עם הרשאות לפי תפקידים`);
            console.log(`🏢 ניהול נכסים: יצירה, עריכה, חיפוש וסטטיסטיקות`);
            console.log(`📅 ניהול הזמנות: יצירה, עריכה, צ'ק-אין/אאוט, ביטול`);
            console.log(`💰 ניהול תשלומים: דוחות לבעלי נכסים, ניהול מלא למנהלים`);
            console.log(`📈 דוחות מתקדמים: כספיים, ביצועים, סיכומי מערכת`);
            console.log(`📁 מערכת מסמכים: העלאה, הורדה, חיפוש וארכוב - פעיל!`); // ← עודכן!
            console.log(`📊 יצוא דוחות: PDF מעוצב ו-Excel עם נוסחאות - פעיל!`); // ← עודכן!
            console.log(`📅 זמן הפעלה: ${new Date().toLocaleString('he-IL')}`);
            console.log(`🔧 סביבה: ${process.env.NODE_ENV || 'development'}`);
            console.log('\n📍 נקודות גישה עיקריות:');
            console.log(`   • דף בית: http://localhost:${PORT}`);
            console.log(`   • תיעוד API: http://localhost:${PORT}/api/docs`);
            console.log(`   • בדיקת תקינות: http://localhost:${PORT}/api/health`);
            console.log(`   • כניסה למערכת: POST http://localhost:${PORT}/api/auth/login`);
            console.log(`   • ניהול נכסים: http://localhost:${PORT}/api/properties`);
            console.log(`   • ניהול הזמנות: http://localhost:${PORT}/api/bookings`);
            console.log(`   • ניהול תשלומים: http://localhost:${PORT}/api/payments`);
            console.log(`   • מערכת מסמכים: http://localhost:${PORT}/api/documents - פעיל!`); // ← עודכן!
            console.log(`   • דוחות כספיים: http://localhost:${PORT}/api/reports`);
            console.log(`   • בדיקת מסמכים: http://localhost:${PORT}/api/test-documents`);
            console.log(`   • בדיקת דוחות: http://localhost:${PORT}/api/test-reports`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            if (process.env.NODE_ENV === 'development') {
                console.log('🔑 פרטי כניסה ברירת מחדל:');
                console.log('   📧 אימייל: admin@robyhom.com');
                console.log('   🔐 סיסמה: admin123456');
                console.log('   ⚠️  שנה את הסיסמה לאחר הכניסה הראשונה!');
                console.log('\n💡 טיפים לבדיקה:');
                console.log('   • אימות: http://localhost:3000/api/test-auth');
                console.log('   • נכסים: http://localhost:3000/api/test-properties');
                console.log('   • הזמנות: http://localhost:3000/api/test-bookings');
                console.log('   • תשלומים: http://localhost:3000/api/test-payments');
                console.log('   • דוחות: http://localhost:3000/api/test-reports');
                console.log('   • מסמכים: http://localhost:3000/api/test-documents - פעיל!'); // ← עודכן!
                console.log('   • תיעוד מלא: http://localhost:3000/api/docs');
                console.log('\n🛡️ הרשאות מערכת:');
                console.log('   • מנהל: יכול ליצור/לעדכן/למחוק הכל');
                console.log('   • בעל נכס: יכול לראות דוחות ולהעלות מסמכים');
                console.log('   • שוכר: יכול לראות רק נתונים שלו');
                console.log('\n📊 פיצ\'רים זמינים:');
                console.log('   • דוח כספי: GET /api/reports/owner/:id/financial');
                console.log('   • יצוא לExcel: GET /api/documents/reports/owner/:id/financial/excel - פעיל!'); // ← עודכן!
                console.log('   • יצוא לPDF: GET /api/documents/reports/owner/:id/financial/pdf - פעיל!'); // ← עודכן!
                console.log('   • העלאת מסמכים: POST /api/documents/upload - פעיל!'); // ← עודכן!
                console.log('   • חיפוש מסמכים: GET /api/documents?search=... - פעיל!'); // ← עודכן!
                console.log('\n📁 תיקיות uploads:');
                console.log('   • מסמכים: uploads/documents/');
                console.log('   • תמונות: uploads/images/');
                console.log('   • דוחות: uploads/reports/');
                console.log('   • זמניים: uploads/temp/\n');
            }
        });
        
    } catch (error) {
        console.error('💥 שגיאה קריטית בהפעלת השרת:', error.message);
        console.error('🔧 פרטי השגיאה:', error.stack);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 מקבל אות כיבוי...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 מקבל אות כיבוי (Ctrl+C)...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;