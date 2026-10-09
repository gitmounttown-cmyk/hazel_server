const axios = require("axios");
const VelocityShipment = require("../models/velocityShipmentModel");

const VELOCITY_BASE_URL = "https://shazam.velocity.in";

const getHeaders = () => {
  let token = process.env.VELOCITY_AUTH_TOKEN || "";
  
  // Automatically prepends Bearer if not present
  if (token && !token.startsWith("Bearer ")) {
    token = `Bearer ${token}`;
  }

  return {
    "Content-Type": "application/json",
    Authorization: token,
  };
};

// ==========================================================
// 1. CHECK SERVICEABILITY
// POST /api/velocity/check-serviceability
// ==========================================================
exports.checkServiceability = async (req, res) => {
  try {
    const { fromPincode, toPincode, paymentMode = "cod", shipmentType = "forward" } = req.body;

    if (!fromPincode || !toPincode) {
      return res.status(400).json({
        success: false,
        message: "Source (from) and Destination (to) pincodes are required",
      });
    }

    const payload = {
      from: String(fromPincode),
      to: String(toPincode),
      payment_mode: paymentMode.toLowerCase(),
      shipment_type: shipmentType.toLowerCase(),
    };

    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/serviceability`,
      payload,
      { headers: getHeaders() }
    );

    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Velocity Serviceability Error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to check serviceability",
      error: error.response?.data || error.message,
    });
  }
};

// ==========================================================
// 2. MANIFEST FORWARD SHIPMENT
// POST /api/velocity/manifest-order
// ==========================================================
exports.manifestForwardOrder = async (req, res) => {
  try {
    const {
      orderNumber,
      carrierId,
      warehouseId,
      pickupLocation,
      customer,
      items,
      paymentMethod,
      subTotal,
      totalAmount,
      packageDimensions,
    } = req.body;

    if (!orderNumber || !customer || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderNumber, customer, or items",
      });
    }

    const payload = {
      order_id: String(orderNumber),
      order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
      carrier_id: carrierId || "",
      billing_customer_name: customer.name,
      billing_last_name: customer.lastName || "",
      billing_address: customer.address,
      billing_city: customer.city,
      billing_pincode: String(customer.pincode),
      billing_state: customer.state,
      billing_country: customer.country || "India",
      billing_email: customer.email || "customer@example.com",
      billing_phone: String(customer.phone),
      shipping_is_billing: true,
      print_label: true,
      order_items: items.map((item) => ({
        name: item.name,
        sku: item.sku || "SKU-DEFAULT",
        units: Number(item.units || 1),
        selling_price: Number(item.price || 0),
        discount: Number(item.discount || 0),
        tax: Number(item.tax || 0),
      })),
      payment_method: paymentMethod === "COD" ? "COD" : "PREPAID",
      sub_total: Number(subTotal || totalAmount),
      cod_collectible: paymentMethod === "COD" ? Number(totalAmount) : 0,
      length: Number(packageDimensions?.length || 10),
      breadth: Number(packageDimensions?.breadth || 10),
      height: Number(packageDimensions?.height || 10),
      weight: Number(packageDimensions?.weight || 0.5),
      pickup_location: pickupLocation || process.env.VELOCITY_PICKUP_LOCATION || "Primary Warehouse",
      warehouse_id: warehouseId,
    };

    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/forward-order-orchestration`,
      payload,
      { headers: getHeaders() }
    );

    const result = response.data;

    if (result.status === 1 && result.payload) {
      const p = result.payload;

      const shipment = await VelocityShipment.create({
        orderNumber: String(orderNumber),
        velocityOrderId: p.order_id,
        shipmentId: p.shipment_id,
        awbCode: p.awb_code,
        courierCompanyId: p.courier_company_id,
        courierName: p.courier_name,
        labelUrl: p.label_url,
        manifestUrl: p.manifest_url,
        shippingAddress: {
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          pincode: customer.pincode,
        },
        packageDetails: packageDimensions,
        charges: {
          shippingCharges: Number(p.charges?.frwd_charges?.shipping_charges || 0),
          codCharges: Number(p.charges?.frwd_charges?.cod_charges || 0),
          rtoCharges: Number(p.charges?.rto_charges?.rto_charges || 0),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Shipment manifested successfully",
        data: shipment,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Manifestation failed",
      data: result,
    });
  } catch (error) {
    console.error("Velocity Manifest Error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Failed to manifest shipment with Velocity",
      error: error.response?.data || error.message,
    });
  }
};

// ==========================================================
// 3. TRACK SHIPMENT BY AWB CODE
// GET /api/velocity/track/:awbCode
// ==========================================================
exports.trackShipment = async (req, res) => {
  try {
    const { awbCode } = req.params;

    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`,
      { awbs: [awbCode] },
      { headers: getHeaders() }
    );

    const trackingInfo = response.data?.result?.[awbCode];

    if (trackingInfo) {
      const activities = trackingInfo.shipment_track_activities || [];
      const currentStatus = trackingInfo.tracking_data?.shipment_status;

      await VelocityShipment.findOneAndUpdate(
        { awbCode },
        {
          status: currentStatus,
          trackingHistory: activities,
        }
      );

      return res.json({
        success: true,
        trackingData: trackingInfo,
      });
    }

    return res.status(404).json({ success: false, message: "No tracking details found for AWB" });
  } catch (error) {
    console.error("Velocity Track Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to track shipment",
      error: error.response?.data || error.message,
    });
  }
};

// ==========================================================
// 4. TRACK SHIPMENT BY ORDER NUMBER
// GET /api/velocity/track-by-order/:orderNumber
// ==========================================================
// GET /api/velocity/track-by-order/:orderNumber
exports.trackByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    // Find shipment by Order Number
    const shipment = await VelocityShipment.findOne({ orderNumber });

    // Return 200 with success: false if no shipment or AWB is created yet
    if (!shipment || !shipment.awbCode) {
      return res.status(200).json({
        success: false,
        message: "Shipment details will be available once packed and dispatched.",
      });
    }

    // Fetch tracking details from Velocity API using AWB Code
    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`,
      { awbs: [shipment.awbCode] },
      { headers: getHeaders() }
    );

    const trackingInfo = response.data?.result?.[shipment.awbCode];

    return res.status(200).json({
      success: true,
      awbCode: shipment.awbCode,
      courierName: shipment.courierName,
      status: trackingInfo?.tracking_data?.shipment_status || shipment.status,
      activities: trackingInfo?.shipment_track_activities || [],
    });
  } catch (error) {
    console.error("Tracking Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch live tracking details",
    });
  }
};

// ==========================================================
// 5. CANCEL SHIPMENT
// POST /api/velocity/cancel
// ==========================================================
exports.cancelShipment = async (req, res) => {
  try {
    const { awbCode } = req.body;

    if (!awbCode) {
      return res.status(400).json({ success: false, message: "AWB code is required" });
    }

    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/cancel-order`,
      { awbs: [awbCode] },
      { headers: getHeaders() }
    );

    await VelocityShipment.findOneAndUpdate({ awbCode }, { status: "CANCELLED" });

    return res.json({
      success: true,
      message: response.data?.message || "Cancellation initiated successfully",
    });
  } catch (error) {
    console.error("Velocity Cancel Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel Velocity shipment",
      error: error.response?.data || error.message,
    });
  }
};