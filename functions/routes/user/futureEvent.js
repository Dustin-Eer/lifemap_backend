const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const { generateId, authenticateToken, decodeToken } = require("../../utils");

router.post("/futureEvent/create", authenticateToken, async (req, res) => {
  const { data } = req.body;

  const schema = Joi.object({
    data: Joi.object({
      title: Joi.string().required(),
      images: Joi.array().items(Joi.string().allow(null, '')).optional(),
      desc: Joi.string().required(),
      eventType: Joi.string().required(),
      locationImage: Joi.string().allow(null, ''),
      location: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      operationTime: Joi.string().allow("").optional(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, images, desc, eventType, locationImage, location, operationTime } = data;

    const eventId = await generateId({ collection: "futureEvents", idPrefix: "FE", length: 12 });
    const eventRef = db.collection("futureEvents").doc(eventId);
    const ownerId = decodeToken(req.get("Authorization")).id;

    await eventRef.set({
      id: eventId,
      title: title,
      eventType: eventType,
      ownerId: ownerId,
      locationImage: locationImage,
      location: location,
      operationTime: operationTime,
      images: images,
      desc: desc,
    });
    res.status(200).json({ message: "Event created successfully", eventId: eventId });
  } catch (error) {
    res.status(500).json({
      error: "Error creating event",
      message: error.message
    });
  }
});

router.post("/futureEvent/update", authenticateToken, async (req, res) => {
  const { id, data } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
    data: Joi.object({
      title: Joi.string().required(),
      images: Joi.array().items(Joi.string().allow(null, '')).optional(),
      desc: Joi.string().required(),
      eventType: Joi.string().required(),
      locationImage: Joi.string().allow(null, ''),
      location: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      operationTime: Joi.string().allow("").optional(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, images, desc, eventType, locationImage, location, operationTime } = data;
    const eventRef = db.collection("futureEvents").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (eventDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this event" });
    }

    await eventRef.update({
      title: title,
      eventType: eventType,
      locationImage: locationImage,
      location: location,
      operationTime: operationTime,
      images: images,
      desc: desc,
    });
    res.status(200).json({ message: "Event updated successfully", eventId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error updating event",
      message: error.message
    });
  }
});

router.delete("/futureEvent/delete", authenticateToken, async (req, res) => {
  const { id } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const eventRef = db.collection("futureEvents").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (eventDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this event" });
    }

    // send notification to all participant
    await eventRef.delete();
    res.status(200).json({ message: "Event deleted successfully", eventId: id });
  } catch (error) {
    res.status(500).json({ error: "Error deleting event", message: error.message });
  }
});

module.exports = router;
