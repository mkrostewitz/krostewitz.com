import "server-only";

import QRCode from "qrcode";

export async function createQrSvg(data) {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 3,
    color: {
      dark: "#171717",
      light: "#ffffff",
    },
  });
}
