import { validationResult } from 'express-validator';

export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const err = new Error('validation_failed');
  err.status = 400;
  err.code = 'validation_failed';
  err.details = result.array();
  next(err);
}
