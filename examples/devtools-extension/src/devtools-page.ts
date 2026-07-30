declare const chrome:
  | {
      devtools?: {
        panels?: {
          create(
            title: string,
            iconPath: string,
            pagePath: string,
            callback?: (panel: unknown) => void,
          ): void;
        };
      };
    }
  | undefined;

if (typeof chrome !== "undefined") {
  chrome.devtools?.panels?.create("Solace", "", "panel.html");
}
