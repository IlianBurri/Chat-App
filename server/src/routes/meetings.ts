import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/http-error';
import {
  cancelMeeting,
  createMeeting,
  listMeetings,
  MAX_MEETING_MS,
  requireMeetingAccess,
  respondToMeeting,
  RESPONSES,
  toMeetingDto,
  updateMeeting,
} from '../lib/meetings';
import { currentUserId } from '../middleware/auth';

export const meetingsRouter = Router();

const id = z.string().min(1).max(40);
const date = z.coerce.date();

/** The calendar asks for one visible range at a time (a month view spans at most six weeks). */
meetingsRouter.get('/', async (req, res) => {
  const { from, to } = z.object({ from: date, to: date }).parse(req.query);
  if (to <= from || to.getTime() - from.getTime() > 7 * MAX_MEETING_MS) throw new HttpError(400, 'validation', 'Invalid range');
  res.json({ meetings: await listMeetings(currentUserId(req), from, to) });
});

meetingsRouter.get('/:meetingId', async (req, res) => {
  const meeting = await requireMeetingAccess(req.params.meetingId, currentUserId(req));
  res.json({ meeting: toMeetingDto(meeting) });
});

const meetingInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5_000).optional(),
  start: date,
  end: date,
  participantIds: z.array(id).max(100),
});

meetingsRouter.post('/', async (req, res) => {
  const input = meetingInput.extend({ chatId: id.optional(), isInstant: z.boolean().optional() }).parse(req.body);
  res.status(201).json({ meeting: await createMeeting(currentUserId(req), input) });
});

meetingsRouter.patch('/:meetingId', async (req, res) => {
  const input = meetingInput.parse(req.body);
  res.json({ meeting: await updateMeeting(req.params.meetingId, currentUserId(req), input) });
});

meetingsRouter.post('/:meetingId/cancel', async (req, res) => {
  res.json({ meeting: await cancelMeeting(req.params.meetingId, currentUserId(req)) });
});

meetingsRouter.post('/:meetingId/respond', async (req, res) => {
  const { response } = z.object({ response: z.enum(RESPONSES) }).parse(req.body);
  res.json({ meeting: await respondToMeeting(req.params.meetingId, currentUserId(req), response) });
});
