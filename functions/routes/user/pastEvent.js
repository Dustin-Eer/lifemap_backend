const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const { generateId, authenticateToken, decodeToken } = require("../../utils");

router.post("/pastEvent/create", authenticateToken, async (req, res) => {
  const { owner, data } = req.body;

  const schema = Joi.object({
    owner: Joi.object({
      name: Joi.string().required(),
      avatar: Joi.string().allow(null),
    }).required(),
    data: Joi.object({
      title: Joi.string().required(),
      images: Joi.array().items(Joi.string().allow(null, '')).optional(),
      desc: Joi.string().required(),
      eventType: Joi.string().required(),
      location: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      startDate: Joi.number().required(),
      endDate: Joi.number().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, images, desc, eventType, location, startDate, endDate } = data;

    const eventId = await generateId({ collection: "pastEvents", idPrefix: "PE", length: 12 });
    const eventRef = db.collection("pastEvents").doc(eventId);
    const ownerId = decodeToken(req.get("Authorization")).id;
    const participants = [{
      id: ownerId,
      name: owner.name,
      avatar: owner.avatar,
    }];
    const participantIds = participants.map((p) => p.id);

    await eventRef.set({
      id: eventId,
      title: title,
      eventType: eventType,
      ownerId: ownerId,
      location: location,
      startDate: startDate,
      endDate: endDate,
      participants: participants,
      participantIds: participantIds,
      images: images,
      desc: desc,
      createAt: new Date().getTime(),
    });
    res.status(200).json({ message: "Event created successfully", eventId: eventId });
  } catch (error) {
    res.status(500).json({
      error: "Error creating event",
      message: error.message
    });
  }
});

router.post("/pastEvent/update", authenticateToken, async (req, res) => {
  const { id, data } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
    data: Joi.object({
      title: Joi.string().required(),
      eventType: Joi.string().required(),
      location: Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        address: Joi.string().required(),
        lat: Joi.number().required(),
        lng: Joi.number().required(),
      }).required(),
      startDate: Joi.number().required(),
      endDate: Joi.number().required(),
      images: Joi.array().items(Joi.string().allow(null, '')).optional(),
      desc: Joi.string().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, images, desc, eventType, location, startDate, endDate } = data;
    const eventRef = db.collection("pastEvents").doc(id);
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
      location: location,
      startDate: startDate,
      endDate: endDate,
      images: images,
      desc: desc,
      updateAt: new Date().getTime(),
    });
    res.status(200).json({ message: "Event updated successfully", eventId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error updating event",
      message: error.message
    });
  }
});

router.delete("/pastEvent/delete", authenticateToken, async (req, res) => {
  const { id } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const eventRef = db.collection("pastEvents").doc(id);
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
