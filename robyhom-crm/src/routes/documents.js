const express = require('express');
const { authenticate } = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/upload');
const {
    uploadDocument,
    getDocuments,
    downloadDocument,
    deleteDocument,
    exportOwnerFinancialReportExcel,
    exportOwnerFinancialReportPDF
} = require('../controllers/documentController');

const router = express.Router();

// נתיבי מסמכים
router.post('/upload', authenticate, uploadMiddleware.single('document'), uploadDocument);
router.get('/', authenticate, getDocuments);
router.get('/:id/download', authenticate, downloadDocument);
router.delete('/:id', authenticate, deleteDocument);

// נתיבי יצוא דוחות
router.get('/reports/owner/:ownerId/financial/excel', authenticate, exportOwnerFinancialReportExcel);
router.get('/reports/owner/:ownerId/financial/pdf', authenticate, exportOwnerFinancialReportPDF);

module.exports = router;