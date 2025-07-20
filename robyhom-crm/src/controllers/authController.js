const { User } = require('../models');
const { createToken } = require('../middleware/auth');

// Login endpoint
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                error: 'נתונים חסרים',
                message: 'נדרש אימייל וסיסמה',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Find user by email
        const user = await User.findByEmail(email);
        
        if (!user) {
            return res.status(401).json({
                error: 'פרטי כניסה שגויים',
                message: 'אימייל או סיסמה לא נכונים',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                error: 'חשבון לא פעיל',
                message: 'החשבון שלך הושעה. פנה למנהל המערכת',
                code: 'ACCOUNT_SUSPENDED'
            });
        }
        
        // Validate password
        const isValidPassword = await user.validatePassword(password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'פרטי כניסה שגויים',
                message: 'אימייל או סיסמה לא נכונים',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Update last login
        await user.updateLastLogin();
        
        // Create token
        const token = createToken(user.id, user.role, user.email);
        
        // Get user public info
        const userInfo = user.getPublicInfo();
        
        res.json({
            success: true,
            message: `ברוך הבא, ${user.fullName}!`,
            token,
            user: {
                ...userInfo,
                roleDisplay: User.getRoleDisplayName(user.role)
            },
            loginTime: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('שגיאה בכניסה:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'אירעה שגיאה בתהליך הכניסה',
            code: 'LOGIN_ERROR'
        });
    }
};

// Register new user (admin only)
const register = async (req, res) => {
    try {
        const { email, password, fullName, phone, role } = req.body;
        
        // Validate required fields
        if (!email || !password || !fullName) {
            return res.status(400).json({
                error: 'נתונים חסרים',
                message: 'נדרש אימייל, סיסמה ושם מלא',
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'אימייל לא תקין',
                message: 'פורמט האימייל לא תקין',
                code: 'INVALID_EMAIL_FORMAT'
            });
        }
        
        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                error: 'סיסמה חלשה',
                message: 'הסיסמה חייבת להכיל לפחות 6 תווים',
                code: 'WEAK_PASSWORD'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            where: { email: email.toLowerCase() } 
        });
        
        if (existingUser) {
            return res.status(409).json({
                error: 'משתמש קיים',
                message: 'משתמש עם אימייל זה כבר קיים במערכת',
                code: 'USER_EXISTS'
            });
        }
        
        // Validate role
        const validRoles = ['admin', 'owner', 'tenant'];
        const userRole = role || 'tenant';
        
        if (!validRoles.includes(userRole)) {
            return res.status(400).json({
                error: 'תפקיד לא תקין',
                message: 'תפקיד המשתמש לא תקין',
                code: 'INVALID_ROLE'
            });
        }
        
        // Only admin can create other admins
        if (userRole === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'אין הרשאה',
                message: 'רק מנהל מערכת יכול ליצור מנהלים נוספים',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        // Create new user
        const newUser = await User.createUser({
            email: email.toLowerCase(),
            password,
            fullName,
            phone: phone || null,
            role: userRole
        });
        
        res.status(201).json({
            success: true,
            message: `משתמש ${User.getRoleDisplayName(userRole)} נוצר בהצלחה`,
            user: {
                ...newUser,
                roleDisplay: User.getRoleDisplayName(userRole)
            }
        });
        
    } catch (error) {
        console.error('שגיאה ברישום משתמש:', error);
        
        // Handle unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                error: 'משתמש קיים',
                message: 'משתמש עם אימייל זה כבר קיים במערכת',
                code: 'USER_EXISTS'
            });
        }
        
        res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'אירעה שגיאה ביצירת המשתמש',
            code: 'REGISTRATION_ERROR'
        });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                error: 'משתמש לא נמצא',
                code: 'USER_NOT_FOUND'
            });
        }
        
        const userInfo = user.getPublicInfo();
        
        res.json({
            success: true,
            user: {
                ...userInfo,
                roleDisplay: User.getRoleDisplayName(user.role)
            }
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת פרופיל:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'PROFILE_ERROR'
        });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const { fullName, phone, currentPassword, newPassword } = req.body;
        
        const user = await User.findByPk(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                error: 'משתמש לא נמצא',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Update basic info
        if (fullName) {
            user.fullName = fullName;
        }
        
        if (phone !== undefined) {
            user.phone = phone;
        }
        
        // Handle password change
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    error: 'נדרשת סיסמה נוכחית',
                    message: 'כדי לשנות סיסמה, נדרש לספק את הסיסמה הנוכחית',
                    code: 'CURRENT_PASSWORD_REQUIRED'
                });
            }
            
            const isValidCurrentPassword = await user.validatePassword(currentPassword);
            
            if (!isValidCurrentPassword) {
                return res.status(401).json({
                    error: 'סיסמה נוכחית שגויה',
                    code: 'INVALID_CURRENT_PASSWORD'
                });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({
                    error: 'סיסמה חלשה',
                    message: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים',
                    code: 'WEAK_PASSWORD'
                });
            }
            
            user.password = newPassword;
        }
        
        await user.save();
        
        const userInfo = user.getPublicInfo();
        
        res.json({
            success: true,
            message: 'הפרופיל עודכן בהצלחה',
            user: {
                ...userInfo,
                roleDisplay: User.getRoleDisplayName(user.role)
            }
        });
        
    } catch (error) {
        console.error('שגיאה בעדכון פרופיל:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'UPDATE_PROFILE_ERROR'
        });
    }
};

// Refresh token
const refreshToken = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        
        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'משתמש לא פעיל',
                code: 'USER_INACTIVE'
            });
        }
        
        // Create new token
        const newToken = createToken(user.id, user.role, user.email);
        
        res.json({
            success: true,
            token: newToken,
            message: 'טוקן חודש בהצלחה'
        });
        
    } catch (error) {
        console.error('שגיאה בחידוש טוקן:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'REFRESH_TOKEN_ERROR'
        });
    }
};

// Logout (mainly for logging purposes)
const logout = async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'התנתקת בהצלחה',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('שגיאה בהתנתקות:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'LOGOUT_ERROR'
        });
    }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;
        const offset = (page - 1) * limit;
        
        const where = {};
        
        // Filter by role
        if (role && ['admin', 'owner', 'tenant'].includes(role)) {
            where.role = role;
        }
        
        // Search in name or email
        if (search) {
            const { Op } = require('sequelize');
            where[Op.or] = [
                { fullName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        const { count, rows: users } = await User.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']],
            attributes: { exclude: ['password'] }
        });
        
        const usersWithRoleDisplay = users.map(user => ({
            ...user.toJSON(),
            roleDisplay: User.getRoleDisplayName(user.role)
        }));
        
        res.json({
            success: true,
            users: usersWithRoleDisplay,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalUsers: count,
                usersPerPage: parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('שגיאה בקבלת רשימת משתמשים:', error);
        res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'GET_USERS_ERROR'
        });
    }
};

module.exports = {
    login,
    register,
    getProfile,
    updateProfile,
    refreshToken,
    logout,
    getAllUsers
};