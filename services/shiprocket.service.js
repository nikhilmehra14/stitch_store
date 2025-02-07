import axios from "axios";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";

const SHIPROCKET_BASE_URL = process.env.SHIPROCKET_BASE_URL;
let SHIPROCKET_TOKEN = null;

export const authenticateShiprocket = async () => {
  try {
    const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    SHIPROCKET_TOKEN = response.data.token;
    return SHIPROCKET_TOKEN;
  } catch (error) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to authenticate with Shiprocket");
  }
};

export const createShiprocketOrder = async (orderDetails) => {
  if (!SHIPROCKET_TOKEN) {
    await authenticateShiprocket();
  }

  try {
    const response = await axios.post(`${SHIPROCKET_BASE_URL}/orders/create/adhoc`, orderDetails, {
      headers: {
        Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
      },
    });

    return response?.data;
  } catch (error) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create Shiprocket order", error.message);
  }
};

export const generateShippingLabel = async (orderId) => {
  if (!SHIPROCKET_TOKEN) {
    await authenticateShiprocket();
  }

  try {
    const response = await axios.get(`${SHIPROCKET_BASE_URL}/courier/generate/label`, {
      params: { order_id: orderId },
      headers: {
        Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
      },
    });

    return response.data;
  } catch (error) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate shipping label", error.message);
  }
};

export const trackShiprocketOrder = async (shipmentId) => {
  if (!SHIPROCKET_TOKEN) {
    await authenticateShiprocket();
  }

  try {
    const response = await axios.get(`${SHIPROCKET_BASE_URL}/courier/track`, {
      params: { shipment_id: shipmentId },
      headers: {
        Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
      },
    });

    return response?.data;
  } catch (error) {
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to track Shiprocket order", error.message);
  }
};

export const cancelShiprocketOrder = async (shiprocketOrderId) => {
    if (!SHIPROCKET_TOKEN) {
      await authenticateShiprocket();
    }
  
    try {
      const response = await axios.post(
        `${SHIPROCKET_BASE_URL}/orders/cancel`,
        { order_id: shiprocketOrderId },
        {
          headers: {
            Authorization: `Bearer ${SHIPROCKET_TOKEN}`,
          },
        }
      );
  
      return response?.data;
    } catch (error) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to cancel Shiprocket order", error.message);
    }
  };
  