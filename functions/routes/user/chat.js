const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const {generateId, authenticateToken} = require("../../utils");

router.post("/sendMessage", authenticateToken, async (req, res) => {
  const {userId, message, chatId} = req.body;

  const schema = Joi.object({
    userId: Joi.string().required(),
    message: Joi.string().required(),
    chatId: Joi.string().required(),
  });

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const messageId = await generateId({collection: "message", idPrefix: "MS", length: 12});
    const chatRef = db.collection("messages").doc(messageId);
    await chatRef.set({
      id: messageId,
      senderId: userId,
      message: message,
      chatId: chatId,
      createAt: new Date().getTime(),
    });
    res.status(200).json({message: "Message sent successfully"});
  } catch (error) {
    res.status(500).json({error: "Error sending message",
      message: error.message});
  }
});

module.exports = router;
