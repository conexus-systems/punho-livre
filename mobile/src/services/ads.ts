/**
 * AdMob: banner nos menus, interstitial entre partidas (com intervalo mínimo) e
 * rewarded para "continuar" no modo arcade. Assinantes premium não veem anúncios.
 *
 * Ordem no iOS: consentimento UMP → App Tracking Transparency → inicializar SDK.
 */

import { Platform } from "react-native";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import mobileAds, {
  AdEventType,
  AdsConsent,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

import { config } from "@/src/config";
import { app } from "@/src/store";

const pick = (android: string | undefined, ios: string | undefined, test: string): string => {
  if (config.adsTest) return test;
  const id = Platform.OS === "ios" ? ios : android;
  return id && id.trim() !== "" ? id : test;
};

export const AD_UNITS = {
  banner: pick(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID, process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS, TestIds.ADAPTIVE_BANNER),
  interstitial: pick(
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
    TestIds.INTERSTITIAL,
  ),
  rewarded: pick(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID, process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS, TestIds.REWARDED),
};

const INTERSTITIAL_EVERY = 2; // partidas
const INTERSTITIAL_MIN_GAP_MS = 3 * 60_000;

let ready = false;
let personalized = false;
let lastInterstitial = 0;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;

export function adsEnabled(): boolean {
  return ready && !app.get().premium;
}

export async function initAds(): Promise<void> {
  try {
    const consent = await AdsConsent.gatherConsent();
    if (!consent.canRequestAds) return;
    const choices = await AdsConsent.getUserChoices().catch(() => null);
    personalized = choices?.selectPersonalisedAds ?? false;
    if (Platform.OS === "ios") {
      const { granted } = await requestTrackingPermissionsAsync();
      if (!granted) personalized = false;
    }
    await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.T });
    await mobileAds().initialize();
    ready = true;
    loadInterstitial();
  } catch (err) {
    console.warn("[ads] indisponível:", (err as Error).message);
  }
}

export function requestOptions() {
  return { requestNonPersonalizedAdsOnly: !personalized, keywords: ["games", "fighting", "arcade"] };
}

function loadInterstitial(): void {
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, requestOptions());
  interstitialLoaded = false;
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => loadInterstitial());
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
  });
  interstitial.load();
}

/** Chamado ao fim de cada partida; mostra um interstitial se for a vez. */
export async function onMatchFinished(): Promise<void> {
  if (!adsEnabled()) return;
  const count = app.get().matchesSinceAd + 1;
  app.set({ matchesSinceAd: count });
  const due = count >= INTERSTITIAL_EVERY && Date.now() - lastInterstitial > INTERSTITIAL_MIN_GAP_MS;
  if (!due || !interstitial || !interstitialLoaded) return;
  app.set({ matchesSinceAd: 0 });
  lastInterstitial = Date.now();
  await interstitial.show();
}

/** Mostra um rewarded; resolve true se o jogador ganhou a recompensa. */
export function showRewarded(): Promise<boolean> {
  if (app.get().premium) return Promise.resolve(true);
  if (!ready) return Promise.resolve(false);
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(AD_UNITS.rewarded, requestOptions());
    let earned = false;
    const unsubs = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        void ad.show();
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        unsubs.forEach((u) => u());
        resolve(earned);
      }),
      ad.addAdEventListener(AdEventType.ERROR, () => {
        unsubs.forEach((u) => u());
        resolve(false);
      }),
    ];
    ad.load();
  });
}
