const mongoose = require("mongoose");

const Location = require("../models/locationModel");

const {
  reverseGeocode,
} = require("../services/nominationService");

// ==========================================================
// HELPER
// GET ADDRESS COMPONENT
// ==========================================================

const getAddressComponent = (
  address,
  keys
) => {
  for (const key of keys) {
    if (address?.[key]) {
      return address[key];
    }
  }

  return "";
};

// ==========================================================
// SAVE CURRENT LOCATION
// POST /api/locations
// ==========================================================

exports.saveLocation = async (
  req,
  res
) => {
  try {
    // ========================================================
    // USER
    // ========================================================

    const userId = req.user?.id;

    // ========================================================
    // REQUEST BODY
    // ========================================================

    const {
      latitude,
      longitude,
      source = "gps",
    } = req.body;

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === null ||
      longitude === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Latitude and longitude are required",
      });
    }

    // ========================================================
    // CONVERT TO NUMBER
    // ========================================================

    const lat = Number(latitude);
    const lng = Number(longitude);

    // ========================================================
    // VALIDATE NUMBERS
    // ========================================================

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Latitude and longitude must be valid numbers",
      });
    }

    // ========================================================
    // VALIDATE LATITUDE
    // ========================================================

    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message:
          "Latitude must be between -90 and 90",
      });
    }

    // ========================================================
    // VALIDATE LONGITUDE
    // ========================================================

    if (lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message:
          "Longitude must be between -180 and 180",
      });
    }

    // ========================================================
    // VALIDATE SOURCE
    // ========================================================

    const allowedSources = [
      "gps",
      "map",
      "manual",
    ];

    if (
      !allowedSources.includes(source)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid source. Allowed values are gps, map, manual",
      });
    }

    // ========================================================
    // VALIDATE USER ID
    // ========================================================

    if (
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user ID",
      });
    }

    // ========================================================
    // NOMINATIM REVERSE GEOCODING
    // ========================================================

    let geoData = null;

    try {
      geoData =
        await reverseGeocode(
          lat,
          lng
        );
    } catch (geocodeError) {
      console.error(
        "REVERSE GEOCODING FAILED:",
        geocodeError.message
      );

      // We do NOT fail the complete location request.
      // GPS coordinates can still be saved.
      geoData = null;
    }

    // ========================================================
    // ADDRESS OBJECT
    // ========================================================

    const address =
      geoData?.address || {};

    // ========================================================
    // EXTRACT ADDRESS DETAILS
    // ========================================================

    const houseNumber =
      getAddressComponent(
        address,
        [
          "house_number",
        ]
      );

    const street =
      getAddressComponent(
        address,
        [
          "road",
          "street",
        ]
      );

    const area =
      getAddressComponent(
        address,
        [
          "suburb",
          "neighbourhood",
          "neighborhood",
          "village",
        ]
      );

    const landmark =
      getAddressComponent(
        address,
        [
          "amenity",
          "building",
        ]
      );

    const city =
      getAddressComponent(
        address,
        [
          "city",
          "town",
          "municipality",
          "village",
        ]
      );

    const district =
      getAddressComponent(
        address,
        [
          "county",
          "state_district",
        ]
      );

    const state =
      getAddressComponent(
        address,
        [
          "state",
        ]
      );

    const country =
      getAddressComponent(
        address,
        [
          "country",
        ]
      ) || "India";

    const pincode =
      getAddressComponent(
        address,
        [
          "postcode",
        ]
      );

    // ========================================================
    // FORMATTED ADDRESS
    // ========================================================

    const formattedAddress =
      geoData?.display_name || "";

    // ========================================================
    // PLACE ID
    // ========================================================

    const placeId =
      geoData?.place_id
        ? String(geoData.place_id)
        : "";

    // ========================================================
    // MARK OLD CURRENT LOCATIONS FALSE
    // ========================================================

    await Location.updateMany(
      {
        user: userId,
        isCurrent: true,
      },
      {
        $set: {
          isCurrent: false,
        },
      }
    );

    // ========================================================
    // CREATE LOCATION
    // ========================================================

    const location =
      await Location.create({
        user: userId,

        latitude: lat,

        longitude: lng,

        placeId,

        formattedAddress,

        houseNumber,

        street,

        area,

        landmark,

        city,

        district,

        state,

        country,

        pincode,

        source,

        isCurrent: true,
      });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,

      message:
        "Current location detected and saved successfully",

      location,
    });
  } catch (error) {
    console.error(
      "SAVE LOCATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to save location",

      error: error.message,
    });
  }
};

// ==========================================================
// GET CURRENT LOCATION
// GET /api/locations/current
// ==========================================================

exports.getCurrentLocation =
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      const location =
        await Location.findOne({
          user: userId,
          isCurrent: true,
        });

      if (!location) {
        return res.status(404).json({
          success: false,
          message:
            "Current location not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Current location fetched successfully",
        location,
      });
    } catch (error) {
      console.error(
        "GET CURRENT LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get current location",
        error: error.message,
      });
    }
  };

// ==========================================================
// GET ALL LOCATIONS
// GET /api/locations
// ==========================================================

exports.getLocations =
  async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      const locations =
        await Location.find({
          user: userId,
        });

      return res.status(200).json({
        success: true,
        count: locations.length,
        locations,
      });
    } catch (error) {
      console.error(
        "GET LOCATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get locations",
        error: error.message,
      });
    }
  };

// ==========================================================
// GET LOCATION BY ID
// GET /api/locations/:id
// ==========================================================

exports.getLocationById =
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid location ID",
        });
      }

      const location =
        await Location.findOne({
          _id: id,
          user: userId,
        });

      if (!location) {
        return res.status(404).json({
          success: false,
          message:
            "Location not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Location fetched successfully",
        location,
      });
    } catch (error) {
      console.error(
        "GET LOCATION BY ID ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get location",
        error: error.message,
      });
    }
  };

// ==========================================================
// UPDATE LOCATION
// PUT /api/locations/:id
// ==========================================================

exports.updateLocation =
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      const {
        latitude,
        longitude,
        source,
        isCurrent,
      } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid location ID",
        });
      }

      const existingLocation =
        await Location.findOne({
          _id: id,
          user: userId,
        });

      if (!existingLocation) {
        return res.status(404).json({
          success: false,
          message:
            "Location not found",
        });
      }

      // ======================================================
      // UPDATE DATA
      // ======================================================

      const updateData = {};

      if (latitude !== undefined) {
        const lat = Number(latitude);

        if (
          !Number.isFinite(lat) ||
          lat < -90 ||
          lat > 90
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid latitude",
          });
        }

        updateData.latitude = lat;
      }

      if (longitude !== undefined) {
        const lng = Number(longitude);

        if (
          !Number.isFinite(lng) ||
          lng < -180 ||
          lng > 180
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid longitude",
          });
        }

        updateData.longitude = lng;
      }

      if (source !== undefined) {
        if (
          ![
            "gps",
            "map",
            "manual",
          ].includes(source)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid source",
          });
        }

        updateData.source = source;
      }

      if (
        isCurrent !== undefined
      ) {
        updateData.isCurrent =
          isCurrent;
      }

      // ======================================================
      // CURRENT LOCATION
      // ======================================================

      if (isCurrent === true) {
        await Location.updateMany(
          {
            user: userId,
            _id: {
              $ne: id,
            },
            isCurrent: true,
          },
          {
            $set: {
              isCurrent: false,
            },
          }
        );
      }

      // ======================================================
      // UPDATE
      // ======================================================

      const location =
        await Location.findOneAndUpdate(
          {
            _id: id,
            user: userId,
          },
          {
            $set: updateData,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Location updated successfully",
        location,
      });
    } catch (error) {
      console.error(
        "UPDATE LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update location",
        error: error.message,
      });
    }
  };

// ==========================================================
// SET CURRENT LOCATION
// PATCH /api/locations/:id/current
// ==========================================================

exports.setCurrentLocation =
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid location ID",
        });
      }

      const location =
        await Location.findOne({
          _id: id,
          user: userId,
        });

      if (!location) {
        return res.status(404).json({
          success: false,
          message:
            "Location not found",
        });
      }

      // ======================================================
      // REMOVE CURRENT STATUS
      // ======================================================

      await Location.updateMany(
        {
          user: userId,
          isCurrent: true,
        },
        {
          $set: {
            isCurrent: false,
          },
        }
      );

      // ======================================================
      // SET CURRENT
      // ======================================================

      location.isCurrent = true;

      await location.save();

      return res.status(200).json({
        success: true,
        message:
          "Current location updated successfully",
        location,
      });
    } catch (error) {
      console.error(
        "SET CURRENT LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to set current location",
        error: error.message,
      });
    }
  };

// ==========================================================
// DELETE LOCATION
// DELETE /api/locations/:id
// ==========================================================

exports.deleteLocation =
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid location ID",
        });
      }

      const location =
        await Location.findOne({
          _id: id,
          user: userId,
        });

      if (!location) {
        return res.status(404).json({
          success: false,
          message:
            "Location not found",
        });
      }

      await location.deleteOne();

      return res.status(200).json({
        success: true,
        message:
          "Location deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE LOCATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete location",
        error: error.message,
      });
    }
  };