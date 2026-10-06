const mongoose = require("mongoose");
// Adjust path relative to root directory
const Product = require("./models/productModel");
const Inventory = require("./models/inventoryModel");

async function syncExistingProducts() {
  try {
    // Replace with your actual MongoDB connection string (or process.env.MONGO_URI)
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/your-database-name");
    console.log("Connected to database...");

    const products = await Product.find({ isDeleted: false });

    for (const product of products) {
      const exists = await Inventory.findOne({ productId: product._id });
      if (!exists) {
        let totalQty = 0;
        let sellingPrice = 0;

        if (Array.isArray(product.variants)) {
          product.variants.forEach((v) => {
            if (v.price && !sellingPrice) sellingPrice = Number(v.price) || 0;
            if (Array.isArray(v.sizes)) {
              totalQty += v.sizes.reduce((sum, s) => sum + (Number(s.stockQuantity) || 0), 0);
            } else {
              totalQty += Number(v.quantity) || 0;
            }
          });
        }

        await Inventory.create({
          productId: product._id,
          quantity: totalQty,
          reservedQuantity: 0,
          availableQuantity: totalQty,
          lowStockThreshold: 5,
          sellingPrice: sellingPrice,
          stockStatus: totalQty > 5 ? "IN_STOCK" : totalQty > 0 ? "LOW_STOCK" : "OUT_OF_STOCK",
        });
        console.log(`Synced inventory for product: ${product.name}`);
      }
    }

    console.log("Existing products successfully synced to Inventory!");
  } catch (error) {
    console.error("Error syncing inventory:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

syncExistingProducts();