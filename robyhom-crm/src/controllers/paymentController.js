const { Payment, Property, Booking, User } = require('../models');
const { Op } = require('sequelize');

// יצירת תשלום חדש - רק מנהלים!
const createPayment = async (req, res) => {
    try {
        // רק מנהלים יכולים ליצור תשלומים
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'רק מנהלי מערכת יכולים ליצור תשלומים'
            });
        }

        const {
            amount,
            paymentDate,
            paymentMethod,
            paymentType,
            bookingId,
            propertyId,
            payerId,
            receiverId,
            description,
            referenceNumber,
            checkNumber,
            checkDate,
            status = 'completed',
            category,
            isForRenovation = false,
            isCommission = false,
            commissionRate,
            originalAmount,
            vatAmount,
            vatRate,
            receiptNumber,
            invoiceNumber,
            attachments,
            internalNotes
        } = req.body;

        // ולידציה בסיסית
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'סכום התשלום חייב להיות גדול מאפס'
            });
        }

        if (!paymentType) {
            return res.status(400).json({
                success: false,
                message: 'סוג התשלום הוא שדה חובה'
            });
        }

        // בדיקה שהנכס קיים (אם צוין)
        if (propertyId) {
            const property = await Property.findByPk(propertyId);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'נכס לא נמצא'
                });
            }
        }

        // בדיקה שההזמנה קיימת (אם צוינה)
        if (bookingId) {
            const booking = await Booking.findByPk(bookingId);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'הזמנה לא נמצאה'
                });
            }
        }

        // יצירת התשלום
        const payment = await Payment.create({
            amount,
            paymentDate: paymentDate || new Date(),
            paymentMethod: paymentMethod || 'cash',
            paymentType,
            bookingId,
            propertyId,
            payerId,
            receiverId,
            description,
            referenceNumber,
            checkNumber,
            checkDate,
            status,
            category,
            isForRenovation,
            isCommission,
            commissionRate,
            originalAmount,
            vatAmount,
            vatRate,
            receiptNumber,
            invoiceNumber,
            attachments,
            internalNotes,
            createdBy: req.user.id
        });

        // החזרת התשלום עם כל הפרטים הקשורים
        const fullPayment = await Payment.findByPk(payment.id, {
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address', 'propertyType']
                },
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'checkInDate', 'checkOutDate', 'guestName', 'guestPhone']
                },
                {
                    model: User,
                    as: 'payer',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'תשלום נרשם בהצלחה',
            data: fullPayment
        });

    } catch (error) {
        console.error('שגיאה ביצירת תשלום:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// קבלת רשימת תשלומים עם פילטרים - צפייה בלבד לבעל נכס
const getPayments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            paymentType,
            paymentMethod,
            status,
            propertyId,
            bookingId,
            payerId,
            receiverId,
            dateFrom,
            dateTo,
            isForRenovation,
            isCommission,
            search
        } = req.query;

        // בניית תנאי החיפוש
        const whereConditions = {};

        // פילטרים בסיסיים
        if (paymentType) whereConditions.paymentType = paymentType;
        if (paymentMethod) whereConditions.paymentMethod = paymentMethod;
        if (status) whereConditions.status = status;
        if (propertyId) whereConditions.propertyId = propertyId;
        if (bookingId) whereConditions.bookingId = bookingId;
        if (payerId) whereConditions.payerId = payerId;
        if (receiverId) whereConditions.receiverId = receiverId;
        if (isForRenovation !== undefined) whereConditions.isForRenovation = isForRenovation === 'true';
        if (isCommission !== undefined) whereConditions.isCommission = isCommission === 'true';

        // פילטר טווח תאריכים
        if (dateFrom || dateTo) {
            whereConditions.paymentDate = {};
            if (dateFrom) whereConditions.paymentDate[Op.gte] = dateFrom;
            if (dateTo) whereConditions.paymentDate[Op.lte] = dateTo;
        }

        // חיפוש טקסט
        if (search) {
            whereConditions[Op.or] = [
                { description: { [Op.iLike]: `%${search}%` } },
                { category: { [Op.iLike]: `%${search}%` } },
                { referenceNumber: { [Op.iLike]: `%${search}%` } },
                { checkNumber: { [Op.iLike]: `%${search}%` } },
                { receiptNumber: { [Op.iLike]: `%${search}%` } },
                { invoiceNumber: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // הרשאות - בעל נכס רואה רק תשלומים הקשורים לנכסים שלו
        if (req.user.role === 'owner') {
            const userProperties = await Property.findAll({
                where: { ownerId: req.user.id },
                attributes: ['id']
            });
            
            const propertyIds = userProperties.map(p => p.id);
            
            // בעל נכס רואה רק תשלומים של הנכסים שלו או תשלומים שהוא מעורב בהם
            whereConditions[Op.or] = [
                { propertyId: { [Op.in]: propertyIds } },
                { payerId: req.user.id },
                { receiverId: req.user.id }
            ];
        }

        // שוכר רואה רק תשלומים שלו
        if (req.user.role === 'tenant') {
            whereConditions[Op.or] = [
                { payerId: req.user.id },
                { receiverId: req.user.id }
            ];
        }

        // חישוב pagination
        const offset = (page - 1) * limit;

        // שליפת התשלומים
        const { count, rows: payments } = await Payment.findAndCountAll({
            where: whereConditions,
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address', 'propertyType']
                },
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'checkInDate', 'checkOutDate', 'guestName', 'guestPhone']
                },
                {
                    model: User,
                    as: 'payer',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: {
                payments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: parseInt(limit)
                }
            },
            permissions: {
                canCreate: req.user.role === 'admin',
                canEdit: req.user.role === 'admin',
                canDelete: req.user.role === 'admin',
                viewOnly: req.user.role === 'owner' // ← הוספנו מידע על הרשאות
            }
        });

    } catch (error) {
        console.error('שגיאה בקבלת תשלומים:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// קבלת תשלום בודד - צפייה בלבד לבעל נכס
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.findByPk(id, {
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address', 'propertyType'],
                    include: [{
                        model: User,
                        as: 'owner',
                        attributes: ['id', 'fullName', 'email', 'phone']
                    }]
                },
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'checkInDate', 'checkOutDate', 'guestName', 'guestPhone', 'totalAmount']
                },
                {
                    model: User,
                    as: 'payer',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'תשלום לא נמצא'
            });
        }

        // בדיקת הרשאות
        if (req.user.role === 'owner') {
            const hasAccess = payment.property && payment.property.ownerId === req.user.id ||
                           payment.payerId === req.user.id ||
                           payment.receiverId === req.user.id;
            
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'אין לך הרשאה לצפות בתשלום זה'
                });
            }
        }

        if (req.user.role === 'tenant') {
            const hasAccess = payment.payerId === req.user.id || payment.receiverId === req.user.id;
            
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'אין לך הרשאה לצפות בתשלום זה'
                });
            }
        }

        res.json({
            success: true,
            data: payment,
            permissions: {
                canEdit: req.user.role === 'admin',
                canDelete: req.user.role === 'admin',
                viewOnly: req.user.role === 'owner' || req.user.role === 'tenant'
            }
        });

    } catch (error) {
        console.error('שגיאה בקבלת תשלום:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// עדכון תשלום - רק מנהלים!
const updatePayment = async (req, res) => {
    try {
        // רק מנהלים יכולים לעדכן תשלומים
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'רק מנהלי מערכת יכולים לעדכן תשלומים'
            });
        }

        const { id } = req.params;
        const updateData = req.body;

        // מציאת התשלום
        const payment = await Payment.findByPk(id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'תשלום לא נמצא'
            });
        }

        // עדכון התשלום
        await payment.update(updateData);

        // קבלת התשלום המעודכן עם כל הפרטים
        const updatedPayment = await Payment.findByPk(id, {
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address', 'propertyType']
                },
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'checkInDate', 'checkOutDate', 'guestName', 'guestPhone']
                },
                {
                    model: User,
                    as: 'payer',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        res.json({
            success: true,
            message: 'תשלום עודכן בהצלחה',
            data: updatedPayment
        });

    } catch (error) {
        console.error('שגיאה בעדכון תשלום:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// מחיקת תשלום - רק מנהלים!
const deletePayment = async (req, res) => {
    try {
        // רק מנהלים יכולים למחוק תשלומים
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'רק מנהלי מערכת יכולים למחוק תשלומים'
            });
        }

        const { id } = req.params;

        const payment = await Payment.findByPk(id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'תשלום לא נמצא'
            });
        }

        await payment.destroy();

        res.json({
            success: true,
            message: 'תשלום נמחק בהצלחה'
        });

    } catch (error) {
        console.error('שגיאה במחיקת תשלום:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// קבלת סטטיסטיקות תשלומים - דוחות לבעל נכס
const getPaymentStats = async (req, res) => {
    try {
        const { propertyId, startDate, endDate } = req.query;

        let whereConditions = { status: 'completed' };

        // פילטר לפי נכס
        if (propertyId) {
            whereConditions.propertyId = propertyId;
            
            // בדיקה שבעל הנכס מורשה לראות נתונים של הנכס הזה
            if (req.user.role === 'owner') {
                const property = await Property.findByPk(propertyId);
                if (!property || property.ownerId !== req.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'אין לך הרשאה לצפות בנתונים של נכס זה'
                    });
                }
            }
        }

        // פילטר לפי תאריכים
        if (startDate || endDate) {
            whereConditions.paymentDate = {};
            if (startDate) whereConditions.paymentDate[Op.gte] = startDate;
            if (endDate) whereConditions.paymentDate[Op.lte] = endDate;
        }

        // הרשאות לבעל נכס - רק הנכסים שלו
        if (req.user.role === 'owner') {
            const userProperties = await Property.findAll({
                where: { ownerId: req.user.id },
                attributes: ['id']
            });
            
            const propertyIds = userProperties.map(p => p.id);
            whereConditions[Op.or] = [
                { propertyId: { [Op.in]: propertyIds } },
                { payerId: req.user.id },
                { receiverId: req.user.id }
            ];
        }

        const payments = await Payment.findAll({
            where: whereConditions,
            attributes: ['paymentType', 'amount', 'isCommission', 'isForRenovation']
        });

        const stats = {
            totalPayments: payments.length,
            totalAmount: 0,
            bookingPayments: 0,
            ownerDeposits: 0,
            expensePayments: 0,
            commissions: 0,
            renovationFunds: 0,
            refunds: 0,
            other: 0,
            userRole: req.user.role // ← הוספת מידע על התפקיד
        };

        payments.forEach(payment => {
            const amount = parseFloat(payment.amount);
            stats.totalAmount += amount;

            switch (payment.paymentType) {
                case 'booking_payment':
                    stats.bookingPayments += amount;
                    break;
                case 'owner_deposit':
                    stats.ownerDeposits += amount;
                    break;
                case 'expense_payment':
                    stats.expensePayments += amount;
                    break;
                case 'commission':
                    stats.commissions += amount;
                    break;
                case 'refund':
                    stats.refunds += amount;
                    break;
                default:
                    stats.other += amount;
                    break;
            }

            if (payment.isForRenovation) {
                stats.renovationFunds += amount;
            }
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('שגיאה בקבלת סטטיסטיקות תשלומים:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// קבלת יתרה לבעל נכס - רק מנהל או בעל הנכס עצמו
const getOwnerBalance = async (req, res) => {
    try {
        const { ownerId } = req.params;

        // בדיקת הרשאות - בעל נכס יכול לראות רק יתרה שלו
        if (req.user.role === 'owner' && req.user.id !== ownerId) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לצפות ביתרה של בעל נכס אחר'
            });
        }

        const balance = await Payment.calculateOwnerBalance(ownerId);

        res.json({
            success: true,
            data: balance,
            note: 'יתרה חיובית = החברה חייבת לך, יתרה שלילית = אתה חייב לחברה'
        });

    } catch (error) {
        console.error('שגיאה בקבלת יתרת בעל נכס:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

module.exports = {
    createPayment,
    getPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getPaymentStats,
    getOwnerBalance
};