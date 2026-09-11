const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============================================================
// UPLOAD DIRECTORIES
// ============================================================

const categoryUploadDir = path.join(
  process.cwd(),
  "uploads/categories"
);

const subCategoryUploadDir = path.join(
  process.cwd(),
  "uploads/subcategories"
);

const productUploadDir = path.join(
  process.cwd(),
  "uploads/products"
);

const newArrivalUploadDir = path.join(
  process.cwd(),
  "uploads/new-arrivals"
);

const trendingProductUploadDir = path.join(
  process.cwd(),
  "uploads/trending-products"
);

const bannerUploadDir = path.join(
  process.cwd(),
  "uploads/banners"
);

// ============================================================
// CREATE DIRECTORIES
// ============================================================

[
  categoryUploadDir,
  subCategoryUploadDir,
  productUploadDir,
  newArrivalUploadDir,
  trendingProductUploadDir,
  bannerUploadDir,
].forEach((directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true,
    });
  }
});

// ============================================================
// GENERATE UNIQUE FILE NAME
// ============================================================

const generateFileName = (file) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const uniqueName =
    `${Date.now()}-` +
    `${Math.round(Math.random() * 1e9)}` +
    extension;

  return uniqueName;
};

// ============================================================
// IMAGE FILTER
// ============================================================

const imageFileFilter = (req, file, cb) => {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ];

  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  console.log("==========================================");
  console.log("IMAGE UPLOAD");
  console.log("Field name :", file.fieldname);
  console.log("File name  :", file.originalname);
  console.log("Extension  :", extension);
  console.log("MIME type  :", file.mimetype);
  console.log("==========================================");

  if (!allowedExtensions.includes(extension)) {
    return cb(
      new Error(
        "Only JPG, JPEG, PNG and WEBP images are allowed"
      ),
      false
    );
  }

  cb(null, true);
};

// ============================================================
// PRODUCT MEDIA FILTER
// ============================================================

const productMediaFileFilter = (
  req,
  file,
  cb
) => {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".mp4",
    ".webm",
    ".mov",
  ];

  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  console.log("==========================================");
  console.log("PRODUCT MEDIA UPLOAD");
  console.log("Field name :", file.fieldname);
  console.log("File name  :", file.originalname);
  console.log("Extension  :", extension);
  console.log("MIME type  :", file.mimetype);
  console.log("==========================================");

  if (!allowedExtensions.includes(extension)) {
    return cb(
      new Error(
        "Only JPG, JPEG, PNG, WEBP images and MP4, WEBM, MOV videos are allowed"
      ),
      false
    );
  }

  cb(null, true);
};

// ============================================================
// CATEGORY STORAGE
// ============================================================

const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, categoryUploadDir);
  },

  filename: function (req, file, cb) {
    cb(null, generateFileName(file));
  },
});

// ============================================================
// SUB CATEGORY STORAGE
// ============================================================

const subCategoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, subCategoryUploadDir);
  },

  filename: function (req, file, cb) {
    cb(null, generateFileName(file));
  },
});

// ============================================================
// PRODUCT STORAGE
// ============================================================

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadDir);
  },

  filename: function (req, file, cb) {
    cb(null, generateFileName(file));
  },
});

// ============================================================
// NEW ARRIVAL STORAGE
// ============================================================

const newArrivalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, newArrivalUploadDir);
  },

  filename: function (req, file, cb) {
    cb(null, generateFileName(file));
  },
});

// ============================================================
// TRENDING PRODUCT STORAGE
// ============================================================

const trendingProductStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, trendingProductUploadDir);
  },

  filename: function (req, file, cb) {
    cb(null, generateFileName(file));
  },
});

// ============================================================
// BANNER STORAGE
// ============================================================

const bannerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, bannerUploadDir);
  },

  filename: function (req, file, cb) {
    cb(null, generateFileName(file));
  },
});

// ============================================================
// UPLOAD LIMITS
// ============================================================

const imageUploadLimits = {
  fileSize: 5 * 1024 * 1024,
};

const productMediaUploadLimits = {
  fileSize: 100 * 1024 * 1024,
};

// ============================================================
// CATEGORY UPLOAD
// ============================================================

const uploadCategoryImage = multer({
  storage: categoryStorage,
  fileFilter: imageFileFilter,

  limits: {
    ...imageUploadLimits,
    files: 1,
  },
});

// ============================================================
// SUB CATEGORY UPLOAD
// ============================================================

const uploadSubCategoryImage = multer({
  storage: subCategoryStorage,
  fileFilter: imageFileFilter,

  limits: {
    ...imageUploadLimits,
    files: 1,
  },
});

// ============================================================
// PRODUCT MEDIA UPLOAD
// ============================================================

const uploadProductMedia = multer({
  storage: productStorage,
  fileFilter: productMediaFileFilter,

  limits: {
    ...productMediaUploadLimits,
    files: 10,
  },
});

// ============================================================
// NEW ARRIVAL
// ============================================================

const uploadNewArrivalImage = multer({
  storage: newArrivalStorage,
  fileFilter: imageFileFilter,

  limits: {
    ...imageUploadLimits,
    files: 4,
  },
});

// ============================================================
// TRENDING PRODUCT
// ============================================================

const uploadTrendingProductImage = multer({
  storage: trendingProductStorage,
  fileFilter: imageFileFilter,

  limits: {
    ...imageUploadLimits,
    files: 50,
  },
});

// ============================================================
// BANNER
// ============================================================

const uploadBannerImage = multer({
  storage: bannerStorage,
  fileFilter: imageFileFilter,

  limits: {
    ...imageUploadLimits,
    files: 1,
  },
});

// ============================================================
// DELETE UPLOADED FILE
// ============================================================

const deleteUploadedFile = (file) => {
  if (!file || !file.path) {
    return;
  }

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.error(
      "Failed to delete uploaded file:",
      error.message
    );
  }
};

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

const handleUploadError = (
  err,
  req,
  res,
  next
) => {
  if (!err) {
    return next();
  }

  // ----------------------------------------------------------
  // MULTER ERRORS
  // ----------------------------------------------------------

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message:
          "Maximum allowed files exceeded",
      });
    }

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message:
          "Product media file size cannot exceed 100 MB",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message:
          `Unexpected file field: ${err.field}`,
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // ----------------------------------------------------------
  // NORMAL FILE FILTER ERROR
  // ----------------------------------------------------------

  return res.status(400).json({
    success: false,
    message: err.message || "File upload failed",
  });
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  uploadCategoryImage,
  uploadSubCategoryImage,
  uploadProductMedia,
  uploadNewArrivalImage,
  uploadTrendingProductImage,
  uploadBannerImage,
  handleUploadError,
  deleteUploadedFile,
};