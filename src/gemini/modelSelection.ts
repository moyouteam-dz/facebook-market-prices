type FetchLike = typeof fetch;
interface Model { name?: string; supportedGenerationMethods?: string[] }
export async function selectGeminiGenerateContentModel(apiKey:string,fetchImpl:FetchLike=fetch):Promise<string>{
 const response=await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models",{headers:{"x-goog-api-key":apiKey.trim()}});
 if(!response.ok) throw new Error("gemini_models_http_"+response.status);
 const payload=await response.json() as {models?:Model[]};
 const names=(payload.models??[]).filter(m=>m.supportedGenerationMethods?.includes("generateContent")).map(m=>(m.name??"").replace(/^models\//,"")).filter(n=>/gemini.*flash/i.test(n));
 const stable=names.filter(n=>!/(preview|exp|live)/i.test(n));
 const candidates=stable.length?stable:names;
 if(!candidates.length) throw new Error("gemini_no_generate_model");
 return candidates.sort((x,y)=>y.localeCompare(x,undefined,{numeric:true}))[0];
}
