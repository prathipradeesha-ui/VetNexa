import type { HealthRecordType } from '@vetnexa/shared';
import { Bandage, Pill, Scissors, ShieldAlert, Stethoscope, Syringe } from 'lucide-react';

const icons = {
  VACCINATION: Syringe,
  TREATMENT: Bandage,
  CHECKUP: Stethoscope,
  MEDICATION: Pill,
  ALLERGY: ShieldAlert,
  SURGERY: Scissors,
};

/** Coloured circle with an icon for each kind of health record. */
export function RecordTypeIcon({ type, size = 18 }: { type: HealthRecordType; size?: number }) {
  const Icon = icons[type];
  return (
    <span className={`record-icon record-icon--${type.toLowerCase()}`} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}
