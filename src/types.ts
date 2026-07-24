export interface Exercise {
  id: string;
  name: string;
  createdAt: string;
}

export interface Entry {
  id: string;
  exerciseId: string;
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
  reps: number;
  note?: string;
  createdAt: string;
}

export interface RepRecord {
  reps: number;
  weightKg: number;
  entryId: string;
  date: string;
}
