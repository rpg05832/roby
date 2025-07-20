const { Booking, Property, User } = require('../models');
const { Op } = require('sequelize');

// Get all bookings (with filters)
const getAllBookings = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            propertyId,
            status,
            paymentStatus,
            checkInDate,
            checkOutDate,
            search,
            tenantId
        } = req.query;
        
        const offset = (page - 1) * limit;
        const where = {};
        
        // Role-based filtering
        if (req.user.role === 'owner') {
            // Owners can only see bookings for their properties
            const { Property } = require('../models');
            const userProperties = await Property.findAll({
                where: { ownerId: req.user.id },
                attributes: ['id']
            });
            const propertyIds = userProperties.map(p => p.id);
            where.propertyId = { [Op.in]: propertyIds };
        } else if (req.user.role === 'tenant') {
            // Tenants can only see their own bookings
            where.tenantId = req.user.id;
        }
        
        // Property filter
        if (propertyId) {
            // Additional check for owners
            if (req.user.role === 'owner') {
                const property = await Property.findOne({
                    where: { id: propertyId, ownerId: req.user.id }
                });
                if (!property) {
                    return res.status(403).json({
                        error: 'אין הרשאה',
                        message: 'אין לך הרשאה לצפות בהזמנות לנכס זה',
                        code: 'PROPERTY_ACCESS_DENIED'
                    });
                }
            }
            where.propertyId = propertyId;
        }
        
        // Status filter
        if (status && ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'].includes(status)) {
            where.status = status;
        }
        
        // Payment status filter
        if (paymentStatus && ['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) {
            where.paymentStatus = paymentStatus;
        }
        
        // Date range filters
        if (checkInDate || checkOutDate) {
            if (checkInDate && checkOutDate) {
                where[Op.or] = [
                    {
                        checkInDate: {
                            [Op.between]: [checkInDate, checkOutDate]
                        }
                    },
                    {
                        checkOutDate: {
                            [Op.between]: [checkInDate, checkOutDate]
                        }
                    },
                    {
                        [Op.and]: [
                            { checkInDate: { [Op.lte]: checkInDate } },
                            { checkOutDate: { [Op.gte]: checkOutDate } }
                        ]
                    }
                ];
            } else if (checkInDate) {
                where.checkInDate = { [Op.gte]: checkInDate };
            } else if (checkOutDate) {
                where.checkOutDate = { [Op.lte]: checkOutDate };
            }
        }
        
        // Search in guest name, email or phone
        if (search) {
            where[Op.or] = [
                { guestName: { [Op.iLike]: `%${search}%` } },
                { guestEmail: { [Op.iLike]: `%${search}%` } },
                { guestPhone: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        // Tenant filter (admin only)
        if (tenantId && req.user.role === 'admin') {
            where.tenantId = tenantId;
        }
        
        const { count, rows: bookings } = await Booking.findAndCountAll({
            where,
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address', 'propertyType'],
                    include: [
                        {
                            model: User,
                            as: 'owner',
                            attributes: ['id', 'fullName', 'email', 'phone']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'tenant',
                    attributes: ['id', 'fullName', 'email', 'phone'],
                    required: false
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });
        
        // Add calculated fields to each booking
        const bookingsWithDetails = bookings.map(booking => {
            const bookingData = booking.toJSON();
            bookingData.statusDisplay = booking.getStatusDisplay();
            bookingData.paymentStatusDisplay = booking.getPaymentStatusDisplay();
            
            // Calculate days until check-in
            const today = new Date();
            const checkIn = new Date(booking.checkInDate);
            const daysUntilCheckIn = Math.ceil((checkIn - today) / (1000 * 60 * 60 * 24));
            bookingData.daysUntilCheckIn = daysUntilCheckIn;
            
            return bookingData;
        });
        
        res.json({
            success: true,
            bookings: bookingsWithDetails,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalBookings: count,
                bookingsPerPage: parseInt(limit)
            },
            filters: {
                propertyId,
                status,
                paymentStatus,
                checkInDate,
                checkOutDate,
                search
            }
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת רשימת הזמנות:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'אירעה שגיאה בקבלת רשימת ההזמנות',
            code: 'GET_BOOKINGS_ERROR'
        });
    }
};

// Get single booking by ID
const getBookingById = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        let where = { id: bookingId };
        let include = [
            {
                model: Property,
                as: 'property',
                include: [
                    {
                        model: User,
                        as: 'owner',
                        attributes: ['id', 'fullName', 'email', 'phone']
                    }
                ]
            },
            {
                model: User,
                as: 'tenant',
                attributes: ['id', 'fullName', 'email', 'phone'],
                required: false
            }
        ];
        
        // Role-based access control
        if (req.user.role === 'owner') {
            include[0].where = { ownerId: req.user.id };
        } else if (req.user.role === 'tenant') {
            where.tenantId = req.user.id;
        }
        
        const booking = await Booking.findOne({
            where,
            include
        });
        
        if (!booking) {
            return res.status(404).json({
                error: 'הזמנה לא נמצאה',
                message: 'ההזמנה המבוקשת לא קיימת או שאין לך הרשאה לצפות בה',
                code: 'BOOKING_NOT_FOUND'
            });
        }
        
        const bookingData = booking.toJSON();
        bookingData.statusDisplay = booking.getStatusDisplay();
        bookingData.paymentStatusDisplay = booking.getPaymentStatusDisplay();
        
        // Add payment calculations
        bookingData.paymentSummary = {
            totalAmount: booking.totalAmount,
            paidAmount: booking.paidAmount,
            remainingAmount: booking.remainingAmount,
            paymentPercentage: Math.round((booking.paidAmount / booking.totalAmount) * 100)
        };
        
        res.json({
            success: true,
            booking: bookingData
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת פרטי הזמנה:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_BOOKING_ERROR'
        });
    }
};

// Create new booking
const createBooking = async (req, res) => {
    try {
        const {
            propertyId,
            guestName,
            guestEmail,
            guestPhone,
            numberOfGuests,
            checkInDate,
            checkOutDate,
            specialRequests,
            guestNotes,
            bookingSource,
            externalBookingId
        } = req.body;
        
        // Validate required fields
        if (!propertyId || !guestName || !guestPhone || !checkInDate || !checkOutDate || !numberOfGuests) {
            return res.status(400).json({
                error: 'נתונים חסרים',
                message: 'נדרש מזהה נכס, שם אורח, טלפון, תאריכי כניסה ויציאה ומספר אורחים',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        // Validate dates
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (checkIn >= checkOut) {
            return res.status(400).json({
                error: 'תאריכים לא תקינים',
                message: 'תאריך יציאה חייב להיות אחרי תאריך כניסה',
                code: 'INVALID_DATES'
            });
        }
        
        if (checkIn < today) {
            return res.status(400).json({
                error: 'תאריך כניסה בעבר',
                message: 'לא ניתן ליצור הזמנה לתאריך בעבר',
                code: 'PAST_DATE'
            });
        }
        
        // Get and validate property
        const where = { id: propertyId, isActive: true };
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        const property = await Property.findOne({ where });
        
        if (!property) {
            return res.status(404).json({
                error: 'נכס לא נמצא',
                message: 'הנכס לא קיים, לא פעיל או שאין לך הרשאה ליצור הזמנות עבורו',
                code: 'PROPERTY_NOT_FOUND'
            });
        }
        
        if (property.propertyType !== 'short_term') {
            return res.status(400).json({
                error: 'סוג נכס לא מתאים',
                message: 'ניתן ליצור הזמנות רק לנכסים לטווח קצר',
                code: 'INVALID_PROPERTY_TYPE'
            });
        }
        
        // Validate guest count
        if (property.maxGuests && numberOfGuests > property.maxGuests) {
            return res.status(400).json({
                error: 'מספר אורחים עולה על המותר',
                message: `מספר האורחים המקסימלי לנכס זה הוא ${property.maxGuests}`,
                code: 'GUESTS_LIMIT_EXCEEDED'
            });
        }
        
        // Calculate nights and validate minimum/maximum stay
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        
        if (property.minStayDays && nights < property.minStayDays) {
            return res.status(400).json({
                error: 'תקופת שהייה קצרה מדי',
                message: `מינימום לילות לנכס זה הוא ${property.minStayDays}`,
                code: 'MIN_STAY_VIOLATION'
            });
        }
        
        if (property.maxStayDays && nights > property.maxStayDays) {
            return res.status(400).json({
                error: 'תקופת שהייה ארוכה מדי',
                message: `מקסימום לילות לנכס זה הוא ${property.maxStayDays}`,
                code: 'MAX_STAY_VIOLATION'
            });
        }
        
        // Check for overlapping bookings
        const overlapping = await Booking.findOverlapping(
            propertyId,
            checkInDate,
            checkOutDate
        );
        
        if (overlapping.length > 0) {
            return res.status(409).json({
                error: 'תאריכים תפוסים',
                message: 'קיימת הזמנה חופפת לתאריכים אלו',
                code: 'DATES_UNAVAILABLE',
                conflictingBookings: overlapping.length
            });
        }
        
        // Calculate pricing
        const basePrice = property.basePrice;
        const totalBaseAmount = basePrice * nights;
        const cleaningFee = property.cleaningFee || 0;
        const totalAmount = totalBaseAmount + cleaningFee;
        
        // Create booking
        const bookingData = {
            propertyId,
            tenantId: req.user.role === 'tenant' ? req.user.id : null,
            guestName,
            guestEmail: guestEmail || null,
            guestPhone,
            numberOfGuests: parseInt(numberOfGuests),
            checkInDate,
            checkOutDate,
            numberOfNights: nights,
            basePrice,
            totalBaseAmount,
            cleaningFee,
            totalAmount,
            remainingAmount: totalAmount,
            specialRequests: specialRequests || null,
            guestNotes: guestNotes || null,
            bookingSource: bookingSource || 'direct',
            externalBookingId: externalBookingId || null,
            status: 'pending'
        };
        
        const booking = await Booking.create(bookingData);
        
        // Get booking with related data
        const bookingWithDetails = await Booking.findByPk(booking.id, {
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address'],
                    include: [
                        {
                            model: User,
                            as: 'owner',
                            attributes: ['id', 'fullName', 'email']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'tenant',
                    attributes: ['id', 'fullName', 'email'],
                    required: false
                }
            ]
        });
        
        const bookingResponse = bookingWithDetails.toJSON();
        bookingResponse.statusDisplay = bookingWithDetails.getStatusDisplay();
        bookingResponse.paymentStatusDisplay = bookingWithDetails.getPaymentStatusDisplay();
        
        res.status(201).json({
            success: true,
            message: 'ההזמנה נוצרה בהצלחה',
            booking: bookingResponse
        });
        
    } catch (error) {
        console.error('שגיאה ביצירת הזמנה:', error);
        
        if (error.message.includes('קיימת הזמנה חופפת')) {
            return res.status(409).json({
                error: 'תאריכים תפוסים',
                message: error.message,
                code: 'OVERLAPPING_BOOKING'
            });
        }
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'שגיאת ולידציה',
                details: error.errors.map(e => e.message),
                code: 'VALIDATION_ERROR'
            });
        }
        
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'אירעה שגיאה ביצירת ההזמנה',
            code: 'CREATE_BOOKING_ERROR'
        });
    }
};

// Update booking
const updateBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
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
        } else if (req.user.role === 'tenant') {
            where.tenantId = req.user.id;
        }
        
        const booking = await Booking.findOne({
            where,
            include
        });
        
        if (!booking) {
            return res.status(404).json({
                error: 'הזמנה לא נמצאה',
                message: 'ההזמנה לא קיימת או שאין לך הרשאה לערוך אותה',
                code: 'BOOKING_NOT_FOUND'
            });
        }
        
        // Check if booking can be modified
        if (booking.status === 'checked_out' || booking.status === 'cancelled') {
            return res.status(400).json({
                error: 'לא ניתן לערוך הזמנה',
                message: 'לא ניתן לערוך הזמנה שכבר הסתיימה או בוטלה',
                code: 'BOOKING_NOT_EDITABLE'
            });
        }
        
        const updateData = {};
        const allowedFields = [
            'guestName', 'guestEmail', 'guestPhone', 'numberOfGuests',
            'checkInDate', 'checkOutDate', 'specialRequests', 'guestNotes',
            'internalNotes', 'status', 'bookingSource', 'externalBookingId'
        ];
        
        // Only admin and owners can change certain fields
        const restrictedFields = ['status'];
        if (req.user.role === 'tenant') {
            restrictedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    delete req.body[field];
                }
            });
        }
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        
        // Handle date changes
        if (updateData.checkInDate || updateData.checkOutDate) {
            const newCheckIn = new Date(updateData.checkInDate || booking.checkInDate);
            const newCheckOut = new Date(updateData.checkOutDate || booking.checkOutDate);
            
            if (newCheckIn >= newCheckOut) {
                return res.status(400).json({
                    error: 'תאריכים לא תקינים',
                    message: 'תאריך יציאה חייב להיות אחרי תאריך כניסה',
                    code: 'INVALID_DATES'
                });
            }
            
            // Check for overlapping bookings (excluding current booking)
            const overlapping = await Booking.findOverlapping(
                booking.propertyId,
                newCheckIn.toISOString().split('T')[0],
                newCheckOut.toISOString().split('T')[0],
                booking.id
            );
            
            if (overlapping.length > 0) {
                return res.status(409).json({
                    error: 'תאריכים תפוסים',
                    message: 'קיימת הזמנה חופפת לתאריכים החדשים',
                    code: 'DATES_UNAVAILABLE'
                });
            }
            
            // Recalculate pricing if dates changed
            const nights = Math.ceil((newCheckOut - newCheckIn) / (1000 * 60 * 60 * 24));
            updateData.numberOfNights = nights;
            updateData.totalBaseAmount = booking.basePrice * nights;
            updateData.totalAmount = updateData.totalBaseAmount + (booking.cleaningFee || 0);
            updateData.remainingAmount = updateData.totalAmount - booking.paidAmount;
        }
        
        // Validate guest count if changed
        if (updateData.numberOfGuests) {
            const maxGuests = booking.property.maxGuests;
            if (maxGuests && updateData.numberOfGuests > maxGuests) {
                return res.status(400).json({
                    error: 'מספר אורחים עולה על המותר',
                    message: `מספר האורחים המקסימלי לנכס זה הוא ${maxGuests}`,
                    code: 'GUESTS_LIMIT_EXCEEDED'
                });
            }
        }
        
        await booking.update(updateData);
        
        // Get updated booking with related data
        const updatedBooking = await Booking.findByPk(booking.id, {
            include: [
                {
                    model: Property,
                    as: 'property',
                    attributes: ['id', 'name', 'address'],
                    include: [
                        {
                            model: User,
                            as: 'owner',
                            attributes: ['id', 'fullName', 'email']
                        }
                    ]
                },
                {
                    model: User,
                    as: 'tenant',
                    attributes: ['id', 'fullName', 'email'],
                    required: false
                }
            ]
        });
        
        const bookingResponse = updatedBooking.toJSON();
        bookingResponse.statusDisplay = updatedBooking.getStatusDisplay();
        bookingResponse.paymentStatusDisplay = updatedBooking.getPaymentStatusDisplay();
        
        res.json({
            success: true,
            message: 'ההזמנה עודכנה בהצלחה',
            booking: bookingResponse
        });
        
    } catch (error) {
        console.error('שגיאה בעדכון הזמנה:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'שגיאת ולידציה',
                details: error.errors.map(e => e.message),
                code: 'VALIDATION_ERROR'
            });
        }
        
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'UPDATE_BOOKING_ERROR'
        });
    }
};

// Cancel booking
const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;
        
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
        } else if (req.user.role === 'tenant') {
            where.tenantId = req.user.id;
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
                error: 'ההזמנה כבר בוטלה',
                code: 'ALREADY_CANCELLED'
            });
        }
        
        if (booking.status === 'checked_out') {
            return res.status(400).json({
                error: 'לא ניתן לבטל הזמנה שהסתיימה',
                code: 'CANNOT_CANCEL_COMPLETED'
            });
        }
        
        await booking.cancel(reason);
        
        res.json({
            success: true,
            message: 'ההזמנה בוטלה בהצלחה',
            booking: {
                id: booking.id,
                status: 'cancelled',
                cancelReason: reason
            }
        });
        
    } catch (error) {
        console.error('שגיאה בביטול הזמנה:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'CANCEL_BOOKING_ERROR'
        });
    }
};

// Check-in booking
const checkInBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        // Find booking with access control (only admin and owners can check-in)
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
        
        if (booking.status !== 'confirmed') {
            return res.status(400).json({
                error: 'לא ניתן לבצע צ\'ק-אין',
                message: 'ההזמנה חייבת להיות במצב מאושר',
                code: 'INVALID_STATUS_FOR_CHECKIN'
            });
        }
        
        await booking.checkIn();
        
        res.json({
            success: true,
            message: 'צ\'ק-אין בוצע בהצלחה',
            booking: {
                id: booking.id,
                status: 'checked_in',
                actualCheckIn: booking.actualCheckIn
            }
        });
        
    } catch (error) {
        console.error('שגיאה בצ\'ק-אין:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'CHECKIN_ERROR'
        });
    }
};

// Check-out booking
const checkOutBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        // Find booking with access control (only admin and owners can check-out)
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
        
        if (booking.status !== 'checked_in') {
            return res.status(400).json({
                error: 'לא ניתן לבצע צ\'ק-אאוט',
                message: 'ההזמנה חייבת להיות במצב צ\'ק-אין',
                code: 'INVALID_STATUS_FOR_CHECKOUT'
            });
        }
        
        await booking.checkOut();
        
        res.json({
            success: true,
            message: 'צ\'ק-אאוט בוצע בהצלחה',
            booking: {
                id: booking.id,
                status: 'checked_out',
                actualCheckOut: booking.actualCheckOut
            }
        });
        
    } catch (error) {
        console.error('שגיאה בצ\'ק-אאוט:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'CHECKOUT_ERROR'
        });
    }
};

// Get booking statistics
const getBookingStats = async (req, res) => {
    try {
        const where = {};
        
        // Role-based filtering
        if (req.user.role === 'owner') {
            const userProperties = await Property.findAll({
                where: { ownerId: req.user.id },
                attributes: ['id']
            });
            const propertyIds = userProperties.map(p => p.id);
            where.propertyId = { [Op.in]: propertyIds };
        } else if (req.user.role === 'tenant') {
            where.tenantId = req.user.id;
        }
        
        // Basic counts
        const totalBookings = await Booking.count({ where });
        const pendingBookings = await Booking.count({ 
            where: { ...where, status: 'pending' } 
        });
        const confirmedBookings = await Booking.count({ 
            where: { ...where, status: 'confirmed' } 
        });
        const activeBookings = await Booking.count({ 
            where: { ...where, status: ['confirmed', 'checked_in'] } 
        });
        const completedBookings = await Booking.count({ 
            where: { ...where, status: 'checked_out' } 
        });
        const cancelledBookings = await Booking.count({ 
            where: { ...where, status: 'cancelled' } 
        });
        
        // Payment status counts
        const unpaidBookings = await Booking.count({ 
            where: { ...where, paymentStatus: 'unpaid' } 
        });
        const partiallyPaidBookings = await Booking.count({ 
            where: { ...where, paymentStatus: 'partial' } 
        });
        const paidBookings = await Booking.count({ 
            where: { ...where, paymentStatus: 'paid' } 
        });
        
        // Revenue calculations
        const { sequelize } = require('../models');
        
        const revenueData = await Booking.findAll({
            where: { 
                ...where, 
                status: { [Op.ne]: 'cancelled' }
            },
            attributes: [
                [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalRevenue'],
                [sequelize.fn('SUM', sequelize.col('paid_amount')), 'collectedRevenue'],
                [sequelize.fn('AVG', sequelize.col('total_amount')), 'avgBookingValue']
            ],
            raw: true
        });
        
        const revenue = revenueData[0] || {};
        
        // Upcoming bookings (next 30 days)
        const today = new Date();
        const nextMonth = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        const upcomingBookings = await Booking.count({
            where: {
                ...where,
                checkInDate: { [Op.between]: [today, nextMonth] },
                status: ['confirmed', 'pending']
            }
        });
        
        // Monthly breakdown (last 6 months)
        const monthlyStats = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
            
            const monthBookings = await Booking.count({
                where: {
                    ...where,
                    checkInDate: { [Op.between]: [monthStart, monthEnd] },
                    status: { [Op.ne]: 'cancelled' }
                }
            });
            
            const monthRevenue = await Booking.findAll({
                where: {
                    ...where,
                    checkInDate: { [Op.between]: [monthStart, monthEnd] },
                    status: { [Op.ne]: 'cancelled' }
                },
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('total_amount')), 'revenue']
                ],
                raw: true
            });
            
            monthlyStats.push({
                month: monthStart.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' }),
                bookings: monthBookings,
                revenue: parseFloat(monthRevenue[0]?.revenue || 0)
            });
        }
        
        res.json({
            success: true,
            stats: {
                bookings: {
                    total: totalBookings,
                    pending: pendingBookings,
                    confirmed: confirmedBookings,
                    active: activeBookings,
                    completed: completedBookings,
                    cancelled: cancelledBookings,
                    upcoming: upcomingBookings
                },
                payments: {
                    unpaid: unpaidBookings,
                    partial: partiallyPaidBookings,
                    paid: paidBookings
                },
                revenue: {
                    total: parseFloat(revenue.totalRevenue || 0),
                    collected: parseFloat(revenue.collectedRevenue || 0),
                    pending: parseFloat(revenue.totalRevenue || 0) - parseFloat(revenue.collectedRevenue || 0),
                    avgBookingValue: Math.round(parseFloat(revenue.avgBookingValue || 0))
                },
                monthlyBreakdown: monthlyStats
            }
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת סטטיסטיקות הזמנות:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: error.message,
            code: 'GET_BOOKING_STATS_ERROR'
        });
    }
};

module.exports = {
    getAllBookings,
    getBookingById,
    createBooking,
    updateBooking,
    cancelBooking,
    checkInBooking,
    checkOutBooking,
    getBookingStats
};