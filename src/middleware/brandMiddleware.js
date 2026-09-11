const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ==========================================================
// CREATE BRAND UPLOAD DIRECTORY
// ==========================================================

const brandUploadDir = path.join(
  process.cwd(),
  "uploads/brands"
);

if (!fs.existsSync(brandUploadDir)) {
  fs.mkdirSync(brandUploadDir, {
    recursive: true,
  });
}

// ==========================================================
// FILE FILTER
// ==========================================================

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;

  const extension = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimeType = allowedTypes.test(file.mimetype);

  if (extension && mimeType) {
    cb(null, true);
  } else {
    cb(
      new Error("Only JPG, JPEG, PNG and WEBP images are allowed"),
      false
    );
  }
};

// ==========================================================
// BRAND STORAGE
// ==========================================================

const brandStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, brandUploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

// ==========================================================
// BRAND UPLOAD
// ==========================================================

const uploadBrandImage = multer({
  storage: brandStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  uploadBrandImage,
};