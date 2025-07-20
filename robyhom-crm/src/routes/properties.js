const express = require('express');
const router = express.Router();

// Import controllers and middleware
const {
    getAllProperties,
    getPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,
    getPropertyStats
} = require('../controllers/propertyController');

const {
    authenticate,
    authorize,
    authorizeOwnerAccess
} = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/properties/test
 * @desc    Test properties routes
 * @access  Private
 */
router.get('/test', (req, res) => {
    res.json({
        message: 'נתיבי הנכסים פועלים כראוי',
        userRole: req.user.role,
        timestamp: new Date().toISOString(),
        availableEndpoints: {
            general: [
                'GET /api/properties - רשימת נכסים',
                'GET /api/properties/stats - סטטיסטיקות נכסים',
                'GET /api/properties/:id - פרטי נכס ספציפי'
            ],
            create: [
                'POST /api/properties - יצירת נכס חדש (מנהל/בעל נכס)'
            ],
            manage: [
                'PUT /api/properties/:id - עדכון נכס',
                'DELETE /api/properties/:id - מחיקת נכס'
            ]
        },
        permissions: {
            admin: 'גישה מלאה לכל הנכסים',
            owner: 'גישה רק לנכסים של המשתמש',
            tenant: 'צפייה בנכסים בלבד'
        }
    });
});

/**
 * @route   GET /api/properties/stats
 * @desc    Get properties statistics
 * @access  Private (Admin, Owner)
 */
router.get('/stats', authorize('admin', 'owner'), getPropertyStats);

/**
 * @route   GET /api/properties
 * @desc    Get all properties with filters
 * @access  Private
 * @query   { page?, limit?, propertyType?, search?, minPrice?, maxPrice?, rooms?, city?, isActive? }
 */
router.get('/', getAllProperties);

/**
 * @route   POST /api/properties
 * @desc    Create new property
 * @access  Private (Admin, Owner)
 */
router.post('/', authorize('admin', 'owner'), createProperty);

/**
 * @route   GET /api/properties/:propertyId
 * @desc    Get single property by ID
 * @access  Private
 */
router.get('/:propertyId', authorizeOwnerAccess, getPropertyById);

/**
 * @route   PUT /api/properties/:propertyId
 * @desc    Update property
 * @access  Private (Admin, Owner of property)
 */
router.put('/:propertyId', authorize('admin', 'owner'), authorizeOwnerAccess, updateProperty);

/**
 * @route   DELETE /api/properties/:propertyId
 * @desc    Delete property
 * @access  Private (Admin, Owner of property)
 */
router.delete('/:propertyId', authorize('admin', 'owner'), authorizeOwnerAccess, deleteProperty);

// Property type specific endpoints

/**
 * @route   GET /api/properties/type/:propertyType
 * @desc    Get properties by type
 * @access  Private
 */
router.get('/type/:propertyType', async (req, res) => {
    try {
        const { propertyType } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        // Validate property type
        if (!['maintenance', 'short_term', 'long_term'].includes(propertyType)) {
            return res.status(400).json({
                error: 'סוג נכס לא תקין',
                validTypes: ['maintenance', 'short_term', 'long_term'],
                code: 'INVALID_PROPERTY_TYPE'
            });
        }
        
        // Add property type to query and call main controller
        req.query.propertyType = propertyType;
        req.query.page = page;
        req.query.limit = limit;
        
        getAllProperties(req, res);
        
    } catch (error) {
        console.error('שגיאה בקבלת נכסים לפי סוג:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_PROPERTIES_BY_TYPE_ERROR'
        });
    }
});

/**
 * @route   GET /api/properties/owner/:ownerId
 * @desc    Get properties by owner (admin only)
 * @access  Private (Admin only)
 */
router.get('/owner/:ownerId', authorize('admin'), async (req, res) => {
    try {
        const { ownerId } = req.params;
        
        // Verify owner exists
        const { User } = require('../models');
        const owner = await User.findOne({
            where: { id: ownerId, role: ['admin', 'owner'] }
        });
        
        if (!owner) {
            return res.status(404).json({
                error: 'בעל נכס לא נמצא',
                code: 'OWNER_NOT_FOUND'
            });
        }
        
        // Add owner ID to query and call main controller
        req.query.ownerId = ownerId;
        
        getAllProperties(req, res);
        
    } catch (error) {
        console.error('שגיאה בקבלת נכסים לפי בעלים:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_PROPERTIES_BY_OWNER_ERROR'
        });
    }
});

// Property availability endpoints (for short-term properties)

/**
 * @route   GET /api/properties/:propertyId/availability
 * @desc    Check property availability for dates
 * @access  Private
 * @query   { checkIn: date, checkOut: date }
 */
router.get('/:propertyId/availability', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { checkIn, checkOut } = req.query;
        
        if (!checkIn || !checkOut) {
            return res.status(400).json({
                error: 'נתונים חסרים',
                message: 'נדרש תאריך כניסה ויציאה',
                code: 'MISSING_DATES'
            });
        }
        
        const { Property, Booking } = require('../models');
        
        const where = { id: propertyId };
        
        // Role-based access control
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        const property = await Property.findOne({ where });
        
        if (!property) {
            return res.status(404).json({
                error: 'נכס לא נמצא',
                code: 'PROPERTY_NOT_FOUND'
            });
        }
        
        if (property.propertyType !== 'short_term') {
            return res.status(400).json({
                error: 'בדיקת זמינות רלוונטית רק לנכסים לטווח קצר',
                code: 'NOT_SHORT_TERM_PROPERTY'
            });
        }
        
        // Check for overlapping bookings
        const overlappingBookings = await Booking.findOverlapping(
            propertyId,
            checkIn,
            checkOut
        );
        
        const isAvailable = overlappingBookings.length === 0;
        
        // Calculate price if available
        let pricing = null;
        if (isAvailable) {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
            
            pricing = {
                nights,
                basePrice: property.basePrice,
                totalBaseAmount: property.calculateTotalPrice(nights),
                cleaningFee: property.cleaningFee || 0,
                totalAmount: property.calculateTotalPrice(nights)
            };
        }
        
        res.json({
            success: true,
            available: isAvailable,
            propertyId,
            dates: { checkIn, checkOut },
            conflictingBookings: overlappingBookings.length,
            pricing
        });
        
    } catch (error) {
        console.error('שגיאה בבדיקת זמינות:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'AVAILABILITY_CHECK_ERROR'
        });
    }
});

/**
 * @route   POST /api/properties/:propertyId/toggle-status
 * @desc    Toggle property active status
 * @access  Private (Admin, Owner of property)
 */
router.post('/:propertyId/toggle-status', authorize('admin', 'owner'), authorizeOwnerAccess, async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        const { Property } = require('../models');
        
        const where = { id: propertyId };
        
        // Role-based access control
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        const property = await Property.findOne({ where });
        
        if (!property) {
            return res.status(404).json({
                error: 'נכס לא נמצא',
                code: 'PROPERTY_NOT_FOUND'
            });
        }
        
        // Toggle status
        property.isActive = !property.isActive;
        await property.save();
        
        res.json({
            success: true,
            message: `הנכס ${property.isActive ? 'הופעל' : 'בוטל'} בהצלחה`,
            property: {
                id: property.id,
                name: property.name,
                isActive: property.isActive
            }
        });
        
    } catch (error) {
        console.error('שגיאה בשינוי סטטוס נכס:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'TOGGLE_STATUS_ERROR'
        });
    }
});

// Bulk operations (admin only)

/**
 * @route   POST /api/properties/bulk/delete
 * @desc    Delete multiple properties
 * @access  Private (Admin only)
 */
router.post('/bulk/delete', authorize('admin'), async (req, res) => {
    try {
        const { propertyIds } = req.body;
        
        if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
            return res.status(400).json({
                error: 'רשימת נכסים לא תקינה',
                code: 'INVALID_PROPERTY_LIST'
            });
        }
        
        const { Property, Booking } = require('../models');
        
        // Check for active bookings
        const activeBookings = await Booking.count({
            where: {
                propertyId: propertyIds,
                status: ['confirmed', 'checked_in']
            }
        });
        
        if (activeBookings > 0) {
            return res.status(400).json({
                error: 'לא ניתן למחוק נכסים',
                message: 'קיימות הזמנות פעילות לחלק מהנכסים',
                code: 'ACTIVE_BOOKINGS_EXIST'
            });
        }
        
        const deletedCount = await Property.destroy({
            where: { id: propertyIds }
        });
        
        res.json({
            success: true,
            message: `${deletedCount} נכסים נמחקו בהצלחה`,
            deletedCount
        });
        
    } catch (error) {
        console.error('שגיאה במחיקה מרובה:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'BULK_DELETE_ERROR'
        });
    }
});

// Error handling for this router
router.use((err, req, res, next) => {
    console.error('שגיאה בנתיבי הנכסים:', err);
    res.status(500).json({
        error: 'שגיאה פנימית',
        message: 'אירעה שגיאה בתהליך ניהול הנכסים',
        code: 'PROPERTIES_ROUTER_ERROR'
    });
});

module.exports = router;