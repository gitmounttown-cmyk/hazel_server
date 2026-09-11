const mongoose = require("mongoose");
const similarProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  similarProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
const SimilarProduct = mongoose.model("SimilarProduct", similarProductSchema);
module.exports = SimilarProduct;



