const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user");
const guestRoutes = require("./routes/guest");
// const adminRoutes = require("./routes/admin");

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

app.use("/user", userRoutes);
app.use("/guest", guestRoutes);

module.exports = app;
