import api from "./api";

/**
 * Get product details using barcode
 *
 * API:
 * GET /products/barcode/{barcode}
 *
 * Example:
 * GET /products/barcode/8901234567890
 */
export const getProductByBarcode = async (barcode) => {
  try {
    if (!barcode) {
      throw new Error("Barcode is required");
    }

    const response = await api.get(
      `/products/barcode/${encodeURIComponent(barcode)}`
    );

    return response.data;
  } catch (error) {
    console.error(
      "getProductByBarcode error:",
      error?.response?.data || error.message
    );

    throw error;
  }
};