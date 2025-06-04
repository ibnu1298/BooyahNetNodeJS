const express = require("express");
require("dotenv").config();

const usersRoutes = require("./routes/users");
const paymentsRoutes = require("./routes/payments");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/users", usersRoutes);
app.use("/payments", paymentsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
