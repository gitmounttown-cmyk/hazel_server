const mongoose = require("mongoose");

const neckPatternSchema = new mongoose.Schema(
  {
    // ==========================================================
    // NECK PATTERN NAME
    // ==========================================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    // ==========================================================
    // SLUG
    // ==========================================================

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // ==========================================================
    // DESCRIPTION
    // ==========================================================

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    // ==========================================================
    // IMAGE
    // ==========================================================

    image: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================================
    // STATUS
    // ==========================================================

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    

    // ==========================================================
    // AUDIT
    // ==========================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


module.exports =
  mongoose.models.NeckPattern ||
  mongoose.model(
    "NeckPattern",
    neckPatternSchema
  );