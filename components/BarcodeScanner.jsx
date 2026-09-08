import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";

import { getProductByBarcode } from "../services/product.service";

export default function BarcodeScanner() {
  const [permission, requestPermission] = useCameraPermissions();

  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const fetchProduct = async (code) => {
    try {
      setLoading(true);

      console.log("Calling product API for:", code);

      const response = await getProductByBarcode(code);

      console.log("Product response:", response);

      setProduct(response);
    } catch (error) {
      console.error(
        "Product API Error:",
        error?.response?.data || error?.message
      );

      setProduct(null);

      Alert.alert(
        "Product Not Found",
        `No product found for barcode ${code}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = ({ data, type }) => {
    if (!data || scanned || loading) {
      return;
    }

    console.log("Barcode detected:", data);
    console.log("Barcode type:", type);

    setScanned(true);
    setBarcode(data);

    fetchProduct(data);
  };

  const scanAgain = () => {
    setBarcode("");
    setProduct(null);
    setScanned(false);
  };

  // Camera permission is still loading
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.permissionText}>
          Checking camera permission...
        </Text>
      </View>
    );
  }

  // Camera permission is not granted
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>
          Camera Permission Required
        </Text>

        <Text style={styles.subText}>
          We need camera access to scan product barcodes.
        </Text>

        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>
            Allow Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* CAMERA */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "code128",
            "upc_a",
            "upc_e",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* DARK OVERLAY */}
      <View style={styles.overlay}>
        {/* SCANNER BOX */}
        <View style={styles.scannerBox}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <Text style={styles.scanText}>
          {scanned
            ? "Barcode scanned"
            : "Scan product barcode"}
        </Text>
      </View>

      {/* BOTTOM PANEL */}
      <View style={styles.bottomPanel}>
        {!barcode && !loading && (
          <Text style={styles.instruction}>
            Point your camera at a product barcode
          </Text>
        )}

        {barcode && (
          <View>
            <Text style={styles.label}>Barcode</Text>

            <Text style={styles.barcodeText}>
              {barcode}
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />

            <Text style={styles.loadingText}>
              Getting product details...
            </Text>
          </View>
        )}

        {product && !loading && (
          <View style={styles.productCard}>
            <Text style={styles.productTitle}>
              Product Details
            </Text>

            <View style={styles.productRow}>
              <Text style={styles.productLabel}>
                Product
              </Text>

              <Text style={styles.productValue}>
                {product.name ||
                  product.productName ||
                  "-"}
              </Text>
            </View>

            <View style={styles.productRow}>
              <Text style={styles.productLabel}>
                SKU
              </Text>

              <Text style={styles.productValue}>
                {product.sku || "-"}
              </Text>
            </View>

            <View style={styles.productRow}>
              <Text style={styles.productLabel}>
                Barcode
              </Text>

              <Text style={styles.productValue}>
                {product.barcode || barcode}
              </Text>
            </View>

            <View style={styles.productRow}>
              <Text style={styles.productLabel}>
                Quantity
              </Text>

              <Text style={styles.productValue}>
                {product.quantity ?? "-"}
              </Text>
            </View>
          </View>
        )}

        {/* SCAN AGAIN BUTTON */}
        {scanned && !loading && (
          <Pressable
            style={styles.scanAgainButton}
            onPress={scanAgain}
          >
            <Text style={styles.scanAgainText}>
              Scan Again
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },

  permissionText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },

  subText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },

  permissionButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#000",
  },

  permissionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scannerBox: {
    width: 290,
    height: 180,
    position: "relative",
  },

  cornerTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#fff",
  },

  cornerTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#fff",
  },

  cornerBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#fff",
  },

  cornerBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#fff",
  },

  scanText: {
    marginTop: 20,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  instruction: {
    textAlign: "center",
    color: "#666",
    fontSize: 15,
  },

  label: {
    fontSize: 13,
    color: "#777",
    marginBottom: 4,
  },

  barcodeText: {
    fontSize: 21,
    fontWeight: "700",
  },

  loadingContainer: {
    marginTop: 12,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 8,
    color: "#555",
  },

  productCard: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
  },

  productTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
  },

  productLabel: {
    fontSize: 14,
    color: "#666",
  },

  productValue: {
    fontSize: 14,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },

  scanAgainButton: {
    marginTop: 16,
    backgroundColor: "#000",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },

  scanAgainText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});