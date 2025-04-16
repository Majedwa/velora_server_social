const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET api/users
// @desc    الحصول على جميع المستخدمين
// @access  Public
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error('خطأ في جلب المستخدمين:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   POST api/users/register
// @desc    تسجيل مستخدم جديد
// @access  Public
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    console.log('محاولة تسجيل مستخدم جديد:', username, email);
    
    // التحقق من وجود المستخدم
    let userByEmail = await User.findOne({ email });
    if (userByEmail) {
      return res.status(400).json({ msg: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    
    let userByUsername = await User.findOne({ username });
    if (userByUsername) {
      return res.status(400).json({ msg: 'اسم المستخدم مستخدم بالفعل' });
    }

    // إنشاء مستخدم جديد
    const user = new User({
      username,
      email,
      password,
      profilePicture: '/uploads/profiles/default-profile.jpg' // تعيين صورة افتراضية
    });

    // تشفير كلمة المرور
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // حفظ المستخدم في قاعدة البيانات
    await user.save();
    console.log(`تم إنشاء مستخدم جديد: ${user._id}`);

    // إنشاء توكن JWT
    const payload = {
      user: {
        id: user.id
      }
    };

    // توقيع التوكن
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('خطأ في تسجيل المستخدم:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   POST api/users/login
// @desc    تسجيل الدخول للمستخدم
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('محاولة تسجيل الدخول:', email);
    
    // التحقق من وجود المستخدم
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'بيانات الاعتماد غير صالحة' });
    }

    // مقارنة كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'بيانات الاعتماد غير صالحة' });
    }

    // إنشاء توكن JWT
    const payload = {
      user: {
        id: user.id
      }
    };

    // توقيع التوكن
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        
        // تحويل المستخدم إلى توكن JSON
        console.log(`تسجيل دخول ناجح: ${user._id}`);
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('خطأ في تسجيل الدخول:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/users/me
// @desc    الحصول على بيانات المستخدم الحالي
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    console.log('جلب بيانات المستخدم الحالي:', req.user.id);
    
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    // تحقق من وجود صورة الملف الشخصي
    if (user.profilePicture === 'default-profile.jpg') {
      user.profilePicture = '/uploads/profiles/default-profile.jpg';
    }
    
    console.log('صورة الملف الشخصي للمستخدم:', user.profilePicture);
    res.json(user);
  } catch (err) {
    console.error('خطأ في جلب بيانات المستخدم:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/users/email/:email
// @desc    الحصول على مستخدم عن طريق البريد الإلكتروني
// @access  Public
router.get('/email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    res.json(user);
  } catch (err) {
    console.error('خطأ في جلب المستخدم بالبريد الإلكتروني:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/users/:id
// @desc    الحصول على بيانات مستخدم بواسطة الرقم التعريفي
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    console.log('جلب بيانات المستخدم بالمعرف:', req.params.id);
    
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    console.log('صورة الملف الشخصي للمستخدم المطلوب:', user.profilePicture);
    res.json(user);
  } catch (err) {
    console.error('خطأ في جلب المستخدم بالمعرف:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/users/search/:query
// @desc    البحث عن مستخدمين
// @access  Public
router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    
    if (searchQuery.length < 1) {
      return res.json([]);
    }
    
    console.log('البحث عن مستخدمين:', searchQuery);
    
    // البحث في اسم المستخدم أو البريد الإلكتروني
    const users = await User.find({
      $or: [
        { username: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    }).select('-password').limit(20);
    
    res.json(users);
  } catch (err) {
    console.error('خطأ في البحث عن مستخدمين:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   POST api/users/multiple
// @desc    الحصول على بيانات عدة مستخدمين
// @access  Public
router.post('/multiple', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ msg: 'يجب توفير معرفات المستخدمين' });
    }
    
    console.log('جلب معلومات متعددة للمستخدمين:', userIds.length);
    
    const users = await User.find({
      _id: { $in: userIds }
    }).select('-password');
    
    res.json(users);
  } catch (err) {
    console.error('خطأ في جلب معلومات متعددة للمستخدمين:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

module.exports = router;