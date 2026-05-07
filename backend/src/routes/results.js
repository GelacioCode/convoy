import { Router } from 'express';
import { param } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { getResults, getReplay } from '../services/resultsService.js';

const router = Router();

router.get(
  '/:id/results',
  param('id').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const data = await getResults(req.params.id);
    res.json(data);
  })
);

router.get(
  '/:id/replay',
  param('id').isUUID(),
  validate,
  asyncHandler(async (req, res) => {
    const data = await getReplay(req.params.id);
    res.json(data);
  })
);

export default router;
