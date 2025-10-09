const express = require("express");
const router = new express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const Joi = require("joi");
const { generateId, authenticateToken, decodeToken } = require("../../utils");

router.post("/travelPlan/create", authenticateToken, async (req, res) => {
  const { owner, data } = req.body;

  const schema = Joi.object({
    owner: Joi.object({
      name: Joi.string().required(),
      avatar: Joi.string().allow(null),
    }).required(),
    data: Joi.object({
      title: Joi.string().required(),
      startDate: Joi.number().required(),
      endDate: Joi.number().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title } = data;
    const startDate = new Date(data.startDate).setHours(0, 0, 0, 0);
    const endDate = new Date(data.endDate).setHours(0, 0, 0, 0);
    const eventId = await generateId({ collection: "travelPlans", idPrefix: "TP"});
    const eventRef = db.collection("travelPlans").doc(eventId);
    const ownerId = decodeToken(req.get("Authorization")).id;
    const durationInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const dailyPlans = [];
    for (let i = 0; i < durationInDays; i++) {
      const dailyPlanId = await generateId({ collection: "dailyPlans", idPrefix: "DP", length: 12 });
      const currentDate = new Date(startDate + i * 24 * 60 * 60 * 1000);
      dailyPlans.push({
        id: dailyPlanId,
        date: currentDate.getTime(),
        scheduleItems: [],
      });
    }

    const participants = [{
      id: ownerId,
      name: owner.name,
      avatar: owner.avatar,
    }];
    const participantIds = participants.map((p) => p.id);

    await eventRef.set({
      id: eventId,
      ownerId: ownerId,
      title: title,
      startDate: startDate,
      endDate: endDate,
      participants: participants,
      participantIds: participantIds,
      dailyPlans: dailyPlans,
    });
    res.status(200).json({ message: "Travel plan created successfully", eventId: eventId });
  } catch (error) {
    res.status(500).json({
      error: "Error creating travel plan",
      message: error.message
    });
  }
});

router.post("/travelPlan/update", authenticateToken, async (req, res) => {
  const { id, data } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
    data: Joi.object({
      title: Joi.string().required(),
      startDate: Joi.number().required(),
      endDate: Joi.number().required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { title, startDate, endDate } = data;

    const eventRef = db.collection("travelPlans").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Travel plan not found" });
    }

    if (eventDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this travel plan" });
    }

    const newStartDate = new Date(startDate).setHours(0, 0, 0, 0);
    const newEndDate = new Date(endDate).setHours(0, 0, 0, 0);
    const currentStartDate = new Date(eventDoc.data().startDate).setHours(0, 0, 0, 0);
    const currentEndDate = new Date(eventDoc.data().endDate).setHours(0, 0, 0, 0);

    const currentDayList = [];
    for (let d = new Date(currentStartDate); d <= new Date(currentEndDate); d.setDate(d.getDate() + 1)) {
      currentDayList.push(d.getTime());
    }

    const newDayList = [];
    for (let d = new Date(newStartDate); d <= new Date(newEndDate); d.setDate(d.getDate() + 1)) {
      newDayList.push(d.getTime());
    }

    const daysToAdd = newDayList.filter(t => !currentDayList.includes(t));
    const daysToRemove = currentDayList.filter(t => !newDayList.includes(t));
    let newDailyPlans = eventDoc.data().dailyPlans;

    if (daysToRemove.length > 0) {
      newDailyPlans = eventDoc.data().dailyPlans.filter(dp => !daysToRemove.includes(dp.date));
    }

    if (daysToAdd.length > 0) {
      for (const dayTimestamp of daysToAdd) {
        const dailyPlanId = await generateId({ collection: "dailyPlans", idPrefix: "DP", length: 12 });
        newDailyPlans.push({
          id: dailyPlanId,
          date: dayTimestamp,
          scheduleItems: [],
        });
      }
    }

    await eventRef.update({
      title: title,
      startDate: newStartDate,
      endDate: newEndDate,
      dailyPlans: newDailyPlans,
    });
    res.status(200).json({ message: "Travel plan updated successfully", eventId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error updating travel plan",
      message: error.message
    });
  }
});

router.delete("/travelPlan/delete", authenticateToken, async (req, res) => {
  const { id } = req.body;

  const schema = Joi.object({
    id: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const eventRef = db.collection("travelPlans").doc(id);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Travel plan not found" });
    }

    if (eventDoc.data().ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden: You are not the owner of this travel plan" });
    }

    await eventRef.delete();
    res.status(200).json({ message: "Travel plan deleted successfully", eventId: id });
  } catch (error) {
    res.status(500).json({ error: "Error deleting travel plan", message: error.message });
  }
});

router.post("/travelPlan/dailyPlan/scheduleItem/create", authenticateToken, async (req, res) => {
  const { travelPlanId, dailyPlanId, data } = req.body;

  const schema = Joi.object({
    travelPlanId: Joi.string().required(),
    dailyPlanId: Joi.string().required(),
    data: Joi.object({
      scheduleItem: Joi.object({
        title: Joi.string().required(),
        assignedBy: Joi.string().required(),
        time: Joi.object({
          hour: Joi.number().required(),
          minute: Joi.number().required(),
        }).required(),
      }).required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { scheduleItem } = data;
    const eventRef = db.collection("travelPlans").doc(travelPlanId);
    const userId = decodeToken(req.get("Authorization")).id;
    scheduleItem.id = await generateId({ collection: "scheduleItems", idPrefix: "SI", length: 14 });

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Travel plan not found" });
    }

    if (eventDoc.data().participants.find((p) => p.id === userId) === undefined) {
      return res.status(403).json({ error: "Forbidden: You have no right to add daily plan" });
    }

    const selectedDailyPlan = eventDoc.data().dailyPlans.find((plan) => plan.id === dailyPlanId);
    if (!selectedDailyPlan) {
      return res.status(404).json({ error: "Daily plan not found" });
    }

    selectedDailyPlan.scheduleItems.push(scheduleItem);

    const dailyPlans = eventDoc.data().dailyPlans.map((plan) => {
      if (plan.id === dailyPlanId) {
        console.log(selectedDailyPlan);
        return selectedDailyPlan;
      }
      return plan;
    });

    await eventRef.update({
      dailyPlans: dailyPlans,
    });
    res.status(200).json({ dailyPlan: selectedDailyPlan, message: "Schedule added successfully", eventId: travelPlanId });
  } catch (error) {
    res.status(500).json({
      error: "Error adding schedule",
      message: error.message
    });
  }
});

router.post("/travelPlan/dailyPlan/scheduleItem/update", authenticateToken, async (req, res) => {
  const { travelPlanId, dailyPlanId, scheduleItemId, data } = req.body;

  const schema = Joi.object({
    travelPlanId: Joi.string().required(),
    dailyPlanId: Joi.string().required(),
    scheduleItemId: Joi.string().required(),
    data: Joi.object({
      scheduleItem: Joi.object({
        title: Joi.string().required(),
        assignedBy: Joi.string().required(),
        time: Joi.object({
          hour: Joi.number().required(),
          minute: Joi.number().required(),
        }).required(),
      }).required(),
    }).required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const { scheduleItem } = data;
    const eventRef = db.collection("travelPlans").doc(travelPlanId);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Travel plan not found" });
    }

    if (eventDoc.data().participants.find((p) => p.id === userId) === undefined) {
      return res.status(403).json({ error: "Forbidden: You have no right to add daily plan" });
    }

    const selectedDailyPlan = eventDoc.data().dailyPlans.find((plan) => plan.id === dailyPlanId);
    if (!selectedDailyPlan) {
      return res.status(404).json({ error: "Daily plan not found" });
    }

    const selectedScheduleItem = selectedDailyPlan.scheduleItems.find((item) => item.id === scheduleItemId);
    if (!selectedScheduleItem) {
      return res.status(404).json({ error: "Schedule item not found" });
    }

    selectedScheduleItem.title = scheduleItem.title;
    selectedScheduleItem.assignedBy = scheduleItem.assignedBy;
    selectedScheduleItem.time = scheduleItem.time;

    const dailyPlans = eventDoc.data().dailyPlans.map((plan) => {
      if (plan.id === dailyPlanId) {
        return selectedDailyPlan;
      }
      return plan;
    });

    await eventRef.update({
      dailyPlans: dailyPlans,
    });
    res.status(200).json({ dailyPlan: selectedDailyPlan, message: "Schedule edited successfully", eventId: travelPlanId });
  } catch (error) {
    res.status(500).json({
      error: "Error editing schedule",
      message: error.message
    });
  }
});

router.delete("/travelPlan/dailyPlan/scheduleItem/delete", authenticateToken, async (req, res) => {
  const { travelPlanId, dailyPlanId, scheduleItemId } = req.body;

  const schema = Joi.object({
    travelPlanId: Joi.string().required(),
    dailyPlanId: Joi.string().required(),
    scheduleItemId: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const eventRef = db.collection("travelPlans").doc(travelPlanId);
    const userId = decodeToken(req.get("Authorization")).id;

    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Travel plan not found" });
    }

    if (eventDoc.data().participants.find((p) => p.id === userId) === undefined) {
      return res.status(403).json({ error: "Forbidden: You have no right to add daily plan" });
    }

    const selectedDailyPlan = eventDoc.data().dailyPlans.find((plan) => plan.id === dailyPlanId);
    if (!selectedDailyPlan) {
      return res.status(404).json({ error: "Daily plan not found" });
    }

    const selectedScheduleItem = selectedDailyPlan.scheduleItems.find((item) => item.id === scheduleItemId);
    if (!selectedScheduleItem) {
      return res.status(404).json({ error: "Schedule item not found" });
    }

    selectedDailyPlan.scheduleItems = selectedDailyPlan.scheduleItems.filter((item) => item.id !== scheduleItemId);

    const dailyPlans = eventDoc.data().dailyPlans.map((plan) => {
      if (plan.id === dailyPlanId) {
        return selectedDailyPlan;
      }
      return plan;
    });

    await eventRef.update({
      dailyPlans: dailyPlans,
    });
    res.status(200).json({ dailyPlan: selectedDailyPlan, message: "Schedule deleted successfully", eventId: travelPlanId });
  } catch (error) {
    res.status(500).json({ error: "Error deleting schedule", message: error.message });
  }
});

module.exports = router;