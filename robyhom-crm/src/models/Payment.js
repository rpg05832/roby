const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0.01
        },
        comment: 'סכום התשלום'
    },
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'payment_date',
        comment: 'תאריך התשלום'
    },
    paymentMethod: {
        type: DataTypes.ENUM,
        values: ['cash', 'bank_transfer', 'credit_card', 'check', 'bit', 'paypal', 'other'],
        allowNull: false,
        field: 'payment_method',
        defaultValue: 'cash',
        comment: 'אמצעי תשלום'
    },
    paymentType: {
        type: DataTypes.ENUM,
        values: ['booking_payment', 'owner_deposit', 'expense_payment', 'refund', 'commission', 'other'],
        allowNull: false,
        field: 'payment_type',
        comment: 'סוג התשלום'
    },
    // Relationships
    bookingId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'booking_id',
        references: {
            model: 'bookings',
            key: 'id'
        },
        comment: 'קישור להזמנה (לתשלומי אורחים)'
    },
    propertyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'property_id',
        references: {
            model: 'properties',
            key: 'id'
        },
        comment: 'קישור לנכס'
    },
    payerId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'payer_id',
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'מי שילם (יכול להיות בעל נכס או שוכר)'
    },
    receiverId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'receiver_id',
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'מי שקיבל את התשלום'
    },
    // Payment details
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'תיאור התשלום'
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'reference_number',
        comment: 'מספר אסמכתא / העברה בנקאית'
    },
    checkNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'check_number',
        comment: 'מספר צ\'ק'
    },
    checkDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'check_date',
        comment: 'תאריך פדיון צ\'ק'
    },
    // Status and categorization
    status: {
        type: DataTypes.ENUM,
        values: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
        allowNull: false,
        defaultValue: 'completed',
        comment: 'סטטוס התשלום'
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'קטגוריה לצורכי דוחות (שיפוצים, תחזוקה, וכו\')'
    },
    isForRenovation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_for_renovation',
        comment: 'האם התשלום מיועד לשיפוצים'
    },
    isCommission: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_commission',
        comment: 'האם זו עמלה'
    },
    commissionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: 'commission_rate',
        comment: 'אחוז העמלה (אם רלוונטי)'
    },
    // Financial tracking
    originalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'original_amount',
        comment: 'סכום מקורי לפני הנחות/עמלות'
    },
    vatAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'vat_amount',
        defaultValue: 0,
        comment: 'סכום מעמ'
    },
    vatRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: 'vat_rate',
        defaultValue: 17,
        comment: 'אחוז מעמ'
    },
    // Currency (for future international support)
    currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'ILS',
        comment: 'מטבע'
    },
    exchangeRate: {
        type: DataTypes.DECIMAL(8, 4),
        allowNull: true,
        field: 'exchange_rate',
        defaultValue: 1,
        comment: 'שער חליפין (אם לא שקל)'
    },
    // Receipt and documentation
    receiptNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'receipt_number',
        comment: 'מספר קבלה'
    },
    invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'invoice_number',
        comment: 'מספר חשבונית'
    },
    attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'קישורים לקבצים מצורפים (קבלות, חשבוניות)'
    },
    // Internal notes
    internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'internal_notes',
        comment: 'הערות פנימיות'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'created_by',
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'מי יצר את רשומת התשלום'
    }
}, {
    tableName: 'payments',
    timestamps: true,
    indexes: [
        {
            fields: ['booking_id']
        },
        {
            fields: ['property_id']
        },
        {
            fields: ['payer_id']
        },
        {
            fields: ['receiver_id']
        },
        {
            fields: ['payment_date']
        },
        {
            fields: ['payment_type']
        },
        {
            fields: ['payment_method']
        },
        {
            fields: ['status']
        },
        {
            fields: ['is_commission']
        },
        {
            fields: ['is_for_renovation']
        }
    ]
});

// Instance methods
Payment.prototype.getPaymentMethodDisplay = function() {
    const methodNames = {
        'cash': 'מזומן',
        'bank_transfer': 'העברה בנקאית',
        'credit_card': 'כרטיס אשראי',
        'check': 'צ\'ק',
        'bit': 'Bit',
        'paypal': 'PayPal',
        'other': 'אחר'
    };
    return methodNames[this.paymentMethod] || this.paymentMethod;
};

Payment.prototype.getPaymentTypeDisplay = function() {
    const typeNames = {
        'booking_payment': 'תשלום הזמנה',
        'owner_deposit': 'הפקדה מבעל נכס',
        'expense_payment': 'תשלום הוצאה',
        'refund': 'החזר כספי',
        'commission': 'עמלה',
        'other': 'אחר'
    };
    return typeNames[this.paymentType] || this.paymentType;
};

Payment.prototype.getStatusDisplay = function() {
    const statusNames = {
        'pending': 'ממתין',
        'completed': 'הושלם',
        'failed': 'נכשל',
        'cancelled': 'בוטל',
        'refunded': 'הוחזר'
    };
    return statusNames[this.status] || this.status;
};

Payment.prototype.calculateNetAmount = function() {
    const amount = parseFloat(this.amount);
    const vatAmount = parseFloat(this.vatAmount) || 0;
    return amount - vatAmount;
};

Payment.prototype.calculateCommissionAmount = function() {
    if (!this.isCommission || !this.commissionRate) return 0;
    
    const amount = parseFloat(this.amount);
    const rate = parseFloat(this.commissionRate);
    return (amount * rate) / 100;
};

// Class methods
Payment.findByBooking = async function(bookingId) {
    return await this.findAll({
        where: { bookingId },
        order: [['paymentDate', 'DESC']]
    });
};

Payment.findByProperty = async function(propertyId, startDate = null, endDate = null) {
    const where = { propertyId };
    
    if (startDate && endDate) {
        const { Op } = require('sequelize');
        where.paymentDate = {
            [Op.between]: [startDate, endDate]
        };
    }
    
    return await this.findAll({
        where,
        order: [['paymentDate', 'DESC']]
    });
};

Payment.findByUser = async function(userId, role = 'payer') {
    const where = {};
    where[role === 'payer' ? 'payerId' : 'receiverId'] = userId;
    
    return await this.findAll({
        where,
        order: [['paymentDate', 'DESC']]
    });
};

Payment.calculateOwnerBalance = async function(ownerId) {
    const { Op } = require('sequelize');
    
    // הכנסות מהזמנות (כסף שנכנס)
    const income = await this.sum('amount', {
        where: {
            paymentType: 'booking_payment',
            receiverId: ownerId,
            status: 'completed'
        }
    }) || 0;
    
    // הפקדות שבעל הנכס העביר למערכת
    const deposits = await this.sum('amount', {
        where: {
            paymentType: 'owner_deposit',
            payerId: ownerId,
            status: 'completed'
        }
    }) || 0;
    
    // הוצאות ששולמו עבור הנכסים שלו
    const expenses = await this.sum('amount', {
        where: {
            paymentType: 'expense_payment',
            receiverId: ownerId,
            status: 'completed'
        }
    }) || 0;
    
    // עמלות שנגבו
    const commissions = await this.sum('amount', {
        where: {
            paymentType: 'commission',
            payerId: ownerId,
            status: 'completed'
        }
    }) || 0;
    
    // חישוב יתרה: הכנסות + הפקדות - הוצאות - עמלות
    const balance = income + deposits - expenses - commissions;
    
    return {
        income: parseFloat(income),
        deposits: parseFloat(deposits),
        expenses: parseFloat(expenses),
        commissions: parseFloat(commissions),
        balance: parseFloat(balance)
    };
};

Payment.getRevenueReport = async function(startDate, endDate, propertyId = null) {
    const { Op } = require('sequelize');
    const where = {
        paymentDate: {
            [Op.between]: [startDate, endDate]
        },
        status: 'completed'
    };
    
    if (propertyId) {
        where.propertyId = propertyId;
    }
    
    const payments = await this.findAll({
        where,
        include: [
            {
                model: require('./Property'),
                as: 'property',
                attributes: ['name', 'propertyType']
            },
            {
                model: require('./User'),
                as: 'payer',
                attributes: ['fullName', 'email']
            }
        ]
    });
    
    // קיבוץ לפי סוג תשלום
    const report = {
        bookingPayments: 0,
        ownerDeposits: 0,
        expenses: 0,
        commissions: 0,
        total: 0,
        count: payments.length
    };
    
    payments.forEach(payment => {
        const amount = parseFloat(payment.amount);
        report.total += amount;
        
        switch (payment.paymentType) {
            case 'booking_payment':
                report.bookingPayments += amount;
                break;
            case 'owner_deposit':
                report.ownerDeposits += amount;
                break;
            case 'expense_payment':
                report.expenses += amount;
                break;
            case 'commission':
                report.commissions += amount;
                break;
        }
    });
    
    return report;
};

module.exports = Payment;