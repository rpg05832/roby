const express = require('express');
const router = express.Router();

// Import controllers and middleware
const {
    getAllBookings,
    getBookingById,
    createBooking,
    updateBooking,
    cancelBooking,
    checkInBooking,
    checkOutBooking,
    getBookingStats
} = require('../controllers/bookingController');

const {
    authenticate,
    authorize,
    authorizeTenantAccess
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/bookings/test
 * @desc    Test bookings routes
 * @access  Private
 */
router.get('/test', (req, res) => {
    res.json({
        message: 'נתיבי ההזמנות פועלים כראוי',
        userRole: req.user.role,
        timestamp: new Date().toISOString(),
        availableEndpoints: {
            general: [
                'GET /api/bookings - רשימת הזמנות',
                'GET /api/bookings/stats - סטטיסטיקות הזמנות',
                'GET /api/bookings/:id - פרטי הזמנה ספציפית'
            ],
            create: [
                'POST /api/bookings - יצירת הזמנה חדשה (מנהל/בעל נכס)'
            ],
            manage: [
                'PUT /api/bookings/:id - עדכון הזמנה',
                'POST /api/bookings/:id/cancel - ביטול הזמנה',
                'POST /api/bookings/:id/check-in - צ\'ק-אין',
                'POST /api/bookings/:id/check-out - צ\'ק-אאוט'
            ]
        },
        permissions: {
            admin: 'גישה מלאה לכל ההזמנות',
            owner: 'גישה להזמנות של הנכסים שלו',
            tenant: 'גישה להזמנות שלו בלבד'
        }
    });
});

/**
 * @route   GET /api/bookings/stats
 * @desc    Get bookings statistics
 * @access  Private
 */
router.get('/stats', getBookingStats);

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings with filters
 * @access  Private
 * @query   { page?, limit?, propertyId?, status?, paymentStatus?, checkInDate?, checkOutDate?, search? }
 */
router.get('/', getAllBookings);

/**
 * @route   POST /api/bookings
 * @desc    Create new booking
 * @access  Private (Admin, Owner)
 */
router.post('/', authorize('admin', 'owner'), createBooking);

/**
 * @route   GET /api/bookings/:bookingId
 * @desc    Get single booking by ID
 * @access  Private (with access control)
 */
router.get('/:bookingId', authorizeTenantAccess, getBookingById);

/**
 * @route   PUT /api/bookings/:bookingId
 * @desc    Update booking
 * @access  Private (with access control)
 */
router.put('/:bookingId', authorizeTenantAccess, updateBooking);

/**
 * @route   POST /api/bookings/:bookingId/cancel
 * @desc    Cancel booking
 * @access  Private (with access control)
 */
router.post('/:bookingId/cancel', authorizeTenantAccess, cancelBooking);

/**
 * @route   POST /api/bookings/:bookingId/check-in
 * @desc    Check-in booking
 * @access  Private (Admin, Owner only)
 */
router.post('/:bookingId/check-in', authorize('admin', 'owner'), checkInBooking);

/**
 * @route   POST /api/bookings/:bookingId/check-out
 * @desc    Check-out booking
 * @access  Private (Admin, Owner only)
 */
router.post('/:bookingId/check-out', authorize('admin', 'owner'), checkOutBooking);

/**
 * @route   POST /api/bookings/:bookingId/confirm
 * @desc    Confirm booking (change status from pending to confirmed)
 * @access  Private (Admin, Owner only)
 */
router.post('/:bookingId/confirm', authorize('admin', 'owner'), async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const { Booking, Property } = require('../models');
        
        // Find booking with access control
        let where = { id: bookingId };
        let include = [
            {
                model: Property,
                as: 'property'
            }
        ];
        
        if (req.user.role === 'owner') {
            include[0].where = { ownerId: req.user.id };
        }
        
        const booking = await Booking.findOne({
            where,
            include
        });
        
        if (!booking) {
            return res.status(404).json({
                error: 'הזמנה לא נמצאה',
                code: 'BOOKING_NOT_FOUND'
            });
        }
        
        if (booking.status !== 'pending') {
            return res.status(400).json({
                error: 'לא ניתן לאשר הזמנה',
                message: 'ההזמנה חייבת להיות במצב ממתין',
                code: 'INVALID_STATUS_FOR_CONFIRM'
            });
        }
        
        await booking.update({ status: 'confirmed' });
        
        res.json({
            success: true,
            message: 'ההזמנה אושרה בהצלחה',
            booking: {
                id: booking.id,
                status: 'confirmed',
                statusDisplay: 'מאושר'
            }
        });
        
    } catch (error) {
        console.error('שגיאה באישור הזמנה:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'CONFIRM_BOOKING_ERROR'
        });
    }
});

/**
 * @route   GET /api/bookings/property/:propertyId
 * @desc    Get bookings by property
 * @access  Private (Admin, Property Owner)
 */
router.get('/property/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        // Verify property access
        const { Property } = require('../models');
        const where = { id: propertyId };
        
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        const property = await Property.findOne({ where });
        
        if (!property) {
            return res.status(404).json({
                error: 'נכס לא נמצא',
                message: 'הנכס לא קיים או שאין לך הרשאה לצפות בו',
                code: 'PROPERTY_NOT_FOUND'
            });
        }
        
        // Add property filter to query and call main controller
        req.query.propertyId = propertyId;
        
        getAllBookings(req, res);
        
    } catch (error) {
        console.error('שגיאה בקבלת הזמנות לפי נכס:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_BOOKINGS_BY_PROPERTY_ERROR'
        });
    }
});

/**
 * @route   GET /api/bookings/status/:status
 * @desc    Get bookings by status
 * @access  Private
 */
router.get('/status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        
        // Validate status
        const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'סטטוס לא תקין',
                validStatuses,
                code: 'INVALID_STATUS'
            });
        }
        
        // Add status filter to query and call main controller
        req.query.status = status;
        
        getAllBookings(req, res);
        
    } catch (error) {
        console.error('שגיאה בקבלת הזמנות לפי סטטוס:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_BOOKINGS_BY_STATUS_ERROR'
        });
    }
});

/**
 * @route   GET /api/bookings/upcoming/:days
 * @desc    Get upcoming bookings within specified days
 * @access  Private
 */
router.get('/upcoming/:days', async (req, res) => {
    try {
        const { days } = req.params;
        const numDays = parseInt(days);
        
        if (isNaN(numDays) || numDays < 1 || numDays > 365) {
            return res.status(400).json({
                error: 'מספר ימים לא תקין',
                message: 'מספר הימים חייב להיות בין 1 ל-365',
                code: 'INVALID_DAYS'
            });
        }
        
        const today = new Date();
        const futureDate = new Date(today.getTime() + (numDays * 24 * 60 * 60 * 1000));
        
        // Add date filters to query and call main controller
        req.query.checkInDate = today.toISOString().split('T')[0];
        req.query.checkOutDate = futureDate.toISOString().split('T')[0];
        req.query.status = 'confirmed'; // Only confirmed bookings
        
        getAllBookings(req, res);
        
    } catch (error) {
        console.error('שגיאה בקבלת הזמנות עתידיות:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_UPCOMING_BOOKINGS_ERROR'
        });
    }
});

/**
 * @route   POST /api/bookings/:bookingId/add-payment
 * @desc    Add payment to booking
 * @access  Private (Admin, Owner)
 */
router.post('/:bookingId/add-payment', authorize('admin', 'owner'), async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { amount, paymentMethod, notes } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'סכום לא תקין',
                message: 'נדרש סכום חיובי',
                code: 'INVALID_AMOUNT'
            });
        }
        
        const { Booking, Property } = require('../models');
        
        // Find booking with access control
        let where = { id: bookingId };
        let include = [
            {
                model: Property,
                as: 'property'
            }
        ];
        
        if (req.user.role === 'owner') {
            include[0].where = { ownerId: req.user.id };
        }
        
        const booking = await Booking.findOne({
            where,
            include
        });
        
        if (!booking) {
            return res.status(404).json({
                error: 'הזמנה לא נמצאה',
                code: 'BOOKING_NOT_FOUND'
            });
        }
        
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                error: 'לא ניתן להוסיף תשלום',
                message: 'לא ניתן להוסיף תשלום להזמנה מבוטלת',
                code: 'BOOKING_CANCELLED'
            });
        }
        
        const newPaidAmount = parseFloat(booking.paidAmount) + parseFloat(amount);
        
        if (newPaidAmount > booking.totalAmount) {
            return res.status(400).json({
                error: 'סכום גבוה מדי',
                message: 'הסכום עולה על המגיע',
                code: 'AMOUNT_EXCEEDS_TOTAL'
            });
        }
        
        await booking.updatePaymentAmount(amount);
        
        res.json({
            success: true,
            message: 'התשלום נוסף בהצלחה',
            payment: {
                bookingId: booking.id,
                amount: parseFloat(amount),
                newPaidAmount: booking.paidAmount,
                remainingAmount: booking.remainingAmount,
                paymentStatus: booking.paymentStatus
            }
        });
        
    } catch (error) {
        console.error('שגיאה בהוספת תשלום:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'ADD_PAYMENT_ERROR'
        });
    }
});

// Bulk operations (admin only)

/**
 * @route   POST /api/bookings/bulk/cancel
 * @desc    Cancel multiple bookings
 * @access  Private (Admin only)
 */
router.post('/bulk/cancel', authorize('admin'), async (req, res) => {
    try {
        const { bookingIds, reason } = req.body;
        
        if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
            return res.status(400).json({
                error: 'רשימת הזמנות לא תקינה',
                code: 'INVALID_BOOKING_LIST'
            });
        }
        
        const { Booking } = require('../models');
        
        const bookings = await Booking.findAll({
            where: { 
                id: bookingIds,
                status: { [require('sequelize').Op.ne]: 'cancelled' }
            }
        });
        
        let cancelledCount = 0;
        
        for (const booking of bookings) {
            await booking.cancel(reason);
            cancelledCount++;
        }
        
        res.json({
            success: true,
            message: `${cancelledCount} הזמנות בוטלו בהצלחה`,
            cancelledCount,
            reason
        });
        
    } catch (error) {
        console.error('שגיאה בביטול מרובה:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'BULK_CANCEL_ERROR'
        });
    }
});

// Error handling for this router
router.use((err, req, res, next) => {
    console.error('שגיאה בנתיבי ההזמנות:', err);
    res.status(500).json({
        error: 'שגיאה פנימית',
        message: 'אירעה שגיאה בתהליך ניהול ההזמנות',
        code: 'BOOKINGS_ROUTER_ERROR'
    });
});

module.exports = router;