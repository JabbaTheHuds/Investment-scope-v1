/** Response shapes of our own /api routes (shared by server and client). */
import type { Breadth, Contributor } from "./derive";
import type { ChartData, DataMeta, Envelope, GlobalStats } from "./types";

export interface GlobalResponse extends Envelope<GlobalStats> {
  analysis: {
    sampleDescription: string;
    breadth: Breadth;
    contributors: { net: number; contributors: Contributor[] };
    sampleMeta: DataMeta;
  } | null;
  analysisError: string | null;
}

export type ChartResponse = Envelope<ChartData & { maxHistoryDays: number | null }>;
