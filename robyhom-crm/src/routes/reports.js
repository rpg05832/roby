const express = require('express');
const router = express.Router();

// ייבוא המידלוואר עם השמות הנכונים
const { authenticate, authorize } = require('../middleware/auth');

// נתיב בדיקה
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'נתיבי דוחות פעילים עם אימות מתוקן!',
        timestamp: new Date().toISOString(),
        middleware: 'authenticate ו-authorize פעילים'
    });
});

// דוח כספי - עם אימות נכון
router.get('/owner/:ownerId/financial', authenticate, async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { startDate, endDate, propertyId } = req.query;
        
        // בדיקת הרשאות - רק מנהל או בעל הנכס עצמו
        if (req.user.role !== 'admin' && req.user.id !== ownerId) {
            return res.status(403).json({
                success: false,
                message: 'אין לך הרשאה לצפות בדוח של בעל נכס אחר'
            });
        }
        
        // נחזיר דוח בסיסי עם מבנה נכון
        res.json({
            success: true,
            data: {
                owner: {
                    id: ownerId,
                    fullName: `בעל נכס ${ownerId}`,
                    email: `owner${ownerId}@example.com`
                },
                reportPeriod: {
                    startDate: startDate || 'התחלת הזמנים',
                    endDate: endDate || 'עד היום',
                    propertyFilter: propertyId ? `נכס ${propertyId}` : 'כל הנכסים'
                },
                summary: {
                    totalIncome: 15000,
                    totalDeposits: 5000,
                    totalExpenses: 3000,
                    totalCommissions: 1500,
                    netIncome: 15500
                },
                currentBalance: 15500,
                paymentsByType: {
                    booking_payment: [],
                    owner_deposit: [],
                    expense_payment: [],
                    commission: [],
                    refund: []
                },
                payments: [],
                totalPayments: 0,
                note: 'זהו דוח לדוגמה - יחובר למסד הנתונים בהמשך',
                requestedBy: req.user.fullName,
                userRole: req.user.role
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'שגיאה בייצור דוח כספי',
            error: error.message
        });
    }
});

// דוח ביצועי נכס
router.get('/property/:propertyId/performance', authenticate, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { startDate, endDate } = req.query;
        
        res.json({
            success: true,
            data: {
                property: {
                    id: propertyId,
                    name: `נכס ${propertyId}`,
                    address: 'כתובת לדוגמה 123',
                    propertyType: 'short_term'
                },
                reportPeriod: {
                    startDate: startDate || 'התחלת הזמנים',
                    endDate: endDate || 'עד היום'
                },
                performance: {
                    totalRevenue: 12000,
                    totalExpenses: 2000,
                    netProfit: 10000,
                    totalBookings: 8,
                    totalNights: 40,
                    averageNightlyRate: 300,
                    occupancyRate: 75,
                    averageBookingValue: 1500
                },
                monthlyBreakdown: [
                    {
                        month: '6/2025',
                        revenue: 4500,
                        expenses: 800,
                        profit: 3700,
                        bookings: 3,
                        nights: 15
                    },
                    {
                        month: '5/2025',
                        revenue: 3600,
                        expenses: 600,
                        profit: 3000,
                        bookings: 2,
                        nights: 12
                    }
                ],
                recentPayments: [],
                recentBookings: [],
                note: 'זהו דוח לדוגמה - יחובר למסד הנתונים בהמשך',
                requestedBy: req.user.fullName,
                userRole: req.user.role
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'שגיאה בדוח ביצועי נכס',
            error: error.message
        });
    }
});

// דוח סיכום מערכת - רק למנהלים
router.get('/system/summary', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        res.json({
            success: true,
            data: {
                reportPeriod: {
                    startDate: startDate || 'התחלת הזמנים',
                    endDate: endDate || 'עד היום'
                },
                summary: {
                    totalUsers: 25,
                    totalProperties: 12,
                    totalBookings: 150,
                    totalPayments: 200,
                    totalRevenue: 450000,
                    totalCommissions: 45000,
                    netRevenue: 405000
                },
                breakdown: {
                    usersByRole: [
                        { role: 'admin', count: 2 },
                        { role: 'owner', count: 8 },
                        { role: 'tenant', count: 15 }
                    ],
                    propertiesByType: [
                        { type: 'short_term', count: 8 },
                        { type: 'long_term', count: 3 },
                        { type: 'maintenance', count: 1 }
                    ],
                    paymentsByType: [
                        { type: 'booking_payment', count: 120, total: 360000 },
                        { type: 'commission', count: 50, total: 45000 },
                        { type: 'expense_payment', count: 30, total: 45000 }
                    ]
                },
                topOwners: [
                    {
                        owner: { fullName: 'יוסי כהן', email: 'yossi@example.com' },
                        totalRevenue: 85000
                    },
                    {
                        owner: { fullName: 'שרה לוי', email: 'sara@example.com' },
                        totalRevenue: 72000
                    }
                ],
                note: 'זהו דוח לדוגמה - יחובר למסד הנתונים בהמשך',
                requestedBy: req.user.fullName,
                userRole: req.user.role,
                systemStatus: 'פעיל',
                lastUpdated: new Date().toISOString()
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'שגיאה בדוח סיכום המערכת',
            error: error.message
        });
    }
});

// נתיב דוח חודשי מהיר
router.get('/monthly/:year/:month', authenticate, async (req, res) => {
    try {
        const { year, month } = req.params;
        
        res.json({
            success: true,
            data: {
                period: `${month}/${year}`,
                summary: {
                    revenue: 45000,
                    expenses: 8000,
                    profit: 37000,
                    bookings: 25,
                    occupancyRate: 78
                },
                requestedBy: req.user.fullName,
                note: 'דוח חודשי לדוגמה'
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'שגיאה בדוח חודשי',
            error: error.message
        });
    }
});

module.exports = router;