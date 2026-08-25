export function boundaryStartMarker(id: number): string {
  return `<!--so:b:${id}-->`;
}

export function boundaryEndMarker(id: number): string {
  return `<!--/so:b:${id}-->`;
}

export function boundaryFailureMarker(id: number, message: string): string {
  return `<!--so:b:${id} failed:${message}-->`;
}

export function replacementScriptMarker(id: number): string {
  return `so:r:${id}`;
}

export function buildReplacementScript(id: number, html: string): string {
  // The payload is a single-quoted JS string: escape backslashes, quotes, line
  // terminators, and neutralize closing <script> sequences (only those can
  // terminate the payload early; escaping every "</" would corrupt the HTML).
  const payload =
    "'" +
    html
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029")
      .replace(/<\/(script)/gi, "<\\/$1") +
    "'";
  return (
    `<script>(function(){var s=null,e=null;` +
    `var w=document.createTreeWalker(document,NodeFilter.SHOW_COMMENT,null,false);` +
    `while(w.nextNode()){var n=w.currentNode;` +
    `if(n.nodeValue==="so:b:${id}"){s=n}else if(n.nodeValue==="/so:b:${id}"){e=n}}` +
    `if(!s||!e){return}` +
    `var r=document.createRange();r.setStartAfter(s);r.setEndBefore(e);` +
    `var t=document.createElement("template");t.innerHTML=${payload};` +
    `r.deleteContents();r.insertNode(t.content);` +
    `if(s.parentNode){s.parentNode.removeChild(s)}` +
    `if(e.parentNode){e.parentNode.removeChild(e)}})();` +
    `</script>`
  );
}

export interface PendingBoundary {
  id: number;
  ready: Promise<void>;
  error: unknown;
  component: unknown;
}

export function createPendingBoundary(id: number, load: Promise<unknown>): PendingBoundary {
  const boundary: PendingBoundary = {
    id,
    error: null,
    component: null,
    ready: null as never,
  };
  boundary.ready = load.then(
    (component) => {
      boundary.component = component;
    },
    (error) => {
      boundary.error = error;
    },
  );
  return boundary;
}
