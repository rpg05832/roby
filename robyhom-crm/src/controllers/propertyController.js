const { Property, User, Booking } = require('../models');
const { Op } = require('sequelize');

// Get all properties (with filters)
const getAllProperties = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            propertyType, 
            ownerId, 
            search,
            minPrice,
            maxPrice,
            rooms,
            city,
            isActive
        } = req.query;
        
        const offset = (page - 1) * limit;
        const where = {};
        
        // Role-based filtering
        if (req.user.role === 'owner') {
            // Owners can only see their own properties
            where.ownerId = req.user.id;
        }
        
        // Property type filter
        if (propertyType && ['maintenance', 'short_term', 'long_term'].includes(propertyType)) {
            where.propertyType = propertyType;
        }
        
        // Owner filter (admin only)
        if (ownerId && req.user.role === 'admin') {
            where.ownerId = ownerId;
        }
        
        // Search in name or address
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { address: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        // Price range filter
        if (minPrice || maxPrice) {
            where.basePrice = {};
            if (minPrice) where.basePrice[Op.gte] = parseFloat(minPrice);
            if (maxPrice) where.basePrice[Op.lte] = parseFloat(maxPrice);
        }
        
        // Rooms filter
        if (rooms) {
            where.rooms = parseInt(rooms);
        }
        
        // City filter (search in address)
        if (city) {
            where.address = { [Op.iLike]: `%${city}%` };
        }
        
        // Active status filter
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }
        
        const { count, rows: properties } = await Property.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'fullName', 'email', 'phone']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });
        
        // Add calculated fields to each property
        const propertiesWithStats = await Promise.all(
            properties.map(async (property) => {
                const propertyData = property.toJSON();
                
                // Add display names
                propertyData.propertyTypeDisplay = property.getPropertyTypeDisplay();
                
                // Add booking statistics for short-term properties
                if (property.propertyType === 'short_term') {
                    const bookingsCount = await Booking.count({
                        where: { propertyId: property.id }
                    });
                    
                    const activeBookingsCount = await Booking.count({
                        where: { 
                            propertyId: property.id,
                            status: ['confirmed', 'checked_in']
                        }
                    });
                    
                    propertyData.stats = {
                        totalBookings: bookingsCount,
                        activeBookings: activeBookingsCount
                    };
                }
                
                return propertyData;
            })
        );
        
        res.json({
            success: true,
            properties: propertiesWithStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalProperties: count,
                propertiesPerPage: parseInt(limit)
            },
            filters: {
                propertyType,
                search,
                priceRange: { min: minPrice, max: maxPrice },
                rooms,
                city
            }
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת רשימת נכסים:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'אירעה שגיאה בקבלת רשימת הנכסים',
            code: 'GET_PROPERTIES_ERROR'
        });
    }
};

// Get single property by ID
const getPropertyById = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        const where = { id: propertyId };
        
        // Role-based access control
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        const property = await Property.findOne({
            where,
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'fullName', 'email', 'phone']
                },
                {
                    model: Booking,
                    as: 'bookings',
                    limit: 10,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });
        
        if (!property) {
            return res.status(404).json({
                error: 'נכס לא נמצא',
                message: 'הנכס המבוקש לא קיים או שאין לך הרשאה לצפות בו',
                code: 'PROPERTY_NOT_FOUND'
            });
        }
        
        const propertyData = property.toJSON();
        propertyData.propertyTypeDisplay = property.getPropertyTypeDisplay();
        
        // Add availability info for short-term properties
        if (property.propertyType === 'short_term') {
            const today = new Date();
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
            
            const upcomingBookings = await Booking.findAll({
                where: {
                    propertyId: property.id,
                    checkInDate: { [Op.gte]: today },
                    checkOutDate: { [Op.lte]: nextMonth },
                    status: ['confirmed', 'checked_in']
                },
                order: [['checkInDate', 'ASC']]
            });
            
            propertyData.upcomingBookings = upcomingBookings;
        }
        
        res.json({
            success: true,
            property: propertyData
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת פרטי נכס:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_PROPERTY_ERROR'
        });
    }
};

// Create new property
const createProperty = async (req, res) => {
    try {
        const {
            name,
            address,
            propertyType,
            ownerId,
            description,
            rooms,
            bedrooms,
            bathrooms,
            area,
            floor,
            balcony,
            parking,
            elevator,
            airConditioning,
            furnished,
            petsAllowed,
            smokingAllowed,
            basePrice,
            cleaningFee,
            securityDeposit,
            maxGuests,
            minStayDays,
            maxStayDays,
            checkInTime,
            checkOutTime,
            wifiPassword,
            keyLocation,
            houseRules,
            images,
            coordinates,
            amenities,
            notes
        } = req.body;
        
        // Validate required fields
        if (!name || !address || !propertyType) {
            return res.status(400).json({
                error: 'נתונים חסרים',
                message: 'נדרש שם נכס, כתובת וסוג נכס',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        // Validate property type
        if (!['maintenance', 'short_term', 'long_term'].includes(propertyType)) {
            return res.status(400).json({
                error: 'סוג נכס לא תקין',
                code: 'INVALID_PROPERTY_TYPE'
            });
        }
        
        // Determine owner
        let finalOwnerId = req.user.id; // Default to current user
        
        if (req.user.role === 'admin' && ownerId) {
            // Admin can specify owner
            const owner = await User.findOne({
                where: { id: ownerId, role: ['admin', 'owner'] }
            });
            
            if (!owner) {
                return res.status(400).json({
                    error: 'בעל נכס לא תקין',
                    message: 'בעל הנכס שצוין לא קיים או אינו מורשה',
                    code: 'INVALID_OWNER'
                });
            }
            
            finalOwnerId = ownerId;
        }
        
        // Validate short-term property requirements
        if (propertyType === 'short_term') {
            if (!basePrice || basePrice <= 0) {
                return res.status(400).json({
                    error: 'מחיר בסיס נדרש',
                    message: 'נכסים לטווח קצר חייבים לכלול מחיר בסיס תקין',
                    code: 'BASE_PRICE_REQUIRED'
                });
            }
        }
        
        const propertyData = {
            name,
            address,
            propertyType,
            ownerId: finalOwnerId,
            description,
            rooms: rooms ? parseInt(rooms) : null,
            bedrooms: bedrooms ? parseInt(bedrooms) : null,
            bathrooms: bathrooms ? parseFloat(bathrooms) : null,
            area: area ? parseFloat(area) : null,
            floor: floor ? parseInt(floor) : null,
            balcony: Boolean(balcony),
            parking: Boolean(parking),
            elevator: Boolean(elevator),
            airConditioning: Boolean(airConditioning),
            furnished: Boolean(furnished),
            petsAllowed: Boolean(petsAllowed),
            smokingAllowed: Boolean(smokingAllowed),
            basePrice: basePrice ? parseFloat(basePrice) : null,
            cleaningFee: cleaningFee ? parseFloat(cleaningFee) : null,
            securityDeposit: securityDeposit ? parseFloat(securityDeposit) : null,
            maxGuests: maxGuests ? parseInt(maxGuests) : null,
            minStayDays: minStayDays ? parseInt(minStayDays) : null,
            maxStayDays: maxStayDays ? parseInt(maxStayDays) : null,
            checkInTime,
            checkOutTime,
            wifiPassword,
            keyLocation,
            houseRules,
            images: images || null,
            coordinates: coordinates || null,
            amenities: amenities || null,
            notes
        };
        
        const property = await Property.create(propertyData);
        
        // Get property with owner info
        const propertyWithOwner = await Property.findByPk(property.id, {
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });
        
        const propertyResponse = propertyWithOwner.toJSON();
        propertyResponse.propertyTypeDisplay = propertyWithOwner.getPropertyTypeDisplay();
        
        res.status(201).json({
            success: true,
            message: 'הנכס נוצר בהצלחה',
            property: propertyResponse
        });
        
    } catch (error) {
        console.error('שגיאה ביצירת נכס:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'שגיאת ולידציה',
                details: error.errors.map(e => e.message),
                code: 'VALIDATION_ERROR'
            });
        }
        
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'אירעה שגיאה ביצירת הנכס',
            code: 'CREATE_PROPERTY_ERROR'
        });
    }
};

// Update property
const updateProperty = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        const where = { id: propertyId };
        
        // Role-based access control
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        const property = await Property.findOne({ where });
        
        if (!property) {
            return res.status(404).json({
                error: 'נכס לא נמצא',
                message: 'הנכס לא קיים או שאין לך הרשאה לערוך אותו',
                code: 'PROPERTY_NOT_FOUND'
            });
        }
        
        // Check if property type is changing and validate
        if (req.body.propertyType && req.body.propertyType !== property.propertyType) {
            if (!['maintenance', 'short_term', 'long_term'].includes(req.body.propertyType)) {
                return res.status(400).json({
                    error: 'סוג נכס לא תקין',
                    code: 'INVALID_PROPERTY_TYPE'
                });
            }
            
            // Check if there are active bookings before changing type
            if (property.propertyType === 'short_term') {
                const activeBookings = await Booking.count({
                    where: {
                        propertyId: property.id,
                        status: ['confirmed', 'checked_in']
                    }
                });
                
                if (activeBookings > 0) {
                    return res.status(400).json({
                        error: 'לא ניתן לשנות סוג נכס',
                        message: 'קיימות הזמנות פעילות לנכס זה',
                        code: 'ACTIVE_BOOKINGS_EXIST'
                    });
                }
            }
        }
        
        // Update fields
        const updateData = {};
        const allowedFields = [
            'name', 'address', 'propertyType', 'description', 'rooms', 'bedrooms',
            'bathrooms', 'area', 'floor', 'balcony', 'parking', 'elevator',
            'airConditioning', 'furnished', 'petsAllowed', 'smokingAllowed',
            'basePrice', 'cleaningFee', 'securityDeposit', 'maxGuests',
            'minStayDays', 'maxStayDays', 'checkInTime', 'checkOutTime',
            'wifiPassword', 'keyLocation', 'houseRules', 'images',
            'coordinates', 'amenities', 'notes', 'isActive'
        ];
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });
        
        // Convert numeric fields
        ['rooms', 'bedrooms', 'maxGuests', 'minStayDays', 'maxStayDays', 'floor'].forEach(field => {
            if (updateData[field] !== undefined && updateData[field] !== null) {
                updateData[field] = parseInt(updateData[field]);
            }
        });
        
        ['bathrooms', 'area', 'basePrice', 'cleaningFee', 'securityDeposit'].forEach(field => {
            if (updateData[field] !== undefined && updateData[field] !== null) {
                updateData[field] = parseFloat(updateData[field]);
            }
        });
        
        // Convert boolean fields
        ['balcony', 'parking', 'elevator', 'airConditioning', 'furnished', 'petsAllowed', 'smokingAllowed', 'isActive'].forEach(field => {
            if (updateData[field] !== undefined) {
                updateData[field] = Boolean(updateData[field]);
            }
        });
        
        await property.update(updateData);
        
        // Get updated property with owner info
        const updatedProperty = await Property.findByPk(property.id, {
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });
        
        const propertyResponse = updatedProperty.toJSON();
        propertyResponse.propertyTypeDisplay = updatedProperty.getPropertyTypeDisplay();
        
        res.json({
            success: true,
            message: 'הנכס עודכן בהצלחה',
            property: propertyResponse
        });
        
    } catch (error) {
        console.error('שגיאה בעדכון נכס:', error);
        
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'שגיאת ולידציה',
                details: error.errors.map(e => e.message),
                code: 'VALIDATION_ERROR'
            });
        }
        
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'UPDATE_PROPERTY_ERROR'
        });
    }
};

// Delete property
const deleteProperty = async (req, res) => {
    try {
        const { propertyId } = req.params;
        
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
        
        // Check for active bookings
        const activeBookings = await Booking.count({
            where: {
                propertyId: property.id,
                status: ['confirmed', 'checked_in']
            }
        });
        
        if (activeBookings > 0) {
            return res.status(400).json({
                error: 'לא ניתן למחוק נכס',
                message: 'קיימות הזמנות פעילות לנכס זה',
                code: 'ACTIVE_BOOKINGS_EXIST'
            });
        }
        
        const propertyInfo = {
            name: property.name,
            address: property.address,
            propertyType: property.getPropertyTypeDisplay()
        };
        
        await property.destroy();
        
        res.json({
            success: true,
            message: 'הנכס נמחק בהצלחה',
            deletedProperty: propertyInfo
        });
        
    } catch (error) {
        console.error('שגיאה במחיקת נכס:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'DELETE_PROPERTY_ERROR'
        });
    }
};

// Get property statistics - FINAL FIXED VERSION
const getPropertyStats = async (req, res) => {
    try {
        const where = {};
        
        // Role-based filtering
        if (req.user.role === 'owner') {
            where.ownerId = req.user.id;
        }
        
        // Get basic counts
        const totalProperties = await Property.count({ where });
        const activeProperties = await Property.count({ 
            where: { ...where, isActive: true } 
        });
        
        // Get stats by property type
        const maintenanceCount = await Property.count({
            where: { ...where, propertyType: 'maintenance' }
        });
        
        const shortTermCount = await Property.count({
            where: { ...where, propertyType: 'short_term' }
        });
        
        const longTermCount = await Property.count({
            where: { ...where, propertyType: 'long_term' }
        });
        
        // Short-term property pricing stats
        let shortTermStats = null;
        
        if (shortTermCount > 0) {
            const { sequelize } = require('../models');
            
            const pricingData = await Property.findAll({
                where: { 
                    ...where, 
                    propertyType: 'short_term',
                    basePrice: { [Op.ne]: null }
                },
                attributes: [
                    [sequelize.fn('AVG', sequelize.col('base_price')), 'avgPrice'],
                    [sequelize.fn('MIN', sequelize.col('base_price')), 'minPrice'],
                    [sequelize.fn('MAX', sequelize.col('base_price')), 'maxPrice']
                ],
                raw: true
            });
            
            if (pricingData.length > 0 && pricingData[0].avgPrice) {
                shortTermStats = {
                    avgPrice: Math.round(parseFloat(pricingData[0].avgPrice)),
                    minPrice: parseFloat(pricingData[0].minPrice),
                    maxPrice: parseFloat(pricingData[0].maxPrice)
                };
            }
        }
        
        res.json({
            success: true,
            stats: {
                total: totalProperties,
                active: activeProperties,
                inactive: totalProperties - activeProperties,
                byType: {
                    maintenance: maintenanceCount,
                    short_term: shortTermCount,
                    long_term: longTermCount
                },
                shortTermPricing: shortTermStats
            }
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת סטטיסטיקות נכסים:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: error.message,
            code: 'GET_STATS_ERROR'
        });
    }
};

module.exports = {
    getAllProperties,
    getPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,
    getPropertyStats
};