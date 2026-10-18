import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

import { AD_UNITS, adsEnabled, requestOptions } from "@/src/services/ads";
import { app } from "@/src/store";

/** Banner AdMob nos menus (nunca durante a luta; nunca para premium). */
export function AdBannerSlot() {
  const premium = app.use((s) => s.premium);
  if (premium || !adsEnabled()) return null;
  return (
    <View style={{ alignItems: "center" }}>
      <BannerAd unitId={AD_UNITS.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={requestOptions()} />
    </View>
  );
}
