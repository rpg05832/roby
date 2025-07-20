const express = require('express');
const router = express.Router();

// Import controllers and middleware
const {
    login,
    register,
    getProfile,
    updateProfile,
    refreshToken,
    logout,
    getAllUsers
} = require('../controllers/authController');

const {
    authenticate,
    authorize,
    rateLimitLogin
} = require('../middleware/auth');

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 * @body    { email: string, password: string }
 */
router.post('/login', rateLimitLogin, login);

/**
 * @route   GET /api/auth/test
 * @desc    Test auth routes
 * @access  Public
 */
router.get('/test', (req, res) => {
    res.json({
        message: 'נתיבי האימות פועלים כראוי',
        timestamp: new Date().toISOString(),
        availableEndpoints: {
            public: [
                'POST /api/auth/login - כניסה למערכת',
                'GET /api/auth/test - בדיקת תקינות'
            ],
            authenticated: [
                'GET /api/auth/profile - פרופיל משתמש',
                'PUT /api/auth/profile - עדכון פרופיל',
                'POST /api/auth/refresh - חידוש טוקן',
                'POST /api/auth/logout - יציאה'
            ],
            adminOnly: [
                'POST /api/auth/register - רישום משתמש חדש',
                'GET /api/auth/users - רשימת כל המשתמשים'
            ]
        }
    });
});

// Protected routes (authentication required)

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 * @body    { fullName?: string, phone?: string, currentPassword?: string, newPassword?: string }
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', authenticate, refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    User logout
 * @access  Private
 */
router.post('/logout', authenticate, logout);

// Admin-only routes

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (admin only)
 * @access  Private (Admin only)
 * @body    { email: string, password: string, fullName: string, phone?: string, role?: string }
 */
router.post('/register', authenticate, authorize('admin'), register);

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin only)
 * @query   { page?: number, limit?: number, role?: string, search?: string }
 */
router.get('/users', authenticate, authorize('admin'), getAllUsers);

// User management routes (admin only)

/**
 * @route   PUT /api/auth/users/:userId/status
 * @desc    Activate/deactivate user (admin only)
 * @access  Private (Admin only)
 */
router.put('/users/:userId/status', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                error: 'נתון לא תקין',
                message: 'נדרש ערך boolean עבור isActive',
                code: 'INVALID_STATUS_VALUE'
            });
        }
        
        const { User } = require('../models');
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'משתמש לא נמצא',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Prevent admin from deactivating themselves
        if (user.id === req.user.id && !isActive) {
            return res.status(400).json({
                error: 'פעולה לא מותרת',
                message: 'לא ניתן לבטל את הפעלת החשבון שלך',
                code: 'CANNOT_DEACTIVATE_SELF'
            });
        }
        
        user.isActive = isActive;
        await user.save();
        
        res.json({
            success: true,
            message: `המשתמש ${isActive ? 'הופעל' : 'בוטל'} בהצלחה`,
            user: {
                ...user.getPublicInfo(),
                roleDisplay: User.getRoleDisplayName(user.role)
            }
        });
        
    } catch (error) {
        console.error('שגיאה בעדכון סטטוס משתמש:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'UPDATE_STATUS_ERROR'
        });
    }
});

/**
 * @route   DELETE /api/auth/users/:userId
 * @desc    Delete user (admin only)
 * @access  Private (Admin only)
 */
router.delete('/users/:userId', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { User } = require('../models');
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'משתמש לא נמצא',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Prevent admin from deleting themselves
        if (user.id === req.user.id) {
            return res.status(400).json({
                error: 'פעולה לא מותרת',
                message: 'לא ניתן למחוק את החשבון שלך',
                code: 'CANNOT_DELETE_SELF'
            });
        }
        
        // Store user info before deletion
        const deletedUserInfo = {
            email: user.email,
            fullName: user.fullName,
            role: user.role
        };
        
        await user.destroy();
        
        res.json({
            success: true,
            message: 'המשתמש נמחק בהצלחה',
            deletedUser: deletedUserInfo
        });
        
    } catch (error) {
        console.error('שגיאה במחיקת משתמש:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'DELETE_USER_ERROR'
        });
    }
});

// Password reset endpoints (for future implementation)

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset (future implementation)
 * @access  Public
 */
router.post('/forgot-password', (req, res) => {
    res.status(501).json({
        message: 'תכונה זו תמומש בעתיד',
        code: 'NOT_IMPLEMENTED'
    });
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token (future implementation)
 * @access  Public
 */
router.post('/reset-password', (req, res) => {
    res.status(501).json({
        message: 'תכונה זו תמומש בעתיד',
        code: 'NOT_IMPLEMENTED'
    });
});

// Error handling for this router
router.use((err, req, res, next) => {
    console.error('שגיאה בנתיבי האימות:', err);
    res.status(500).json({
        error: 'שגיאה פנימית',
        message: 'אירעה שגיאה בתהליך האימות',
        code: 'AUTH_ROUTER_ERROR'
    });
});

module.exports = router;