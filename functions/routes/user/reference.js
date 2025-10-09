const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const { generateId, authenticateToken, decodeToken } = require("../../utils");

router.post("/reference/create", authenticateToken, async (req, res) => {
  const { data } = req.body;

  const schema = Joi.object({
    data: Joi.object({
      referenceName: Joi.string().required(),
      title: Joi.string().required(),
      eventType: Joi.string().required(),
      eventStatus: Joi.string().required(),
      location: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      participants: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        avatar: Joi.string().allow(null, ''),
      })).required(),
      participantIds: Joi.array().items(Joi.string()).required(),
      maxParticipants: Joi.number().required(),
      image: Joi.string().allow(null, ''),
      desc: Joi.string().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { referenceName, title, eventType, eventStatus, location, participants, participantIds, maxParticipants, image, desc } = data;
    const referenceId = await generateId({ collection: "reference", idPrefix: "RF", length: 12 });
    const referenceRef = db.collection("references").doc(referenceId);
    const ownerId = decodeToken(req.get("Authorization")).id;

    await referenceRef.set({
      id: referenceId,
      referenceName: referenceName,
      eventStatus: eventStatus,
      title: title,
      eventType: eventType,
      ownerId: ownerId,
      location: location,
      maxParticipants: maxParticipants,
      participants: participants,
      participantIds: participantIds,
      image: image,
      desc: desc,
      createAt: new Date().getTime(),
    });
    res.status(200).json({ message: "Reference created successfully", referenceId: referenceId });
  } catch (error) {
    res.status(500).json({
      error: "Error creating reference",
      message: error.message
    });
  }
});

router.post("/reference/update", authenticateToken, async (req, res) => {
  const { id, data } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
    data: Joi.object({
      referenceName: Joi.string().required(),
      title: Joi.string().required(),
      eventStatus: Joi.string().required(),
      eventType: Joi.string().required(),
      location: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      maxParticipants: Joi.number().required(),
      participants: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        avatar: Joi.string().allow(null, ''),
      })).required(),
      participantIds: Joi.array().items(Joi.string()).required(),
      image: Joi.string().allow(null, ''),
      desc: Joi.string().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { referenceName, title, eventType, eventStatus, location, maxParticipants, participants, participantIds, image, desc } = data;
    const referenceRef = db.collection("references").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const referenceDoc = await referenceRef.get();
    if (!referenceDoc.exists) {
      return res.status(404).json({ error: "Reference not found" });
    }

    if (referenceDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this reference" });
    }

    await referenceRef.update({
      referenceName: referenceName,
      title: title,
      eventType: eventType,
      eventStatus: eventStatus,
      location: location,
      maxParticipants: maxParticipants,
      participants: participants,
      participantIds: participantIds,
      image: image,
      desc: desc,
      updateAt: new Date().getTime(),
    });
    res.status(200).json({ message: "Reference updated successfully", referenceId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error updating reference",
      message: error.message
    });
  }
});

router.delete("/reference/delete", authenticateToken, async (req, res) => {
  const { id } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const referenceRef = db.collection("references").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const referenceDoc = await referenceRef.get();
    if (!referenceDoc.exists) {
      return res.status(404).json({ error: "Reference not found" });
    }

    if (referenceDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this reference" });
    }

    await referenceRef.delete();
    res.status(200).json({ message: "Reference deleted successfully", referenceId: id });
  } catch (error) {
    res.status(500).json({ error: "Error deleting reference", message: error.message });
  }
});

module.exports = router;
