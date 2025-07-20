const { Sequelize } = require('sequelize');
require('dotenv').config();

// יצירת חיבור לבסיס הנתונים
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            charset: 'utf8',
            collate: 'utf8_unicode_ci',
            timestamps: true,
            underscored: false
        }
    }
);

// בדיקת חיבור לבסיס הנתונים
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ החיבור לבסיס הנתונים הצליח!');
        console.log(`📊 מחובר לבסיס: ${process.env.DB_NAME}`);
        console.log(`🏠 שרת: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        return true;
    } catch (error) {
        console.error('❌ שגיאה בחיבור לבסיס הנתונים:', error.message);
        console.error('🔧 בדוק את ההגדרות בקובץ .env');
        return false;
    }
};

// סנכרון בסיס הנתונים
const syncDatabase = async () => {
    try {
        await sequelize.sync({ force: false });
        console.log('🔄 סנכרון בסיס הנתונים הושלם בהצלחה');
    } catch (error) {
        console.error('❌ שגיאה בסנכרון בסיס הנתונים:', error.message);
    }
};

module.exports = {
    sequelize,
    testConnection,
    syncDatabase
};