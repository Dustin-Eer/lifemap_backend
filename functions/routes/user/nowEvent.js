const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const { generateId, authenticateToken, decodeToken } = require("../../utils");

router.post("/nowEvent/create", authenticateToken, async (req, res) => {
  const { data } = req.body;

  const schema = Joi.object({
    data: Joi.object({
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
      startDate: Joi.number().required(),
      endDate: Joi.number().required(),
      maxParticipants: Joi.number().required(),
      participants: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        avatar: Joi.string().allow(null)
      })).required(),
      images: Joi.array().items(Joi.string()).optional(),
      desc: Joi.string().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, eventType, eventStatus, location, startDate, endDate, maxParticipants, participants, images, desc } = data;
    const participantIds = participants.map((p) => p.id);
    const eventId = await generateId({ collection: "nowEvents", idPrefix: "NE", length: 12 });
    const eventRef = db.collection("nowEvents").doc(eventId);
    const ownerId = decodeToken(req.get("Authorization")).id;

    await eventRef.set({
      id: eventId,
      eventStatus: eventStatus,
      title: title,
      eventType: eventType,
      ownerId: ownerId,
      location: location,
      startDate: startDate,
      endDate: endDate,
      maxParticipants: maxParticipants,
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

router.post("/nowEvent/update", authenticateToken, async (req, res) => {
  const { id, data } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
    data: Joi.object({
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
      startDate: Joi.number().required(),
      endDate: Joi.number().required(),
      maxParticipants: Joi.number().required(),
      participants: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        avatar: Joi.string().allow(null)
      })).required(),
      images: Joi.array().items(Joi.string()).optional(),
      desc: Joi.string().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, eventType, eventStatus, location, startDate, endDate, maxParticipants, participants, images, desc } = data;
    const participantIds = participants.map((p) => p.id);
    const eventRef = db.collection("nowEvents").doc(id);
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
      eventStatus: eventStatus,
      location: location,
      startDate: startDate,
      endDate: endDate,
      maxParticipants: maxParticipants,
      participants: participants,
      participantIds: participantIds,
      images: images,
      desc: desc,
      createAt: new Date().getTime(),
    });
    res.status(200).json({ message: "Event updated successfully", eventId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error updating event",
      message: error.message
    });
  }
});

router.delete("/nowEvent/delete", authenticateToken, async (req, res) => {
  const { id } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const eventRef = db.collection("nowEvents").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (eventDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this event" });
    }

    await eventRef.delete();
    res.status(200).json({ message: "Event deleted successfully", eventId: id });
  } catch (error) {
    res.status(500).json({ error: "Error deleting event", message: error.message });
  }
});


module.exports = router;
