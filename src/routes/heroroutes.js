const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getSlides, createSlide, deleteSlide } = require("../controllers/heroController");

// Ensure uploads folder is created in the absolute project root
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.route("/").get(getSlides).post(upload.array("images", 10), createSlide);
router.route("/:id").delete(deleteSlide);

module.exports = router;