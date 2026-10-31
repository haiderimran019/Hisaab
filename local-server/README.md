# Free Qwen3-1.7B prototype

The chosen runtime is Ollama, model ID `qwen3:1.7b`. No paid AI API is used.
Install Ollama separately and run `ollama pull qwen3:1.7b` first. The model is about 1.4 GB. Weights stay outside Git; this gateway is not a public host.

Run `npm run dev:assistant` from the repository. It starts/reuses localhost Ollama,
a loopback-only gateway and Vite at http://127.0.0.1:5174. Stop with Ctrl-C.
To reinstall weights on a different machine, install Ollama and run the model pull
with the same OLLAMA_MODELS directory configured for the running Ollama service.
The launcher never downloads a model or starts a public tunnel automatically.

The gateway sends the current question and up to six shortened recent messages
to localhost Ollama. It logs no message content. It accepts only the fixed model
and bounded JSON; callers cannot choose an upstream host, system prompt or tool.
The model returns a checked intent/definition ID. Its prose, figures, codes and
write requests are discarded. Calculations and legal definitions are rendered
from application functions and the versioned source register. Unknown codes stay
unknown. `think:false` avoids exposing private reasoning; the UI shows a real
request-in-progress spinner instead. Never touch the network skips the gateway.

This intentionally bounded first integration is not a general conversational
financial adviser. Broader phrasing and reviewed-source retrieval need additional evaluations. Financial write/undo tools are implemented in the app, outside the model. No Qwen weights are updated by chatting.
Per-user context comes from encrypted chats and confirmed, editable memory.

Production builds have no hosted model endpoint enabled. They offer a separate optional on-device WebLLM worker download through Settings. A Mac running this process is
not an always-available production server. Public hosting, authenticated user
isolation, encrypted sync, operational limits and recovery must be set up before
other people's financial data is sent to a hosted backend. Model weights are free;
computer resources and public hosting are not guaranteed free.
