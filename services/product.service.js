import api from "./api";

export const getProductByBarcode = async (barcode) => {
  try {
    if (!barcode) {
      throw new Error("Barcode is required");
    }

    const response = await api.get(
      `/products/barcode/${encodeURIComponent(barcode)}`
    );

    console.log("Product Barcode Response:", response);

    return response;
  } catch (error) {
    console.error(
      "getProductByBarcode error:",
      error?.message || error
    );

    throw error;
  }
};