import fs from "fs";
import path from "path";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { HttpStatus } from "../constants/status.code.js";
import { Product } from "../models/product.model.js";
import mongoose from "mongoose";
import { uploadOnCloudinary } from "../services/cloudinary.service.js";

export const addProduct = async (req, res) => {
  try {
    const { product_name, sku, category, description, price, stock } = req.body;
    if (!product_name || !sku || !category || !description || !price || !stock) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "All fields are required"));
    }

    const imageUrls = [];
    for (const file of req.files) {
      const uploadedImage = await uploadOnCloudinary(file.path);
      if (uploadedImage) {
        imageUrls.push(uploadedImage.secure_url);
      }
    }

    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(new ApiError(HttpStatus.BAD_REQUEST.code, "Product with this SKU already exists"));
    }

    const newProduct = new Product({
      product_name,
      sku,
      category,
      description,
      price,
      images: imageUrls,
      stock,
    });

    const savedProduct = await newProduct.save();
    res.status(HttpStatus.CREATED.code).json(new ApiResponse(HttpStatus.CREATED.code, savedProduct, "Product added successfully"));
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while adding product", error.message));
  }
};


export const getProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const products = await Product.find(filter);
    res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, products, "Products Fetched Successfully"));
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while fetching products details", error.message));
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(HttpStatus.NOT_FOUND.code).json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found"));
    }

    res.status(HttpStatus.OK.code).json(new ApiResponse(HttpStatus.OK.code, product, "Product details fetched successfully"));
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(new ApiError(HttpStatus.INTERNAL_SERVER_ERROR.code, "Error while fetching product details", error.message));
  }
};

export const updateProduct = async (req, res) => {
  try {
    const _id = req.params?.id;
    const { product_name, sku, category, description, price, stock } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(new ApiError(HttpStatus.BAD_REQUEST.code, "Invalid Product ID"));
    }

    const product = await Product.findById(_id);
    if (!product) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found"));
    }

    if (product.images && product.images.length > 0) {
      product.images.forEach((imagePath) => {
        const fullPath = path.resolve(imagePath);
        fs.unlink(fullPath, (err) => {
          if (err) {
            console.error(`Failed to delete image: ${fullPath}`, err);
          } else {
            console.log(`Image deleted: ${fullPath}`);
          }
        });
      });
    }

    product.images = [];

    const imageUrls = [];
    for (const file of req.files) {
      const uploadedImage = await uploadOnCloudinary(file.path);
      if (uploadedImage) {
        imageUrls.push(uploadedImage.secure_url);
      }
    }

    if (imageUrls.length > 0) {
      product.images.push(...imageUrls);
    }

    product.product_name = product_name || product.product_name;
    product.sku = sku || product.sku;
    product.category = category || product.category;
    product.description = description || product.description;
    product.price = price || product.price;
    product.stock = stock || product.stock;

    const updatedProduct = await product.save();

    return res
      .status(HttpStatus.OK.code)
      .json(
        new ApiResponse(
          HttpStatus.OK.code,
          updatedProduct,
          "Product updated successfully"
        )
      );
  } catch (error) {
    console.error("Error updating product:", error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Error while updating product details",
          error.message
        )
      );
  }
};


export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ApiError(HttpStatus.NOT_FOUND.code, "Product not found"));
    }
    if (product.images && product.images.length > 0) {
      product.images.forEach((imagePath) => {
        const fullPath = path.resolve(imagePath);
        fs.unlink(fullPath, (err) => {
          if (err) {
            console.error(`Failed to delete image: ${fullPath}`, err);
          } else {
            console.log(`Image deleted: ${fullPath}`);
          }
        });
      });
    }

    await product.deleteOne();

    return res
      .status(HttpStatus.OK.code)
      .json(
        new ApiResponse(HttpStatus.OK.code, product, "Product deleted successfully")
      );
  } catch (error) {
    console.error("Error deleting product:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          "Error while deleting product",
          error.message
        )
      );
  }
};
