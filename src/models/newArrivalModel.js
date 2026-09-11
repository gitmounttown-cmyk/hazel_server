const mongoose = require("mongoose");

// ==========================================================
// NEW ARRIVAL PRODUCT SCHEMA
// ==========================================================

const NewArrivalProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    displayOrder: {
      type: Number,
      default: 1,
      min: 1,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Image specifically uploaded for this New Arrival product
    image: {
      type: String,
      default: null,
    },
  },
  {
    _id: true,
  }
);

// ==========================================================
// NEW ARRIVAL SCHEMA
// ==========================================================

const NewArrivalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    subtitle: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    featuredProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    // Maximum 4 products
    products: {
      type: [NewArrivalProductSchema],

      validate: {
        validator: function (value) {
          return value.length <= 4;
        },

        message: "Maximum 4 products are allowed",
      },

      default: [],
    },
  },

  {
    timestamps: true,
  }
);

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "NewArrival",
  NewArrivalSchema
);