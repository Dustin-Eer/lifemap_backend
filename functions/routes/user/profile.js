const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const {decodeToken, authenticateToken} = require("../../utils");

router.post("/profile/update", authenticateToken, async (req, res) => {
  const { data } = req.body;

  const schema = Joi.object({
    data: Joi.object({
      name: Joi.string().required(),
      avatar: Joi.string().allow("",null),
      sex: Joi.string().required(),
    }).required(),
  });

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const userId = decodeToken(req.get("Authorization")).id;
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      name: data.name,
      avatar: data.avatar,
      sex: data.sex,
      updateAt: new Date().getTime(),
    });
    res.status(200).json({message: "Profile updated successfully"});
  } catch (error) {
    res.status(500).json({error: "Error updating profile",
      message: error.message});
  }
});

module.exports = router;
