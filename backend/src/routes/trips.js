import { Router } from 'express';
import { body, param } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createTrip,
  deleteTrip,
  getTripByShareToken,
  setTripStatus,
} from '../services/tripService.js';
import { listParticipants } from '../services/participantService.js';

const router = Router();

const TRANSPORT_MODES = ['driving', 'cycling', 'walking', 'motorcycling', 'running'];
const TRIP_STATUSES = ['active', 'finished'];
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

router.post(
  '/',
  optionalAuth,
  body('destinationName').isString().trim().notEmpty(),
  body('destinationLat').isFloat({ min: -90, max: 90 }),
  body('destinationLng').isFloat({ min: -180, max: 180 }),
  body('transportMode').optional().isIn(TRANSPORT_MODES),
  body('avoidTolls').optional().isBoolean(),
  body('routeData').optional().isObject(),
  body('host.name').isString().trim().notEmpty(),
  body('host.color').matches(HEX_COLOR_RE),
  validate,
  asyncHandler(async (req, res) => {
    // host_id always comes from the verified session (or null for guests),
    // never from client-supplied input — that would let anyone claim a trip
    // as another user.
    const result = await createTrip({
      ...req.body,
      hostId: req.user?.id ?? null,
    });
    res.status(201).json(result);
  })
);

router.get(
  '/:shareToken',
  param('shareToken').isString().isLength({ min: 4, max: 32 }),
  validate,
  asyncHandler(async (req, res) => {
    const trip = await getTripByShareToken(req.params.shareToken);
    if (!trip) return res.status(404).json({ error: 'trip_not_found' });
    res.json({ trip });
  })
);

router.get(
  '/:id/participants',
  param('id').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const participants = await listParticipants(req.params.id);
    res.json({ participants });
  })
);

router.patch(
  '/:id/status',
  param('id').isUUID(),
  body('status').isIn(TRIP_STATUSES),
  validate,
  asyncHandler(async (req, res) => {
    const trip = await setTripStatus(req.params.id, req.body.status);
    res.json({ trip });
  })
);

router.delete(
  '/:id',
  requireAuth,
  param('id').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const result = await deleteTrip(req.params.id, req.user.id);
    res.json(result);
  })
);

export default router;
