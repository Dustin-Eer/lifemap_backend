const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const {generateRandomNum, generateToken, generateId} = require("../../utils");
const joi = require("joi");

router.post("/otp", async (req, res) => {
  const {phoneNo, countryCode} = req.body;
  const schema = joi.object({
    phoneNo: joi.string().required(),
    countryCode: joi.string().required(),
  });
  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  const malaysiaPhoneRegex = /^(1)[0-46-9]-*[0-9]{6,7}$/;
  if (!malaysiaPhoneRegex.test(phoneNo)) {
    return res.status(400).json({error: "Invalid Malaysian phone number format. Must start with 1 and be 9-10 digits"});
  }

  if (countryCode !== "+60") {
    return res.status(400).json({error: "Invalid countryCode. Only allowed for Malaysia"});
  }
  const otp = generateRandomNum(6);
  try {
    const snapshot = await db.collection("users").where("phoneNo", "==", phoneNo).get();

    if (snapshot.docs.length > 0) {
      await db.collection("users").doc(snapshot.docs[0].id).update({
        otp: otp,
        otpTimestamp: new Date().getTime(),
      });
    }

    res.status(200).json({message: "OTP sent successfully", otp: otp});
  } catch (error) {
    res.status(500).json({error: "Error sending OTP", message: error.message});
  }
});

router.post("/loginOrRegister", async (req, res) => {
  const {phoneNo, otp, countryCode} = req.body;
  const schema = joi.object({
    phoneNo: joi.string().required(),
    otp: joi.string().required(),
    countryCode: joi.string().required(),
  });
  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  if (countryCode !== "+60") {
    return res.status(400).json({error: "Invalid countryCode. Only allowed for Malaysia"});
  }

  try {
    const snapshot = await db.collection("users").where("phoneNo", "==", phoneNo).get();

    const users = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (users.length === 0) {
      return res.status(202).json({message: "Please register as a new user", users: []});
    }

    const user = users[0];
    if (user.otp != otp) {
      return res.status(400).json({error: "Invalid OTP"});
    }

    const timeNow = new Date().getTime();
    if (!user.otpTimestamp || (timeNow - user.otpTimestamp) > (10 * 60 * 1000)) {
      if (!user.otpTimestamp || (timeNow - user.otpTimestamp) > (10 * 60 * 1000)) {
        return res.status(400).json({error: "OTP expired"});
      }
    }
    const token = generateToken(user);

    await db.collection("users").doc(snapshot.docs[0].id).update({
      token: token,
      otp: null,
      otpTimestamp: null,
    });

    return res.status(200).json({
      message: "Login successfully",
      user: {
        id: user.id,
        ...user,
        token: token,
        otp: undefined,
        otpTimestamp: undefined,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error getting users: " + error.message);
  }
});

router.post("/loginByToken", async (req, res) => {
  const {token} = req.body;
  const schema = joi.object({
    token: joi.string().required(),
  });

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const snapshot = await db.collection("users").where("token", "==", token).get();

    const users = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (users.length === 0) {
      return res.status(400).json({message: "Invalid token"});
    }

    const user = users[0];

    return res.status(200).json({
      message: "Login successfully",
      user: {
        id: user.id,
        ...user,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error getting users: " + error.message);
  }
});

router.post("/createAccount", async (req, res) => {
  const {name, phoneNo, countryCode, sex, avatar} = req.body;

  const schema = joi.object({
    name: joi.string().required(),
    phoneNo: joi.string().required(),
    countryCode: joi.string().required(),
    sex: joi.string().required(),
    avatar: joi.string().optional(),
  });
  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  if (countryCode !== "+60") {
    return res.status(400).json({
      error: "Invalid countryCode. Only allowed for Malaysia",
    });
  }

  try {
    const snapshot = await db.collection("users").where("phoneNo", "==", phoneNo).get();
    if (!snapshot.empty) {
      return res.status(200).json({message: "This phone number is already registered", users: []});
    }

    const userId = await generateId({collection: "users", idPrefix: "US"});

    const userData = {
      id: userId,
      phoneNo: phoneNo,
      countryCode: countryCode,
      name: name,
      sex: sex,
      avatar: avatar ? avatar : null,
      auraCoins: 0,
      createAt: new Date().getTime(),
      token: generateToken({id: userId, phoneNo: phoneNo}),
    };

    const userRef = db.collection("users").doc(userId);
    await userRef.set(userData);

    return res.status(200).json({message: "User created successfully", user: {id: userId, ...userData}});
  } catch (error) {
    return res.status(500).json({error: "Error creating user", message: error.message});
  }
});

module.exports = router;
