// Keep the map location while withholding the full address text from public settings.
export function publicAddress(address) {
  if (!address || !address.hideStreetAddress) return address;

  return {
    label: address.publicLabel || "",
    longitude: address.longitude,
    latitude: address.latitude,
  };
}
