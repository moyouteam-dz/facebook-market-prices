import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";
import { db } from "../db/database";
import {
  saveReviewedCandidates,
  type EditableReviewCandidate,
  type ReviewSaveSummary,
} from "./saveReview";

export interface ReviewSession {
  runId: string;
  candidates: EditableReviewCandidate[];
}

type SaveHandler = (
  runId: string,
  candidates: EditableReviewCandidate[],
) => Promise<ReviewSaveSummary>;

interface ReviewSessionContextValue {
  session: ReviewSession | null;
  setSession: (session: ReviewSession | null) => void;
  updateCandidate: (
    candidateId: string,
    patch: Partial<EditableReviewCandidate>,
  ) => void;
  save: () => Promise<ReviewSaveSummary>;
}

const ReviewSessionContext =
  createContext<ReviewSessionContextValue | null>(null);

export interface ReviewSessionProviderProps extends PropsWithChildren {
  initialSession?: ReviewSession | null;
  saveHandler?: SaveHandler;
}

export function ReviewSessionProvider({
  children,
  initialSession = null,
  saveHandler = (runId, candidates) =>
    saveReviewedCandidates(db, runId, candidates),
}: ReviewSessionProviderProps) {
  const [session, setSession] = useState<ReviewSession | null>(initialSession);

  const value = useMemo<ReviewSessionContextValue>(
    () => ({
      session,
      setSession,
      updateCandidate(candidateId, patch) {
        setSession((current) => {
          if (!current) return current;
          return {
            ...current,
            candidates: current.candidates.map((candidate) =>
              candidate.id === candidateId
                ? { ...candidate, ...patch }
                : candidate,
            ),
          };
        });
      },
      async save() {
        if (!session) {
          return { saved: 0, rejected: 0, duplicates: 0 };
        }

        const summary = await saveHandler(session.runId, session.candidates);
        setSession(null);
        return summary;
      },
    }),
    [saveHandler, session],
  );

  return (
    <ReviewSessionContext.Provider value={value}>
      {children}
    </ReviewSessionContext.Provider>
  );
}

export function useReviewSession() {
  const value = useContext(ReviewSessionContext);
  if (!value) {
    throw new Error("ReviewSessionProvider is missing");
  }
  return value;
}
