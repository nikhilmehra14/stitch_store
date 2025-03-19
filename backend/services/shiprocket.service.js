import axios from "axios";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";

const SHIPROCKET_BASE_URL = process.env.SHIPROCKET_BASE_URL;
let SHIPROCKET_TOKEN = null;
let SHIPROCKET_TOKEN_EXPIRY = null;

export const authenticateShiprocket = async () => {
  try {
    const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    SHIPROCKET_TOKEN = response?.data?.token;
    SHIPROCKET_TOKEN_EXPIRY = Date.now() + 10 * 24 * 60 * 60 * 1000;
    return SHIPROCKET_TOKEN;
  } catch (error) {
    console.dir("Error: ", error);
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to authenticate with Shiprocket", error.message);
  }
};

const isTokenValid = () => {
  return SHIPROCKET_TOKEN && SHIPROCKET_TOKEN_EXPIRY && Date.now() < SHIPROCKET_TOKEN_EXPIRY;
};

const ensureTokenValid = async () => {
  if (!isTokenValid()) {
    await authenticateShiprocket();
  }
};

export const createShiprocketOrder = async (orderDetails) => {
  try {
    console.log("SHIPROCKET_TOKEN  and EXPIRY:",  SHIPROCKET_TOKEN,   SHIPROCKET_TOKEN_EXPIRY);
    await ensureTokenValid();
    console.log("Order Details: ", orderDetails);    
    const response = await axios.post(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`, orderDetails, {
      headers: {
        Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
      },
    });
    console.log("received respose from shiprocket: ", response?.data);
    return response?.data;
  } catch (error) {
    console.log("Error while creating shiprocket order: ", error);
    if (error.response?.status === HttpStatus.UNAUTHORIZED.code) {
      await authenticateShiprocket();
      return createShiprocketOrder(orderDetails);
    }
    console.error(error);
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create Shiprocket order", error.message);
  }
};

export const generateShippingLabel = async (shipmentId) => {
  try {
    await ensureTokenValid();

    const awbResponse = await assignAWB(shipmentId);
    console.log("AWB Assigned:", awbResponse);

    const response = await axios.post(`${SHIPROCKET_BASE_URL}/courier/generate/label`,
      { shipment_id: [shipmentId] },
      {
        headers: {
	'Content-Type': 'application/json',
        Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
      },
    });

    console.log("Shipping Label Response:", response.data);
    return response?.data;
  } catch (error) {
    console.log("Error while generating shipping label:", error);
    if (error.response?.status === HttpStatus.UNAUTHORIZED.code) {
      await authenticateShiprocket();
      return generateShippingLabel(shipmentId);
    }
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate shipping label", error.message);
  }
};

export const assignAWB = async (shipmentId) => {
  try {
    await ensureTokenValid();

    const response = await axios.post(
      `${SHIPROCKET_BASE_URL}/courier/assign/awb`,
      { shipment_id: shipmentId },
      {
        headers: {
          Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
        },
      }
    );

    return response?.data;
  } catch (error) {
    if (error.response?.status === HttpStatus.UNAUTHORIZED.code) {
      await authenticateShiprocket();
      return assignAWB(shipmentId);
    }
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to assign AWB", error.message);
  }
};

export const trackShiprocketOrder = async (shipmentId) => {
  try {
    await ensureTokenValid();

    const response = await axios.get(`${SHIPROCKET_BASE_URL}/courier/track`, {
      params: { shipment_id: shipmentId },
      headers: {
        Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === HttpStatus.UNAUTHORIZED.code) {
      await authenticateShiprocket();
      return trackShiprocketOrder(shipmentId);
    }
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to track Shiprocket order", error.message);
  }
};

export const cancelShiprocketOrder = async (shiprocketOrderId) => {
  try {
    await ensureTokenValid();

    const response = await axios.post(
      `${SHIPROCKET_BASE_URL}/orders/cancel`,
      { ids: [shiprocketOrderId] },
      {
        headers: {
          Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response?.status === HttpStatus.UNAUTHORIZED.code) {
      await authenticateShiprocket();
      return cancelShiprocketOrder(shiprocketOrderId);
    }
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to cancel Shiprocket order", error.message);
  }
};
