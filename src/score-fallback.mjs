/** Keep device history as the authoritative fallback, never a stale shared cache. */
export function deviceFallback(readLocal){
 return {scores:readLocal(),notice:'Online scores are unavailable. Showing This device scores; pending online submissions will retry.'};
}
