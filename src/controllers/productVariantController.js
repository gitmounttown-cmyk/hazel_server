const mongoose = require("mongoose");

const ProductVariant = require("../models/productVariantModel");
const Product = require("../models/productModel");
const Size = require("../models/sizeModel");
const Color = require("../models/colorModel");

// ==========================================================
// OBJECT ID VALIDATION
// ==========================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};


// ==========================================================
// CREATE PRODUCT VARIANT
// ==========================================================

exports.createProductVariant = async (req, res) => {
  try {

    const {
      product,
      size,
      color,
      sku,
      mrp,
      price,
      stock,
      lowStockThreshold,
      status,
      isDefault,
    } = req.body;


    // ======================================================
    // GET UPLOADED IMAGES
    // ======================================================

    const imagePaths = req.files
      ? req.files.map((file) => {
          return `/uploads/product-variants/${file.filename}`;
        })
      : [];


    // ======================================================
    // REQUIRED VALIDATION
    // ======================================================

    if (!product) {
      return res.status(400).json({
        success: false,
        message: "Product is required",
      });
    }

    if (!size) {
      return res.status(400).json({
        success: false,
        message: "Size is required",
      });
    }

    if (!color) {
      return res.status(400).json({
        success: false,
        message: "Color is required",
      });
    }

    if (!sku || !sku.trim()) {
      return res.status(400).json({
        success: false,
        message: "SKU is required",
      });
    }

    if (mrp === undefined || mrp === "") {
      return res.status(400).json({
        success: false,
        message: "MRP is required",
      });
    }

    if (price === undefined || price === "") {
      return res.status(400).json({
        success: false,
        message: "Selling price is required",
      });
    }

    if (stock === undefined || stock === "") {
      return res.status(400).json({
        success: false,
        message: "Stock is required",
      });
    }


    // ======================================================
    // OBJECT ID VALIDATION
    // ======================================================

    if (!isValidObjectId(product)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if (!isValidObjectId(size)) {
      return res.status(400).json({
        success: false,
        message: "Invalid size ID",
      });
    }

    if (!isValidObjectId(color)) {
      return res.status(400).json({
        success: false,
        message: "Invalid color ID",
      });
    }


    // ======================================================
    // CHECK PRODUCT
    // ======================================================

    const productData =
      await Product.findById(product);

    if (!productData) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }


    // ======================================================
    // CHECK SIZE
    // ======================================================

    const sizeData =
      await Size.findById(size);

    if (!sizeData) {
      return res.status(404).json({
        success: false,
        message: "Size not found",
      });
    }


    // ======================================================
    // CHECK COLOR
    // ======================================================

    const colorData =
      await Color.findById(color);

    if (!colorData) {
      return res.status(404).json({
        success: false,
        message: "Color not found",
      });
    }


    // ======================================================
    // NUMERIC VALIDATION
    // ======================================================

    const mrpValue =
      Number(mrp);

    const priceValue =
      Number(price);

    const stockValue =
      Number(stock);

    const lowStockValue =
      lowStockThreshold !== undefined &&
      lowStockThreshold !== ""
        ? Number(lowStockThreshold)
        : 5;


    if (
      !Number.isFinite(mrpValue) ||
      mrpValue < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid MRP",
      });
    }


    if (
      !Number.isFinite(priceValue) ||
      priceValue < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid selling price",
      });
    }


    if (
      !Number.isFinite(stockValue) ||
      stockValue < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock",
      });
    }


    if (
      !Number.isFinite(lowStockValue) ||
      lowStockValue < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid low stock threshold",
      });
    }


    // ======================================================
    // PRICE VALIDATION
    // ======================================================

    if (priceValue > mrpValue) {
      return res.status(400).json({
        success: false,
        message:
          "Selling price cannot be greater than MRP",
      });
    }


    // ======================================================
    // NORMALIZE SKU
    // ======================================================

    const normalizedSku =
      sku.trim().toUpperCase();


    // ======================================================
    // CHECK DUPLICATE SKU
    // ======================================================

    const existingSku =
      await ProductVariant.findOne({
        sku: normalizedSku,
      });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        message:
          "Product variant with this SKU already exists",
      });
    }


    // ======================================================
    // CHECK DUPLICATE PRODUCT + SIZE + COLOR
    // ======================================================

    const existingVariant =
      await ProductVariant.findOne({
        product,
        size,
        color,
      });

    if (existingVariant) {
      return res.status(409).json({
        success: false,
        message:
          "This product variant already exists for the selected size and color",
      });
    }


    // ======================================================
    // DEFAULT VARIANT
    // ======================================================

    const defaultValue =
      isDefault === true ||
      isDefault === "true";


    // ======================================================
    // IF THIS IS DEFAULT VARIANT
    // REMOVE DEFAULT FROM OTHER VARIANTS
    // ======================================================

    if (defaultValue) {

      await ProductVariant.updateMany(
        {
          product,
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }


    // ======================================================
    // CREATE VARIANT
    // ======================================================

    const variant =
      await ProductVariant.create({

        product,

        size,

        color,

        sku:
          normalizedSku,

        mrp:
          mrpValue,

        price:
          priceValue,

        stock:
          stockValue,

        lowStockThreshold:
          lowStockValue,

        images:
          imagePaths,

        status:
          status || "active",

        isDefault:
          defaultValue,

        createdBy:
          req.user?.id ||
          req.user?._id ||
          null,

        updatedBy:
          req.user?.id ||
          req.user?._id ||
          null,
      });


    // ======================================================
    // POPULATE
    // ======================================================

    await variant.populate([
      {
        path: "product",
        select:
          "name slug category brand length neckPattern",
      },
      {
        path: "size",
        select:
          "name code",
      },
      {
        path: "color",
        select:
          "name code hexCode",
      },
    ]);


    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(201).json({
      success: true,
      message:
        "Product variant created successfully",
      data: variant,
    });


  } catch (error) {

    console.error(
      "Create Product Variant Error:",
      error
    );


    // ======================================================
    // DUPLICATE KEY
    // ======================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Product variant already exists",
      });
    }


    return res.status(500).json({
      success: false,
      message:
        "Failed to create product variant",
      error: error.message,
    });
  }
};


// ==========================================================
// GET ALL PRODUCT VARIANTS
// ==========================================================

exports.getProductVariants = async (
  req,
  res
) => {

  try {

    const {
      product,
      size,
      color,
      status,
      search,
      page = 1,
      limit = 20,
    } = req.query;


    // ======================================================
    // PAGINATION
    // ======================================================

    const pageNumber =
      Math.max(
        parseInt(page) || 1,
        1
      );

    const limitNumber =
      Math.max(
        parseInt(limit) || 20,
        1
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;


    // ======================================================
    // FILTER
    // ======================================================

    const filter = {};


    // ======================================================
    // PRODUCT FILTER
    // ======================================================

    if (product) {

      if (!isValidObjectId(product)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product ID",
        });
      }

      filter.product =
        product;
    }


    // ======================================================
    // SIZE FILTER
    // ======================================================

    if (size) {

      if (!isValidObjectId(size)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid size ID",
        });
      }

      filter.size =
        size;
    }


    // ======================================================
    // COLOR FILTER
    // ======================================================

    if (color) {

      if (!isValidObjectId(color)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid color ID",
        });
      }

      filter.color =
        color;
    }


    // ======================================================
    // STATUS
    // ======================================================

    if (status) {
      filter.status =
        status;
    }


    // ======================================================
    // SKU SEARCH
    // ======================================================

    if (search && search.trim()) {

      filter.sku = {
        $regex:
          search.trim(),
        $options: "i",
      };
    }


    // ======================================================
    // GET VARIANTS
    // ======================================================

    const [
      variants,
      totalVariants,
    ] = await Promise.all([

      ProductVariant.find(filter)

        .populate(
          "product",
          "name slug"
        )

        .populate(
          "size",
          "name code"
        )

        .populate(
          "color",
          "name code hexCode"
        )

        .populate(
          "createdBy",
          "name email"
        )

        .populate(
          "updatedBy",
          "name email"
        )

        .sort({
          createdAt: -1,
        })

        .skip(skip)

        .limit(limitNumber)

        .lean(),

      ProductVariant.countDocuments(
        filter
      ),
    ]);


    // ======================================================
    // PAGINATION
    // ======================================================

    const totalPages =
      Math.ceil(
        totalVariants /
          limitNumber
      );


    return res.status(200).json({
      success: true,
      message:
        "Product variants fetched successfully",

      data: variants,

      pagination: {
        currentPage:
          pageNumber,

        totalPages,

        totalVariants,

        limit:
          limitNumber,

        hasNextPage:
          pageNumber <
          totalPages,

        hasPreviousPage:
          pageNumber > 1,
      },
    });


  } catch (error) {

    console.error(
      "Get Product Variants Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch product variants",
      error: error.message,
    });
  }
};


// ==========================================================
// GET VARIANT BY ID
// ==========================================================

exports.getProductVariantById =
  async (req, res) => {

    try {

      const { id } =
        req.params;


      // ====================================================
      // ID VALIDATION
      // ====================================================

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product variant ID",
        });
      }


      // ====================================================
      // FIND VARIANT
      // ====================================================

      const variant =
        await ProductVariant.findById(id)

          .populate(
            "product",
            "name slug category brand length neckPattern"
          )

          .populate(
            "size",
            "name code"
          )

          .populate(
            "color",
            "name code hexCode"
          )

          .populate(
            "createdBy",
            "name email"
          )

          .populate(
            "updatedBy",
            "name email"
          );


      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Product variant not found",
        });
      }


      return res.status(200).json({
        success: true,
        message:
          "Product variant fetched successfully",
        data: variant,
      });


    } catch (error) {

      console.error(
        "Get Product Variant Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch product variant",
        error: error.message,
      });
    }
  };


// ==========================================================
// UPDATE PRODUCT VARIANT
// ==========================================================

exports.updateProductVariant =
  async (req, res) => {

    try {

      const { id } =
        req.params;


      // ====================================================
      // ID VALIDATION
      // ====================================================

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product variant ID",
        });
      }


      // ====================================================
      // FIND VARIANT
      // ====================================================

      const variant =
        await ProductVariant.findById(id);


      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Product variant not found",
        });
      }


      const {
        product,
        size,
        color,
        sku,
        mrp,
        price,
        stock,
        lowStockThreshold,
        status,
        isDefault,
      } = req.body;


      // ====================================================
      // PRODUCT
      // ====================================================

      if (product !== undefined) {

        if (!isValidObjectId(product)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid product ID",
          });
        }


        const productData =
          await Product.findById(
            product
          );

        if (!productData) {
          return res.status(404).json({
            success: false,
            message:
              "Product not found",
          });
        }


        variant.product =
          product;
      }


      // ====================================================
      // SIZE
      // ====================================================

      if (size !== undefined) {

        if (!isValidObjectId(size)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid size ID",
          });
        }


        const sizeData =
          await Size.findById(
            size
          );

        if (!sizeData) {
          return res.status(404).json({
            success: false,
            message:
              "Size not found",
          });
        }


        variant.size =
          size;
      }


      // ====================================================
      // COLOR
      // ====================================================

      if (color !== undefined) {

        if (!isValidObjectId(color)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid color ID",
          });
        }


        const colorData =
          await Color.findById(
            color
          );

        if (!colorData) {
          return res.status(404).json({
            success: false,
            message:
              "Color not found",
          });
        }


        variant.color =
          color;
      }


      // ====================================================
      // SKU
      // ====================================================

      if (sku !== undefined) {

        if (!sku.trim()) {
          return res.status(400).json({
            success: false,
            message:
              "SKU cannot be empty",
          });
        }


        const normalizedSku =
          sku.trim().toUpperCase();


        const existingSku =
          await ProductVariant.findOne({
            sku: normalizedSku,

            _id: {
              $ne: id,
            },
          });


        if (existingSku) {
          return res.status(409).json({
            success: false,
            message:
              "Another product variant already uses this SKU",
          });
        }


        variant.sku =
          normalizedSku;
      }


      // ====================================================
      // MRP
      // ====================================================

      if (mrp !== undefined) {

        const mrpValue =
          Number(mrp);


        if (
          !Number.isFinite(mrpValue) ||
          mrpValue < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid MRP",
          });
        }


        variant.mrp =
          mrpValue;
      }


      // ====================================================
      // PRICE
      // ====================================================

      if (price !== undefined) {

        const priceValue =
          Number(price);


        if (
          !Number.isFinite(priceValue) ||
          priceValue < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid selling price",
          });
        }


        variant.price =
          priceValue;
      }


      // ====================================================
      // PRICE CHECK
      // ====================================================

      if (
        variant.price >
        variant.mrp
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selling price cannot be greater than MRP",
        });
      }


      // ====================================================
      // STOCK
      // ====================================================

      if (stock !== undefined) {

        const stockValue =
          Number(stock);


        if (
          !Number.isFinite(stockValue) ||
          stockValue < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid stock",
          });
        }


        variant.stock =
          stockValue;
      }


      // ====================================================
      // LOW STOCK THRESHOLD
      // ====================================================

      if (
        lowStockThreshold !==
        undefined
      ) {

        const thresholdValue =
          Number(
            lowStockThreshold
          );


        if (
          !Number.isFinite(
            thresholdValue
          ) ||
          thresholdValue < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid low stock threshold",
          });
        }


        variant.lowStockThreshold =
          thresholdValue;
      }


      // ====================================================
      // STATUS
      // ====================================================

      if (status !== undefined) {

        const allowedStatuses = [
          "active",
          "inactive",
        ];


        if (
          !allowedStatuses.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid variant status",
          });
        }


        variant.status =
          status;
      }


      // ====================================================
      // DEFAULT VARIANT
      // ====================================================

      if (
        isDefault !== undefined
      ) {

        const defaultValue =
          isDefault === true ||
          isDefault === "true";


        if (defaultValue) {

          await ProductVariant.updateMany(
            {
              product:
                variant.product,

              _id: {
                $ne: id,
              },
            },
            {
              $set: {
                isDefault: false,
              },
            }
          );
        }


        variant.isDefault =
          defaultValue;
      }


      // ====================================================
      // UPDATE IMAGES
      // ====================================================

      if (
        req.files &&
        req.files.length > 0
      ) {

        const newImages =
          req.files.map(
            (file) => {
              return `/uploads/product-variants/${file.filename}`;
            }
          );


        variant.images =
          newImages;
      }


      // ====================================================
      // CHECK PRODUCT + SIZE + COLOR
      // ====================================================

      const duplicateVariant =
        await ProductVariant.findOne({
          product:
            variant.product,

          size:
            variant.size,

          color:
            variant.color,

          _id: {
            $ne: id,
          },
        });


      if (duplicateVariant) {
        return res.status(409).json({
          success: false,
          message:
            "Another variant already exists for this product, size and color",
        });
      }


      // ====================================================
      // UPDATED BY
      // ====================================================

      variant.updatedBy =
        req.user?.id ||
        req.user?._id ||
        null;


      // ====================================================
      // SAVE
      // ====================================================

      await variant.save();


      // ====================================================
      // POPULATE
      // ====================================================

      await variant.populate([
        {
          path: "product",
          select:
            "name slug category brand length neckPattern",
        },
        {
          path: "size",
          select:
            "name code",
        },
        {
          path: "color",
          select:
            "name code hexCode",
        },
      ]);


      return res.status(200).json({
        success: true,
        message:
          "Product variant updated successfully",
        data: variant,
      });


    } catch (error) {

      console.error(
        "Update Product Variant Error:",
        error
      );


      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "Product variant already exists",
        });
      }


      return res.status(500).json({
        success: false,
        message:
          "Failed to update product variant",
        error: error.message,
      });
    }
  };


// ==========================================================
// DELETE PRODUCT VARIANT
// SOFT DELETE
// ==========================================================

exports.deleteProductVariant =
  async (req, res) => {

    try {

      const { id } =
        req.params;


      // ====================================================
      // ID VALIDATION
      // ====================================================

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product variant ID",
        });
      }


      // ====================================================
      // FIND VARIANT
      // ====================================================

      const variant =
        await ProductVariant.findById(
          id
        );


      if (!variant) {
        return res.status(404).json({
          success: false,
          message:
            "Product variant not found",
        });
      }


      // ====================================================
      // SOFT DELETE
      // ====================================================

      variant.status =
        "inactive";

      variant.isDefault =
        false;

      variant.updatedBy =
        req.user?.id ||
        req.user?._id ||
        null;


      await variant.save();


      return res.status(200).json({
        success: true,
        message:
          "Product variant deactivated successfully",
      });


    } catch (error) {

      console.error(
        "Delete Product Variant Error:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          "Failed to delete product variant",
        error: error.message,
      });
    }
  };

