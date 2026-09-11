const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      
    },
    description: {
      type: String,
      trim: true,
    },
    imageURL: {
      type: String,
      trim: true,
      
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
  mongoose.models.Brand ||
  mongoose.model("Brand", brandSchema);