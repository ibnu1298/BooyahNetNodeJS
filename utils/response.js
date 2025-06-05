exports.success = (message, data = null) => {
  return {
    success: true,
    message,
    data,
  };
};

exports.error = (message, data = null) => {
  return {
    success: false,
    message,
    data,
  };
};
