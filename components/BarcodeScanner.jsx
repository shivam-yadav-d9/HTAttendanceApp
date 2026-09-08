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

  const [scanned, setScanned] = useState(false);

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
  // BARCODE SCANNED
  // =========================================================
  const handleBarcodeScanned = ({ data, type }) => {
    if (!data || scanned || submitting) {
      return;
    }

    const code = String(data).trim();

    if (!code) {
      return;
    }

    console.log("Barcode detected:", code);
    console.log("Barcode type:", type);

    // -------------------------------------------------------
    // Prevent duplicate product
    // -------------------------------------------------------
    if (scannedProducts.includes(code)) {
      setScanned(true);

      Alert.alert(
        "Already Added",
        `${code} is already added to this lead.`
      );

      return;
    }

    // -------------------------------------------------------
    // Add product to list
    // -------------------------------------------------------
    setScannedProducts((previous) => [
      ...previous,
      code,
    ]);

    // Stop scanner until user clicks Scan Next Product
    setScanned(true);

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

      const payload = {
        mobile: mobile.trim(),

        customerName: customerName.trim(),

        // ---------------------------------------------------
        // TEMPORARY VALUES
        // Replace these with logged-in user/store data later.
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
        // ALL SCANNED PRODUCT CODES
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
        response?.data
      );

      if (response?.data?.success) {
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
          response?.data?.message ||
            "Unable to submit the lead."
        );
      }
    } catch (error) {
      console.error(
        "QR Lead Submit Error:",
        error?.response?.data ||
          error?.message ||
          error
      );

      Alert.alert(
        "Submission Failed",
        error?.response?.data?.message ||
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

          {/* =================================================
              MOBILE
          ================================================= */}
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

          {/* =================================================
              CUSTOMER NAME
          ================================================= */}
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

          {/* =================================================
              NEXT BUTTON
          ================================================= */}
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
          barcodes.
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
            "ean13",
            "ean8",
            "code128",
            "upc_a",
            "upc_e",
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
            : "Scan product barcode"}
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