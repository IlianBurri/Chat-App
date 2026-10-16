import { Router } from 'express';
import { callHistory } from '../lib/calls';
import { currentUserId } from '../middleware/auth';
import { activeCallsFor } from '../socket/calls';

export const callsRouter = Router();

/** Call history for the Calls app. */
callsRouter.get('/', async (req, res) => {
  res.json({ calls: await callHistory(currentUserId(req)) });
});

/** Calls running right now that the user may join ("Join" banners). */
callsRouter.get('/active', async (req, res) => {
  res.json({ calls: await activeCallsFor(currentUserId(req)) });
});
