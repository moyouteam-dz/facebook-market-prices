export interface FacebookActorInput {
  captionText: false;
  resultsLimit: number;
  onlyPostsNewerThan: string;
  startUrls: Array<{ url: string }>;
}

export function buildFacebookActorInput(pageUrls: string[]): FacebookActorInput {
  const uniqueUrls = [...new Set(pageUrls.map((url) => url.trim()).filter(Boolean))];

  return {
    captionText: false,
    resultsLimit: 5,
    onlyPostsNewerThan: "7 days",
    startUrls: uniqueUrls.map((url) => ({ url })),
  };
}
