import {
  normalizeApifyFacebookItem,
  type NormalizedFacebookPost,
} from "./apifyAdapter";
import {
  matchSourceForApifyItem,
  type MatchableFacebookSource,
} from "./sourceMatch";

export interface CollectedFacebookSource extends MatchableFacebookSource {
  market: string;
}

export function normalizeCollectedFacebookItems(
  items: unknown[],
  sources: CollectedFacebookSource[],
): NormalizedFacebookPost[] {
  const output: NormalizedFacebookPost[] = [];

  for (const item of items) {
    const source = matchSourceForApifyItem(item, sources);
    if (!source) continue;

    output.push(
      normalizeApifyFacebookItem(item, {
        sourceId: source.id,
        market: source.market,
      }),
    );
  }

  return output;
}
