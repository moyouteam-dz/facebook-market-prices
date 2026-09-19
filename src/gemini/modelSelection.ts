type FetchLike = typeof fetch;
interface Model { name?: string; supportedGenerationMethods?: string[] }

function rankModel(name: string): number {
  const lower = name.toLowerCase();
  if (/flash-lite/.test(lower) && !/(preview|exp|live)/.test(lower)) return 0;
  if (/flash-lite/.test(lower)) return 1;
  if (/flash/.test(lower) && !/(preview|exp|live)/.test(lower)) return 2;
  return 3;
}

export async function listGeminiGenerateContentModels(apiKey:string,fetchImpl:FetchLike=fetch):Promise<string[]>{
 const response=await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models",{headers:{"x-goog-api-key":apiKey.trim()}});
 if(!response.ok) throw new Error("gemini_models_http_"+response.status);
 const payload=await response.json() as {models?:Model[]};
 return (payload.models??[])
  .filter(m=>m.supportedGenerationMethods?.includes("generateContent"))
  .map(m=>(m.name??"").replace(/^models\//,""))
  .filter(n=>/gemini.*flash/i.test(n))
  .sort((a,b)=>rankModel(a)-rankModel(b) || b.localeCompare(a,undefined,{numeric:true}));
}

export async function selectGeminiGenerateContentModel(apiKey:string,fetchImpl:FetchLike=fetch):Promise<string>{
 const candidates=await listGeminiGenerateContentModels(apiKey,fetchImpl);
 if(!candidates.length) throw new Error("gemini_no_generate_model");
 return candidates[0]!;
}
