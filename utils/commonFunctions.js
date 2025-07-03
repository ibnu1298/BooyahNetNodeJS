exports.formatBillingDate = (dateStr, locale = "id-ID", options) => {
  const date = new Date(dateStr);

  // default options
  const formatOptions = options || {
    day: "2-digit",
    month: "long", // bisa 'short' untuk Jun
    year: "numeric",
  };

  return date.toLocaleDateString(locale, formatOptions);
};
exports.formatBillingDateWithDay = (dateStr, locale = "id-ID") => {
  const date = new Date(dateStr);

  // format lengkap dengan weekday
  const options = {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  };

  return date.toLocaleDateString(locale, options);
};
exports.formatRupiah = (number) => {
  return Number(number).toLocaleString("id-ID");
};
exports.capitalizeString = (name) => {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
