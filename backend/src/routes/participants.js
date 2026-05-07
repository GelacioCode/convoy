import { Router } from 'express';
import { body, param } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { joinTrip, markFinished, setGhost } from '../services/participantService.js';

const router = Router();

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

router.post(
  '/trips/:id/join',
  param('id').isUUID(),
  body('guestName').isString().trim().isLength({ min: 1, max: 40 }),
  body('color').matches(HEX_COLOR_RE),
  body('userId').optional().isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const participant = await joinTrip(req.params.id, req.body);
    res.status(201).json({ participant });
  })
);

router.patch(
  '/participants/:id/finish',
  param('id').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const participant = await markFinished(req.params.id);
    res.json({ participant });
  })
);

router.patch(
  '/participants/:id/ghost',
  param('id').isUUID(),
  body('is_ghost').isBoolean(),
  validate,
  asyncHandler(async (req, res) => {
    const participant = await setGhost(req.params.id, req.body.is_ghost);
    res.json({ participant });
  })
);

export default router;
