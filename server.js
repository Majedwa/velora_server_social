const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// التأكد من وجود جميع مجلدات التحميل
const requiredDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/profiles'),
  path.join(__dirname, 'uploads/posts'),
  path.join(__dirname, 'uploads/test')
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`إنشاء مجلد ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log(`المجلد موجود: ${dir}`);
  }
});

// إنشاء صورة افتراضية إذا لم تكن موجودة
const defaultProfilePath = path.join(__dirname, 'uploads/profiles/default-profile.jpg');
if (!fs.existsSync(defaultProfilePath)) {
  console.log('إنشاء صورة الملف الشخصي الافتراضية');
  
  // نسخ صورة افتراضية من مصدر آخر أو إنشاء ملف تعبئة
  try {
    // إنشاء ملف صورة فارغ بسيط
    fs.writeFileSync(defaultProfilePath, '');
    console.log('تم إنشاء ملف صورة افتراضية');
  } catch (e) {
    console.log('فشل في إنشاء الصورة الافتراضية:', e);
  }
}

// الاتصال بقاعدة البيانات
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ extended: false }));

// إضافة معلومات تشخيصية للطلبات
app.use((req, res, next) => {
  // طباعة معلومات الطلب للتشخيص
  console.log(`${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Headers:', req.headers);
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      console.log('Multipart request detected');
    }
  }
  next();
});

// مسار اختبار بسيط
app.get('/', (req, res) => {
  res.send('API Running');
});

// خدمة الملفات الساكنة - تأكد من توفر مسار كامل
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// المسارات الأساسية
app.use('/api/users', require('./routes/users'));
app.use('/api/profiles', require('./routes/profiles'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/test-upload', require('./routes/image-test'));

// معلومات عن الخادم - مفيد للتشخيص
app.get('/api/server-info', (req, res) => {
  const serverInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    directories: {
      uploads: fs.existsSync(uploadsDir),
      profiles: fs.existsSync(profilesDir),
      posts: fs.existsSync(postsDir),
      test: fs.existsSync(path.join(uploadsDir, 'test')),
    },
    files: {
      defaultProfile: fs.existsSync(defaultProfilePath),
      defaultProfileSize: fs.existsSync(defaultProfilePath) ? fs.statSync(defaultProfilePath).size : 0
    },
    baseUrl: `${req.protocol}://${req.get('host')}`,
    endpoints: {
      api: `${req.protocol}://${req.get('host')}/api`,
      uploads: `${req.protocol}://${req.get('host')}/uploads`,
      uploadTest: `${req.protocol}://${req.get('host')}/api/test-upload`
    }
  };
  
  res.json(serverInfo);
});

// Middleware للتعامل مع الأخطاء
app.use((err, req, res, next) => {
  console.error('خطأ عام:', err.message);
  if (err.name === 'MulterError') {
    return res.status(400).json({
      msg: `خطأ في تحميل الملف: ${err.message}`,
      details: err.code
    });
  } 
  
  if (err) {
    return res.status(500).json({
      msg: 'حدث خطأ في الخادم',
      error: err.message
    });
  }
  
  next();
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
  console.log(`API URL: http://localhost:${PORT}/api`);
  console.log(`Uploads URL: http://localhost:${PORT}/uploads`);
  console.log(`Default profile image: ${fs.existsSync(defaultProfilePath) ? 'exists' : 'missing'}`);
  console.log(`===========================================`);
});