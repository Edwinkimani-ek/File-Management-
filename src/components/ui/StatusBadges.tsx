import { Badge, type BadgeTone } from '@/components/ui/Badge';
import {
  EVENT_STATUS_LABELS, FEE_NOTE_STATUS_LABELS, MATTER_STATUS_LABELS,
} from '@/lib/labels';
import type { DiaryEventStatus, FeeNoteStatus, MatterStatus } from '@/lib/types';

const MATTER_TONES: Record<MatterStatus, BadgeTone> = {
  active: 'green',
  dormant: 'amber',
  closed: 'neutral',
};

const FEE_NOTE_TONES: Record<FeeNoteStatus, BadgeTone> = {
  draft: 'neutral',
  approved: 'blue',
  sent: 'amber',
  partially_paid: 'amber',
  paid: 'green',
};

const EVENT_TONES: Record<DiaryEventStatus, BadgeTone> = {
  upcoming: 'blue',
  done: 'green',
  adjourned: 'amber',
};

export const MatterStatusBadge = ({ status }: { status: MatterStatus }) => (
  <Badge tone={MATTER_TONES[status]}>{MATTER_STATUS_LABELS[status]}</Badge>
);

export const FeeNoteStatusBadge = ({ status }: { status: FeeNoteStatus }) => (
  <Badge tone={FEE_NOTE_TONES[status]}>{FEE_NOTE_STATUS_LABELS[status]}</Badge>
);

export const EventStatusBadge = ({ status }: { status: DiaryEventStatus }) => (
  <Badge tone={EVENT_TONES[status]}>{EVENT_STATUS_LABELS[status]}</Badge>
);
