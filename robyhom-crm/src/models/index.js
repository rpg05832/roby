const { sequelize } = require('../config/database');

// Import all models - עכשיו הם כבר מוגדרים עם sequelize.define
const User = require('./User');
const Property = require('./Property');
const Booking = require('./Booking');
const Payment = require('./Payment');
const Document = require('./Document'); // ← הוספה חדשה!

// Initialize models object
const models = {
    User,
    Property,
    Booking,
    Payment,
    Document, // ← הוספה חדשה!
    sequelize
};

// Define associations between models manually (instead of using associate functions)
// This ensures proper loading order

// User associations
User.hasMany(Property, {
    foreignKey: 'ownerId',
    as: 'properties'
});

User.hasMany(Booking, {
    foreignKey: 'tenantId',
    as: 'bookings'
});

User.hasMany(Payment, {
    foreignKey: 'payerId',
    as: 'paymentsMade'
});

User.hasMany(Payment, {
    foreignKey: 'receiverId',
    as: 'paymentsReceived'
});

User.hasMany(Payment, {
    foreignKey: 'createdBy',
    as: 'paymentsCreated'
});

User.hasMany(Document, { // ← הוספה חדשה!
    foreignKey: 'uploadedBy',
    as: 'documentsUploaded'
});

// Property associations
Property.belongsTo(User, {
    foreignKey: 'ownerId',
    as: 'owner'
});

// ✅ קשר חדש לשוכר טווח ארוך:
Property.belongsTo(User, {
    foreignKey: 'tenantId',
    as: 'tenant'
});

Property.hasMany(Booking, {
    foreignKey: 'propertyId',
    as: 'bookings'
});

Property.hasMany(Payment, {
    foreignKey: 'propertyId',
    as: 'payments'
});

Property.hasMany(Document, { // ← הוספה חדשה!
    foreignKey: 'propertyId',
    as: 'documents'
});

// Booking associations
Booking.belongsTo(Property, {
    foreignKey: 'propertyId',
    as: 'property'
});

Booking.belongsTo(User, {
    foreignKey: 'tenantId',
    as: 'tenant'
});

Booking.hasMany(Payment, {
    foreignKey: 'bookingId',
    as: 'payments'
});

Booking.hasMany(Document, { // ← הוספה חדשה!
    foreignKey: 'bookingId',
    as: 'documents'
});

// Payment associations
Payment.belongsTo(Booking, {
    foreignKey: 'bookingId',
    as: 'booking'
});

Payment.belongsTo(Property, {
    foreignKey: 'propertyId',
    as: 'property'
});

Payment.belongsTo(User, {
    foreignKey: 'payerId',
    as: 'payer'
});

Payment.belongsTo(User, {
    foreignKey: 'receiverId',
    as: 'receiver'
});

Payment.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator'
});

Payment.hasMany(Document, { // ← הוספה חדשה!
    foreignKey: 'paymentId',
    as: 'documents'
});

// Document associations - ← הוספה חדשה!
Document.belongsTo(User, {
    foreignKey: 'uploadedBy',
    as: 'uploader'
});

Document.belongsTo(Property, {
    foreignKey: 'propertyId',
    as: 'property'
});

Document.belongsTo(Booking, {
    foreignKey: 'bookingId',
    as: 'booking'
});

Document.belongsTo(Payment, {
    foreignKey: 'paymentId',
    as: 'payment'
});

// Additional validations and hooks

// Property validations based on type
Property.addHook('beforeValidate', (property) => {
    // For maintenance properties - clear booking-related fields
    if (property.propertyType === 'maintenance') {
        property.basePrice = null;
        property.cleaningFee = null;
        property.maxGuests = null;
        property.minStayDays = null;
        property.maxStayDays = null;
        property.checkInTime = null;
        property.checkOutTime = null;
        
        // ✅ נקה גם שדות טווח ארוך:
        property.isRented = false;
        property.tenantId = null;
        property.monthlyRent = null;
        property.rentalStartDate = null;
        property.rentalEndDate = null;
        property.tenantName = null;
        property.tenantPhone = null;
        property.tenantEmail = null;
    }
    
    // For short-term properties - require certain fields
    if (property.propertyType === 'short_term') {
        if (!property.basePrice) {
            throw new Error('מחיר בסיס נדרש לנכסים לטווח קצר');
        }
        if (!property.maxGuests) {
            property.maxGuests = 2; // Default
        }
        if (!property.checkInTime) {
            property.checkInTime = '15:00:00';
        }
        if (!property.checkOutTime) {
            property.checkOutTime = '11:00:00';
        }
        
        // ✅ נקה שדות טווח ארוך:
        property.isRented = false;
        property.tenantId = null;
        property.monthlyRent = null;
        property.rentalStartDate = null;
        property.rentalEndDate = null;
        property.tenantName = null;
        property.tenantPhone = null;
        property.tenantEmail = null;
    }
    
    // ✅ For long-term properties - clear short-term specific fields
    if (property.propertyType === 'long_term') {
        property.cleaningFee = null;
        property.maxGuests = null;
        property.minStayDays = null;
        property.maxStayDays = null;
        property.checkInTime = null;
        property.checkOutTime = null;
        
        // ולידציה לטווח ארוך - אם מושכר חייב להיות שוכר
        if (property.isRented) {
            if (!property.tenantName && !property.tenantId) {
                throw new Error('נכס מושכר חייב לכלול פרטי שוכר');
            }
            if (!property.monthlyRent || property.monthlyRent <= 0) {
                throw new Error('נכס מושכר חייב לכלול דמי שכירות חודשיים');
            }
            if (!property.rentalStartDate) {
                throw new Error('נכס מושכר חייב לכלול תאריך תחילת שכירות');
            }
        } else {
            // אם לא מושכר - נקה פרטי שוכר
            property.tenantId = null;
            property.tenantName = null;
            property.tenantPhone = null;
            property.tenantEmail = null;
            property.monthlyRent = null;
            property.rentalStartDate = null;
            property.rentalEndDate = null;
        }
    }
});

// Booking validations - only for short-term properties
Booking.addHook('beforeCreate', async (booking) => {
    // Get the property to validate it's short-term
    const property = await Property.findByPk(booking.propertyId);
    
    if (!property) {
        throw new Error('נכס לא נמצא');
    }
    
    if (property.propertyType !== 'short_term') {
        throw new Error('ניתן ליצור הזמנות רק לנכסים לטווח קצר');
    }
    
    // Check for overlapping bookings
    const overlapping = await Booking.findOverlapping(
        booking.propertyId,
        booking.checkInDate,
        booking.checkOutDate
    );
    
    if (overlapping.length > 0) {
        throw new Error('קיימת הזמנה חופפת לתאריכים אלו');
    }
    
    // Set base price from property if not set
    if (!booking.basePrice) {
        booking.basePrice = property.basePrice;
    }
    
    // Set cleaning fee from property if not set
    if (!booking.cleaningFee && property.cleaningFee) {
        booking.cleaningFee = property.cleaningFee;
    }
    
    // Validate guest count
    if (booking.numberOfGuests > property.maxGuests) {
        throw new Error(`מספר האורחים (${booking.numberOfGuests}) עולה על המקסימום המותר (${property.maxGuests})`);
    }
    
    // Validate minimum stay
    if (property.minStayDays && booking.numberOfNights < property.minStayDays) {
        throw new Error(`מינימום לילות: ${property.minStayDays}`);
    }
    
    // Validate maximum stay
    if (property.maxStayDays && booking.numberOfNights > property.maxStayDays) {
        throw new Error(`מקסימום לילות: ${property.maxStayDays}`);
    }
});

Booking.addHook('beforeUpdate', async (booking) => {
    // If dates are being updated, check for overlaps
    if (booking.changed('checkInDate') || booking.changed('checkOutDate')) {
        const overlapping = await Booking.findOverlapping(
            booking.propertyId,
            booking.checkInDate,
            booking.checkOutDate,
            booking.id // Exclude current booking
        );
        
        if (overlapping.length > 0) {
            throw new Error('קיימת הזמנה חופפת לתאריכים החדשים');
        }
    }
});

// Payment validations and hooks
Payment.addHook('beforeValidate', (payment) => {
    // Ensure amount is positive
    if (payment.amount <= 0) {
        throw new Error('סכום התשלום חייב להיות חיובי');
    }
    
    // Calculate VAT if rate is provided but amount isn't
    if (payment.vatRate && !payment.vatAmount) {
        const amount = parseFloat(payment.amount);
        const vatRate = parseFloat(payment.vatRate);
        payment.vatAmount = (amount * vatRate) / (100 + vatRate);
    }
    
    // Set default currency
    if (!payment.currency) {
        payment.currency = 'ILS';
    }
});

Payment.addHook('afterCreate', async (payment) => {
    // Update booking payment status if this is a booking payment
    if (payment.bookingId && payment.paymentType === 'booking_payment' && payment.status === 'completed') {
        const booking = await Booking.findByPk(payment.bookingId);
        if (booking) {
            await booking.updatePaymentAmount(payment.amount);
        }
    }
});

// Document validations and hooks - ← הוספה חדשה!
Document.addHook('beforeValidate', (document) => {
    // Validate file type
    if (!Document.validateFileType(document.mimeType)) {
        throw new Error('סוג קובץ לא נתמך');
    }
    
    // Validate file size
    if (document.fileSize > Document.getMaxFileSize()) {
        throw new Error('גודל הקובץ גדול מדי (מקסימום 10MB)');
    }
    
    // Set file type automatically
    if (!document.fileType) {
        document.fileType = Document.getFileTypeFromMime(document.mimeType);
    }
    
    // Validate that at least one relation exists (property, booking, or payment)
    if (!document.propertyId && !document.bookingId && !document.paymentId) {
        // For now, we'll allow documents without relations
        // throw new Error('המסמך חייב להיות קשור לנכס, הזמנה או תשלום');
    }
});

Document.addHook('beforeDestroy', async (document) => {
    // TODO: Delete physical file from disk
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
        const fullPath = path.join(process.cwd(), document.filePath);
        await fs.unlink(fullPath);
        console.log(`🗑️ נמחק קובץ: ${document.filePath}`);
    } catch (error) {
        console.error(`❌ שגיאה במחיקת קובץ ${document.filePath}:`, error.message);
        // Don't throw error - continue with database deletion
    }
});

// Property helper methods for different types
Property.prototype.canHaveBookings = function() {
    return this.propertyType === 'short_term';
};

Property.prototype.canHaveLongTermTenant = function() {
    return this.propertyType === 'long_term';
};

Property.prototype.isForMaintenance = function() {
    return this.propertyType === 'maintenance';
};

// ✅ פונקציות עזר חדשות לטווח ארוך:
Property.prototype.isCurrentlyRented = function() {
    if (this.propertyType !== 'long_term') {
        return false;
    }
    
    if (!this.isRented) {
        return false;
    }
    
    // בדיקה אם השכירות עדיין פעילה
    if (this.rentalEndDate) {
        const today = new Date();
        const endDate = new Date(this.rentalEndDate);
        return endDate >= today;
    }
    
    return true; // אם אין תאריך סיום, השכירות פעילה
};

Property.prototype.getTenantDisplayName = function() {
    if (!this.isRented || this.propertyType !== 'long_term') {
        return null;
    }
    
    return this.tenantName || 'שוכר לא מוגדר';
};

Property.prototype.getRentalDuration = function() {
    if (!this.rentalStartDate) {
        return null;
    }
    
    const startDate = new Date(this.rentalStartDate);
    const endDate = this.rentalEndDate ? new Date(this.rentalEndDate) : new Date();
    
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    
    return {
        days: diffDays,
        months: months,
        displayText: months > 0 ? `${months} חודשים` : `${diffDays} ימים`
    };
};

// User helper methods for property types
User.prototype.canOwnProperties = function() {
    return this.role === 'admin' || this.role === 'owner';
};

User.prototype.canMakeBookings = function() {
    return this.role === 'admin' || this.role === 'tenant';
};

User.prototype.canUploadDocuments = function() { // ← הוספה חדשה!
    return this.role === 'admin' || this.role === 'owner';
};

User.prototype.canViewAllDocuments = function() { // ← הוספה חדשה!
    return this.role === 'admin';
};

// ✅ פונקציות עזר חדשות למשתמש:
User.prototype.canBeAssignedAsLongTermTenant = function() {
    return this.role === 'tenant' || this.role === 'admin';
};

User.prototype.getPropertiesAsOwner = async function() {
    return await Property.findAll({
        where: { ownerId: this.id }
    });
};

User.prototype.getPropertiesAsTenant = async function() {
    return await Property.findAll({
        where: { tenantId: this.id, isRented: true }
    });
};

// Payment helper methods
Payment.prototype.isBookingPayment = function() {
    return this.paymentType === 'booking_payment';
};

Payment.prototype.isOwnerDeposit = function() {
    return this.paymentType === 'owner_deposit';
};

Payment.prototype.isExpense = function() {
    return this.paymentType === 'expense_payment';
};

// Document helper methods - ← הוספה חדשה!
Document.prototype.canBeViewedBy = function(user) {
    // Admin can view all documents
    if (user.role === 'admin') {
        return true;
    }
    
    // Public documents can be viewed by everyone
    if (this.isPublic) {
        return true;
    }
    
    // Document uploader can always view
    if (this.uploadedBy === user.id) {
        return true;
    }
    
    // Property owner can view property documents
    if (this.propertyId && this.property && this.property.ownerId === user.id) {
        return true;
    }
    
    // Booking tenant can view booking documents
    if (this.bookingId && this.booking && this.booking.tenantId === user.id) {
        return true;
    }
    
    return false;
};

Document.prototype.canBeEditedBy = function(user) {
    // Admin can edit all documents
    if (user.role === 'admin') {
        return true;
    }
    
    // Document uploader can edit
    if (this.uploadedBy === user.id) {
        return true;
    }
    
    return false;
};

Document.prototype.canBeDeletedBy = function(user) {
    // Only admin and uploader can delete
    return user.role === 'admin' || this.uploadedBy === user.id;
};

// Sync all models
const syncModels = async (force = false) => {
    try {
        console.log('🔄 מסנכרן מודלים...');
        
        // Sync in correct order (dependencies first)
        await User.sync({ force });
        await Property.sync({ force });
        await Booking.sync({ force });
        await Payment.sync({ force });
        await Document.sync({ force }); // ← הוספה חדשה!
        
        console.log('✅ כל המודלים סונכרנו בהצלחה');
        console.log('📊 מודלים זמינים: User, Property, Booking, Payment, Document'); // ← עדכון!
        
        if (force) {
            console.log('⚠️  בסיס הנתונים אותחל (כל הנתונים נמחקו)');
        }
        
    } catch (error) {
        console.error('❌ שגיאה בסנכרון המודלים:', error.message);
        throw error;
    }
};

// Initialize default admin user if doesn't exist
const createDefaultAdmin = async () => {
    try {
        const adminExists = await User.findOne({ where: { role: 'admin' } });
        
        if (!adminExists) {
            const admin = await User.createUser({
                email: 'admin@robyhom.com',
                password: 'admin123456',
                fullName: 'מנהל מערכת',
                phone: '050-0000000',
                role: 'admin'
            });
            
            console.log('👤 נוצר משתמש מנהל ברירת מחדל:', admin.email);
            console.log('🔑 סיסמה: admin123456');
            console.log('⚠️  שנה את הסיסמה לאחר הכניסה הראשונה!');
        }
    } catch (error) {
        console.error('❌ שגיאה ביצירת מנהל ברירת מחדל:', error.message);
    }
};

module.exports = {
    ...models,
    syncModels,
    createDefaultAdmin
};