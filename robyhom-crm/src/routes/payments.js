const express = require('express');
const router = express.Router();
const {
    createPayment,
    getPayments,
    getPaymentById,
    updatePayment,
    deletePayment,
    getPaymentStats,
    getOwnerBalance
} = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

// הגנה על כל הנתיבים - דרוש אימות
router.use(authenticate);

/**
 * @route   GET /api/payments
 * @desc    קבלת רשימת תשלומים עם פילטרים
 * @access  Admin, Owner (רק צפייה), Tenant (מוגבל)
 * @note    בעל נכס יכול רק לראות תשלומים של הנכסים שלו
 */
router.get('/', getPayments);

/**
 * @route   GET /api/payments/stats
 * @desc    קבלת סטטיסטיקות תשלומים (דוחות)
 * @access  Admin, Owner (רק לנכסים שלו)
 * @params  propertyId, startDate, endDate
 */
router.get('/stats', authorize('admin', 'owner'), getPaymentStats);

/**
 * @route   GET /api/payments/owner-balance/:ownerId
 * @desc    קבלת יתרה של בעל נכס
 * @access  Admin, Owner (רק יתרה שלו)
 */
router.get('/owner-balance/:ownerId', authorize('admin', 'owner'), getOwnerBalance);

/**
 * @route   POST /api/payments
 * @desc    יצירת תשלום חדש
 * @access  Admin ONLY - בעל נכס לא יכול ליצור תשלומים!
 */
router.post('/', authorize('admin'), createPayment); // ← רק מנהל!

/**
 * @route   GET /api/payments/:id
 * @desc    קבלת תשלום בודד
 * @access  Admin, Owner (רק צפייה), Tenant (מוגבל)
 */
router.get('/:id', getPaymentById);

/**
 * @route   PUT /api/payments/:id
 * @desc    עדכון תשלום
 * @access  Admin ONLY - בעל נכס לא יכול לעדכן תשלומים!
 */
router.put('/:id', authorize('admin'), updatePayment); // ← רק מנהל!

/**
 * @route   DELETE /api/payments/:id
 * @desc    מחיקת תשלום
 * @access  Admin ONLY
 */
router.delete('/:id', authorize('admin'), deletePayment);

module.exports = router;