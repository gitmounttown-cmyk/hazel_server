const mongoose = require("mongoose");

// *============================================================*
// *SIZE SCHEMA*
// *============================================================*

const SizeSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL"],
    },

    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    sku: {
      type: String,
      trim: true,
      default: null,
    },

    barcode: {
      type: String,
      trim: true,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

// *============================================================*
// *MEDIA SCHEMA*
// *============================================================*

const MediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },

    imageURL: {
      type: String,
      trim: true,
      default: null,
    },

    thumbnail: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: true,
  }
);

// *============================================================*
// *OFFER SCHEMA*
// *============================================================*

const OfferSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["percentage", "fixed", "none"],
      default: "none",
    },

    value: {
      type: Number,
      default: 0,
      min: 0,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

// *============================================================*
// *VARIANT SCHEMA*
// *============================================================*

const VariantSchema = new mongoose.Schema(
  {
    color: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    media: {
      type: [MediaSchema],
      default: [],

      validate: {
        validator: function (media) {
          return media.length <= 10;
        },

        message:
          "Maximum 10 media files are allowed for each color",
      },
    },

    fabric: {
      type: String,
      trim: true,
      default: "",
    },

    feel: {
      type: String,
      trim: true,
      default: "",
    },

    lining: {
      type: String,
      trim: true,
      default: "",
    },

    sleeveStyle: {
      type: String,
      trim: true,
      default: "",
    },

    finishing: {
      type: String,
      trim: true,
      default: "",
    },

    pocket: {
      type: String,
      trim: true,
      default: "",
    },

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    offer: {
      type: OfferSchema,

      default: () => ({
        type: "none",
        value: 0,
        startDate: null,
        endDate: null,
      }),
    },

    sizes: {
      type: [SizeSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: true,
  }
);

// *============================================================*
// *PRODUCT SCHEMA*
// *============================================================*

const ProductSchema = new mongoose.Schema(
  {
    // *----------------------------------------------------------*
    // *CATEGORY*
    // *----------------------------------------------------------*

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
    },

    // *----------------------------------------------------------*
    // *BASIC PRODUCT INFORMATION*
    // *----------------------------------------------------------*

    name: {
      type: String,
      required: true,
      trim: true,
    },

    productType: {
      type: String,
      trim: true,
      default: "",
    },

    fit: {
      type: String,
      trim: true,
      default: "",
    },

    length: {
      type: String,
      trim: true,
      default: "",
    },

    // *----------------------------------------------------------*
    // *DESCRIPTION*
    // *----------------------------------------------------------*

    description: {
      about: {
        type: String,
        trim: true,
        default: "",
      },

      itemDetails: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // *----------------------------------------------------------*
    // *FEATURES*
    // *----------------------------------------------------------*

    features: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],

      default: [],
    },

    // *----------------------------------------------------------*
    // *COMBO / BANNER*
    // *----------------------------------------------------------*

    comboOffer: {
      type: String,
      trim: true,
      default: "",
    },

    bannerType: {
      type: String,
      trim: true,
      default: "",
    },

    // *----------------------------------------------------------*
    // *PRODUCT RATING*
    // *----------------------------------------------------------*

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // *----------------------------------------------------------*
    // *AUTOMATIC AVAILABILITY*
    // *----------------------------------------------------------*

    availability: {
      type: String,
      enum: ["In Stock", "Out of Stock"],
      default: "Out of Stock",
    },

    // *----------------------------------------------------------*
    // *VARIANTS*
    // *----------------------------------------------------------*

    variants: {
      type: [VariantSchema],
      default: [],
    },

    // *----------------------------------------------------------*
    // *STATUS*
    // *----------------------------------------------------------*

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// *============================================================*
// *PRE SAVE*
// *============================================================*

ProductSchema.pre("save", function () {
  let totalQuantity = 0;

  if (Array.isArray(this.variants)) {
    this.variants.forEach((variant) => {
      if (Array.isArray(variant.sizes)) {
        variant.quantity = variant.sizes.reduce(
          (total, size) =>
            total + (Number(size.stockQuantity) || 0),
          0
        );
      } else {
        variant.quantity = 0;
      }

      totalQuantity += variant.quantity;
    });
  }

  this.availability =
    totalQuantity > 0 ? "In Stock" : "Out of Stock";
});

module.exports = mongoose.model("Product", ProductSchema);