const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    let mongoURI;

    if (process.env.NODE_ENV === "production") {
      mongoURI = process.env.MONGODB_ATLAS;
    } else {
      mongoURI = process.env.MONGODB_ATLAS;
    }

    if (!mongoURI) {
      throw new Error("MongoDB connection string is missing");
    }

    console.log("Environment:", process.env.NODE_ENV);
    console.log("MongoDB URI exists:", !!mongoURI);

    const conn = await mongoose.connect(mongoURI);

    console.log("MongoDB Connected Successfully!!");
  } catch (error) {
    console.error("MongoDB Connection Failed");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Full error:", error);

    process.exit(1);
  }
};

module.exports = connectDB;