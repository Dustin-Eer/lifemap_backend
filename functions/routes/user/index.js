const express = require("express");
const router = new express.Router();

router.use(require("./chat"));
router.use(require("./pastEvent"));
router.use(require("./nowEvent"));
router.use(require("./futureEvent"));
router.use(require("./travelPlan"));


module.exports = router;
