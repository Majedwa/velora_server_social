const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// التأكد من وجود مجلد لصور الملفات الشخصية
const uploadsDir = path.join(__dirname, '../uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
if (!fs.existsSync(profilesDir)) {
  console.log('إنشاء مجلد uploads/profiles من profiles.js');
  fs.mkdirSync(profilesDir, { recursive: true });
}

// إعداد multer لتحميل الصور مع أسماء فريدة
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('وجهة تخزين صورة الملف الشخصي:', profilesDir);
    cb(null, profilesDir);
  },
  filename: function (req, file, cb) {
    // إنشاء اسم فريد للملف باستخدام uuid
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    console.log('اسم ملف صورة الملف الشخصي المنشأ:', uniqueFilename);
    cb(null, uniqueFilename);
  }
});

// تحقق من نوع الملف
const fileFilter = function (req, file, cb) {
  console.log('معالجة ملف صورة الملف الشخصي:', file);
  
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB كحد أقصى
  fileFilter: fileFilter
});

// تعديل معالج تحديث الملف الشخصي
router.put('/', auth, upload.single('profilePicture'), async (req, res) => {
  const { bio } = req.body;
  
  try {
    console.log('بدء تحديث الملف الشخصي');
    console.log('بيانات الطلب:', req.body);
    console.log('الملف المرفق:', req.file);
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    // تحديث النبذة الشخصية
    if (bio !== undefined) {
      user.bio = bio;
    }
    
    // تحديث صورة الملف الشخصي إذا تم تحميلها
    if (req.file) {
      // إزالة الصورة القديمة إذا لم تكن الصورة الافتراضية
      if (user.profilePicture && user.profilePicture !== 'default-profile.jpg' && user.profilePicture.includes('/uploads/')) {
        try {
          const oldImagePath = path.join(__dirname, '..', user.profilePicture);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log(`تم حذف الصورة القديمة: ${oldImagePath}`);
          }
        } catch (err) {
          console.error('خطأ في حذف الصورة القديمة:', err);
          // نستمر بالرغم من خطأ حذف الصورة القديمة
        }
      }
      
      // تحديث مسار الصورة الجديدة
      const profilePicturePath = `/uploads/profiles/${req.file.filename}`;
      user.profilePicture = profilePicturePath;
      console.log(`تم تحديث صورة المستخدم إلى: ${profilePicturePath}`);
      
      // التحقق من وجود الملف فعليًا
      const fullImagePath = path.join(__dirname, '..', profilePicturePath);
      const fileExists = fs.existsSync(fullImagePath);
      console.log(`هل ملف الصورة الجديدة موجود: ${fileExists}, الحجم: ${
        fileExists ? fs.statSync(fullImagePath).size : 0
      } بايت`);
    }
    
    await user.save();
    res.json(user);
  } catch (err) {
    console.error('خطأ في تحديث الملف الشخصي:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/profiles/me
// @desc    الحصول على الملف الشخصي للمستخدم الحالي
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('خطأ في جلب الملف الشخصي:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم' });
  }
});

// @route   PUT api/profiles/follow/:id
// @desc    متابعة مستخدم
// @access  Private
router.put('/follow/:id', auth, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ msg: 'لا يمكنك متابعة نفسك' });
    }
    
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    
    if (!userToFollow) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    // التحقق إذا كان يتابع بالفعل
    if (currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ msg: 'أنت بالفعل تتابع هذا المستخدم' });
    }
    
    // إضافة إلى قائمة المتابعة
    currentUser.following.push(req.params.id);
    await currentUser.save();
    
    // إضافة إلى قائمة المتابعين
    userToFollow.followers.push(req.user.id);
    await userToFollow.save();
    
    res.json({ 
      msg: 'تمت متابعة المستخدم بنجاح',
      followers: userToFollow.followers,
      following: currentUser.following
    });
  } catch (err) {
    console.error('خطأ في متابعة المستخدم:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم' });
  }
});

// @route   PUT api/profiles/unfollow/:id
// @desc    إلغاء متابعة مستخدم
// @access  Private
router.put('/unfollow/:id', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const userToUnfollow = await User.findById(req.params.id);
    
    if (!userToUnfollow) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    // التحقق إذا كان يتابع
    if (!currentUser.following.includes(req.params.id)) {
      return res.status(400).json({ msg: 'أنت لا تتابع هذا المستخدم' });
    }
    
    // إزالة من قائمة المتابعة
    currentUser.following = currentUser.following.filter(
      userId => userId.toString() !== req.params.id
    );
    await currentUser.save();
    
    // إزالة من قائمة المتابعين
    userToUnfollow.followers = userToUnfollow.followers.filter(
      userId => userId.toString() !== req.user.id
    );
    await userToUnfollow.save();
    
    res.json({ 
      msg: 'تم إلغاء متابعة المستخدم بنجاح',
      followers: userToUnfollow.followers,
      following: currentUser.following
    });
  } catch (err) {
    console.error('خطأ في إلغاء متابعة المستخدم:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم' });
  }
});

// @route   GET api/profiles/:id
// @desc    الحصول على ملف شخصي لمستخدم محدد
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('خطأ في جلب الملف الشخصي:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم' });
  }
});

module.exports = router;