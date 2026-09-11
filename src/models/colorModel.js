const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Color name is required"],
      trim: true,
      unique: true,
    },

    code: {
      type: String,
      required: [true, "Color code is required"],
      trim: true,
      uppercase: true,
      match: [
        /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        "Please provide a valid HEX color code",
      ],
    },

    // description: {
    //   type: String,
    //   trim: true,
    //   default: "",
    // },
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
  mongoose.models.Color || mongoose.model("Color", colorSchema);