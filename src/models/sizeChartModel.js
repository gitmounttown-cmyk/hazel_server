const mongoose = require("mongoose");

// ============================================================
// MEASUREMENT ROW SCHEMA
// ============================================================
const MeasurementRowSchema = new mongoose.Schema(
  {
    parameter: {
      type: String,
      required: [true, "Measurement parameter is required"],
      trim: true,
      uppercase: true,
    },
    // Map of size name to measurement value, e.g. { "XS": "13.5", "S": "14", ... }
    values: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: true,
  }
);

// ============================================================
// TABLE SECTION SCHEMA (e.g. TOP, BOTTOM, or MAXI DRESS)
// ============================================================
const TableSectionSchema = new mongoose.Schema(
  {
    tableName: {
      type: String,
      trim: true,
      uppercase: true,
      default: "STANDARD",
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    // Multiple images support for this section (e.g. for TOP or BOTTOM)
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    // List of size columns for this section, e.g. ["XS", "S", "M", "L", "XL", "XXL", "3XL"]
    sizes: [
      {
        type: String,
        trim: true,
        uppercase: true,
      },
    ],
    // List of measurement rows (e.g. SHOULDER, BUST, WAIST, HIPS, FRONT LENGTH)
    rows: {
      type: [MeasurementRowSchema],
      default: [],
    },
  },
  {
    _id: true,
  }
);

// ============================================================
// SIZE CHART SCHEMA
// ============================================================
const sizeChartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Size chart name is required"],
      trim: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    unit: {
      type: String,
      trim: true,
      default: "inches",
    },

    // Dynamic guide illustration image URL (e.g. /uploads/size-charts/xxx.jpg)
    image: {
      type: String,
      trim: true,
      default: "",
    },
    // Multiple images support for this section (e.g. for TOP or BOTTOM)
    images: [
      {
        type: String,
        trim: true,
      },
    ],

    description: {
      type: String,
      trim: true,
      default: "All measurements are in inches",
    },

    // Multi-table support (e.g. TOP + BOTTOM or single table like MAXI DRESS)
    tables: {
      type: [TableSectionSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

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

// Index for quick product / category lookup
sizeChartSchema.index({ productId: 1 });
sizeChartSchema.index({ categoryId: 1 });
sizeChartSchema.index({ name: 1 });

module.exports = mongoose.model("SizeChart", sizeChartSchema);
