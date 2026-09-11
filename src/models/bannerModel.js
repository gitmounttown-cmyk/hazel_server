const mongoose = require("mongoose");


const bannerListSchema = new mongoose.Schema({

  bannerType: {

    type: String,

    enum: [

      "offer",
      "festival",
      "dailyUsage"

      //

    ],

    required: true

  },

  imageURL: {

    type: String,

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

module.exports = mongoose.model("Banner", bannerListSchema);