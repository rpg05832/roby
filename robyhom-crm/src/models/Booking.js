const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    propertyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'property_id',
        references: {
            model: 'properties',
            key: 'id'
        }
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'tenant_id',
        references: {
            model: 'users',
            key: 'id'
        }
    },
    // Guest details (manual entry for short-term)
    guestName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'guest_name'
    },
    guestEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'guest_email',
        validate: {
            isEmail: true
        }
    },
    guestPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'guest_phone'
    },
    numberOfGuests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'number_of_guests',
        defaultValue: 1,
        validate: {
            min: 1,
            max: 50
        }
    },
    // Booking dates
    checkInDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'check_in_date'
    },
    checkOutDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'check_out_date'
    },
    actualCheckIn: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'actual_check_in'
    },
    actualCheckOut: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'actual_check_out'
    },
    // Hebrew calendar dates
    checkInDateHebrew: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'check_in_date_hebrew'
    },
    checkOutDateHebrew: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'check_out_date_hebrew'
    },
    isHolidayPeriod: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_holiday_period',
        comment: 'האם התקופה כוללת חגים'
    },
    holidayNames: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'holiday_names',
        comment: 'שמות החגים בתקופה'
    },
    // Calculated fields
    numberOfNights: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'number_of_nights'
    },
    // Pricing
    basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'base_price',
        comment: 'מחיר בסיס ללילה'
    },
    totalBaseAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'total_base_amount',
        comment: 'סכום בסיס כולל (לילות * מחיר)'
    },
    cleaningFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'cleaning_fee',
        defaultValue: 0
    },
    extraFees: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'extra_fees',
        defaultValue: 0,
        comment: 'עלויות נוספות'
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'הנחה'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'total_amount',
        comment: 'סכום כולל להזמנה'
    },
    paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'paid_amount',
        defaultValue: 0,
        comment: 'סכום ששולם'
    },
    remainingAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        field: 'remaining_amount',
        comment: 'יתרה לתשלום'
    },
    // Status
    status: {
        type: DataTypes.ENUM,
        values: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
        allowNull: false,
        defaultValue: 'pending'
    },
    // Payment status
    paymentStatus: {
        type: DataTypes.ENUM,
        values: ['unpaid', 'partial', 'paid', 'refunded'],
        allowNull: false,
        field: 'payment_status',
        defaultValue: 'unpaid'
    },
    // Booking source
    bookingSource: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'booking_source',
        comment: 'מקור ההזמנה (Airbnb, Booking.com, ישיר וכו)'
    },
    externalBookingId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'external_booking_id',
        comment: 'מזהה הזמנה באתר חיצוני'
    },
    // Special requests and notes
    specialRequests: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'special_requests'
    },
    guestNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'guest_notes',
        comment: 'הערות על האורח'
    },
    internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'internal_notes',
        comment: 'הערות פנימיות'
    },
    // Communication preferences
    preferredLanguage: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'preferred_language',
        defaultValue: 'he'
    },
    emergencyContact: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'emergency_contact',
        comment: 'פרטי איש קשר לחירום'
    }
}, {
    tableName: 'bookings',
    timestamps: true,
    indexes: [
        {
            fields: ['property_id']
        },
        {
            fields: ['tenant_id']
        },
        {
            fields: ['check_in_date', 'check_out_date']
        },
        {
            fields: ['status']
        },
        {
            fields: ['payment_status']
        },
        {
            unique: false,
            fields: ['property_id', 'check_in_date', 'check_out_date']
        }
    ],
    hooks: {
        beforeValidate: (booking) => {
            // Calculate number of nights
            if (booking.checkInDate && booking.checkOutDate) {
                const checkIn = new Date(booking.checkInDate);
                const checkOut = new Date(booking.checkOutDate);
                const timeDiff = checkOut.getTime() - checkIn.getTime();
                booking.numberOfNights = Math.ceil(timeDiff / (1000 * 3600 * 24));
            }
            
            // Calculate total amounts
            if (booking.basePrice && booking.numberOfNights) {
                booking.totalBaseAmount = parseFloat(booking.basePrice) * booking.numberOfNights;
                
                const cleaningFee = parseFloat(booking.cleaningFee) || 0;
                const extraFees = parseFloat(booking.extraFees) || 0;
                const discount = parseFloat(booking.discount) || 0;
                
                booking.totalAmount = booking.totalBaseAmount + cleaningFee + extraFees - discount;
                
                const paidAmount = parseFloat(booking.paidAmount) || 0;
                booking.remainingAmount = booking.totalAmount - paidAmount;
                
                // Update payment status
                if (paidAmount === 0) {
                    booking.paymentStatus = 'unpaid';
                } else if (paidAmount >= booking.totalAmount) {
                    booking.paymentStatus = 'paid';
                } else {
                    booking.paymentStatus = 'partial';
                }
            }
        }
    }
});

// Instance methods
Booking.prototype.updatePaymentAmount = async function(amount) {
    this.paidAmount = parseFloat(this.paidAmount) + parseFloat(amount);
    this.remainingAmount = this.totalAmount - this.paidAmount;
    
    // Update payment status
    if (this.paidAmount >= this.totalAmount) {
        this.paymentStatus = 'paid';
    } else if (this.paidAmount > 0) {
        this.paymentStatus = 'partial';
    }
    
    await this.save();
};

Booking.prototype.checkIn = async function() {
    this.status = 'checked_in';
    this.actualCheckIn = new Date();
    await this.save();
};

Booking.prototype.checkOut = async function() {
    this.status = 'checked_out';
    this.actualCheckOut = new Date();
    await this.save();
};

Booking.prototype.cancel = async function(reason = null) {
    this.status = 'cancelled';
    if (reason) {
        this.internalNotes = (this.internalNotes || '') + `\nבוטל: ${reason}`;
    }
    await this.save();
};

Booking.prototype.getStatusDisplay = function() {
    const statusNames = {
        'pending': 'ממתין לאישור',
        'confirmed': 'מאושר',
        'checked_in': 'נכנס',
        'checked_out': 'יצא',
        'cancelled': 'בוטל',
        'no_show': 'לא הגיע'
    };
    return statusNames[this.status] || this.status;
};

Booking.prototype.getPaymentStatusDisplay = function() {
    const statusNames = {
        'unpaid': 'לא שולם',
        'partial': 'שולם חלקי',
        'paid': 'שולם במלואו',
        'refunded': 'הוחזר'
    };
    return statusNames[this.paymentStatus] || this.paymentStatus;
};

// Class methods
Booking.findOverlapping = async function(propertyId, checkIn, checkOut, excludeBookingId = null) {
    const { Op } = require('sequelize');
    
    const where = {
        propertyId: propertyId,
        status: ['confirmed', 'checked_in'],
        [Op.or]: [
            {
                checkInDate: {
                    [Op.between]: [checkIn, checkOut]
                }
            },
            {
                checkOutDate: {
                    [Op.between]: [checkIn, checkOut]
                }
            },
            {
                [Op.and]: [
                    {
                        checkInDate: {
                            [Op.lte]: checkIn
                        }
                    },
                    {
                        checkOutDate: {
                            [Op.gte]: checkOut
                        }
                    }
                ]
            }
        ]
    };
    
    if (excludeBookingId) {
        where.id = { [Op.ne]: excludeBookingId };
    }
    
    return await this.findAll({ where });
};

Booking.findByDateRange = async function(startDate, endDate, propertyId = null) {
    const { Op } = require('sequelize');
    
    const where = {
        [Op.or]: [
            {
                checkInDate: {
                    [Op.between]: [startDate, endDate]
                }
            },
            {
                checkOutDate: {
                    [Op.between]: [startDate, endDate]
                }
            }
        ]
    };
    
    if (propertyId) {
        where.propertyId = propertyId;
    }
    
    return await this.findAll({
        where,
        order: [['checkInDate', 'ASC']]
    });
};

module.exports = Booking;