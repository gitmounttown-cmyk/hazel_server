const mongoose = require("mongoose");

const heroSlideSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      required: true,
      trim: true,
      default: "PREMIUM COTTON NIGHTWEAR",
    },
    image: {
      type: String, // Stores the image URL or path
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HeroSlide", heroSlideSchema);