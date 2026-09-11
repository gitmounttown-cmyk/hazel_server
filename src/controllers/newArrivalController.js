const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const NewArrival = require("../models/newArrivalModel");
const Product = require("../models/productModel");

// ==========================================================
// GET FULL IMAGE URL
// ==========================================================

const getImageUrl = (
  req,
  imagePath
) => {
  if (!imagePath) {
    return null;
  }

  const normalizedPath =
    imagePath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

  return `${req.protocol}://${req.get(
    "host"
  )}/${normalizedPath}`;
};

// ==========================================================
// DELETE LOCAL FILE
// ==========================================================

const deleteLocalFile = (
  imagePath
) => {
  if (!imagePath) {
    return;
  }

  const normalizedPath =
    imagePath.replace(
      /\\/g,
      "/"
    );

  const absolutePath =
    path.join(
      process.cwd(),
      normalizedPath
    );

  try {
    if (
      fs.existsSync(
        absolutePath
      )
    ) {
      fs.unlinkSync(
        absolutePath
      );

      console.log(
        "Deleted file:",
        absolutePath
      );
    }
  } catch (error) {
    console.error(
      "Error deleting file:",
      error.message
    );
  }
};

// ==========================================================
// DELETE UPLOADED FILES
// ==========================================================

const deleteUploadedFiles = (
  files
) => {
  if (
    !files ||
    !Array.isArray(files)
  ) {
    return;
  }

  files.forEach((file) => {
    if (file?.path) {
      const relativePath =
        path.relative(
          process.cwd(),
          file.path
        );

      deleteLocalFile(
        relativePath
      );
    }
  });
};

// ==========================================================
// PARSE PRODUCTS
// ==========================================================

const parseProducts = (
  products
) => {
  if (!products) {
    return [];
  }

  if (Array.isArray(products)) {
    return products;
  }

  if (
    typeof products ===
    "object"
  ) {
    return products;
  }

  try {
    return JSON.parse(products);
  } catch (error) {
    const customError =
      new Error(
        "Invalid products JSON format"
      );

    customError.details =
      error.message;

    throw customError;
  }
};

// ==========================================================
// VALIDATE PRODUCTS
// ==========================================================

const validateProducts =
  async (products) => {
    if (
      !Array.isArray(
        products
      )
    ) {
      throw new Error(
        "Products must be an array"
      );
    }

    // Maximum 4 products
    if (
      products.length > 4
    ) {
      throw new Error(
        "Maximum 4 products are allowed"
      );
    }

    const productIds = [];

    for (
      let i = 0;
      i < products.length;
      i++
    ) {
      const item =
        products[i];

      // --------------------------------
      // PRODUCT OBJECT
      // --------------------------------

      if (
        !item ||
        typeof item !==
          "object"
      ) {
        throw new Error(
          `Invalid product data at index ${i}`
        );
      }

      // --------------------------------
      // PRODUCT ID
      // --------------------------------

      if (
        !item.product
      ) {
        throw new Error(
          `Product ID is required at index ${i}`
        );
      }

      // --------------------------------
      // OBJECT ID VALIDATION
      // --------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          item.product
        )
      ) {
        throw new Error(
          `Invalid product ID at index ${i}`
        );
      }

      productIds.push(
        item.product.toString()
      );
    }

    // --------------------------------
    // DUPLICATE PRODUCT CHECK
    // --------------------------------

    const uniqueIds =
      new Set(
        productIds
      );

    if (
      uniqueIds.size !==
      productIds.length
    ) {
      throw new Error(
        "Duplicate products are not allowed"
      );
    }

    // --------------------------------
    // CHECK PRODUCTS EXIST
    // --------------------------------

    const existingProducts =
      await Product.find({
        _id: {
          $in: productIds,
        },
      }).select("_id");

    if (
      existingProducts.length !==
      productIds.length
    ) {
      const existingIds =
        existingProducts.map(
          (item) =>
            item._id.toString()
        );

      const missingIds =
        productIds.filter(
          (id) =>
            !existingIds.includes(
              id
            )
        );

      const error =
        new Error(
          "One or more products were not found"
        );

      error.missingProducts =
        missingIds;

      throw error;
    }
  };

// ==========================================================
// CREATE NEW ARRIVAL
// ==========================================================

const createNewArrival =
  async (req, res) => {
    let uploadedFiles =
      req.files || [];

    try {
      console.log(
        "CREATE NEW ARRIVAL"
      );

      console.log(
        "Body:",
        req.body
      );

      console.log(
        "Files:",
        uploadedFiles
      );

      const {
        title,
        subtitle,
        description,
        featuredProduct,
        products,
      } = req.body;

      // --------------------------------
      // TITLE
      // --------------------------------

      if (
        !title ||
        !title.trim()
      ) {
        deleteUploadedFiles(
          uploadedFiles
        );

        return res.status(
          400
        ).json({
          success: false,
          message:
            "Title is required",
        });
      }

      // --------------------------------
      // PARSE PRODUCTS
      // --------------------------------

      let parsedProducts;

      try {
        parsedProducts =
          parseProducts(
            products
          );
      } catch (error) {
        deleteUploadedFiles(
          uploadedFiles
        );

        return res.status(
          400
        ).json({
          success: false,
          message:
            "Invalid products JSON format",
          error:
            error.details,
          example:
            '[{"product":"PRODUCT_ID","displayOrder":1,"isFeatured":true}]',
        });
      }

      // --------------------------------
      // VALIDATE PRODUCTS
      // --------------------------------

      try {
        await validateProducts(
          parsedProducts
        );
      } catch (error) {
        deleteUploadedFiles(
          uploadedFiles
        );

        return res.status(
          400
        ).json({
          success: false,
          message:
            error.message,
          missingProducts:
            error.missingProducts ||
            undefined,
        });
      }

      // --------------------------------
      // FEATURED PRODUCT
      // --------------------------------

      if (
        featuredProduct
      ) {
        if (
          !mongoose.Types.ObjectId.isValid(
            featuredProduct
          )
        ) {
          deleteUploadedFiles(
            uploadedFiles
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              "Invalid featuredProduct ID",
          });
        }

        const product =
          await Product.findById(
            featuredProduct
          );

        if (!product) {
          deleteUploadedFiles(
            uploadedFiles
          );

          return res.status(
            404
          ).json({
            success: false,
            message:
              "Featured product not found",
          });
        }
      }

      // --------------------------------
      // PRODUCT IMAGES
      // --------------------------------

      const productImages =
        Array.isArray(
          req.files
        )
          ? req.files
          : [];

      // --------------------------------
      // MAX 4 IMAGES
      // --------------------------------

      if (
        productImages.length >
        4
      ) {
        deleteUploadedFiles(
          productImages
        );

        return res.status(
          400
        ).json({
          success: false,
          message:
            "Maximum 4 product images are allowed",
        });
      }

      // --------------------------------
      // IMAGE COUNT SHOULD NOT EXCEED
      // PRODUCT COUNT
      // --------------------------------

      if (
        productImages.length >
        parsedProducts.length
      ) {
        deleteUploadedFiles(
          productImages
        );

        return res.status(
          400
        ).json({
          success: false,
          message:
            "Number of images cannot exceed number of products",
        });
      }

      // --------------------------------
      // CREATE PRODUCT ARRAY
      // --------------------------------

      const finalProducts =
        parsedProducts.map(
          (item, index) => {
            const image =
              productImages[
                index
              ];

            return {
              product:
                item.product,

              displayOrder:
                item.displayOrder ||
                index + 1,

              isFeatured:
                item.isFeatured ===
                true,

              image: image
                ? path
                    .relative(
                      process.cwd(),
                      image.path
                    )
                    .replace(
                      /\\/g,
                      "/"
                    )
                : null,
            };
          }
        );

      // --------------------------------
      // CREATE NEW ARRIVAL
      // --------------------------------

      const newArrival =
        await NewArrival.create(
          {
            title:
              title.trim(),

            subtitle:
              subtitle?.trim() ||
              "",

            description:
              description?.trim() ||
              "",

            featuredProduct:
              featuredProduct ||
              null,

            products:
              finalProducts,
          }
        );

      // --------------------------------
      // POPULATE
      // --------------------------------

      const populated =
        await NewArrival.findById(
          newArrival._id
        )
          .populate(
            "featuredProduct"
          )
          .populate(
            "products.product"
          );

      // --------------------------------
      // RESPONSE
      // --------------------------------

      const responseData =
        populated.toObject();

      responseData.products =
        responseData.products.map(
          (item) => ({
            ...item,

            image:
              getImageUrl(
                req,
                item.image
              ),
          })
        );

      return res.status(
        201
      ).json({
        success: true,

        message:
          "New Arrival created successfully",

        data:
          responseData,
      });
    } catch (error) {
      console.error(
        "CREATE NEW ARRIVAL ERROR:",
        error
      );

      deleteUploadedFiles(
        uploadedFiles
      );

      return res.status(
        500
      ).json({
        success: false,

        message:
          "Failed to create New Arrival",

        error:
          error.message,
      });
    }
  };

// ==========================================================
// GET ALL NEW ARRIVALS
// ==========================================================

const getAllNewArrivals =
  async (req, res) => {
    try {
      const newArrivals =
        await NewArrival.find()
          .populate(
            "featuredProduct"
          )
          .populate(
            "products.product"
          )
          .sort({
            createdAt: -1,
          });

      const data =
        newArrivals.map(
          (arrival) => {
            const item =
              arrival.toObject();

            item.products =
              item.products.map(
                (product) => ({
                  ...product,

                  image:
                    getImageUrl(
                      req,
                      product.image
                    ),
                })
              );

            return item;
          }
        );

      return res.status(
        200
      ).json({
        success: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      console.error(
        "GET ALL NEW ARRIVALS ERROR:",
        error
      );

      return res.status(
        500
      ).json({
        success: false,

        message:
          "Failed to fetch New Arrivals",

        error:
          error.message,
      });
    }
  };

// ==========================================================
// GET NEW ARRIVAL BY ID
// ==========================================================

const getNewArrivalById =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      // --------------------------------
      // VALIDATE ID
      // --------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(
          400
        ).json({
          success: false,
          message:
            "Invalid New Arrival ID",
        });
      }

      // --------------------------------
      // FIND
      // --------------------------------

      const newArrival =
        await NewArrival.findById(
          id
        )
          .populate(
            "featuredProduct"
          )
          .populate(
            "products.product"
          );

      if (!newArrival) {
        return res.status(
          404
        ).json({
          success: false,
          message:
            "New Arrival not found",
        });
      }

      // --------------------------------
      // RESPONSE
      // --------------------------------

      const data =
        newArrival.toObject();

      data.products =
        data.products.map(
          (product) => ({
            ...product,

            image:
              getImageUrl(
                req,
                product.image
              ),
          })
        );

      return res.status(
        200
      ).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error(
        "GET NEW ARRIVAL ERROR:",
        error
      );

      return res.status(
        500
      ).json({
        success: false,

        message:
          "Failed to fetch New Arrival",

        error:
          error.message,
      });
    }
  };

// ==========================================================
// UPDATE NEW ARRIVAL
// ==========================================================

const updateNewArrival =
  async (req, res) => {
    const uploadedFiles =
      req.files || [];

    try {
      const { id } =
        req.params;

      // --------------------------------
      // VALIDATE ID
      // --------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        deleteUploadedFiles(
          uploadedFiles
        );

        return res.status(
          400
        ).json({
          success: false,
          message:
            "Invalid New Arrival ID",
        });
      }

      // --------------------------------
      // FIND EXISTING
      // --------------------------------

      const existing =
        await NewArrival.findById(
          id
        );

      if (!existing) {
        deleteUploadedFiles(
          uploadedFiles
        );

        return res.status(
          404
        ).json({
          success: false,
          message:
            "New Arrival not found",
        });
      }

      const {
        title,
        subtitle,
        description,
        featuredProduct,
        products,
      } = req.body;

      // --------------------------------
      // TITLE
      // --------------------------------

      if (
        title !== undefined
      ) {
        if (
          !title.trim()
        ) {
          deleteUploadedFiles(
            uploadedFiles
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              "Title cannot be empty",
          });
        }

        existing.title =
          title.trim();
      }

      // --------------------------------
      // SUBTITLE
      // --------------------------------

      if (
        subtitle !==
        undefined
      ) {
        existing.subtitle =
          subtitle.trim();
      }

      // --------------------------------
      // DESCRIPTION
      // --------------------------------

      if (
        description !==
        undefined
      ) {
        existing.description =
          description.trim();
      }

      // --------------------------------
      // FEATURED PRODUCT
      // --------------------------------

      if (
        featuredProduct !==
        undefined
      ) {
        if (
          featuredProduct &&
          !mongoose.Types.ObjectId.isValid(
            featuredProduct
          )
        ) {
          deleteUploadedFiles(
            uploadedFiles
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              "Invalid featuredProduct ID",
          });
        }

        if (
          featuredProduct
        ) {
          const product =
            await Product.findById(
              featuredProduct
            );

          if (!product) {
            deleteUploadedFiles(
              uploadedFiles
            );

            return res.status(
              404
            ).json({
              success: false,
              message:
                "Featured product not found",
            });
          }
        }

        existing.featuredProduct =
          featuredProduct ||
          null;
      }

      // --------------------------------
      // UPDATE PRODUCTS
      // --------------------------------

      if (
        products !==
        undefined
      ) {
        let parsedProducts;

        try {
          parsedProducts =
            parseProducts(
              products
            );
        } catch (error) {
          deleteUploadedFiles(
            uploadedFiles
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              "Invalid products JSON format",
            error:
              error.details,
          });
        }

        // --------------------------------
        // VALIDATE
        // --------------------------------

        try {
          await validateProducts(
            parsedProducts
          );
        } catch (error) {
          deleteUploadedFiles(
            uploadedFiles
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              error.message,

            missingProducts:
              error.missingProducts ||
              undefined,
          });
        }

        const productImages =
          Array.isArray(
            req.files
          )
            ? req.files
            : [];

        // --------------------------------
        // IMAGE COUNT
        // --------------------------------

        if (
          productImages.length >
          4
        ) {
          deleteUploadedFiles(
            productImages
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              "Maximum 4 product images are allowed",
          });
        }

        if (
          productImages.length >
          parsedProducts.length
        ) {
          deleteUploadedFiles(
            productImages
          );

          return res.status(
            400
          ).json({
            success: false,
            message:
              "Number of images cannot exceed number of products",
          });
        }

        // --------------------------------
        // DELETE OLD IMAGES
        // --------------------------------

        existing.products.forEach(
          (oldProduct) => {
            if (
              oldProduct.image
            ) {
              deleteLocalFile(
                oldProduct.image
              );
            }
          }
        );

        // --------------------------------
        // CREATE UPDATED PRODUCTS
        // --------------------------------

        existing.products =
          parsedProducts.map(
            (
              item,
              index
            ) => {
              const image =
                productImages[
                  index
                ];

              return {
                product:
                  item.product,

                displayOrder:
                  item.displayOrder ||
                  index + 1,

                isFeatured:
                  item.isFeatured ===
                  true,

                image: image
                  ? path
                      .relative(
                        process.cwd(),
                        image.path
                      )
                      .replace(
                        /\\/g,
                        "/"
                      )
                  : null,
              };
            }
          );
      }

      // --------------------------------
      // SAVE
      // --------------------------------

      await existing.save();

      // --------------------------------
      // POPULATE
      // --------------------------------

      const populated =
        await NewArrival.findById(
          existing._id
        )
          .populate(
            "featuredProduct"
          )
          .populate(
            "products.product"
          );

      const data =
        populated.toObject();

      data.products =
        data.products.map(
          (product) => ({
            ...product,

            image:
              getImageUrl(
                req,
                product.image
              ),
          })
        );

      return res.status(
        200
      ).json({
        success: true,

        message:
          "New Arrival updated successfully",

        data,
      });
    } catch (error) {
      console.error(
        "UPDATE NEW ARRIVAL ERROR:",
        error
      );

      deleteUploadedFiles(
        uploadedFiles
      );

      return res.status(
        500
      ).json({
        success: false,

        message:
          "Failed to update New Arrival",

        error:
          error.message,
      });
    }
  };

// ==========================================================
// DELETE NEW ARRIVAL
// ==========================================================

const deleteNewArrival =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      // --------------------------------
      // VALIDATE ID
      // --------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(
          400
        ).json({
          success: false,
          message:
            "Invalid New Arrival ID",
        });
      }

      // --------------------------------
      // FIND
      // --------------------------------

      const newArrival =
        await NewArrival.findById(
          id
        );

      if (!newArrival) {
        return res.status(
          404
        ).json({
          success: false,
          message:
            "New Arrival not found",
        });
      }

      // --------------------------------
      // DELETE PRODUCT IMAGES
      // --------------------------------

      newArrival.products.forEach(
        (product) => {
          if (
            product.image
          ) {
            deleteLocalFile(
              product.image
            );
          }
        }
      );

      // --------------------------------
      // DELETE DATABASE RECORD
      // --------------------------------

      await NewArrival.findByIdAndDelete(
        id
      );

      return res.status(
        200
      ).json({
        success: true,

        message:
          "New Arrival deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE NEW ARRIVAL ERROR:",
        error
      );

      return res.status(
        500
      ).json({
        success: false,

        message:
          "Failed to delete New Arrival",

        error:
          error.message,
      });
    }
  };

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  createNewArrival,
  getAllNewArrivals,
  getNewArrivalById,
  updateNewArrival,
  deleteNewArrival,
};