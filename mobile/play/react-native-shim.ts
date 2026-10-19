/** O renderizador só usa Platform.select para escolher a família da fonte. */
export const Platform = {
  OS: "web",
  select: <T,>(o: { default?: T; web?: T }) => o.web ?? o.default,
};
