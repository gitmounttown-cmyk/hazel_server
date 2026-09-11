const mongoose = require("mongoose");

const lengthSchema = new mongoose.Schema(
  {
    // ==========================================================
    // LENGTH NAME
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
  mongoose.models.Length ||
  mongoose.model("Length", lengthSchema);