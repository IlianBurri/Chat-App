import { useComingSoon } from '@/components/ui/ComingSoon';
import i18n from '@/i18n';

/** Entry point for "Join" and "Meet now"; audio/video calls arrive in milestone 7. */
export function joinMeeting() {
  useComingSoon.getState().show(i18n.t('meetings.callFeature'));
}
