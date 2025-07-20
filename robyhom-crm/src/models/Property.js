const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Property = sequelize.define('Property', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [2, 255]
        }
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    propertyType: {
        type: DataTypes.ENUM,
        values: ['maintenance', 'short_term', 'long_term'],
        allowNull: false,
        field: 'property_type',
        comment: 'תחזוקה / טווח קצר / טווח ארוך'
    },
    ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'owner_id',
        references: {
            model: 'users',
            key: 'id'
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    rooms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 0,
            max: 50
        }
    },
    bedrooms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 0,
            max: 20
        }
    },
    bathrooms: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        validate: {
            min: 0,
            max: 20
        }
    },
    area: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        comment: 'שטח במטרים רבועים'
    },
    floor: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    balcony: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    parking: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    elevator: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    airConditioning: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'air_conditioning'
    },
    furnished: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    petsAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'pets_allowed'
    },
    smokingAllowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'smoking_allowed'
    },
    basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'base_price',
        comment: 'מחיר בסיס לטווח קצר או שכירות חודשית'
    },
    cleaningFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'cleaning_fee',
        comment: 'עלות ניקיון לטווח קצר'
    },
    securityDeposit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'security_deposit',
        comment: 'פיקדון'
    },
    maxGuests: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'max_guests',
        validate: {
            min: 1,
            max: 50
        }
    },
    minStayDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'min_stay_days',
        defaultValue: 1,
        comment: 'מינימום לילות לטווח קצר'
    },
    maxStayDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'max_stay_days',
        comment: 'מקסימום לילות לטווח קצר'
    },
    checkInTime: {
        type: DataTypes.TIME,
        allowNull: true,
        field: 'check_in_time',
        defaultValue: '15:00:00'
    },
    checkOutTime: {
        type: DataTypes.TIME,
        allowNull: true,
        field: 'check_out_time',
        defaultValue: '11:00:00'
    },
    wifiPassword: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'wifi_password'
    },
    keyLocation: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'key_location',
        comment: 'הוראות לקבלת מפתח'
    },
    houseRules: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'house_rules'
    },
    
    // ✅ השדות החדשים לטווח ארוך שהוספנו:
    isRented: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_rented',
        comment: 'האם הנכס מושכר כרגע (לטווח ארוך)'
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'tenant_id',
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'מזהה השוכר הנוכחי (לטווח ארוך)'
    },
    monthlyRent: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'monthly_rent',
        comment: 'שכר דירה חודשי (לטווח ארוך)'
    },
    rentalStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'rental_start_date',
        comment: 'תאריך תחילת שכירות (לטווח ארוך)'
    },
    rentalEndDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'rental_end_date',
        comment: 'תאריך סיום שכירות (לטווח ארוך)'
    },
    tenantName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'tenant_name',
        comment: 'שם השוכר (לשמירת מידע נוח)'
    },
    tenantPhone: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'tenant_phone',
        comment: 'טלפון השוכר (לשמירת מידע נוח)'
    },
    tenantEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'tenant_email',
        comment: 'אימייל השוכר (לשמירת מידע נוח)'
    },
    // ✅ סוף השדות החדשים
    
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    images: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'מערך של קישורי תמונות'
    },
    coordinates: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'קואורדינטות GPS: {lat: number, lng: number}'
    },
    amenities: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'רשימת שירותים וציוד'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'הערות פנימיות'
    }
}, {
    tableName: 'properties',
    timestamps: true,
    indexes: [
        {
            fields: ['owner_id']
        },
        {
            fields: ['property_type']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['base_price']
        },
        // ✅ אינדקסים חדשים לשדות החדשים:
        {
            fields: ['is_rented']
        },
        {
            fields: ['tenant_id']
        },
        {
            fields: ['rental_start_date', 'rental_end_date']
        }
    ]
});

// Instance methods - עם פונקציות חדשות לטווח ארוך
Property.prototype.getDisplayName = function() {
    return `${this.name} - ${this.address}`;
};

Property.prototype.isAvailableForDates = async function(checkIn, checkOut) {
    if (this.propertyType !== 'short_term') {
        return false;
    }
    
    // This will be implemented when we create the Booking model
    // Check for overlapping bookings
    return true;
};

Property.prototype.calculateTotalPrice = function(nights) {
    if (!this.basePrice) return 0;
    
    const baseTotal = parseFloat(this.basePrice) * nights;
    const cleaningFee = parseFloat(this.cleaningFee) || 0;
    return baseTotal + cleaningFee;
};

Property.prototype.getPropertyTypeDisplay = function() {
    const typeNames = {
        'maintenance': 'תחזוקה',
        'short_term': 'שכירות לטווח קצר',
        'long_term': 'שכירות לטווח ארוך'
    };
    return typeNames[this.propertyType] || this.propertyType;
};

// ✅ פונקציות חדשות לטווח ארוך:
Property.prototype.getRentalStatusDisplay = function() {
    if (this.propertyType !== 'long_term') {
        return null;
    }
    
    if (this.isRented) {
        return {
            status: 'מושכר',
            color: 'success',
            tenant: this.tenantName,
            phone: this.tenantPhone,
            email: this.tenantEmail,
            startDate: this.rentalStartDate,
            endDate: this.rentalEndDate,
            monthlyRent: this.monthlyRent
        };
    } else {
        return {
            status: 'פנוי',
            color: 'available',
            message: 'זמין להשכרה'
        };
    }
};

Property.prototype.isRentalActive = function() {
    if (!this.isRented || !this.rentalEndDate) {
        return false;
    }
    
    const today = new Date();
    const endDate = new Date(this.rentalEndDate);
    return endDate >= today;
};

Property.prototype.getDaysUntilRentalEnd = function() {
    if (!this.isRented || !this.rentalEndDate) {
        return null;
    }
    
    const today = new Date();
    const endDate = new Date(this.rentalEndDate);
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
};

// Class methods
Property.findByOwner = async function(ownerId) {
    return await this.findAll({
        where: { 
            ownerId: ownerId,
            isActive: true 
        },
        order: [['createdAt', 'DESC']]
    });
};

Property.findAvailableProperties = async function(propertyType = 'short_term') {
    return await this.findAll({
        where: { 
            propertyType: propertyType,
            isActive: true 
        },
        order: [['name', 'ASC']]
    });
};

Property.searchProperties = async function(searchParams) {
    const where = { isActive: true };
    
    if (searchParams.propertyType) {
        where.propertyType = searchParams.propertyType;
    }
    
    if (searchParams.ownerId) {
        where.ownerId = searchParams.ownerId;
    }
    
    if (searchParams.minPrice && searchParams.maxPrice) {
        where.basePrice = {
            [require('sequelize').Op.between]: [searchParams.minPrice, searchParams.maxPrice]
        };
    }
    
    if (searchParams.rooms) {
        where.rooms = searchParams.rooms;
    }
    
    // ✅ חיפוש חדש לפי שוכר:
    if (searchParams.tenantName) {
        where.tenantName = {
            [require('sequelize').Op.iLike]: `%${searchParams.tenantName}%`
        };
    }
    
    if (searchParams.isRented !== undefined) {
        where.isRented = searchParams.isRented;
    }
    
    return await this.findAll({
        where,
        order: [['createdAt', 'DESC']]
    });
};

// ✅ פונקציות סטטיסטיקה חדשות:
Property.getRentalStatistics = async function(ownerId = null) {
    const where = { isActive: true };
    if (ownerId) {
        where.ownerId = ownerId;
    }
    
    const totalLongTerm = await this.count({
        where: { ...where, propertyType: 'long_term' }
    });
    
    const rentedLongTerm = await this.count({
        where: { ...where, propertyType: 'long_term', isRented: true }
    });
    
    const availableLongTerm = totalLongTerm - rentedLongTerm;
    
    return {
        totalLongTerm,
        rentedLongTerm,
        availableLongTerm,
        occupancyRate: totalLongTerm > 0 ? ((rentedLongTerm / totalLongTerm) * 100).toFixed(1) : 0
    };
};

module.exports = Property;