/** Web (só para visualização/QA): AdMob não existe no navegador; mesma API, sem anúncios. */
export const AD_UNITS = { banner: "", interstitial: "", rewarded: "" };
export function adsEnabled(): boolean {
  return false;
}
export async function initAds(): Promise<void> {}
export function requestOptions() {
  return {};
}
export async function onMatchFinished(): Promise<void> {}
export async function showRewarded(): Promise<boolean> {
  return false;
}
