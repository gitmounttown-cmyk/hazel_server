const express = require("express");

const router = express.Router();

const {
  createVideo,
  getVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
} = require("../controllers/videoController");

const {
  uploadVideo,
  handleUploadError,
} = require("../middleware/uploadMiddleware");


router.post(
  "/create",
  uploadVideo.single("video"),
  handleUploadError,
  createVideo
);

// =====================================================
// GET ALL VIDEOS
// =====================================================
router.get(
  "/all",
  getVideos
);

// =====================================================
// GET SINGLE VIDEO
// =====================================================
router.get(
  "/:id",
  getVideoById
);

// =====================================================
// UPDATE VIDEO
// =====================================================
router.put(
  "/update/:id",
  uploadVideo.single("video"),
  handleUploadError,
  updateVideo
);

// =====================================================
// DELETE VIDEO
// =====================================================
router.delete(
  "/delete/:id",
  deleteVideo
);

module.exports = router;