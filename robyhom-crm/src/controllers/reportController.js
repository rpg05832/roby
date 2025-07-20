const { Payment, Property, Booking, User } = require('../models');
const { Op } = require('sequelize');

// דו"ח כספי מפורט לבעל נכס
const getOwnerFinancialReport = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { startDate, endDate, propertyId } = req.query;

        // בדיקת הרשאות
        if (req.user.role === 'owner' && req.user.id !== ownerId) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לצפות בדוח של בעל נכס אחר'
            });
        }

        // בדיקה שבעל הנכס קיים
        const owner = await User.findByPk(ownerId);
        if (!owner || owner.role !== 'owner') {
            return res.status(404).json({
                success: false,
                message: 'בעל נכס לא נמצא'
            });
        }

        // בניית תנאי החיפוש
        let whereConditions = { status: 'completed' };
        
        // פילטר תאריכים
        if (startDate || endDate) {
            whereConditions.paymentDate = {};
            if (startDate) whereConditions.paymentDate[Op.gte] = startDate;
            if (endDate) whereConditions.paymentDate[Op.lte] = endDate;
        }

        // קבלת נכסים של בעל הנכס
        const ownerProperties = await Property.findAll({
            where: { ownerId },
            attributes: ['id', 'name', 'address', 'propertyType']
        });

        if (ownerProperties.length === 0) {
            return res.json({
                success: true,
                data: {
                    owner: { id: owner.id, fullName: owner.fullName, email: owner.email },
                    properties: [],
                    summary: { totalIncome: 0, totalExpenses: 0, totalCommissions: 0, netIncome: 0 },
                    payments: [],
                    currentBalance: 0, // ← תיקון!
                    message: 'לא נמצאו נכסים עבור בעל נכס זה'
                }
            });
        }

        const propertyIds = ownerProperties.map(p => p.id);

        // פילטר לפי נכס ספציפי אם נדרש
        if (propertyId) {
            if (!propertyIds.includes(propertyId)) {
                return res.status(403).json({
                    success: false,
                    message: 'אין לך הרשאה לצפות בנתונים של נכס זה'
                });
            }
            whereConditions.propertyId = propertyId;
        } else {
            whereConditions[Op.or] = [
                { propertyId: { [Op.in]: propertyIds } },
                { payerId: ownerId },
                { receiverId: ownerId }
            ];
        }

        // שליפת כל התשלומים הרלוונטיים
        const payments = await Payment.findAll({
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
                    attributes: ['id', 'checkInDate', 'checkOutDate', 'guestName']
                },
                {
                    model: User,
                    as: 'payer',
                    attributes: ['id', 'fullName', 'email']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'fullName', 'email']
                }
            ],
            order: [['paymentDate', 'DESC']]
        });

        // חישוב סיכומים
        let summary = {
            totalIncome: 0,        // הכנסות מהזמנות
            totalDeposits: 0,      // הפקדות מבעל הנכס
            totalExpenses: 0,      // הוצאות ששולמו עבורו
            totalCommissions: 0,   // עמלות שנגבו
            renovationFunds: 0,    // כספים לשיפוצים
            netIncome: 0          // רווח נטו
        };

        // פירוט לפי סוגי תשלום
        let paymentsByType = {
            booking_payment: [],
            owner_deposit: [],
            expense_payment: [],
            commission: [],
            refund: [],
            other: []
        };

        // פירוט לפי נכס
        let paymentsByProperty = {};

        payments.forEach(payment => {
            const amount = parseFloat(payment.amount);
            
            // הוספה לקטגוריה
            if (paymentsByType[payment.paymentType]) {
                paymentsByType[payment.paymentType].push(payment);
            }

            // הוספה לנכס
            if (payment.property) {
                if (!paymentsByProperty[payment.property.id]) {
                    paymentsByProperty[payment.property.id] = {
                        property: payment.property,
                        payments: [],
                        income: 0,
                        expenses: 0,
                        net: 0
                    };
                }
                paymentsByProperty[payment.property.id].payments.push(payment);
            }

            // חישוב סיכומים
            switch (payment.paymentType) {
                case 'booking_payment':
                    if (payment.receiverId === ownerId || (payment.property && payment.property.ownerId === ownerId)) {
                        summary.totalIncome += amount;
                        if (payment.property) {
                            paymentsByProperty[payment.property.id].income += amount;
                        }
                    }
                    break;
                case 'owner_deposit':
                    if (payment.payerId === ownerId) {
                        summary.totalDeposits += amount;
                    }
                    break;
                case 'expense_payment':
                    if (payment.property && payment.property.ownerId === ownerId) {
                        summary.totalExpenses += amount;
                        if (payment.property) {
                            paymentsByProperty[payment.property.id].expenses += amount;
                        }
                    }
                    break;
                case 'commission':
                    if (payment.payerId === ownerId) {
                        summary.totalCommissions += amount;
                    }
                    break;
            }

            // כספים לשיפוצים
            if (payment.isForRenovation) {
                summary.renovationFunds += amount;
            }
        });

        // חישוב רווח נטו לכל נכס
        Object.keys(paymentsByProperty).forEach(propertyId => {
            const propertyData = paymentsByProperty[propertyId];
            propertyData.net = propertyData.income - propertyData.expenses;
        });

        // חישוב רווח נטו כולל
        summary.netIncome = summary.totalIncome + summary.totalDeposits - summary.totalExpenses - summary.totalCommissions;

        // חישוב יתרה נוכחית (פשוט מחישוב הסיכום) ← תיקון!
        const currentBalance = summary.netIncome;

        res.json({
            success: true,
            data: {
                owner: {
                    id: owner.id,
                    fullName: owner.fullName,
                    email: owner.email,
                    phone: owner.phone
                },
                reportPeriod: {
                    startDate: startDate || 'התחלת הזמנים',
                    endDate: endDate || 'עד היום',
                    propertyFilter: propertyId ? ownerProperties.find(p => p.id === propertyId)?.name : 'כל הנכסים'
                },
                properties: ownerProperties,
                summary,
                currentBalance,
                paymentsByType,
                paymentsByProperty: Object.values(paymentsByProperty),
                payments: payments.slice(0, 50), // מגביל ל-50 תשלומים אחרונים
                totalPayments: payments.length
            }
        });

    } catch (error) {
        console.error('שגיאה בייצור דוח כספי:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// דו"ח ביצועים לנכס ספציפי
const getPropertyPerformanceReport = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { startDate, endDate } = req.query;

        // מציאת הנכס
        const property = await Property.findByPk(propertyId, {
            include: [{
                model: User,
                as: 'owner',
                attributes: ['id', 'fullName', 'email']
            }]
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                message: 'נכס לא נמצא'
            });
        }

        // בדיקת הרשאות
        if (req.user.role === 'owner' && property.ownerId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לצפות בדוח של נכס זה'
            });
        }

        // בניית תנאי החיפוש לתשלומים
        let paymentWhere = { 
            propertyId,
            status: 'completed'
        };

        // בניית תנאי החיפוש להזמנות
        let bookingWhere = { propertyId };

        if (startDate || endDate) {
            paymentWhere.paymentDate = {};
            bookingWhere.checkInDate = {};
            
            if (startDate) {
                paymentWhere.paymentDate[Op.gte] = startDate;
                bookingWhere.checkInDate[Op.gte] = startDate;
            }
            if (endDate) {
                paymentWhere.paymentDate[Op.lte] = endDate;
                bookingWhere.checkInDate[Op.lte] = endDate;
            }
        }

        // שליפת תשלומים
        const payments = await Payment.findAll({
            where: paymentWhere,
            include: [
                {
                    model: Booking,
                    as: 'booking',
                    attributes: ['id', 'checkInDate', 'checkOutDate', 'guestName', 'numberOfNights']
                }
            ],
            order: [['paymentDate', 'DESC']]
        });

        // שליפת הזמנות
        const bookings = await Booking.findAll({
            where: bookingWhere,
            order: [['checkInDate', 'DESC']]
        });

        // חישובי ביצועים
        let performance = {
            totalRevenue: 0,
            totalExpenses: 0,
            netProfit: 0,
            totalBookings: bookings.length,
            totalNights: 0,
            averageNightlyRate: 0,
            occupancyRate: 0,
            averageBookingValue: 0
        };

        // חישוב הכנסות והוצאות
        payments.forEach(payment => {
            const amount = parseFloat(payment.amount);
            
            switch (payment.paymentType) {
                case 'booking_payment':
                    performance.totalRevenue += amount;
                    break;
                case 'expense_payment':
                    performance.totalExpenses += amount;
                    break;
            }
        });

        // חישוב נתוני הזמנות
        let totalNights = 0;
        let totalBookingValue = 0;

        bookings.forEach(booking => {
            totalNights += booking.numberOfNights || 0;
            totalBookingValue += parseFloat(booking.totalAmount || 0);
        });

        performance.totalNights = totalNights;
        performance.netProfit = performance.totalRevenue - performance.totalExpenses;

        if (bookings.length > 0) {
            performance.averageBookingValue = totalBookingValue / bookings.length;
            
            if (totalNights > 0) {
                performance.averageNightlyRate = performance.totalRevenue / totalNights;
            }
        }

        // חישוב שיעור תפוסה (אם יש טווח תאריכים)
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            
            if (totalDays > 0) {
                performance.occupancyRate = (totalNights / totalDays) * 100;
            }
        }

        // ביצועים לפי חודש (אם יש טווח תאריכים של יותר מחודש)
        let monthlyBreakdown = [];
        if (startDate && endDate) {
            const months = getMonthsBetweenDates(startDate, endDate);
            
            for (const month of months) {
                const monthStart = new Date(month.year, month.month - 1, 1);
                const monthEnd = new Date(month.year, month.month, 0);
                
                const monthPayments = payments.filter(p => {
                    const paymentDate = new Date(p.paymentDate);
                    return paymentDate >= monthStart && paymentDate <= monthEnd;
                });
                
                const monthBookings = bookings.filter(b => {
                    const checkIn = new Date(b.checkInDate);
                    return checkIn >= monthStart && checkIn <= monthEnd;
                });

                let monthRevenue = 0;
                let monthExpenses = 0;

                monthPayments.forEach(payment => {
                    const amount = parseFloat(payment.amount);
                    if (payment.paymentType === 'booking_payment') {
                        monthRevenue += amount;
                    } else if (payment.paymentType === 'expense_payment') {
                        monthExpenses += amount;
                    }
                });

                monthlyBreakdown.push({
                    month: `${month.month}/${month.year}`,
                    revenue: monthRevenue,
                    expenses: monthExpenses,
                    profit: monthRevenue - monthExpenses,
                    bookings: monthBookings.length,
                    nights: monthBookings.reduce((sum, b) => sum + (b.numberOfNights || 0), 0)
                });
            }
        }

        res.json({
            success: true,
            data: {
                property: {
                    id: property.id,
                    name: property.name,
                    address: property.address,
                    propertyType: property.propertyType,
                    owner: property.owner
                },
                reportPeriod: {
                    startDate: startDate || 'התחלת הזמנים',
                    endDate: endDate || 'עד היום'
                },
                performance,
                monthlyBreakdown,
                recentPayments: payments.slice(0, 20),
                recentBookings: bookings.slice(0, 10)
            }
        });

    } catch (error) {
        console.error('שגיאה בדוח ביצועי נכס:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// דו"ח סיכום כלל המערכת (מנהלים בלבד)
const getSystemSummaryReport = async (req, res) => {
    try {
        // רק מנהלים יכולים לראות דוח כלל המערכת
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'רק מנהלי מערכת יכולים לצפות בדוח זה'
            });
        }

        const { startDate, endDate } = req.query;

        // בניית תנאי זמן
        let dateWhere = {};
        if (startDate || endDate) {
            dateWhere.paymentDate = {};
            if (startDate) dateWhere.paymentDate[Op.gte] = startDate;
            if (endDate) dateWhere.paymentDate[Op.lte] = endDate;
        }

        // סטטיסטיקות כלליות
        const [
            totalUsers,
            totalProperties,
            totalBookings,
            totalPayments,
            totalRevenue,
            totalCommissions
        ] = await Promise.all([
            User.count(),
            Property.count(),
            Booking.count(),
            Payment.count({ where: { status: 'completed', ...dateWhere } }),
            Payment.sum('amount', { 
                where: { 
                    paymentType: 'booking_payment', 
                    status: 'completed',
                    ...dateWhere 
                } 
            }) || 0,
            Payment.sum('amount', { 
                where: { 
                    paymentType: 'commission', 
                    status: 'completed',
                    ...dateWhere 
                } 
            }) || 0
        ]);

        // פירוט לפי סוגי משתמשים
        const usersByRole = await User.findAll({
            attributes: [
                'role',
                [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
            ],
            group: ['role']
        });

        // פירוט לפי סוגי נכסים
        const propertiesByType = await Property.findAll({
            attributes: [
                'propertyType',
                [Property.sequelize.fn('COUNT', Property.sequelize.col('id')), 'count']
            ],
            group: ['propertyType']
        });

        // פירוט תשלומים לפי סוג
        const paymentsByType = await Payment.findAll({
            where: { status: 'completed', ...dateWhere },
            attributes: [
                'paymentType',
                [Payment.sequelize.fn('COUNT', Payment.sequelize.col('id')), 'count'],
                [Payment.sequelize.fn('SUM', Payment.sequelize.col('amount')), 'total']
            ],
            group: ['paymentType']
        });

        // בעלי נכסים הכי רווחיים
        const topOwners = await Payment.findAll({
            where: { 
                paymentType: 'booking_payment',
                status: 'completed',
                ...dateWhere 
            },
            include: [{
                model: Property,
                as: 'property',
                include: [{
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'fullName', 'email']
                }]
            }],
            attributes: [
                [Payment.sequelize.fn('SUM', Payment.sequelize.col('amount')), 'totalRevenue']
            ],
            group: ['property.owner.id', 'property.owner.fullName', 'property.owner.email'],
            order: [[Payment.sequelize.fn('SUM', Payment.sequelize.col('amount')), 'DESC']],
            limit: 10
        });

        res.json({
            success: true,
            data: {
                reportPeriod: {
                    startDate: startDate || 'התחלת הזמנים',
                    endDate: endDate || 'עד היום'
                },
                summary: {
                    totalUsers,
                    totalProperties,
                    totalBookings,
                    totalPayments,
                    totalRevenue: parseFloat(totalRevenue),
                    totalCommissions: parseFloat(totalCommissions),
                    netRevenue: parseFloat(totalRevenue) - parseFloat(totalCommissions)
                },
                breakdown: {
                    usersByRole: usersByRole.map(u => ({
                        role: u.role,
                        count: parseInt(u.dataValues.count)
                    })),
                    propertiesByType: propertiesByType.map(p => ({
                        type: p.propertyType,
                        count: parseInt(p.dataValues.count)
                    })),
                    paymentsByType: paymentsByType.map(p => ({
                        type: p.paymentType,
                        count: parseInt(p.dataValues.count),
                        total: parseFloat(p.dataValues.total)
                    }))
                },
                topOwners: topOwners.map(payment => ({
                    owner: payment.property?.owner,
                    totalRevenue: parseFloat(payment.dataValues.totalRevenue)
                }))
            }
        });

    } catch (error) {
        console.error('שגיאה בדוח סיכום המערכת:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה פנימית בשרת',
            error: process.env.NODE_ENV === 'development' ? error.message : 'שגיאה פנימית'
        });
    }
};

// פונקציה עזר לחישוב חודשים בין תאריכים
function getMonthsBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = [];
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (current <= end) {
        months.push({
            year: current.getFullYear(),
            month: current.getMonth() + 1
        });
        current.setMonth(current.getMonth() + 1);
    }
    
    return months;
}

module.exports = {
    getOwnerFinancialReport,
    getPropertyPerformanceReport,
    getSystemSummaryReport
};