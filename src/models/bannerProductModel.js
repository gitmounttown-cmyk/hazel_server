const mongoose=require("mongoose");

const bannerProductSchema= new mongoose.Schema({
    bannerId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"Banner",
        required:true
    },
    productId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"Product",
        required:true
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

module.exports=mongoose.model("BannerProduct",bannerProductSchema);