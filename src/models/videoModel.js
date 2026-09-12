const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Video", videoSchema);