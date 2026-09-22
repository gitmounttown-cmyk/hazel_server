const Video = require("../models/videoModel");
const fs = require("fs");
const path = require("path");

// =====================================================
// CREATE VIDEO
// FormData fields: video (file), title (text), price (text)
// =====================================================
exports.createVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Video file is required",
      });
    }

    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        message: "Title and price are required",
      });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;

    const video = await Video.create({
      videoUrl,
      title,
      price,
    });

    return res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: video,
    });
  } catch (error) {
    console.error("Create Video Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL VIDEOS
// =====================================================
exports.getVideos = async (req, res) => {
  try {
    const videos = await Video.find().select("_id title price videoUrl").sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: videos,
    });
  } catch (error) {
    console.error("Get Videos Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// GET VIDEO BY ID
// =====================================================
exports.getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    console.error("Get Video Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE VIDEO
// FormData fields: video (optional file), title (text), price (text)
// =====================================================
exports.updateVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    const { title, price } = req.body;

    // Update fields if provided in req.body
    if (title) video.title = title;
    if (price) video.price = price;

    // If a new video file is provided, handle file replacement
    if (req.file) {
      if (video.videoUrl) {
        const oldVideoPath = path.join(
          __dirname,
          "..",
          video.videoUrl
        );

        if (fs.existsSync(oldVideoPath)) {
          fs.unlinkSync(oldVideoPath);
        }
      }

      video.videoUrl = `/uploads/videos/${req.file.filename}`;
    }

    await video.save();

    return res.status(200).json({
      success: true,
      message: "Video updated successfully",
      data: video,
    });
  } catch (error) {
    console.error("Update Video Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE VIDEO
// =====================================================
exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    if (video.videoUrl) {
      const videoPath = path.join(
        __dirname,
        "..",
        video.videoUrl
      );

      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }

    await Video.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    console.error("Delete Video Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};