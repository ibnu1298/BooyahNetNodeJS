const PDFDocument = require("pdfkit");
const getStream = require("get-stream"); // npm install get-stream
const stream = require("stream");
const terbilang = require("terbilang");
const {
  formatBillingDate,
  formatRupiah,
  formatBillingDateWithDay,
  capitalizeString,
} = require("../utils/commonFunctions");
exports.createPdfKwitansi = async ({
  no,
  receivedFrom,
  amount,
  paymentFor,
  date,
}) => {
  const amountInWords = terbilang(amount) + " Rupiah";
  const cmToPt = (cm) => cm * 28.35;
  const doc = new PDFDocument({
    size: [cmToPt(10), cmToPt(21)],
    layout: "landscape",
    margin: 20,
  });
  const passthrough = new stream.PassThrough();
  doc.pipe(passthrough);

  // WATERMARK PATTERN
  const imagePath = "./image/logo.png";
  const patternWidth = 100;
  const patternHeight = 80;

  doc.opacity(0.2);
  for (let y = 0; y < doc.page.height; y += patternHeight) {
    for (let x = 0; x < doc.page.width; x += patternWidth) {
      doc.save(); // simpan state sebelum rotasi
      doc.rotate(-15, { origin: [x, y] }); // miringin 15 derajat
      doc.image(imagePath, x, y, { width: 90 });
      doc.restore(); // balikin state
    }
  }
  doc.opacity(1);
  // Header
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("KWITANSI PEMBAYARAN", { align: "center" });

  doc
    .font("Helvetica")
    .fontSize(10)
    .text(`No. ${no ?? "-"}`, { align: "center" });

  doc.moveDown(1);

  // Body lines
  const startX = 50;
  const startY = doc.y;
  const lineGap = 20;

  doc.font("Helvetica").fontSize(12);

  doc.text("Sudah terima dari", startX, startY);
  doc.text(":", startX + 120, startY);
  doc.text(capitalizeString(receivedFrom) ?? "-", startX + 130, startY, {
    underline: true,
  });

  doc.text("Uang sebesar", startX, startY + lineGap);
  doc.text(":", startX + 120, startY + lineGap);
  doc
    .font("Helvetica-Bold")
    .text(
      capitalizeString(amountInWords) ?? "-",
      startX + 130,
      startY + lineGap,
      {
        underline: true,
      }
    );

  doc.font("Helvetica").text("Untuk pembayaran", startX, startY + lineGap * 2);
  doc.text(":", startX + 120, startY + lineGap * 2);
  doc
    .font("Helvetica-Oblique")
    .text(paymentFor ?? "-", startX + 130, startY + lineGap * 2, {
      underline: true,
    });

  // Signature area
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(
      `Jakarta, ${formatBillingDate(date) ?? "-"}`,
      430,
      startY + lineGap * 3
    );
  doc.opacity(0.7).image("./image/signature.png", 430, startY + lineGap * 2.8, {
    width: 100,
  });
  doc.moveDown(3).text("Admin BooyahNet", 430, startY + lineGap * 5, {
    underline: true,
  });

  // Amount box
  const boxY = startY + lineGap * 6;
  doc.font("Helvetica-Oblique").fontSize(14).text("Jumlah Rp.", startX, boxY);

  doc
    .rect(startX + 80, boxY - 5, 150, 20)
    .fill("#dddddd")
    .stroke();

  doc
    .fillColor("#000000")
    .font("Helvetica-Bold")
    .text(formatRupiah(amount) ?? "-", startX + 90, boxY);
  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .text(
      "Terimakasih sudah melakukan pembayaran WIFI BOOYAHNET\nPastikan anda mendapatkan kwitansi setelah melakukan pembayaran",
      0, // x
      startY + lineGap * 8, // y
      { align: "center", width: doc.page.width }
    );
  doc.end();

  return await getStream.buffer(passthrough);
};
