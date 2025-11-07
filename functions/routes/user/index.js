const express = require("express");
const router = new express.Router();

router.use(require("./chat"));
router.use(require("./pastEvent"));
router.use(require("./nowEvent"));
router.use(require("./futureEvent"));
router.use(require("./travelPlan"));
router.use(require("./reference"));
router.use(require("./profile"));
router.use(require("./location"));

module.exports = router;
