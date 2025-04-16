const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// التأكد من وجود مجلد للإختبار
const uploadsDir = path.join(__dirname, '../uploads');
const testDir = path.join(uploadsDir, 'test');

if (!fs.existsSync(testDir)) {
  console.log('إنشاء مجلد uploads/test لاختبار تحميل الصور');
  fs.mkdirSync(testDir, { recursive: true });
}

// إعداد multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('وجهة تخزين ملف الاختبار:', testDir);
    cb(null, testDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    console.log('اسم ملف الاختبار المنشأ:', uniqueFilename);
    cb(null, uniqueFilename);
  }
});

const fileFilter = function (req, file, cb) {
  console.log('معالجة ملف اختبار:', file);
  
  const filetypes = /jpeg|jpg|png|gif/;
  
  // الصيغة المستلمة
  const mimetype = file.mimetype;
  console.log('نوع MIME المستلم:', mimetype);
  
  // التحقق من امتداد الملف
  let extname = '';
  if (file.originalname) {
    extname = path.extname(file.originalname).toLowerCase();
    console.log('امتداد الملف:', extname);
  }
  
  // التحقق من صحة نوع الملف
  const isValidMimetype = filetypes.test(mimetype);
  const isValidExt = extname ? filetypes.test(extname) : true;
  
  console.log('هل نوع MIME صالح:', isValidMimetype);
  console.log('هل الامتداد صالح:', isValidExt);
  
  if (isValidMimetype && isValidExt) {
    return cb(null, true);
  }
  
  console.error('نوع الملف غير مدعوم:', mimetype, extname);
  cb(new Error('يسمح فقط بتحميل الصور (jpeg، jpg، png، gif)'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// تعديل معالج اختبار تحميل الصور
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    console.log('بدء اختبار تحميل الصور');
    console.log('بيانات الطلب:', req.body);
    console.log('الملف المرفق:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم تحميل أي ملف' });
    }
    
    const imagePath = `/uploads/test/${req.file.filename}`;
    
    // التحقق من وجود الملف فعليًا
    const fullImagePath = path.join(__dirname, '..', imagePath);
    const fileExists = fs.existsSync(fullImagePath);
    console.log(`هل ملف الاختبار موجود: ${fileExists}, الحجم: ${
      fileExists ? fs.statSync(fullImagePath).size : 0
    } بايت`);
    
    // إرجاع معلومات مفصلة عن الملف
    res.json({
      success: true,
      message: 'تم تحميل الصورة بنجاح',
      file: {
        filename: req.file.filename,
        path: imagePath,
        size: req.file.size,
        mimetype: req.file.mimetype,
        fullUrl: `${req.protocol}://${req.get('host')}${imagePath}`
      }
    });
  } catch (err) {
    console.error('خطأ في اختبار تحميل الصورة:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم', error: err.message });
  }
});

module.exports = router;