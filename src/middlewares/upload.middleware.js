const multer = require('multer');
const { AppError } = require('./error.middleware');

// Memory storage keeps file in memory as Buffer (req.file.buffer)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed'), false);
  }
};

// 5MB max
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

const avatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 'Avatar must be 5MB or smaller' : err.message, 400));
    }
    return next(new AppError(err.message || 'Invalid avatar upload', 400));
  });
};

module.exports = upload;
module.exports.avatarUpload = avatarUpload;
