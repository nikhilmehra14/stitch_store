import { HttpStatus } from "../constants/status.code.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";

export const addAddress = async (req, res) => {
  try {
    const { name, phone, addressLine1, addressLine2, city, state, zipCode, country } = req.body;
    const userId = req.user?._id;

    if (!name || !phone || !addressLine1 || !city || !state || !zipCode || !country) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "All fields are required."));
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "User not found."));
    }

    if (!user.addresses) {
      user.addresses = [];
    }

    const newAddress = { name, phone, addressLine1, addressLine2, city, state, zipCode, country };
    user.addresses.push(newAddress);

    await user.save();

    res.status(HttpStatus.CREATED.code).json({ message: "Address added successfully.", addresses: user.address });
  } catch (error) {
    console.error("Add Address Error:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "An error occurred while adding the address."));
  }
};

export const getAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json({ message: "User not found." });
    }

    res.status(HttpStatus.OK.code).json({ addresses: user.addresses });
  } catch (error) {
    console.error("Get Addresses Error:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json({ message: "An error occurred while retrieving addresses." });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const { name, phone, addressLine1, addressLine2, city, state, zipCode, country } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json({ message: "User not found." });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(HttpStatus.NOT_FOUND.code).json({ message: "Address not found." });
    }

    address.name = name;
    address.phone = phone;
    address.addressLine1 = addressLine1;
    address.addressLine2 = addressLine2;
    address.city = city;
    address.state = state;
    address.zipCode = zipCode;
    address.country = country;

    await user.save();
    res.status(HttpStatus.OK.code).json({ message: "Address updated successfully.", addresses: user.addresses });
  } catch (error) {
    console.error("Update Address Error:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json({ message: "An error occurred while updating the address." });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(HttpStatus.NOT_FOUND.code).json({ message: "User not found." });
    }

    user.addresses.id(addressId).remove();
    await user.save();

    res.status(HttpStatus.OK.code).json({ message: "Address deleted successfully.", addresses: user.addresses });
  } catch (error) {
    console.error("Delete Address Error:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json({ message: "An error occurred while deleting the address." });
  }
};
