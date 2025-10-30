const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const {decodeToken, generateId, authenticateToken} = require("../../utils");

router.post("/chat/create", authenticateToken, async (req, res) => {
  const {participantIds} = req.body;

  const schema = Joi.object({
    participantIds: Joi.array().items(Joi.string()).required(),
  }).required();

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const chatId = await generateId({collection: "chats", idPrefix: "CH"});
    const ownerId = decodeToken(req.get("Authorization")).id;
    participantIds.push(
        ownerId,
    );

    const userList = [];
    await Promise.all(participantIds.map(async (id) => {
      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error({message: `User ${id} does not exist`});
      }

      userList.push({id, userDoc, userRef});
    }));

    await Promise.all(userList.map(async (user) => {
      const chats = user.userDoc.data().chats || [];
      chats.push({
        id: chatId,
        participantIds: participantIds,
      });

      await user.userRef.set({
        chats: chats,
      });
    }));

    res.status(200).json({message: "Chat created successfully", chatId: chatId});
  } catch (error) {
    res.status(500).json({
      error: "Error creating chat",
      message: error.message,
    });
  }
});

router.post("/chat/update", authenticateToken, async (req, res) => {
  const {chatId, participantIds, data} = req.body;

  const schema = Joi.object({
    chatId: Joi.string().required(),
    participantIds: Joi.array().items(Joi.string()).required(),
    data: Joi.object({
      groupName: Joi.string().allow("", null),
      groupAvatar: Joi.string().allow("", null),
    }).required(),
  }).required();

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const {groupName, groupAvatar} = data;
    const ownerId = decodeToken(req.get("Authorization")).id;

    const userList = [];

    await Promise.all(participantIds.map(async (id) => {
      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error({message: `User ${id} does not exist`});
      }
      const chats = userDoc.data().chats || [];

      // remove in production but make sure it would happen
      if (!chats.find((chat) => chat.id === chatId)) {
        throw new Error({message: `Chat ${chatId} does not exist`});
      }

      if (!participantIds.includes(ownerId)) {
        throw new Error({message: `you are not one of the member in the chat`});
      }

      userList.push({id, userDoc, userRef});
    }));

    await Promise.all(userList.map(async (user) => {
      const chats = user.userDoc.data().chats || [];
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);

      if (groupName !== null && groupName !== undefined) {
        chats[chatIndex].groupName = groupName;
      }
      if (groupAvatar !== null && groupAvatar !== undefined) {
        chats[chatIndex].groupAvatar = groupAvatar;
      }

      await user.userRef.update({
        chats: chats,
      });
    }));

    res.status(200).json({message: "Chat updated successfully", chatId: chatId});
  } catch (error) {
    res.status(500).json({
      error: "Error updating chat",
      message: error.message,
    });
  }
});

router.delete("/chat/delete", authenticateToken, async (req, res) => {
  const {chatId, participantIds} = req.body;

  const schema = Joi.object({
    chatId: Joi.string().required(),
    participantIds: Joi.array().items(Joi.string()).required(),
  }).required();

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const userList = [];
    await Promise.all(participantIds.map(async (id) => {
      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error({message: `User ${id} does not exist`});
      }
      const chats = userDoc.data().chats || [];

      // remove in production but make sure it would happen in testing
      if (!chats.find((chat) => chat.id === chatId)) {
        throw new Error({message: `Chat ${chatId} does not exist`});
      }

      userList.push({id, userDoc, userRef});
    }));

    await Promise.all(userList.map(async (user) => {
      const chats = user.userDoc.data().chats || [];
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);

      if (chatIndex !== -1) {
        chats.splice(chatIndex, 1);
      }

      await user.userRef.update({
        chats: chats,
      });
    }));

    res.status(200).json({message: "Chat deleted successfully", chatId: chatId});
  } catch (error) {
    res.status(500).json({
      error: "Error deleting chat",
      message: error.message,
    });
  }
});


router.post("/chat/sendMessage", authenticateToken, async (req, res) => {
  const {owner, message, chatId, receiverIds} = req.body;

  const schema = Joi.object({
    owner: Joi.object({
      name: Joi.string().required(),
      avatar: Joi.string().allow(null),
    }).required(),
    message: Joi.string().required(),
    chatId: Joi.string().required(),
    receiverIds: Joi.array().items(Joi.string()).required(),
  });

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    owner.userId = decodeToken(req.get("Authorization")).id;

    if (!receiverIds.includes(owner.userId)) {
      throw new Error({message: `you are not one of the member in the chat`});
    }

    const userList = [];
    await Promise.all(receiverIds.map(async (id) => {
      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error({message: `User ${id} does not exist`});
      }
      const chats = userDoc.data().chats || [];

      // remove in production but make sure it would happen in testing
      if (!chats.find((chat) => chat.id === chatId)) {
        throw new Error({message: `Chat ${chatId} does not exist`});
      }

      userList.push({id, userDoc, userRef});
    }));

    const messageId = await generateId({collection: "message", idPrefix: "MS", length: 12});
    const messageRef = db.collection("messages").doc(messageId);
    await messageRef.set({
      id: messageId,
      senderId: owner.userId,
      message: message,
      chatId: chatId,
      createAt: new Date().getTime(),
    });

    await Promise.all(userList.map(async (user) => {
      const chats = user.userDoc.data().chats || [];
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);

      chats[chatIndex].lastMessage = message;
      chats[chatIndex].lastMessageTime = new Date().getTime();
      chats[chatIndex].unreadCount = user.id !== owner.userId ? (chats[chatIndex].unreadCount || 0) + 1 : 0;
      chats[chatIndex].senderId = owner.userId;
      chats[chatIndex].senderName = owner.name;
      chats[chatIndex].senderAvatar = owner.avatar;

      await user.userRef.update({
        chats: chats,
      });
    }));
    res.status(200).json({message: "Message sent successfully"});
  } catch (error) {
    res.status(500).json({
      error: "Error sending message",
      message: error.message,
    });
  }
});

router.post("/chat/member/add", authenticateToken, async (req, res) => {
  const {addedUserId, chatId, participantIds} = req.body;

  const schema = Joi.object({
    addedUserId: Joi.string().required(),
    chatId: Joi.string().required(),
    participantIds: Joi.array().items(Joi.string()).required(),
  }).required();

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const userList = [];
    await Promise.all(participantIds.map(async (id) => {
      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error({message: `User ${id} does not exist`});
      }
      const chats = userDoc.data().chats || [];

      // remove in production but make sure it would happen in testing
      if (!chats.find((chat) => chat.id === chatId)) {
        throw new Error({message: `Chat ${chatId} does not exist`});
      }

      if (id === addedUserId) {
        throw new Error({message: `User ${addedUserId} already in the chat`});
      }

      userList.push({id, userDoc, userRef});
    }));

    const addedUserRef = db.collection("users").doc(addedUserId);
    const addedUserDoc = await addedUserRef.get();

    if (!addedUserDoc.exists) {
      throw new Error({message: `User ${addedUserId} does not exist`});
    }
    const addedUserChats = addedUserDoc.data().chats || [];

    if (addedUserChats.find((chat) => chat.id === chatId)) {
      throw new Error({message: `User ${addedUserId} already in the chat`});
    }

    addedUserChats.push({
      id: chatId,
      participantIds: [...participantIds, addedUserId],
    });

    await addedUserRef.set({
      chats: addedUserChats,
    });

    await Promise.all(userList.map(async (user) => {
      const chats = user.userDoc.data().chats || [];
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);

      chats[chatIndex].participantIds.push(addedUserId);

      await user.userRef.update({
        chats: chats,
      });
    }));

    res.status(200).json({message: "Member added successfully", chatId: chatId});
  } catch (error) {
    res.status(500).json({
      error: "Error adding member",
      message: error.message,
    });
  }
});

router.delete("/chat/member/kick", authenticateToken, async (req, res) => {
  const {kickedUserId, chatId, participantIds} = req.body;

  const schema = Joi.object({
    kickedUserId: Joi.string().required(),
    chatId: Joi.string().required(),
    participantIds: Joi.array().items(Joi.string()).required(),
  }).required();

  const {error} = schema.validate(req.body);
  if (error) {
    return res.status(400).json({error: error.details[0].message});
  }

  try {
    const userList = [];

    if (!participantIds.find((id) => id === kickedUserId)) {
      throw new Error({message: `User ${kickedUserId} is not in the chat`});
    }

    await Promise.all(participantIds.map(async (id) => {
      const userRef = db.collection("users").doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error({message: `User ${id} does not exist`});
      }
      const chats = userDoc.data().chats || [];

      // remove in production but make sure it would happen in testing
      if (!chats.find((chat) => chat.id === chatId)) {
        throw new Error({message: `Chat ${chatId} does not exist`});
      }

      userList.push({id, userDoc, userRef});
    }));

    await Promise.all(userList.map(async (user) => {
      const chats = user.userDoc.data().chats || [];
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);

      chats[chatIndex].participantIds = participantIds.filter((id) => id !== kickedUserId);

      await user.userRef.update({
        chats: chats,
      });
    }));

    res.status(200).json({message: "Member kicked successfully", chatId: chatId});
  } catch (error) {
    res.status(500).json({
      error: "Error kicking member",
      message: error.message,
    });
  }
});

module.exports = router;
