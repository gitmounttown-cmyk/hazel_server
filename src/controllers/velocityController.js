// const axios = require("axios");
// const VelocityShipment = require("../models/velocityShipmentModel");

// const VELOCITY_BASE_URL = "https://shazam.velocity.in";
// const VELOCITY_AUTH_TOKEN = process.env.VELOCITY_AUTH_TOKEN;

// const getHeaders = () => ({
//   "Content-Type": "application/json",
//   Authorization: VELOCITY_AUTH_TOKEN,
// });

// // ==========================================================
// // 1. CHECK SERVICEABILITY
// // POST /api/velocity/check-serviceability
// // ==========================================================
// exports.checkServiceability = async (req, res) => {
//   try {
//     const { fromPincode, toPincode, paymentMode = "cod", shipmentType = "forward" } = req.body;

//     if (!fromPincode || !toPincode) {
//       return res.status(400).json({
//         success: false,
//         message: "Source (from) and Destination (to) pincodes are required",
//       });
//     }

//     const payload = {
//       from: String(fromPincode),
//       to: String(toPincode),
//       payment_mode: paymentMode.toLowerCase(),
//       shipment_type: shipmentType.toLowerCase(),
//     };

//     const response = await axios.post(
//       `${VELOCITY_BASE_URL}/custom/api/v1/serviceability`,
//       payload,
//       { headers: getHeaders() }
//     );

//     return res.json({
//       success: true,
//       data: response.data,
//     });
//   } catch (error) {
//     console.error("Velocity Serviceability Error:", error.response?.data || error.message);
//     return res.status(error.response?.status || 500).json({
//       success: false,
//       message: "Failed to check serviceability",
//       error: error.response?.data || error.message,
//     });
//   }
// };

// // ==========================================================
// // 2. MANIFEST FORWARD SHIPMENT
// // POST /api/velocity/manifest-order
// // ==========================================================
// exports.manifestForwardOrder = async (req, res) => {
//   try {
//     const {
//       orderNumber,
//       carrierId,
//       warehouseId,
//       pickupLocation,
//       customer,
//       items,
//       paymentMethod,
//       subTotal,
//       totalAmount,
//       packageDimensions,
//     } = req.body;

//     if (!orderNumber || !customer || !items || !items.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: orderNumber, customer, or items",
//       });
//     }

//     // Prepare Velocity payload directly from request body
//     const payload = {
//       order_id: String(orderNumber),
//       order_date: new Date().toISOString().slice(0, 16).replace("T", " "),
//       carrier_id: carrierId || "",
//       billing_customer_name: customer.name,
//       billing_last_name: customer.lastName || "",
//       billing_address: customer.address,
//       billing_city: customer.city,
//       billing_pincode: String(customer.pincode),
//       billing_state: customer.state,
//       billing_country: customer.country || "India",
//       billing_email: customer.email || "customer@example.com",
//       billing_phone: String(customer.phone),
//       shipping_is_billing: true,
//       print_label: true,
//       order_items: items.map((item) => ({
//         name: item.name,
//         sku: item.sku || "SKU-DEFAULT",
//         units: Number(item.units || 1),
//         selling_price: Number(item.price || 0),
//         discount: Number(item.discount || 0),
//         tax: Number(item.tax || 0),
//       })),
//       payment_method: paymentMethod === "COD" ? "COD" : "PREPAID",
//       sub_total: Number(subTotal || totalAmount),
//       cod_collectible: paymentMethod === "COD" ? Number(totalAmount) : 0,
//       length: Number(packageDimensions?.length || 10),
//       breadth: Number(packageDimensions?.breadth || 10),
//       height: Number(packageDimensions?.height || 10),
//       weight: Number(packageDimensions?.weight || 0.5),
//       pickup_location: pickupLocation || "Primary Warehouse",
//       warehouse_id: warehouseId,
//     };

//     const response = await axios.post(
//       `${VELOCITY_BASE_URL}/custom/api/v1/forward-order-orchestration`,
//       payload,
//       { headers: getHeaders() }
//     );

//     const result = response.data;

//     if (result.status === 1 && result.payload) {
//       const p = result.payload;

//       // Save standalone shipment record
//       const shipment = await VelocityShipment.create({
//         orderNumber: String(orderNumber),
//         velocityOrderId: p.order_id,
//         shipmentId: p.shipment_id,
//         awbCode: p.awb_code,
//         courierCompanyId: p.courier_company_id,
//         courierName: p.courier_name,
//         labelUrl: p.label_url,
//         manifestUrl: p.manifest_url,
//         shippingAddress: {
//           name: customer.name,
//           phone: customer.phone,
//           address: customer.address,
//           city: customer.city,
//           state: customer.state,
//           pincode: customer.pincode,
//         },
//         packageDetails: packageDimensions,
//         charges: {
//           shippingCharges: Number(p.charges?.frwd_charges?.shipping_charges || 0),
//           codCharges: Number(p.charges?.frwd_charges?.cod_charges || 0),
//           rtoCharges: Number(p.charges?.rto_charges?.rto_charges || 0),
//         },
//       });

//       return res.status(200).json({
//         success: true,
//         message: "Shipment manifested successfully",
//         data: shipment,
//       });
//     }

//     return res.status(400).json({
//       success: false,
//       message: "Manifestation failed",
//       data: result,
//     });
//   } catch (error) {
//     console.error("Velocity Manifest Error:", error.response?.data || error.message);
//     return res.status(error.response?.status || 500).json({
//       success: false,
//       message: "Failed to manifest shipment with Velocity",
//       error: error.response?.data || error.message,
//     });
//   }
// };

// // ==========================================================
// // 3. TRACK SHIPMENT
// // GET /api/velocity/track/:awbCode
// // ==========================================================
// exports.trackShipment = async (req, res) => {
//   try {
//     const { awbCode } = req.params;

//     const response = await axios.post(
//       `${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`,
//       { awbs: [awbCode] },
//       { headers: getHeaders() }
//     );

//     const trackingInfo = response.data?.result?.[awbCode];

//     if (trackingInfo) {
//       const activities = trackingInfo.shipment_track_activities || [];
//       const currentStatus = trackingInfo.tracking_data?.shipment_status;

//       await VelocityShipment.findOneAndUpdate(
//         { awbCode },
//         {
//           status: currentStatus,
//           trackingHistory: activities,
//         }
//       );

//       return res.json({
//         success: true,
//         trackingData: trackingInfo,
//       });
//     }

//     return res.status(404).json({ success: false, message: "No tracking details found for AWB" });
//   } catch (error) {
//     console.error("Velocity Track Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to track shipment",
//       error: error.response?.data || error.message,
//     });
//   }
// };

// // ==========================================================
// // 4. CANCEL SHIPMENT
// // POST /api/velocity/cancel
// // ==========================================================
// exports.cancelShipment = async (req, res) => {
//   try {
//     const { awbCode } = req.body;

//     if (!awbCode) {
//       return res.status(400).json({ success: false, message: "AWB code is required" });
//     }

//     const response = await axios.post(
//       `${VELOCITY_BASE_URL}/custom/api/v1/cancel-order`,
//       { awbs: [awbCode] },
//       { headers: getHeaders() }
//     );

//     await VelocityShipment.findOneAndUpdate({ awbCode }, { status: "CANCELLED" });

//     return res.json({
//       success: true,
//       message: response.data?.message || "Cancellation initiated successfully",
//     });
//   } catch (error) {
//     console.error("Velocity Cancel Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to cancel Velocity shipment",
//       error: error.response?.data || error.message,
//     });
//   }
// };

// // // ==========================================================
// // // 5. TRACK GUEST ORDER (Order ID + Mobile Number)
// // // POST /api/velocity/track-order
// // // ==========================================================
// // exports.trackGuestOrder = async (req, res) => {
// //   try {
// //     const { orderId, mobileNumber } = req.body;

// //     if (!orderId || !mobileNumber) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Order ID and Mobile Number are required",
// //       });
// //     }

// //     const cleanOrderId = String(orderId).trim().replace(/^#/, "");
// //     const cleanPhone = String(mobileNumber).replace(/\D/g, "").slice(-10);

// //     // 1. Query main Order model first (where your orders are stored)
// //     let orderDoc = null;
// //     try {
// //       const OrderModel = require("../models/orderModel");
// //       if (OrderModel && OrderModel.findOne) {
// //         const mongoose = require("mongoose");
// //         const queryFilter = {
// //           $or: [
// //             { orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") } }
// //           ]
// //         };
// //         if (mongoose.Types.ObjectId.isValid(cleanOrderId)) {
// //           queryFilter.$or.push({ _id: cleanOrderId });
// //         }
// //         orderDoc = await OrderModel.findOne(queryFilter).maxTimeMS(4000);
// //       }
// //     } catch (dbErr) {
// //       console.warn("Order model query warning:", dbErr.message);
// //     }

// //     if (orderDoc) {
// //       // Check mobileNumber against schema structure (shippingAddress.mobileNumber)
// //       const rawOrderPhone = String(
// //         orderDoc.shippingAddress?.mobileNumber ||
// //         orderDoc.shippingAddress?.phone ||
// //         orderDoc.deliveryAddress?.mobileNumber ||
// //         orderDoc.deliveryAddress?.phone ||
// //         orderDoc.phone ||
// //         orderDoc.customer?.phone ||
// //         ""
// //       );
// //       const orderPhone = rawOrderPhone.replace(/\D/g, "").slice(-10);

// //       // STRICT VALIDATION: Mobile number must match
// //       if (orderPhone && orderPhone.length >= 10) {
// //         if (orderPhone !== cleanPhone) {
// //           return res.status(400).json({
// //             success: false,
// //             message: "Mobile number does not match this order.",
// //           });
// //         }
// //       } else {
// //         return res.status(400).json({
// //           success: false,
// //           message: "Mobile number verification failed for this order.",
// //         });
// //       }

// //       // Optional: Check if a Velocity shipment exists for live status updates without blocking
// //       let shipmentData = null;
// //       try {
// //         shipmentData = await VelocityShipment.findOne({
// //           orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") }
// //         }).maxTimeMS(3000);
// //       } catch (shipErr) {}

// //       const currentStatus = shipmentData?.status || orderDoc.orderStatus || "CONFIRMED";
// //       const history = shipmentData?.trackingHistory || [
// //         { 
// //           date: orderDoc.createdAt ? new Date(orderDoc.createdAt).toLocaleString() : new Date().toLocaleString(), 
// //           activity: "Order Placed & Confirmed", 
// //           location: "Warehouse" 
// //         }
// //       ];

// //       return res.json({
// //         success: true,
// //         data: {
// //           orderNumber: orderDoc.orderNumber || orderDoc._id,
// //           status: currentStatus,
// //           createdAt: orderDoc.createdAt || new Date(),
// //           shippingAddress: orderDoc.shippingAddress || orderDoc.deliveryAddress || { mobileNumber },
// //           awbCode: shipmentData?.awbCode || orderDoc.trackingNumber || "",
// //           trackingHistory: history,
// //         },
// //       });
// //     }

// //     // 2. Fallback check in VelocityShipment collection if not found in Order model
// //     let shipment = null;
// //     try {
// //       shipment = await VelocityShipment.findOne({
// //         orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") }
// //       }).maxTimeMS(4000);
// //     } catch (shipErr) {}

// //     if (shipment) {
// //       const rawShipmentPhone = String(
// //         shipment.shippingAddress?.mobileNumber ||
// //         shipment.shippingAddress?.phone || 
// //         shipment.phone || 
// //         ""
// //       );
// //       const shipmentPhone = rawShipmentPhone.replace(/\D/g, "").slice(-10);

// //       if (shipmentPhone && shipmentPhone.length >= 10) {
// //         if (shipmentPhone !== cleanPhone) {
// //           return res.status(400).json({
// //             success: false,
// //             message: "Mobile number does not match this order.",
// //           });
// //         }
// //       }

// //       return res.json({
// //         success: true,
// //         data: shipment,
// //       });
// //     }

// //     // 3. If neither collection contains the order ID
// //     return res.status(404).json({
// //       success: false,
// //       message: "Order not found with the provided Order ID.",
// //     });

// //   } catch (error) {
// //     console.error("Track Guest Order Error:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: "Failed to track order",
// //       error: error.message,
// //     });
// //   }
// // };

// // ==========================================================
// // 6. TRACK LOGGED-IN USER ORDER BY ORDER NUMBER
// // GET /api/velocity/track-by-order/:orderNumber
// // ==========================================================
// // ==========================================================
// // 6. TRACK LOGGED-IN USER ORDER BY ORDER NUMBER
// // GET /api/velocity/track-by-order/:orderNumber
// // ==========================================================
// // ==========================================================
// // 6. TRACK LOGGED-IN USER ORDER BY ORDER NUMBER (Velocity Live Fetch)
// // GET /api/velocity/track-by-order/:orderNumber
// // ==========================================================
// // ==========================================================
// // 6. TRACK LOGGED-IN USER ORDER BY ORDER NUMBER (Velocity Live Fetch)
// // GET /api/velocity/track-by-order/:orderNumber
// // ==========================================================
// exports.trackUserOrder = async (req, res) => {
//   try {
//     const { orderNumber } = req.params;
//     if (!orderNumber) {
//       return res.status(400).json({ success: false, message: "Order number is required" });
//     }

//     const cleanOrderId = String(orderNumber).trim().replace(/^#/, "");

//     let shipment = await VelocityShipment.findOne({
//       orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") }
//     });

//     let awbCode = shipment?.awbCode;
//     let liveStatus = shipment?.status || "CONFIRMED";
//     let activities = shipment?.trackingHistory || [];

//     if (!awbCode) {
//       const OrderModel = require("../models/orderModel");
//       if (OrderModel) {
//         const orderDoc = await OrderModel.findOne({
//           orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") }
//         });
//         if (orderDoc) {
//           awbCode = orderDoc.trackingNumber;
//           liveStatus = orderDoc.orderStatus || liveStatus;
//         }
//       }
//     }

//     if (awbCode) {
//       try {
//         const response = await axios.post(
//           `${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`,
//           { awbs: [awbCode] },
//           { headers: getHeaders() }
//         );

//         const trackingInfo = response.data?.result?.[awbCode];
//         if (trackingInfo) {
//           activities = trackingInfo.shipment_track_activities || [];
//           liveStatus = trackingInfo.tracking_data?.shipment_status || liveStatus;
//         }
//       } catch (trackErr) {
//         console.warn("Live Velocity tracking fetch warning:", trackErr.message);
//       }
//     }

//     return res.json({
//       success: true,
//       orderNumber: cleanOrderId,
//       awbCode: awbCode || "",
//       status: liveStatus,
//       courierName: shipment?.courierName || "Velocity Partner",
//       activities: activities,
//     });
//   } catch (error) {
//     console.error("Track User Order Error:", error.message);
//     return res.status(500).json({ success: false, message: "Failed to fetch tracking details" });
//   }
// };


const axios = require("axios");
const VelocityShipment = require("../models/velocityShipmentModel");

const VELOCITY_BASE_URL = "https://shazam.velocity.in";
const VELOCITY_AUTH_TOKEN = process.env.VELOCITY_AUTH_TOKEN;

const getHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: VELOCITY_AUTH_TOKEN,
});

// 1. CHECK SERVICEABILITY
exports.checkServiceability = async (req, res) => {
  try {
    const { fromPincode, toPincode, paymentMode = "cod", shipmentType = "forward" } = req.body;
    if (!fromPincode || !toPincode) {
      return res.status(400).json({ success: false, message: "Source and Destination pincodes required" });
    }
    const response = await axios.post(
      `${VELOCITY_BASE_URL}/custom/api/v1/serviceability`,
      { from: String(fromPincode), to: String(toPincode), payment_mode: paymentMode.toLowerCase(), shipment_type: shipmentType.toLowerCase() },
      { headers: getHeaders() }
    );
    return res.json({ success: true, data: response.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to check serviceability", error: error.message });
  }
};

// Internal helper to handle automatic order manifestation for both guest and logged-in orders
const manifestOrderHelper = async (orderData) => {
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
  } = orderData;

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
    billing_phone: String(customer.phone || customer.mobileNumber),
    shipping_is_billing: true,
    print_label: true,
    order_items: items.map((i) => ({
      name: i.name || i.productName,
      sku: i.sku || "SKU-DEF",
      units: Number(i.quantity || i.units || 1),
      selling_price: Number(i.price || i.selling_price || 0),
    })),
    payment_method: paymentMethod === "COD" ? "COD" : "PREPAID",
    sub_total: Number(subTotal || totalAmount),
    cod_collectible: paymentMethod === "COD" ? Number(totalAmount) : 0,
    length: Number(packageDimensions?.length || 10),
    breadth: Number(packageDimensions?.breadth || 10),
    height: Number(packageDimensions?.height || 10),
    weight: Number(packageDimensions?.weight || 0.5),
    pickup_location: pickupLocation || "Primary Warehouse",
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
      courierName: p.courier_name,
      labelUrl: p.label_url,
      manifestUrl: p.manifest_url,
      shippingAddress: {
        name: customer.name,
        phone: customer.phone || customer.mobileNumber,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
      },
    });
    return shipment;
  }
  throw new Error(result.message || "Velocity manifestation failed");
};

// 2. MANIFEST FORWARD SHIPMENT (API Endpoint)
exports.manifestForwardOrder = async (req, res) => {
  try {
    const shipment = await manifestOrderHelper(req.body);
    return res.status(200).json({
      success: true,
      message: "Shipment manifested successfully",
      data: shipment,
    });
  } catch (error) {
    console.error("Velocity Manifest Error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to manifest shipment with Velocity",
      error: error.response?.data || error.message,
    });
  }
};

// 3. TRACK SHIPMENT
exports.trackShipment = async (req, res) => {
  try {
    const { awbCode } = req.params;
    const response = await axios.post(`${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`, { awbs: [awbCode] }, { headers: getHeaders() });
    const trackingInfo = response.data?.result?.[awbCode];
    if (trackingInfo) {
      await VelocityShipment.findOneAndUpdate({ awbCode }, { status: trackingInfo.tracking_data?.shipment_status, trackingHistory: trackingInfo.shipment_track_activities || [] });
      return res.json({ success: true, trackingData: trackingInfo });
    }
    return res.status(404).json({ success: false, message: "No tracking details found" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to track", error: error.message });
  }
};

// 4. CANCEL SHIPMENT
exports.cancelShipment = async (req, res) => {
  try {
    const { awbCode } = req.body;
    if (!awbCode) return res.status(400).json({ success: false, message: "AWB code required" });
    const response = await axios.post(`${VELOCITY_BASE_URL}/custom/api/v1/cancel-order`, { awbs: [awbCode] }, { headers: getHeaders() });
    await VelocityShipment.findOneAndUpdate({ awbCode }, { status: "CANCELLED" });
    return res.json({ success: true, message: response.data?.message || "Cancelled successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to cancel", error: error.message });
  }
};

// 5. TRACK GUEST ORDER
exports.trackGuestOrder = async (req, res) => {
  try {
    const { orderId, mobileNumber } = req.body;
    if (!orderId || !mobileNumber) {
      return res.status(400).json({ success: false, message: "Order ID and Mobile Number are required" });
    }
    const cleanOrderId = String(orderId).trim().replace(/^#/, "");
    const cleanPhone = String(mobileNumber).replace(/\D/g, "").slice(-10);

    let orderDoc = null;
    try {
      const OrderModel = require("../models/orderModel");
      if (OrderModel) {
        orderDoc = await OrderModel.findOne({ orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") } }).maxTimeMS(4000);
      }
    } catch (err) {}

    if (orderDoc) {
      const rawOrderPhone = String(orderDoc.shippingAddress?.mobileNumber || orderDoc.shippingAddress?.phone || orderDoc.phone || "").replace(/\D/g, "").slice(-10);
      if (rawOrderPhone && rawOrderPhone !== cleanPhone) {
        return res.status(400).json({ success: false, message: "Mobile number does not match this order." });
      }

      let shipment = await VelocityShipment.findOne({ orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") } });
      if (!shipment) {
        try {
          shipment = await manifestOrderHelper({
            orderNumber: orderDoc.orderNumber,
            customer: {
              name: orderDoc.shippingAddress?.name || "Customer",
              address: orderDoc.shippingAddress?.addressLine1 || orderDoc.shippingAddress?.address || "Address",
              city: orderDoc.shippingAddress?.city || "City",
              state: orderDoc.shippingAddress?.state || "State",
              pincode: orderDoc.shippingAddress?.pincode || "641001",
              phone: rawOrderPhone,
            },
            items: orderDoc.items || [],
            paymentMethod: orderDoc.paymentMethod || "ONLINE",
            totalAmount: orderDoc.totalAmount || 0,
          });
        } catch (manifestErr) {
          console.warn("Auto-manifestation warning during guest track:", manifestErr.message);
        }
      }

      let liveStatus = shipment?.status || orderDoc.orderStatus || "CONFIRMED";
      let activities = shipment?.trackingHistory || [];

      if (shipment?.awbCode) {
        try {
          const response = await axios.post(`${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`, { awbs: [shipment.awbCode] }, { headers: getHeaders() });
          const trackingInfo = response.data?.result?.[shipment.awbCode];
          if (trackingInfo) {
            activities = trackingInfo.shipment_track_activities || [];
            liveStatus = trackingInfo.tracking_data?.shipment_status || liveStatus;
          }
        } catch (trackErr) {}
      }

      return res.json({
        success: true,
        data: {
          orderNumber: orderDoc.orderNumber || orderDoc._id,
          status: liveStatus,
          createdAt: orderDoc.createdAt,
          shippingAddress: orderDoc.shippingAddress,
          awbCode: shipment?.awbCode || "",
          trackingHistory: activities,
        }
      });
    }

    let shipment = await VelocityShipment.findOne({ orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") } }).maxTimeMS(4000);
    if (shipment) {
      return res.json({ success: true, data: shipment });
    }

    return res.status(404).json({ success: false, message: "Order not found with provided Order ID." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to track order", error: error.message });
  }
};

// 6. TRACK LOGGED-IN USER ORDER
exports.trackUserOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) return res.status(400).json({ success: false, message: "Order number required" });
    
    const cleanOrderId = String(orderNumber).trim().replace(/^#/, "");
    let shipment = await VelocityShipment.findOne({ orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") } });
    
    if (!shipment) {
      try {
        const OrderModel = require("../models/orderModel");
        if (OrderModel) {
          const orderDoc = await OrderModel.findOne({ orderNumber: { $regex: new RegExp(`^#?${cleanOrderId}$`, "i") } });
          if (orderDoc) {
            shipment = await manifestOrderHelper({
              orderNumber: orderDoc.orderNumber,
              customer: {
                name: orderDoc.shippingAddress?.name || "Customer",
                address: orderDoc.shippingAddress?.addressLine1 || orderDoc.shippingAddress?.address || "Address",
                city: orderDoc.shippingAddress?.city || "City",
                state: orderDoc.shippingAddress?.state || "State",
                pincode: orderDoc.shippingAddress?.pincode || "641001",
                phone: orderDoc.shippingAddress?.mobileNumber || orderDoc.phone,
              },
              items: orderDoc.items || [],
              paymentMethod: orderDoc.paymentMethod || "ONLINE",
              totalAmount: orderDoc.totalAmount || 0,
            });
          }
        }
      } catch (manifestErr) {
        console.warn("Auto-manifestation warning during user track:", manifestErr.message);
      }
    }

    let awbCode = shipment?.awbCode;
    let liveStatus = shipment?.status || "CONFIRMED";
    let activities = shipment?.trackingHistory || [];

    if (awbCode) {
      try {
        const response = await axios.post(`${VELOCITY_BASE_URL}/custom/api/v1/order-tracking`, { awbs: [awbCode] }, { headers: getHeaders() });
        const trackingInfo = response.data?.result?.[awbCode];
        if (trackingInfo) {
          activities = trackingInfo.shipment_track_activities || [];
          liveStatus = trackingInfo.tracking_data?.shipment_status || liveStatus;
        }
      } catch (trackErr) {}
    }

    return res.json({
      success: true,
      orderNumber: cleanOrderId,
      awbCode: awbCode || "",
      status: liveStatus,
      activities: activities,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch tracking details" });
  }
};