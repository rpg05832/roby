const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Create JWT token
const createToken = (userId, role, email) => {
    const payload = {
        userId,
        role,
        email,
        timestamp: new Date().toISOString()
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '24h',
        issuer: 'robyhom-crm',
        audience: 'robyhom-users'
    });
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET, {
            issuer: 'robyhom-crm',
            audience: 'robyhom-users'
        });
    } catch (error) {
        return null;
    }
};

// Authentication middleware
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                error: 'נדרש אימות',
                message: 'לא סופק טוקן אימות',
                code: 'NO_TOKEN'
            });
        }
        
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;
        
        // Verify token
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                error: 'טוקן לא תקין',
                message: 'הטוקן פג תוקף או לא תקין',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Get user from database
        const user = await User.findByPk(decoded.userId);
        
        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'משתמש לא קיים',
                message: 'המשתמש לא נמצא או לא פעיל',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Add user info to request
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            phone: user.phone,
            isActive: user.isActive,
            lastLogin: user.lastLogin
        };
        
        next();
        
    } catch (error) {
        console.error('שגיאה במידלוואר אימות:', error);
        return res.status(500).json({
            error: 'שגיאה פנימית',
            message: 'שגיאה בתהליך האימות',
            code: 'AUTH_ERROR'
        });
    }
};

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'נדרש אימות',
                message: 'לא בוצע אימות משתמש',
                code: 'NOT_AUTHENTICATED'
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'אין הרשאה',
                message: `נדרשת הרשאת ${allowedRoles.map(role => User.getRoleDisplayName(role)).join(' או ')}`,
                code: 'INSUFFICIENT_PERMISSIONS',
                userRole: User.getRoleDisplayName(req.user.role),
                requiredRoles: allowedRoles.map(role => User.getRoleDisplayName(role))
            });
        }
        
        next();
    };
};

// Owner access control - user can only access their own properties
const authorizeOwnerAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'נדרש אימות',
                code: 'NOT_AUTHENTICATED'
            });
        }
        
        // Admin can access everything
        if (req.user.role === 'admin') {
            return next();
        }
        
        // For property owners, check if they own the property
        if (req.user.role === 'owner') {
            const propertyId = req.params.propertyId || req.body.propertyId || req.query.propertyId;
            
            if (propertyId) {
                const { Property } = require('../models');
                const property = await Property.findByPk(propertyId);
                
                if (!property || property.ownerId !== req.user.id) {
                    return res.status(403).json({
                        error: 'אין הרשאה',
                        message: 'אין לך הרשאה לגשת לנכס זה',
                        code: 'NOT_PROPERTY_OWNER'
                    });
                }
            }
        }
        
        next();
        
    } catch (error) {
        console.error('שגיאה בבדיקת הרשאות בעלי נכסים:', error);
        return res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'AUTHORIZATION_ERROR'
        });
    }
};

// Tenant access control - user can only access their own bookings
const authorizeTenantAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'נדרש אימות',
                code: 'NOT_AUTHENTICATED'
            });
        }
        
        // Admin can access everything
        if (req.user.role === 'admin') {
            return next();
        }
        
        // For tenants, check if they own the booking
        if (req.user.role === 'tenant') {
            const bookingId = req.params.bookingId || req.body.bookingId || req.query.bookingId;
            
            if (bookingId) {
                const { Booking } = require('../models');
                const booking = await Booking.findByPk(bookingId);
                
                if (!booking || booking.tenantId !== req.user.id) {
                    return res.status(403).json({
                        error: 'אין הרשאה',
                        message: 'אין לך הרשאה לגשת להזמנה זו',
                        code: 'NOT_BOOKING_OWNER'
                    });
                }
            }
        }
        
        next();
        
    } catch (error) {
        console.error('שגיאה בבדיקת הרשאות שוכרים:', error);
        return res.status(500).json({
            error: 'שגיאה פנימית',
            code: 'AUTHORIZATION_ERROR'
        });
    }
};

// Optional authentication - for public endpoints that can benefit from user info
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
            const token = authHeader.startsWith('Bearer ') 
                ? authHeader.slice(7) 
                : authHeader;
            
            const decoded = verifyToken(token);
            
            if (decoded) {
                const user = await User.findByPk(decoded.userId);
                
                if (user && user.isActive) {
                    req.user = {
                        id: user.id,
                        email: user.email,
                        fullName: user.fullName,
                        role: user.role,
                        phone: user.phone,
                        isActive: user.isActive,
                        lastLogin: user.lastLogin
                    };
                }
            }
        }
        
        next();
        
    } catch (error) {
        // Silent fail for optional auth
        next();
    }
};

// Rate limiting middleware for login attempts
const loginRateLimit = new Map();

const rateLimitLogin = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;
    
    if (!loginRateLimit.has(ip)) {
        loginRateLimit.set(ip, { attempts: 1, firstAttempt: now });
        return next();
    }
    
    const record = loginRateLimit.get(ip);
    
    // Reset if window has passed
    if (now - record.firstAttempt > windowMs) {
        loginRateLimit.set(ip, { attempts: 1, firstAttempt: now });
        return next();
    }
    
    // Check if limit exceeded
    if (record.attempts >= maxAttempts) {
        return res.status(429).json({
            error: 'יותר מדי ניסיונות כניסה',
            message: `נחסמת למשך 15 דקות בעקבות ${maxAttempts} ניסיונות כניסה כושלים`,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((windowMs - (now - record.firstAttempt)) / 1000)
        });
    }
    
    // Increment attempts
    record.attempts++;
    
    next();
};

module.exports = {
    createToken,
    verifyToken,
    authenticate,
    authorize,
    authorizeOwnerAccess,
    authorizeTenantAccess,
    optionalAuth,
    rateLimitLogin
};