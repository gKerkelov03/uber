import { useAuth } from "@clerk/clerk-expo";
import { useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import { ReactNativeModal } from "react-native-modal";

import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";
import { useLocationStore } from "@/store";
import { StripeCreateResponse } from "@/types/stripe";
import { PaymentProps } from "@/types/type";

const Payment = ({
  fullName,
  email,
  amount,
  driverId,
  rideTime,
}: PaymentProps) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const {
    userAddress,
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationAddress,
    destinationLongitude,
  } = useLocationStore();

  const { userId } = useAuth();
  const [success, setSuccess] = useState<boolean>(false);

  const openPaymentSheet = async () => {
    console.log("Opening payment sheet...");
    try {
      await initializePaymentSheet();
      console.log("Payment sheet initialized, presenting...");
      const { error } = await presentPaymentSheet();
      console.log(
        "Payment sheet presentation result:",
        error ? error : "success"
      );

      if (error) {
        console.error(`Error code: ${error.code}`, error.message);
        Alert.alert("Payment Error", error.message);
      } else {
        setSuccess(true);
      }
    } catch (error) {
      console.error("Error in openPaymentSheet:", error);
      Alert.alert("Payment Error", "Failed to process payment");
    }
  };

  const initializePaymentSheet = async () => {
    console.log("Initializing payment sheet with amount:", amount);
    try {
      const response = await fetchAPI("/(api)/(stripe)/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName || email.split("@")[0],
          email: email,
          amount: amount,
        }),
      });

      const { paymentIntent, ephemeralKey, customer } =
        (await response.json()) as StripeCreateResponse;
      console.log("Payment intent created:", paymentIntent.id);

      if (!paymentIntent?.client_secret) {
        throw new Error("Failed to create payment intent");
      }

      const { error } = await initPaymentSheet({
        merchantDisplayName: "Ride App",
        paymentIntentClientSecret: paymentIntent.client_secret,
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey.secret,
        returnURL: "myapp://book-ride",
        defaultBillingDetails: {
          name: fullName || email.split("@")[0],
          email: email,
        },
      });

      if (error) {
        console.error("Error initializing payment sheet:", error);
        throw error;
      }

      // Create ride record after successful payment
      await fetchAPI("/(api)/ride/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin_address: userAddress,
          destination_address: destinationAddress,
          origin_latitude: userLatitude,
          origin_longitude: userLongitude,
          destination_latitude: destinationLatitude,
          destination_longitude: destinationLongitude,
          ride_time: rideTime.toFixed(0),
          fare_price: parseInt(amount) * 100,
          payment_status: "paid",
          driver_id: driverId,
          user_id: userId,
        }),
      });
    } catch (error) {
      console.error("Error in initializePaymentSheet:", error);
      Alert.alert(
        "Payment Error",
        error instanceof Error ? error.message : "Failed to process payment"
      );
      throw error;
    }
  };

  return (
    <>
      <CustomButton
        title="Потвърди пътуването"
        className="my-10"
        onPress={openPaymentSheet}
      />

      <ReactNativeModal
        isVisible={success}
        onBackdropPress={() => setSuccess(false)}
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <Image source={images.check} className="w-28 h-28 mt-5" />

          <Text className="text-2xl text-center font-JakartaBold mt-5">
            Резервацията е успешна
          </Text>

          <Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
            Благодарим за резервацията. Вашата резервация е успешно направена.
            Моля, продължете с пътуването си.
          </Text>

          <CustomButton
            title="Към началната страница"
            onPress={() => {
              setSuccess(false);
              router.push("/(root)/(tabs)/home");
            }}
            className="mt-5"
          />
        </View>
      </ReactNativeModal>
    </>
  );
};

export default Payment;
