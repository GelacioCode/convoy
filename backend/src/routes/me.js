import { Router } from 'express';
import { body } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listMyTrips, claimGuestParticipants } from '../services/userService.js';

const router = Router();

router.get(
  '/trips',
  requireAuth,
  asyncHandler(async (req, res) => {
    const trips = await listMyTrips(req.user.id);
    res.json({ trips });
  })
);

router.post(
  '/claim-trips',
  requireAuth,
  body('participantIds').isArray({ min: 1, max: 100 }),
  body('participantIds.*').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const updated = await claimGuestParticipants(
      req.user.id,
      req.body.participantIds
    );
    res.json({ updated });
  })
);

export default router;
