const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// التأكد من وجود مجلد uploads ومجلد posts بداخله
const uploadsDir = path.join(__dirname, '../uploads');
const postsDir = path.join(uploadsDir, 'posts');

if (!fs.existsSync(uploadsDir)) {
  console.log('إنشاء مجلد uploads من posts.js');
  fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(postsDir)) {
  console.log('إنشاء مجلد uploads/posts من posts.js');
  fs.mkdirSync(postsDir);
}

// إعداد multer لتخزين الصور في ملفات فريدة
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('وجهة تخزين الملف:', postsDir);
    cb(null, postsDir);
  },
  filename: function (req, file, cb) {
    // إنشاء اسم فريد باستخدام uuid
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    console.log('اسم الملف المنشأ:', uniqueFilename);
    cb(null, uniqueFilename);
  }
});

// فلتر الملفات للتأكد من أنها صور فقط
const fileFilter = function (req, file, cb) {
  console.log('معالجة ملف تم رفعه:', file);
  
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

// @route   POST api/posts
// @desc    إنشاء منشور جديد
// @access  Private
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    console.log('بدء إنشاء منشور جديد');
    console.log('بيانات الطلب:', req.body);
    console.log('الملف المرفق:', req.file);
    
    // التحقق من وجود محتوى
    if (!req.body.content) {
      return res.status(400).json({ msg: 'يجب إدخال محتوى للمنشور' });
    }
    
    const { content } = req.body;
    
    // الحصول على معلومات المستخدم
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ msg: 'المستخدم غير موجود' });
    }
    
    // إنشاء كائن المنشور الجديد
    const newPost = new Post({
      content,
      user: req.user.id,
    });
    
    // إضافة الصورة إذا تم تحميلها
    if (req.file) {
      const imagePath = `/uploads/posts/${req.file.filename}`;
      newPost.image = imagePath;
      console.log(`تم إضافة صورة للمنشور: ${imagePath}`);
      console.log(`مسار الصورة الكامل: ${path.join(__dirname, '..', imagePath)}`);
      
      // التحقق من وجود الملف فعليًا
      const fullImagePath = path.join(__dirname, '..', imagePath);
      const fileExists = fs.existsSync(fullImagePath);
      console.log(`هل الملف موجود: ${fileExists}, الحجم: ${
        fileExists ? fs.statSync(fullImagePath).size : 0
      } بايت`);
    }
    
    // حفظ المنشور في قاعدة البيانات
    const post = await newPost.save();
    console.log(`تم إنشاء منشور جديد: ${post._id}`);
    
    // إعادة الحصول على المنشور مع بيانات المستخدم المرتبط
    const populatedPost = await Post.findById(post._id)
      .populate('user', ['username', 'profilePicture']);
    
    res.json(populatedPost);
  } catch (err) {
    console.error('خطأ في إنشاء منشور:', err);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});


// @route   GET api/posts
// @desc    الحصول على جميع المنشورات
// @access  Public
router.get('/', async (req, res) => {
  try {
    // ترتيب المنشورات بشكل تنازلي حسب تاريخ الإنشاء
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('user', ['username', 'profilePicture'])
      .populate('comments.user', ['username', 'profilePicture']);
    
    res.json(posts);
  } catch (err) {
    console.error('خطأ في جلب المنشورات:', err.message);
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/posts/user/:userId
// @desc    الحصول على منشورات مستخدم محدد
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', ['username', 'profilePicture'])
      .populate('comments.user', ['username', 'profilePicture']);
    
    res.json(posts);
  } catch (err) {
    console.error('خطأ في جلب منشورات المستخدم:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشورات غير موجودة' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   GET api/posts/:id
// @desc    الحصول على منشور محدد
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', ['username', 'profilePicture'])
      .populate('comments.user', ['username', 'profilePicture']);
    
    if (!post) {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    
    res.json(post);
  } catch (err) {
    console.error('خطأ في جلب المنشور:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   DELETE api/posts/:id
// @desc    حذف منشور
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    
    // التحقق من صلاحية المستخدم لحذف المنشور
    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'المستخدم غير مصرح له بحذف هذا المنشور' });
    }
    
    // حذف صورة المنشور إذا وجدت
    if (post.image) {
      try {
        const imagePath = path.join(__dirname, '..', post.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log(`تم حذف صورة المنشور: ${imagePath}`);
        }
      } catch (err) {
        console.error('خطأ في حذف صورة المنشور:', err);
        // نستمر بالرغم من خطأ حذف الصورة
      }
    }
    
    // حذف المنشور
    await post.deleteOne();
    
    res.json({ msg: 'تم حذف المنشور بنجاح' });
  } catch (err) {
    console.error('خطأ في حذف المنشور:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   PUT api/posts/like/:id
// @desc    إضافة إعجاب للمنشور
// @access  Private
router.put('/like/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    
    // التحقق إذا كان المنشور معجب به بالفعل
    if (post.likes.some(like => like.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'تم الإعجاب بالمنشور بالفعل' });
    }
    
    post.likes.unshift(req.user.id);
    
    await post.save();
    
    res.json(post.likes);
  } catch (err) {
    console.error('خطأ في الإعجاب بالمنشور:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   PUT api/posts/unlike/:id
// @desc    إزالة إعجاب من المنشور
// @access  Private
router.put('/unlike/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    
    // التحقق إذا كان المنشور غير معجب به
    if (!post.likes.some(like => like.toString() === req.user.id)) {
      return res.status(400).json({ msg: 'لم يتم الإعجاب بالمنشور بعد' });
    }
    
    // إزالة الإعجاب
    post.likes = post.likes.filter(like => like.toString() !== req.user.id);
    
    await post.save();
    
    res.json(post.likes);
  } catch (err) {
    console.error('خطأ في إلغاء الإعجاب بالمنشور:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   POST api/posts/comment/:id
// @desc    إضافة تعليق على المنشور
// @access  Private
router.post('/comment/:id', auth, async (req, res) => {
  try {
    // التحقق من وجود نص التعليق
    if (!req.body.text) {
      return res.status(400).json({ msg: 'يجب إدخال نص للتعليق' });
    }
    
    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    
    const newComment = {
      text,
      user: req.user.id
    };
    
    post.comments.unshift(newComment);
    
    await post.save();
    
    // الحصول على المنشور مع بيانات المستخدمين
    const populatedPost = await Post.findById(req.params.id)
      .populate('comments.user', ['username', 'profilePicture']);
    
    res.json(populatedPost.comments);
  } catch (err) {
    console.error('خطأ في إضافة تعليق:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

// @route   DELETE api/posts/comment/:id/:comment_id
// @desc    حذف تعليق من المنشور
// @access  Private
router.delete('/comment/:id/:comment_id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ msg: 'المنشور غير موجود' });
    }
    
    // التحقق من وجود التعليق
    const comment = post.comments.find(comment => comment.id === req.params.comment_id);
    
    if (!comment) {
      return res.status(404).json({ msg: 'التعليق غير موجود' });
    }
    
    // التحقق من صلاحية المستخدم لحذف التعليق
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'المستخدم غير مصرح له بحذف هذا التعليق' });
    }
    
    // إزالة التعليق
    post.comments = post.comments.filter(comment => comment.id !== req.params.comment_id);
    
    await post.save();
    
    res.json(post.comments);
  } catch (err) {
    console.error('خطأ في حذف التعليق:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'المنشور أو التعليق غير موجود' });
    }
    res.status(500).json({ msg: 'خطأ في الخادم', error: err.message });
  }
});

module.exports = router;