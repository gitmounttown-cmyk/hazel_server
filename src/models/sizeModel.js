const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Size name is required"],
      trim: true,
      unique: true,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
    },

    // description: {
    //   type: String,
    //   trim: true,
    //   default: "",
    // },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Size", sizeSchema);