const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [6, 100]
        }
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'full_name'
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            is: /^[\d\-\+\(\)\s]+$/
        }
    },
    role: {
        type: DataTypes.ENUM,
        values: ['admin', 'owner', 'tenant'],
        allowNull: false,
        defaultValue: 'tenant'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login'
    },
    profileImage: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'profile_image'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            fields: ['role']
        },
        {
            fields: ['is_active']
        }
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Instance methods
User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

User.prototype.getPublicInfo = function() {
    const { password, ...publicInfo } = this.toJSON();
    return publicInfo;
};

User.prototype.updateLastLogin = async function() {
    this.lastLogin = new Date();
    await this.save({ fields: ['lastLogin'] });
};

// Class methods
User.findByEmail = async function(email) {
    return await this.findOne({ 
        where: { 
            email: email.toLowerCase(),
            isActive: true 
        } 
    });
};

User.createUser = async function(userData) {
    const user = await this.create({
        ...userData,
        email: userData.email.toLowerCase()
    });
    return user.getPublicInfo();
};

User.getRoleDisplayName = function(role) {
    const roleNames = {
        'admin': 'מנהל מערכת',
        'owner': 'בעל נכס',
        'tenant': 'שוכר'
    };
    return roleNames[role] || role;
};

module.exports = User;