exports.sendWhatsApp = async ({ phone, message }) => {
  await fetch(`${baseUrl}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: phone,
      message,
    }),
  });
};
