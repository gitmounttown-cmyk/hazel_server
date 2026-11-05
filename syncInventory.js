require("dotenv").config();
const mongoose = require("mongoose");
const { syncAllProductInventory } = require("./src/services/inventoryService");

async function syncExistingProducts() {
  try {
    const mongoUri =
      process.env.MONGODB_LOCAL ||
      process.env.MONGODB_ATLAS ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/hazel_ecommerce";

    console.log("Connecting to database...");
    await mongoose.connect(mongoUri);
    console.log("Connected to database. Starting sync...");

    const result = await syncAllProductInventory();
    console.log(`Successfully synced ${result.syncedCount} products to Inventory!`);
  } catch (error) {
    console.error("Error syncing inventory:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

syncExistingProducts();
