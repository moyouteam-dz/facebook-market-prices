export function classifyOcrError(error:unknown):string{
 const message=error instanceof Error?error.message:"";
 if(/dynamically imported module|import.*module/i.test(message)) return "ocr_module_load_failed";
 if(/model|\.onnx/i.test(message)&&/fetch|load|download|404|403/i.test(message)) return "ocr_model_load_failed";
 if(/backend|wasm/i.test(message)) return "ocr_backend_failed";
 return "ocr_runtime_failed";
}
