// utils/validators/userValidator.js

exports.validateUserInput = (name, email) => {
  if (!name || name.trim() === "") {
    return "Name is required";
  }

  if (!email || email.trim() === "") {
    return "Email is required";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Invalid email format";
  }

  return null; // artinya valid
};
