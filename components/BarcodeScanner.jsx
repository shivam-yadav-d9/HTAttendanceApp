import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";

import api from "../services/api";

export default function BarcodeScanner() {
  // =========================================================
  // STEP
  // 1 = Customer details
  // 2 = Product scanning
  // =========================================================
  const [step, setStep] = useState(1);

  // =========================================================
  // CUSTOMER DETAILS
  // =========================================================
  const [mobile, setMobile] = useState("");
  const [customerName, setCustomerName] = useState("");

  // =========================================================
  // CAMERA
  // =========================================================
  const [permission, requestPermission] =
    useCameraPermissions();

  // =========================================================
  // PRODUCTS
  // =========================================================
  const [scannedProducts, setScannedProducts] = useState([]);

  // Prevent multiple camera callbacks for same scan
  const [scanned, setScanned] = useState(false);

  // Submit loading
  const [submitting, setSubmitting] = useState(false);

  // =========================================================
  // STEP 1 -> NEXT
  // =========================================================
  const handleNext = () => {
    const cleanMobile = mobile.trim();
    const cleanName = customerName.trim();

    if (!cleanMobile) {
      Alert.alert(
        "Required",
        "Please enter customer mobile number."
      );
      return;
    }

    if (!/^\d{10}$/.test(cleanMobile)) {
      Alert.alert(
        "Invalid Mobile Number",
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    if (!cleanName) {
      Alert.alert(
        "Required",
        "Please enter customer name."
      );
      return;
    }

    setStep(2);
  };

  // =========================================================
  // EXTRACT PRODUCT CODE FROM SCANNED VALUE
  // =========================================================
  const extractProductCode = (data) => {
    if (!data) {
      return "";
    }

    const value = String(data).trim();

    if (!value) {
      return "";
    }

    // -------------------------------------------------------
    // CASE 1:
    // Full URL
    //
    // Example:
    // https://www.hometown.in/600384489
    //
    // Result:
    // 600384489
    // -------------------------------------------------------
    try {
      const url = new URL(value);

      const pathParts = url.pathname
        .split("/")
        .filter(Boolean);

      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];

        // If last part is numeric, use it
        if (/^\d+$/.test(lastPart)) {
          return lastPart;
        }

        // If last part contains a number, extract the number
        const numberMatch = lastPart.match(/\d+$/);

        if (numberMatch) {
          return numberMatch[0];
        }
      }
    } catch (error) {
      // Not a URL.
      // Continue below and treat it as a normal barcode.
    }

    // -------------------------------------------------------
    // CASE 2:
    // URL-like string without valid URL parsing
    //
    // Example:
    // www.hometown.in/600384489
    //
    // Result:
    // 600384489
    // -------------------------------------------------------
    const parts = value
      .split("/")
      .filter(Boolean);

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];

      // Remove query string / hash if present
      const cleanLastPart = lastPart
        .split("?")[0]
        .split("#")[0]
        .trim();

      if (/^\d+$/.test(cleanLastPart)) {
        return cleanLastPart;
      }

      const numberMatch = cleanLastPart.match(/\d+$/);

      if (numberMatch) {
        return numberMatch[0];
      }
    }

    // -------------------------------------------------------
    // CASE 3:
    // Normal barcode
    //
    // Example:
    // 600384489
    //
    // Result:
    // 600384489
    // -------------------------------------------------------
    return value;
  };

  // =========================================================
  // BARCODE / QR CODE SCANNED
  // =========================================================
  const handleBarcodeScanned = ({ data, type }) => {
    // Ignore if already processing/submitting
    if (!data || scanned || submitting) {
      return;
    }

    const rawValue = String(data).trim();

    if (!rawValue) {
      return;
    }

    console.log("=================================");
    console.log("Barcode detected");
    console.log("Barcode type:", type);
    console.log("Raw scanned value:", rawValue);

    // -------------------------------------------------------
    // EXTRACT ONLY PRODUCT CODE
    // -------------------------------------------------------
    const code = extractProductCode(rawValue);

    if (!code) {
      Alert.alert(
        "Invalid Product",
        "Unable to read the product code."
      );

      return;
    }

    console.log("Extracted product code:", code);
    console.log("=================================");

    // -------------------------------------------------------
    // Stop camera callback temporarily
    // -------------------------------------------------------
    setScanned(true);

    // -------------------------------------------------------
    // Prevent duplicate product
    // -------------------------------------------------------
    if (scannedProducts.includes(code)) {
      Alert.alert(
        "Already Added",
        `${code} is already added to this lead.`
      );

      return;
    }

    // -------------------------------------------------------
    // SAVE ONLY PRODUCT CODE LOCALLY
    // -------------------------------------------------------
    setScannedProducts((previous) => [
      ...previous,
      code,
    ]);

    // -------------------------------------------------------
    // Show success immediately
    // -------------------------------------------------------
    Alert.alert(
      "Product Added",
      `${code} has been added successfully.`
    );
  };

  // =========================================================
  // SCAN NEXT PRODUCT
  // =========================================================
  const scanAgain = () => {
    setScanned(false);
  };

  // =========================================================
  // REMOVE PRODUCT
  // =========================================================
  const removeProduct = (code) => {
    setScannedProducts((previous) =>
      previous.filter((item) => item !== code)
    );

    // Allow scanner again
    setScanned(false);
  };

  // =========================================================
  // SUBMIT LEAD
  // =========================================================
  const submitLead = async () => {
    if (!mobile.trim()) {
      Alert.alert(
        "Error",
        "Customer mobile number is missing."
      );
      return;
    }

    if (!customerName.trim()) {
      Alert.alert(
        "Error",
        "Customer name is missing."
      );
      return;
    }

    if (scannedProducts.length === 0) {
      Alert.alert(
        "No Products",
        "Please scan at least one product."
      );
      return;
    }

    try {
      setSubmitting(true);

      // =====================================================
      // QR LEAD PAYLOAD
      // =====================================================
      const payload = {
        mobile: mobile.trim(),

        customerName: customerName.trim(),

        // ---------------------------------------------------
        // CURRENT STORE DETAILS
        // Replace with logged-in user/store data later.
        // ---------------------------------------------------
        storeId: "901",

        storeName:
          "HT Mumbai - Jogeshwari",

        salesmanId: "101",

        salesmanName:
          "Rahul Sharma",

        salesmanEmail:
          "htcsd.homeland@praxisretail.in",

        // ---------------------------------------------------
        // ONLY EXTRACTED PRODUCT CODES
        // Example:
        // ["600384489", "600384490"]
        // ---------------------------------------------------
        products: scannedProducts,

        submittedAt:
          new Date().toISOString(),

        status: "SUBMITTED",
      };

      console.log(
        "QR Lead Payload:",
        JSON.stringify(payload, null, 2)
      );

      // =====================================================
      // POST /api/qrleads
      // =====================================================
      const response = await api.post(
        "/qrleads",
        payload
      );

      console.log(
        "QR Lead Response:",
        response
      );

      // =====================================================
      // SUCCESS
      // =====================================================
      if (response?.success) {
        Alert.alert(
          "Lead Submitted",
          "Customer lead has been submitted successfully.",
          [
            {
              text: "OK",
              onPress: resetLead,
            },
          ]
        );
      } else {
        Alert.alert(
          "Submission Failed",
          response?.message ||
            "Unable to submit the lead."
        );
      }
    } catch (error) {
      console.error(
        "QR Lead Submit Error:",
        error?.message || error
      );

      Alert.alert(
        "Submission Failed",
        error?.message ||
          "Something went wrong while submitting the lead."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // RESET AFTER SUCCESS
  // =========================================================
  const resetLead = () => {
    setStep(1);
    setMobile("");
    setCustomerName("");
    setScannedProducts([]);
    setScanned(false);
  };

  // =========================================================
  // STEP 1
  // CUSTOMER FORM
  // =========================================================
  if (step === 1) {
    return (
      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ICON */}
          <View style={styles.headerIcon}>
            <MaterialIcons
              name="person-add"
              size={38}
              color="#1565C0"
            />
          </View>

          {/* TITLE */}
          <Text style={styles.formTitle}>
            New Lead
          </Text>

          <Text style={styles.formSubtitle}>
            Enter customer details to create a new lead
          </Text>

          {/* MOBILE */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Customer Mobile Number
            </Text>

            <View style={styles.inputWrapper}>
              <MaterialIcons
                name="phone"
                size={21}
                color="#777"
              />

              <TextInput
                style={styles.input}
                value={mobile}
                onChangeText={(text) => {
                  const numbersOnly =
                    text.replace(/[^0-9]/g, "");

                  setMobile(numbersOnly);
                }}
                placeholder="Enter mobile number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* CUSTOMER NAME */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Customer Name
            </Text>

            <View style={styles.inputWrapper}>
              <MaterialIcons
                name="person-outline"
                size={21}
                color="#777"
              />

              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* NEXT BUTTON */}
          <Pressable
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              Next
            </Text>

            <MaterialIcons
              name="arrow-forward"
              size={21}
              color="#fff"
            />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // =========================================================
  // CAMERA PERMISSION LOADING
  // =========================================================
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

  // =========================================================
  // CAMERA PERMISSION NOT GRANTED
  // =========================================================
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons
          name="camera-alt"
          size={55}
          color="#1565C0"
        />

        <Text style={styles.permissionText}>
          Camera Permission Required
        </Text>

        <Text style={styles.subText}>
          We need camera access to scan product
          barcodes and QR codes.
        </Text>

        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>
            Allow Camera
          </Text>
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => setStep(1)}
        >
          <Text style={styles.backButtonText}>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }

  // =========================================================
  // STEP 2
  // PRODUCT SCANNER
  // =========================================================
  return (
    <View style={styles.scannerContainer}>
      {/* =====================================================
          CAMERA
      ===================================================== */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "code93",
            "codabar",
            "itf14",
          ],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : handleBarcodeScanned
        }
      />

      {/* =====================================================
          HEADER
      ===================================================== */}
      <View style={styles.scannerHeader}>
        <Pressable
          style={styles.headerBackButton}
          onPress={() => setStep(1)}
        >
          <MaterialIcons
            name="arrow-back"
            size={24}
            color="#fff"
          />
        </Pressable>

        <View>
          <Text style={styles.scannerHeaderTitle}>
            Scan Products
          </Text>

          <Text style={styles.scannerHeaderCustomer}>
            {customerName}
          </Text>
        </View>
      </View>

      {/* =====================================================
          SCANNER BOX
      ===================================================== */}
      <View style={styles.overlay}>
        <View style={styles.scannerBox}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <Text style={styles.scanText}>
          {scanned
            ? "Product added"
            : "Scan product barcode or QR code"}
        </Text>
      </View>

      {/* =====================================================
          BOTTOM PANEL
      ===================================================== */}
      <View style={styles.bottomPanel}>
        {/* CUSTOMER SUMMARY */}
        <View style={styles.customerSummary}>
          <View style={styles.customerSummaryInfo}>
            <Text style={styles.summaryLabel}>
              Customer
            </Text>

            <Text style={styles.summaryName}>
              {customerName}
            </Text>

            <Text style={styles.summaryMobile}>
              {mobile}
            </Text>
          </View>

          <View style={styles.productCount}>
            <Text style={styles.productCountNumber}>
              {scannedProducts.length}
            </Text>

            <Text style={styles.productCountLabel}>
              Products
            </Text>
          </View>
        </View>

        {/* ===================================================
            PRODUCT LIST
        =================================================== */}
        {scannedProducts.length > 0 ? (
          <ScrollView
            style={styles.productList}
            showsVerticalScrollIndicator={false}
          >
            {scannedProducts.map(
              (code, index) => (
                <View
                  key={code}
                  style={styles.productItem}
                >
                  {/* GREEN TICK */}
                  <View
                    style={styles.tickCircle}
                  >
                    <MaterialIcons
                      name="check"
                      size={18}
                      color="#fff"
                    />
                  </View>

                  {/* PRODUCT DETAILS */}
                  <View
                    style={styles.productInfo}
                  >
                    <Text
                      style={
                        styles.productNumber
                      }
                    >
                      Product {index + 1}
                    </Text>

                    <Text
                      style={
                        styles.productCode
                      }
                    >
                      {code}
                    </Text>
                  </View>

                  {/* REMOVE */}
                  <Pressable
                    onPress={() =>
                      removeProduct(code)
                    }
                    style={
                      styles.removeButton
                    }
                  >
                    <MaterialIcons
                      name="close"
                      size={20}
                      color="#777"
                    />
                  </Pressable>
                </View>
              )
            )}
          </ScrollView>
        ) : (
          <Text style={styles.noProductsText}>
            No products scanned yet.
          </Text>
        )}

        {/* ===================================================
            SCAN NEXT PRODUCT
        =================================================== */}
        {scanned && (
          <Pressable
            style={styles.scanAgainButton}
            onPress={scanAgain}
          >
            <MaterialIcons
              name="qr-code-scanner"
              size={21}
              color="#1565C0"
            />

            <Text style={styles.scanAgainText}>
              Scan Next Product
            </Text>
          </Pressable>
        )}

        {/* ===================================================
            SUBMIT LEAD
        =================================================== */}
        <Pressable
          style={[
            styles.submitButton,
            scannedProducts.length === 0 &&
              styles.submitButtonDisabled,
          ]}
          onPress={submitLead}
          disabled={
            scannedProducts.length === 0 ||
            submitting
          }
        >
          {submitting ? (
            <>
              <ActivityIndicator
                size="small"
                color="#fff"
              />

              <Text
                style={styles.submitButtonText}
              >
                Submitting...
              </Text>
            </>
          ) : (
            <>
              <MaterialIcons
                name="check-circle"
                size={22}
                color="#fff"
              />

              <Text
                style={styles.submitButtonText}
              >
                Submit Lead
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ===========================================================
// STYLES
// ===========================================================

const styles = StyleSheet.create({
  // =========================================================
  // FORM
  // =========================================================

  formContainer: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },

  formContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },

  headerIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E8F1FB",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
  },

  formTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },

  formSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 35,
  },

  inputContainer: {
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },

  inputWrapper: {
    height: 54,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D9DEE7",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#111827",
  },

  nextButton: {
    height: 54,
    backgroundColor: "#1565C0",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },

  // =========================================================
  // PERMISSION
  // =========================================================

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
    backgroundColor: "#1565C0",
  },

  permissionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  backButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  backButtonText: {
    color: "#1565C0",
    fontSize: 15,
    fontWeight: "600",
  },

  // =========================================================
  // SCANNER
  // =========================================================

  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },

  scannerHeader: {
    position: "absolute",
    top: 45,
    left: 15,
    right: 15,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  scannerHeaderTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },

  scannerHeaderCustomer: {
    color: "#E5E7EB",
    fontSize: 13,
    marginTop: 2,
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
    textAlign: "center",
  },

  // =========================================================
  // BOTTOM PANEL
  // =========================================================

  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    padding: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "52%",
  },

  customerSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  customerSummaryInfo: {
    flex: 1,
  },

  summaryLabel: {
    fontSize: 12,
    color: "#777",
  },

  summaryName: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },

  summaryMobile: {
    marginTop: 2,
    fontSize: 12,
    color: "#777",
  },

  productCount: {
    alignItems: "center",
    backgroundColor: "#E8F1FB",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },

  productCountNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1565C0",
  },

  productCountLabel: {
    fontSize: 10,
    color: "#555",
  },

  productList: {
    maxHeight: 170,
    marginTop: 10,
  },

  productItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  // =========================================================
  // GREEN COMPLETED TICK
  // =========================================================

  tickCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#16A34A",
    justifyContent: "center",
    alignItems: "center",
  },

  productInfo: {
    flex: 1,
    marginLeft: 11,
  },

  productNumber: {
    fontSize: 11,
    color: "#777",
  },

  productCode: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },

  removeButton: {
    padding: 5,
  },

  noProductsText: {
    textAlign: "center",
    color: "#777",
    fontSize: 14,
    paddingVertical: 18,
  },

  // =========================================================
  // SCAN NEXT
  // =========================================================

  scanAgainButton: {
    marginTop: 12,
    height: 46,
    borderWidth: 1,
    borderColor: "#1565C0",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  scanAgainText: {
    color: "#1565C0",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 7,
  },

  // =========================================================
  // SUBMIT
  // =========================================================

  submitButton: {
    marginTop: 10,
    height: 50,
    backgroundColor: "#16A34A",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  submitButtonDisabled: {
    backgroundColor: "#A5A5A5",
  },

  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
});