const HeroSlide = require("../models/HeroSlide");

exports.getSlides = async (req, res) => {
  try {
    const slides = await HeroSlide.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: slides });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSlide = async (req, res) => {
  try {
    const { tag } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "Please select at least one image file" });
    }

    const createdSlides = [];

    for (const file of req.files) {
      // PERMANENT FIX: Prepend the full backend port URL here
      const imageUrl = `http://localhost:5004/uploads/${file.filename}`;
      const newSlide = await HeroSlide.create({
        tag: tag || "PREMIUM COTTON NIGHTWEAR",
        image: imageUrl,
      });
      createdSlides.push(newSlide);
    }

    res.status(201).json({ success: true, data: createdSlides });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ success: false, message: "Slide not found" });
    }

    await slide.deleteOne();
    res.status(200).json({ success: true, message: "Slide removed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};