import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// נייבא את React Router
const { BrowserRouter: Router, Routes, Route, useNavigate, useLocation } = require('react-router-dom');

// דף עריכת נכס
const EditPropertyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // קבלת ID מה-URL
  const propertyId = location.pathname.split('/')[3];
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    propertyType: 'short_term',
    rooms: '',
    bedrooms: '',
    bathrooms: '',
    basePrice: '',
    description: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // טעינת נתוני הנכס
  useEffect(() => {
    if (propertyId) {
      loadProperty();
    }
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/properties/${propertyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const property = data.property;
        
        setFormData({
          name: property.name || '',
          address: property.address || '',
          propertyType: property.propertyType || 'short_term',
          rooms: property.rooms || '',
          bedrooms: property.bedrooms || '',
          bathrooms: property.bathrooms || '',
          basePrice: property.basePrice || '',
          description: property.description || ''
        });
      } else {
        setError('שגיאה בטעינת נתוני הנכס');
      }
    } catch (error) {
      setError('שגיאה בחיבור לשרת');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('הנכס עודכן בהצלחה!');
        navigate('/properties');
      } else {
        const errorData = await response.json();
        setError('שגיאה בעדכון נכס: ' + (errorData.message || 'שגיאה לא ידועה'));
      }
    } catch (error) {
      setError('שגיאה בחיבור לשרת');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>טוען נתוני נכס...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>✏️ עריכת נכס</h1>
        <button className="btn-secondary" onClick={() => navigate('/properties')}>
          ← חזור לרשימה
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="property-form">
        <div className="form-row">
          <div className="form-group">
            <label>שם הנכס *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="דירה 3 חדרים בתל אביב"
              required
            />
          </div>
          
          <div className="form-group">
            <label>סוג הנכס *</label>
            <select
              value={formData.propertyType}
              onChange={(e) => setFormData({...formData, propertyType: e.target.value})}
              required
            >
              <option value="short_term">טווח קצר</option>
              <option value="long_term">טווח ארוך</option>
              <option value="maintenance">תחזוקה</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>כתובת *</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="רחוב הרצל 123, תל אביב"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>מספר חדרים</label>
            <input
              type="number"
              value={formData.rooms}
              onChange={(e) => setFormData({...formData, rooms: e.target.value})}
              placeholder="3"
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label>חדרי שינה</label>
            <input
              type="number"
              value={formData.bedrooms}
              onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
              placeholder="2"
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label>חדרי רחצה</label>
            <input
              type="number"
              value={formData.bathrooms}
              onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
              placeholder="1"
              min="1"
            />
          </div>
        </div>

        {formData.propertyType === 'short_term' && (
          <div className="form-group">
            <label>מחיר בסיס ללילה (₪)</label>
            <input
              type="number"
              value={formData.basePrice}
              onChange={(e) => setFormData({...formData, basePrice: e.target.value})}
              placeholder="300"
              min="1"
            />
          </div>
        )}

        <div className="form-group">
          <label>תיאור</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="תיאור הנכס, מיקום, תכונות מיוחדות..."
            rows="4"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'שומר...' : 'עדכן נכס'}
          </button>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => navigate('/properties')}
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
};

// דף צפייה מפורטת בנכס
const ViewPropertyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const propertyId = location.pathname.split('/')[3];
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propertyId) {
      loadProperty();
    }
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/properties/${propertyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProperty(data.property);
      } else {
        console.error('שגיאה בטעינת נכס');
      }
    } catch (error) {
      console.error('שגיאה בחיבור לשרת:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>טוען פרטי נכס...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-icon">🏠</div>
          <h3>נכס לא נמצא</h3>
          <button className="btn-primary" onClick={() => navigate('/properties')}>
            חזור לרשימה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>👁️ פרטי נכס</h1>
        <div className="header-actions">
          <button 
            className="btn-primary" 
            onClick={() => navigate(`/properties/edit/${property.id}`)}
          >
            ✏️ ערוך נכס
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => navigate('/properties')}
          >
            ← חזור לרשימה
          </button>
        </div>
      </div>

      <div className="property-details-view">
        <div className="property-header-view">
          <h2>{property.name}</h2>
          <span className={`property-type ${property.propertyType}`}>
            {property.propertyType === 'maintenance' ? 'תחזוקה' :
             property.propertyType === 'short_term' ? 'טווח קצר' : 'טווח ארוך'}
          </span>
        </div>

        <div className="property-info-grid">
          <div className="info-section">
            <h3>📍 מידע כללי</h3>
            <p><strong>כתובת:</strong> {property.address}</p>
            <p><strong>חדרים:</strong> {property.rooms || 'לא צוין'}</p>
            <p><strong>חדרי שינה:</strong> {property.bedrooms || 'לא צוין'}</p>
            <p><strong>חדרי רחצה:</strong> {property.bathrooms || 'לא צוין'}</p>
            {property.basePrice && (
              <p><strong>מחיר בסיס:</strong> ₪{property.basePrice}</p>
            )}
          </div>

          {property.description && (
            <div className="info-section">
              <h3>📄 תיאור</h3>
              <p>{property.description}</p>
            </div>
          )}

          {property.owner && (
            <div className="info-section">
              <h3>👤 בעל הנכס</h3>
              <p><strong>שם:</strong> {property.owner.fullName || 'לא צוין'}</p>
              <p><strong>מייל:</strong> {property.owner.email}</p>
              {property.owner.phone && (
                <p><strong>טלפון:</strong> {property.owner.phone}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// מודל מחיקה
const DeleteConfirmModal = ({ isOpen, property, onConfirm, onCancel, isDeleting }) => {
  if (!isOpen || !property) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🗑️ מחיקת נכס</h3>
        </div>
        <div className="modal-body">
          <p>האם אתה בטוח שברצונך למחוק את הנכס:</p>
          <p><strong>"{property.name}"</strong></p>
          <p><strong>⚠️ פעולה זו אינה הפיכה!</strong></p>
        </div>
        <div className="modal-actions">
          <button 
            className="modal-btn danger" 
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'מוחק...' : 'כן, מחק נכס'}
          </button>
          <button 
            className="modal-btn secondary" 
            onClick={onCancel}
            disabled={isDeleting}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

// דף ניהול נכסים מעודכן
const PropertiesPage = () => {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // טעינת נכסים מהשרת
  useEffect(() => {
    loadProperties();
  }, []);

  // סינון נכסים
  useEffect(() => {
    let filtered = properties;

    // סינון לפי טקסט חיפוש
    if (searchTerm) {
      filtered = filtered.filter(property => 
        property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // סינון לפי סוג נכס
    if (filterType !== 'all') {
      filtered = filtered.filter(property => property.propertyType === filterType);
    }

    setFilteredProperties(filtered);
  }, [properties, searchTerm, filterType]);

  const loadProperties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/properties', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      } else {
        console.error('שגיאה בטעינת נכסים');
      }
    } catch (error) {
      console.error('שגיאה בחיבור לשרת:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;

    setIsDeleting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/properties/${propertyToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('הנכס נמחק בהצלחה!');
        setShowDeleteModal(false);
        setPropertyToDelete(null);
        loadProperties(); // רענן רשימה
      } else {
        const errorData = await response.json();
        alert('שגיאה במחיקת נכס: ' + (errorData.message || 'שגיאה לא ידועה'));
      }
    } catch (error) {
      alert('שגיאה בחיבור לשרת');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (property) => {
    setPropertyToDelete(property);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setPropertyToDelete(null);
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>טוען נכסים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>🏠 ניהול נכסים</h1>
        <button className="btn-primary" onClick={() => navigate('/properties/add')}>
          ➕ הוסף נכס חדש
        </button>
      </div>

      {/* פילטרים וחיפוש */}
      <div className="filters-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="🔍 חפש נכס לפי שם או כתובת..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-container">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">כל הנכסים</option>
            <option value="short_term">טווח קצר</option>
            <option value="long_term">טווח ארוך</option>
            <option value="maintenance">תחזוקה</option>
          </select>
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-number">{properties.length}</span>
          <span className="stat-label">סה"כ נכסים</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">
            {properties.filter(p => p.propertyType === 'short_term').length}
          </span>
          <span className="stat-label">טווח קצר</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">
            {properties.filter(p => p.propertyType === 'long_term').length}
          </span>
          <span className="stat-label">טווח ארוך</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">
            {properties.filter(p => p.propertyType === 'maintenance').length}
          </span>
          <span className="stat-label">תחזוקה</span>
        </div>
      </div>

      {filteredProperties.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏠</div>
          <h3>
            {searchTerm || filterType !== 'all' 
              ? 'לא נמצאו נכסים המתאימים לחיפוש' 
              : 'אין נכסים במערכת'
            }
          </h3>
          <p>
            {searchTerm || filterType !== 'all'
              ? 'נסה לשנות את פרמטרי החיפוש'
              : 'התחל בהוספת הנכס הראשון שלך'
            }
          </p>
          {(!searchTerm && filterType === 'all') && (
            <button className="btn-primary" onClick={() => navigate('/properties/add')}>
              הוסף נכס ראשון
            </button>
          )}
        </div>
      ) : (
        <div className="properties-grid">
          {filteredProperties.map(property => (
            <div key={property.id} className="property-card">
              <div className="property-header">
                <h3>{property.name}</h3>
                <span className={`property-type ${property.propertyType}`}>
                  {property.propertyType === 'maintenance' ? 'תחזוקה' :
                   property.propertyType === 'short_term' ? 'טווח קצר' : 'טווח ארוך'}
                </span>
              </div>
              
              <div className="property-details">
                <p><strong>כתובת:</strong> {property.address}</p>
                <p><strong>חדרים:</strong> {property.rooms || 'לא צוין'}</p>
                <p><strong>חדרי שינה:</strong> {property.bedrooms || 'לא צוין'}</p>
                {property.basePrice && (
                  <p><strong>מחיר בסיס:</strong> ₪{property.basePrice}</p>
                )}
              </div>

              <div className="property-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => navigate(`/properties/edit/${property.id}`)}
                >
                  ✏️ ערוך
                </button>
                <button 
                  className="btn-outline"
                  onClick={() => navigate(`/properties/view/${property.id}`)}
                >
                  👁️ צפה
                </button>
                <button 
                  className="btn-danger"
                  onClick={() => openDeleteModal(property)}
                >
                  🗑️ מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* מודל מחיקה */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        property={propertyToDelete}
        onConfirm={handleDeleteProperty}
        onCancel={closeDeleteModal}
        isDeleting={isDeleting}
      />
    </div>
  );
};

// דף הוספת נכס (זהה לקודם)
const AddPropertyPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    propertyType: 'short_term',
    rooms: '',
    bedrooms: '',
    bathrooms: '',
    basePrice: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/properties', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('הנכס נוסף בהצלחה!');
        navigate('/properties');
      } else {
        const error = await response.json();
        alert('שגיאה בהוספת נכס: ' + (error.message || 'שגיאה לא ידועה'));
      }
    } catch (error) {
      alert('שגיאה בחיבור לשרת');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>➕ הוספת נכס חדש</h1>
        <button className="btn-secondary" onClick={() => navigate('/properties')}>
          ← חזור לרשימה
        </button>
      </div>

      <form onSubmit={handleSubmit} className="property-form">
        <div className="form-row">
          <div className="form-group">
            <label>שם הנכס *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="דירה 3 חדרים בתל אביב"
              required
            />
          </div>
          
          <div className="form-group">
            <label>סוג הנכס *</label>
            <select
              value={formData.propertyType}
              onChange={(e) => setFormData({...formData, propertyType: e.target.value})}
              required
            >
              <option value="short_term">טווח קצר</option>
              <option value="long_term">טווח ארוך</option>
              <option value="maintenance">תחזוקה</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>כתובת *</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            placeholder="רחוב הרצל 123, תל אביב"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>מספר חדרים</label>
            <input
              type="number"
              value={formData.rooms}
              onChange={(e) => setFormData({...formData, rooms: e.target.value})}
              placeholder="3"
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label>חדרי שינה</label>
            <input
              type="number"
              value={formData.bedrooms}
              onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
              placeholder="2"
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label>חדרי רחצה</label>
            <input
              type="number"
              value={formData.bathrooms}
              onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
              placeholder="1"
              min="1"
            />
          </div>
        </div>

        {formData.propertyType === 'short_term' && (
          <div className="form-group">
            <label>מחיר בסיס ללילה (₪)</label>
            <input
              type="number"
              value={formData.basePrice}
              onChange={(e) => setFormData({...formData, basePrice: e.target.value})}
              placeholder="300"
              min="1"
            />
          </div>
        )}

        <div className="form-group">
          <label>תיאור</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="תיאור הנכס, מיקום, תכונות מיוחדות..."
            rows="4"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'שומר...' : 'שמור נכס'}
          </button>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={() => navigate('/properties')}
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
};

// דשבורד עם ניווט (זהה לקודם)
const Dashboard = ({ userInfo, onLogout, onNavigate }) => {
  return (
    <div className="dashboard-main">
      <div className="welcome-section">
        <h2>ברוכים הבאים למערכת ניהול הנכסים</h2>
        <p>תפקיד: {userInfo?.role === 'admin' ? 'מנהל מערכת' : 
                    userInfo?.role === 'owner' ? 'בעל נכס' : 'שוכר'}</p>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>📊 סטטיסטיקות</h3>
            <p>נכסים, הזמנות ותשלומים</p>
            <button className="card-btn" onClick={() => onNavigate('/stats')}>
              צפה בדוחות
            </button>
          </div>
          
          <div className="stat-card">
            <h3>🏠 נכסים</h3>
            <p>ניהול הנכסים שלך</p>
            <button className="card-btn" onClick={() => onNavigate('/properties')}>
              ניהול נכסים
            </button>
          </div>
          
          <div className="stat-card">
            <h3>📅 הזמנות</h3>
            <p>הזמנות פעילות ועתידיות</p>
            <button className="card-btn" onClick={() => onNavigate('/bookings')}>
              צפה בהזמנות
            </button>
          </div>
          
          <div className="stat-card">
            <h3>💰 תשלומים</h3>
            <p>מעקב אחר יתרות ותשלומים</p>
            <button className="card-btn" onClick={() => onNavigate('/payments')}>
              צפה ביתרה
            </button>
          </div>
          
          <div className="stat-card">
            <h3>📄 מסמכים</h3>
            <p>העלאה וניהול מסמכים</p>
            <button className="card-btn" onClick={() => onNavigate('/documents')}>
              ניהול מסמכים
            </button>
          </div>
          
          <div className="stat-card">
            <h3>📈 דוחות</h3>
            <p>דוחות כספיים מפורטים</p>
            <button className="card-btn" onClick={() => onNavigate('/reports')}>
              יצירת דוח
            </button>
          </div>
          
          {userInfo?.role === 'admin' && (
            <div className="stat-card admin-only">
              <h3>👥 משתמשים</h3>
              <p>ניהול משתמשים והרשאות</p>
              <button className="card-btn" onClick={() => onNavigate('/users')}>
                ניהול משתמשים
              </button>
            </div>
          )}
          
          {userInfo?.role === 'admin' && (
            <div className="stat-card admin-only">
              <h3>⚙️ הגדרות מערכת</h3>
              <p>הגדרות כלליות ותצורה</p>
              <button className="card-btn" onClick={() => onNavigate('/settings')}>
                הגדרות מערכת
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// רכיב main עם ניווט
const MainApp = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(null);
  
  // State למודל התראה
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMinutes, setWarningMinutes] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  // הגדרות זמן (בדקות)
  const SESSION_DURATION = 60;
  const REMEMBER_ME_DURATION = 24 * 60;
  const ACTIVITY_CHECK_INTERVAL = 1;
  const WARNING_TIME = 5;

  // [כל הפונקציות של פג תוקף ואימות נשארות אותו דבר כמו קודם]
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
    setSessionTimeLeft(SESSION_DURATION);
    setShowWarningModal(false);
  }, [SESSION_DURATION]);

  const checkSessionExpiry = useCallback(() => {
    const lastActivity = localStorage.getItem('lastActivity');
    const loginTime = localStorage.getItem('loginTime');
    const isRemembered = localStorage.getItem('rememberMe') === 'true';
    
    if (!lastActivity || !loginTime) {
      return false;
    }

    const now = Date.now();
    const timeSinceActivity = (now - parseInt(lastActivity)) / (1000 * 60);
    const timeSinceLogin = (now - parseInt(loginTime)) / (1000 * 60);
    
    if (isRemembered) {
      return timeSinceLogin > REMEMBER_ME_DURATION;
    } else {
      return timeSinceActivity > SESSION_DURATION;
    }
  }, [SESSION_DURATION, REMEMBER_ME_DURATION]);

  const calculateTimeLeft = useCallback(() => {
    const lastActivity = localStorage.getItem('lastActivity');
    const loginTime = localStorage.getItem('loginTime');
    const isRemembered = localStorage.getItem('rememberMe') === 'true';
    
    if (!lastActivity || !loginTime) {
      return 0;
    }

    const now = Date.now();
    
    if (isRemembered) {
      const timeSinceLogin = (now - parseInt(loginTime)) / (1000 * 60);
      return Math.max(0, REMEMBER_ME_DURATION - timeSinceLogin);
    } else {
      const timeSinceActivity = (now - parseInt(lastActivity)) / (1000 * 60);
      return Math.max(0, SESSION_DURATION - timeSinceActivity);
    }
  }, [SESSION_DURATION, REMEMBER_ME_DURATION]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('userInfo');
    
    if (savedToken && savedUser) {
      if (checkSessionExpiry()) {
        handleLogout('תם זמן ההתחברות');
        return;
      }

      try {
        const userData = JSON.parse(savedUser);
        setUserInfo(userData);
        setIsLoggedIn(true);
        updateLastActivity();
        
        verifyToken(savedToken);
      } catch (error) {
        handleLogout('שגיאה בטעינת נתוני משתמש');
      }
    }
  }, [checkSessionExpiry, updateLastActivity]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = setInterval(() => {
      if (checkSessionExpiry()) {
        handleLogout('תם זמן ההתחברות');
        return;
      }

      const timeLeft = calculateTimeLeft();
      setSessionTimeLeft(timeLeft);

      if (timeLeft <= WARNING_TIME && timeLeft > 0 && !showWarningModal) {
        if (!document.hidden) {
          const minutes = Math.ceil(timeLeft);
          if (minutes === WARNING_TIME) {
            setWarningMinutes(minutes);
            setShowWarningModal(true);
          }
        }
      }
    }, ACTIVITY_CHECK_INTERVAL * 60 * 1000);

    return () => clearInterval(interval);
  }, [isLoggedIn, checkSessionExpiry, calculateTimeLeft, updateLastActivity, WARNING_TIME, ACTIVITY_CHECK_INTERVAL, showWarningModal]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const handleActivity = () => {
      updateLastActivity();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [isLoggedIn, updateLastActivity]);

  const verifyToken = async (token) => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        handleLogout('הטוקן אינו תקף בשרת');
      }
    } catch (error) {
      console.log('שגיאה בבדיקת טוקן:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok) {
        const now = Date.now();
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.user));
        localStorage.setItem('loginTime', now.toString());
        localStorage.setItem('lastActivity', now.toString());
        localStorage.setItem('rememberMe', rememberMe.toString());
        
        setUserInfo(data.user);
        setIsLoggedIn(true);
        setSessionTimeLeft(SESSION_DURATION);
        
        // נווט לדשבורד
        navigate('/');
        
      } else {
        setError(data.message || 'שגיאה בהתחברות');
      }
    } catch (error) {
      setError('שגיאה בחיבור לשרת');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = (reason = '') => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('rememberMe');
    
    setIsLoggedIn(false);
    setUserInfo(null);
    setSessionTimeLeft(null);
    setCredentials({ email: '', password: '' });
    setShowWarningModal(false);
    
    if (reason) {
      setError(reason);
    }

    // נווט לדף כניסה
    navigate('/login');
  };

  const handleContinueSession = () => {
    updateLastActivity();
    setShowWarningModal(false);
  };

  const handleEndSession = () => {
    setShowWarningModal(false);
    handleLogout();
  };

  const handleNavigate = (path) => {
    updateLastActivity();
    navigate(path);
  };

  // מודל התראה
  const WarningModal = () => {
    if (!showWarningModal) return null;

    return (
      <div className="modal-overlay" onClick={handleEndSession}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>⏰ התראת זמן</h3>
          </div>
          <div className="modal-body">
            <p>תם זמן ההתחברות בעוד <strong>{warningMinutes} דקות</strong></p>
            <p>האם ברצונך להמשיך לעבוד?</p>
          </div>
          <div className="modal-actions">
            <button className="modal-btn primary" onClick={handleContinueSession}>
              כן, המשך
            </button>
            <button className="modal-btn secondary" onClick={handleEndSession}>
              לא, התנתק
            </button>
          </div>
        </div>
      </div>
    );
  };

  // אם לא מחובר - הצג דף כניסה
  if (!isLoggedIn || location.pathname === '/login') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>🏢 RobyHom CRM</h1>
            <p>מערכת ניהול נכסים מתקדמת</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>כתובת מייל:</label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                placeholder="admin@robyhom.com"
                required
              />
            </div>

            <div className="form-group">
              <label>סיסמה:</label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                placeholder="הקלד סיסמה"
                required
              />
            </div>

            <div className="form-group remember-me">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkmark"></span>
                זכור אותי
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'מתחבר...' : 'התחברות'}
            </button>
          </form>

          <div className="login-footer">
            <p>
              <strong>פרטי גישה לבדיקה:</strong><br/>
              מייל: admin@robyhom.com<br/>
              סיסמה: admin123456
            </p>
          </div>
        </div>
      </div>
    );
  }

  // אם מחובר - הצג layout עם ניווט
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            🏢 RobyHom CRM
          </h1>
          <div className="user-info">
            <span>שלום {userInfo?.fullName}</span>
            <button onClick={() => handleLogout()} className="logout-btn">
              יציאה
            </button>
          </div>
        </div>
      </header>
      
      <main>
        <Routes>
          <Route path="/" element={
            <Dashboard 
              userInfo={userInfo} 
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          } />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/add" element={<AddPropertyPage />} />
          <Route path="/properties/edit/:id" element={<EditPropertyPage />} />
          <Route path="/properties/view/:id" element={<ViewPropertyPage />} />
          {/* נוסיף עוד routes בהמשך */}
        </Routes>
      </main>

      <WarningModal />
    </div>
  );
};

function App() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}

export default App;